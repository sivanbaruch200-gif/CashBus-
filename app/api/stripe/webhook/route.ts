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

        if (!claimId) {
          console.error('invoice.paid: missing claim_id in metadata')
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

        } else if (paymentType === 'opening_fee') {
          await supabase
            .from('claims')
            .update({
              opening_fee_paid: true,
              opening_fee_paid_at: new Date().toISOString(),
              opening_fee_stripe_payment_id: paymentRef,
            })
            .eq('id', claimId)

          await supabase
            .from('payment_requests')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: paymentRef,
            })
            .eq('claim_id', claimId)
            .eq('payment_type', 'opening_fee')
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

      default:
        // Unhandled event type - that's fine
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
