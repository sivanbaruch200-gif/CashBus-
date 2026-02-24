/**
 * Stripe Webhook Handler
 *
 * Handles Stripe events:
 * - invoice.paid → marks commission as paid in DB
 * - invoice.payment_failed → logs failure
 *
 * Setup in Stripe Dashboard:
 *   Webhook URL: https://your-domain.com/api/stripe/webhook
 *   Events: invoice.paid, invoice.payment_failed
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import * as Sentry from '@sentry/nextjs'
import {
  upsertSubscriptionFromStripe,
  cancelSubscription,
  getUserIdByStripeCustomer,
  type Subscription as CashBusSubscription,
} from '@/lib/subscriptionService'

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('Missing RESEND_API_KEY')
  return new Resend(key)
}

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable')
  }
  return new Stripe(key, { apiVersion: '2026-01-28.clover' })
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables')
  }
  return createClient(url, key)
}

// Map Stripe subscription status → our DB status
function mapStripeStatus(stripeStatus: Stripe.Subscription['status']): CashBusSubscription['status'] {
  switch (stripeStatus) {
    case 'active': return 'active'
    case 'trialing': return 'trialing'
    case 'past_due': return 'past_due'
    case 'canceled':
    case 'unpaid':
    case 'paused':
    case 'incomplete':
    case 'incomplete_expired':
      return 'canceled'
    default:
      return 'free'
  }
}

export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET environment variable')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // Read raw body for signature verification
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    Sentry.captureException(err, {
      tags: { route: 'stripe-webhook', failure: 'signature-verification' },
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getSupabase()

  try {
    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const claimId = invoice.metadata?.claim_id
        const paymentType = invoice.metadata?.payment_type
        // Extract payment reference: use invoice ID as the stable reference
        const paymentRef = invoice.id

        // Subscription renewal invoice – no claim_id, but has a subscription field.
        // Handle as redundant fallback in case checkout.session.completed was missed.
        if (!claimId) {
          const stripeSubscriptionId = (invoice as any).subscription as string | undefined
          if (stripeSubscriptionId) {
            try {
              const stripeCustomerId = invoice.customer as string
              const resolvedUserId = await getUserIdByStripeCustomer(supabase, stripeCustomerId)
              if (resolvedUserId) {
                const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId) as any
                await upsertSubscriptionFromStripe(supabase, {
                  stripeSubscriptionId,
                  stripeCustomerId,
                  userId: resolvedUserId,
                  status: mapStripeStatus(stripeSub.status),
                  currentPeriodStart: stripeSub.current_period_start,
                  currentPeriodEnd: stripeSub.current_period_end,
                  cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
                  planAmountAgorot: stripeSub.items?.data?.[0]?.price?.unit_amount ?? 2900,
                  planCurrency: stripeSub.items?.data?.[0]?.price?.currency ?? 'ils',
                })
              }
            } catch (subErr) {
              console.error('invoice.paid: failed to sync subscription status:', subErr)
            }
          }
          break
        }

        if (paymentType === 'commission') {
          await supabase
            .from('claims')
            .update({
              commission_paid: true,
              commission_paid_at: new Date().toISOString(),
              commission_stripe_payment_id: paymentRef,
              commission_stripe_invoice_id: invoice.id,
            })
            .eq('id', claimId)

          await supabase
            .from('payment_requests')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: paymentRef,
              stripe_invoice_id: invoice.id,
            })
            .eq('claim_id', claimId)
            .eq('payment_type', 'commission')

        }

        // Log the event
        const amountPaid = typeof invoice.amount_paid === 'number'
          ? (invoice.amount_paid / 100).toFixed(2)
          : 'unknown'
        await supabase.from('execution_logs').insert({
          claim_id: claimId,
          action_type: 'stripe_invoice_paid',
          description: `Stripe invoice ${invoice.id} paid (${paymentType}). Amount: ${amountPaid} ILS`,
          success: true,
        })

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const claimId = invoice.metadata?.claim_id
        const paymentType = invoice.metadata?.payment_type

        // Alert Sentry on every Stripe payment failure
        Sentry.captureMessage(`Stripe payment failed: invoice ${invoice.id}`, {
          level: 'error',
          tags: {
            route: 'stripe-webhook',
            failure: 'payment-failed',
            payment_type: paymentType || 'unknown',
          },
          extra: {
            invoice_id: invoice.id,
            claim_id: claimId,
            amount_due: invoice.amount_due,
            customer: invoice.customer,
            attempt_count: invoice.attempt_count,
          },
        })

        if (claimId) {
          // Update payment request status
          await supabase
            .from('payment_requests')
            .update({ status: 'failed' })
            .eq('claim_id', claimId)
            .eq('payment_type', paymentType || 'commission')

          await supabase.from('execution_logs').insert({
            claim_id: claimId,
            action_type: 'stripe_payment_failed',
            description: `Stripe invoice ${invoice.id} payment failed (${paymentType})`,
            success: false,
          })
        }

        break
      }

      // -----------------------------------------------
      // Subscription events
      // -----------------------------------------------

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        // Use any cast because Stripe API version 2026-01-28.clover renames some fields
        const subscription = event.data.object as any
        const stripeCustomerId = subscription.customer as string

        // Resolve user_id from metadata or customer lookup
        const resolvedUserId =
          subscription.metadata?.user_id ||
          await getUserIdByStripeCustomer(supabase, stripeCustomerId)

        if (!resolvedUserId) {
          console.error('subscription event: cannot resolve user_id for customer', stripeCustomerId)
          break
        }
        const userId: string = resolvedUserId

        const price = subscription.items?.data?.[0]?.price
        const planAmount = price?.unit_amount ?? 2900
        const planCurrency = price?.currency ?? 'ils'

        await upsertSubscriptionFromStripe(supabase, {
          stripeSubscriptionId: subscription.id,
          stripeCustomerId,
          userId,
          status: mapStripeStatus(subscription.status),
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          planAmountAgorot: planAmount,
          planCurrency,
        })

        await supabase.from('execution_logs').insert({
          action_type: `stripe_subscription_${event.type.split('.')[2]}`,
          description: `Subscription ${subscription.id} → ${subscription.status} for user ${userId}`,
          success: true,
        }) // non-critical log - ignore errors

        break
      }

      case 'customer.subscription.deleted': {
        const subDeleted = event.data.object as any

        await cancelSubscription(supabase, subDeleted.id)

        await supabase.from('execution_logs').insert({
          action_type: 'stripe_subscription_deleted',
          description: `Subscription ${subDeleted.id} canceled/deleted`,
          success: true,
        })

        break
      }

      // Checkout session completed (initial subscription purchase)
      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as any
        if (checkoutSession.mode !== 'subscription') break

        const stripeCustomerId = checkoutSession.customer as string
        const stripeSubscriptionId = checkoutSession.subscription as string
        const userId = checkoutSession.metadata?.user_id

        if (!userId || !stripeSubscriptionId) break

        // Fetch full subscription object to get period details
        const stripe = getStripe()
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId) as any
        const price = stripeSub.items?.data?.[0]?.price
        const periodEndDate = stripeSub.current_period_end
          ? new Date(stripeSub.current_period_end * 1000).toLocaleDateString('he-IL')
          : 'לא ידוע'

        await upsertSubscriptionFromStripe(supabase, {
          stripeSubscriptionId,
          stripeCustomerId,
          userId,
          status: mapStripeStatus(stripeSub.status),
          currentPeriodStart: stripeSub.current_period_start,
          currentPeriodEnd: stripeSub.current_period_end,
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          planAmountAgorot: price?.unit_amount ?? 2900,
          planCurrency: price?.currency ?? 'ils',
        })

        // Send welcome email to new subscriber
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', userId)
          .single()

        if (profile?.email) {
          try {
            const resend = getResend()
            const { data: emailData } = await resend.emails.send({
              from: 'CashBus <noreply@cashbuses.com>',
              replyTo: 'cash.bus200@gmail.com',
              to: [profile.email],
              subject: 'ברוכים הבאים ל-CashBus Pro! המינוי שלך פעיל',
              html: `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;direction:rtl;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:#FF8C00;color:white;padding:30px;border-radius:8px 8px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:28px;font-weight:bold;">CashBus</h1>
      <p style="margin:8px 0 0;font-size:15px;opacity:0.9;">מינוי Pro פעיל</p>
    </div>
    <!-- Body -->
    <div style="background:white;padding:30px;border:1px solid #e2e8f0;border-top:none;">
      <p style="font-size:18px;font-weight:bold;color:#1e293b;">שלום ${profile.full_name || 'משתמש יקר'},</p>
      <p style="font-size:15px;line-height:1.8;color:#374151;">
        המינוי שלך ל-CashBus Pro הופעל בהצלחה! כעת יש לך גישה מלאה לכל הכלים המשפטיים:
      </p>
      <ul style="font-size:15px;line-height:2;color:#374151;">
        <li>יצירת מכתבי דרישה אוטומטיים</li>
        <li>מעקב תביעות ותזכורות אוטומטיות (21 יום)</li>
        <li>כתבי תביעה לבית משפט לתביעות קטנות</li>
        <li>מודל 80/20 - אתה מקבל 80% מהפיצוי</li>
      </ul>
      <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0;font-size:14px;color:#92400E;">
          <strong>תקופת המנוי:</strong> עד ${periodEndDate}<br>
          <strong>מספר מנוי:</strong> ${stripeSubscriptionId.slice(0, 20)}...
        </p>
      </div>
      <p style="font-size:15px;line-height:1.8;color:#374151;">
        מוכן להתחיל? כנס למערכת ותעד את האירוע הבא שלך.
      </p>
      <div style="text-align:center;margin:25px 0;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard"
           style="background:#FF8C00;color:white;padding:14px 30px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:bold;">
          כניסה למערכת
        </a>
      </div>
    </div>
    <!-- Footer -->
    <div style="background:#f8fafc;padding:15px 30px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">CashBus | noreply@cashbuses.com | www.cashbuses.com</p>
    </div>
  </div>
</body>
</html>`,
            })

            // Log the welcome email
            await supabase.from('email_logs').insert({
              message_id: emailData?.id || null,
              from_email: 'noreply@cashbuses.com',
              to_email: profile.email,
              subject: 'ברוכים הבאים ל-CashBus Pro! המינוי שלך פעיל',
              status: 'sent',
              user_id: userId,
              email_type: 'subscription_welcome',
              metadata: { stripe_subscription_id: stripeSubscriptionId },
            })
          } catch (emailErr) {
            // Don't fail the webhook if email fails
            console.error('Failed to send subscription welcome email:', emailErr)
          }
        }

        break
      }

      default:
        // Unhandled event type - that's fine
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    Sentry.captureException(error, {
      tags: { route: 'stripe-webhook', failure: 'handler-error', event_type: event?.type },
    })
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
