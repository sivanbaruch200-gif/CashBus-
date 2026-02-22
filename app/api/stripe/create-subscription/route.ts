/**
 * Create Stripe Checkout Session for 29 NIS/month subscription
 *
 * POST /api/stripe/create-subscription
 * Body: { returnUrl?: string }
 *
 * Returns: { url: string } - redirect to Stripe Checkout
 *
 * Stripe Checkout setup:
 * - Price ID from env: STRIPE_SUBSCRIPTION_PRICE_ID
 * - Customer tied to user via metadata.user_id
 * - success_url and cancel_url go back to /subscription
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, rateLimitResponse, getClientIP, RATE_LIMITS } from '@/lib/rateLimit'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY')
  return new Stripe(key, { apiVersion: '2026-01-28.clover' })
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    // --- Rate limit: IP-level burst guard ---
    const ip = getClientIP(request)
    const ipCheck = rateLimit(`create-sub-ip:${ip}`, RATE_LIMITS.ipBurst)
    if (!ipCheck.success) return rateLimitResponse(ipCheck)

    const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID
    if (!priceId) {
      return NextResponse.json(
        { error: 'Subscription price not configured. Set STRIPE_SUBSCRIPTION_PRICE_ID.' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const returnUrl = body.returnUrl || '/subscription'

    // Authenticate user from cookie session
    const serviceSupabase = getServiceSupabase()
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')

    let userId: string | null = null
    let userEmail: string | null = null

    if (token) {
      const { data: { user } } = await serviceSupabase.auth.getUser(token)
      userId = user?.id ?? null
      userEmail = user?.email ?? null
    }

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // --- Rate limit: per-user (5 sessions per 5 min – prevents duplicate checkout spam) ---
    const userCheck = rateLimit(`create-sub-user:${userId}`, RATE_LIMITS.createSubscription)
    if (!userCheck.success) return rateLimitResponse(userCheck)

    const stripe = getStripe()

    // Check if user already has a Stripe customer ID
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('stripe_customer_id, full_name')
      .eq('id', userId)
      .single()

    let stripeCustomerId = profile?.stripe_customer_id

    // Create Stripe customer if not exists
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userEmail || undefined,
        name: profile?.full_name || undefined,
        metadata: { user_id: userId },
      })
      stripeCustomerId = customer.id

      // Save customer ID to profile
      await serviceSupabase
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', userId)
    }

    // Check if there's already an active subscription
    const { data: existingSub } = await serviceSupabase
      .from('subscriptions')
      .select('status, stripe_subscription_id')
      .eq('user_id', userId)
      .single()

    if (existingSub?.status === 'active' || existingSub?.status === 'trialing') {
      // Redirect to billing portal instead of checkout
      const origin = request.nextUrl.origin
      const portal = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${origin}${returnUrl}`,
      })
      return NextResponse.json({ url: portal.url, type: 'portal' })
    }

    // Create Checkout session
    const origin = request.nextUrl.origin
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}${returnUrl}?subscription=success`,
      cancel_url: `${origin}${returnUrl}?subscription=canceled`,
      metadata: {
        user_id: userId,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
        },
      },
      locale: 'auto',
    })

    return NextResponse.json({ url: session.url, type: 'checkout' })
  } catch (error) {
    console.error('Error creating subscription checkout:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
