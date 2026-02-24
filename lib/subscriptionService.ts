/**
 * Subscription Service
 *
 * Business Model:
 * - 2 free claims per user (lifetime)
 * - After that: 29 NIS/month subscription required to open new claims
 * - Subscriptions managed via Stripe Checkout
 *
 * This service handles:
 * 1. Checking if a user can create a new claim
 * 2. Creating Stripe Checkout sessions for subscriptions
 * 3. Reading subscription status from DB
 * 4. Handling Stripe webhook events (created/updated/deleted)
 */

import { supabase } from './supabase'

// =====================================================
// Constants
// =====================================================

export const FREE_CLAIMS_LIMIT = 2
export const SUBSCRIPTION_PRICE_NIS = 29

// =====================================================
// Types
// =====================================================

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  status: 'free' | 'active' | 'past_due' | 'canceled' | 'trialing'
  current_period_start?: string
  current_period_end?: string
  cancel_at_period_end: boolean
  free_claims_used: number
  free_claims_limit: number
  plan_amount: number
  plan_currency: string
  created_at: string
  updated_at: string
}

export interface SubscriptionStatus {
  canCreateClaim: boolean
  isSubscribed: boolean
  freeClaimsUsed: number
  freeClaimsLeft: number
  subscriptionStatus: Subscription['status']
  currentPeriodEnd?: string
  cancelAtPeriodEnd: boolean
}

// =====================================================
// Read subscription status
// =====================================================

/**
 * Get the current user's subscription record from DB
 */
export async function getUserSubscription(): Promise<Subscription | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No row found → treat as free user with 0 used
      return null
    }
    console.error('Error fetching subscription:', error)
    return null
  }

  return data
}

/**
 * Check if the current user can create a new claim
 * Returns full status object for UI display
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const sub = await getUserSubscription()

  if (!sub) {
    return {
      canCreateClaim: true,
      isSubscribed: false,
      freeClaimsUsed: 0,
      freeClaimsLeft: FREE_CLAIMS_LIMIT,
      subscriptionStatus: 'free',
      cancelAtPeriodEnd: false,
    }
  }

  const isSubscribed = sub.status === 'active' || sub.status === 'trialing'
  const freeClaimsLeft = Math.max(0, sub.free_claims_limit - sub.free_claims_used)
  const canCreateClaim = isSubscribed || freeClaimsLeft > 0

  return {
    canCreateClaim,
    isSubscribed,
    freeClaimsUsed: sub.free_claims_used,
    freeClaimsLeft,
    subscriptionStatus: sub.status,
    currentPeriodEnd: sub.current_period_end ?? undefined,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  }
}

// =====================================================
// Admin: update subscription from webhook
// =====================================================

/**
 * Called by Stripe webhook when subscription is created or updated
 * Uses service-role client (passed from webhook route)
 */
export async function upsertSubscriptionFromStripe(
  serviceSupabase: any,
  params: {
    stripeSubscriptionId: string
    stripeCustomerId: string
    userId: string
    status: Subscription['status']
    currentPeriodStart: number  // unix timestamp
    currentPeriodEnd: number    // unix timestamp
    cancelAtPeriodEnd: boolean
    planAmountAgorot: number
    planCurrency: string
  }
): Promise<void> {
  const { error } = await serviceSupabase
    .from('subscriptions')
    .upsert({
      user_id: params.userId,
      stripe_subscription_id: params.stripeSubscriptionId,
      stripe_customer_id: params.stripeCustomerId,
      status: params.status,
      current_period_start: new Date(params.currentPeriodStart * 1000).toISOString(),
      current_period_end: new Date(params.currentPeriodEnd * 1000).toISOString(),
      cancel_at_period_end: params.cancelAtPeriodEnd,
      plan_amount: params.planAmountAgorot,
      plan_currency: params.planCurrency,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    })

  if (error) {
    console.error('Error upserting subscription:', error)
    throw error
  }

  // Sync status to profiles table (denormalized)
  await serviceSupabase
    .from('profiles')
    .update({
      subscription_status: params.status,
      stripe_customer_id: params.stripeCustomerId,
    })
    .eq('id', params.userId)
}

/**
 * Called by Stripe webhook when subscription is canceled/deleted
 */
export async function cancelSubscription(
  serviceSupabase: any,
  stripeSubscriptionId: string
): Promise<void> {
  const { error } = await serviceSupabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', stripeSubscriptionId)

  if (error) {
    console.error('Error canceling subscription:', error)
    throw error
  }

  // Also get user_id to sync profile
  const { data } = await serviceSupabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single()

  if (data?.user_id) {
    await serviceSupabase
      .from('profiles')
      .update({ subscription_status: 'canceled' })
      .eq('id', data.user_id)
  }
}

/**
 * Look up user_id by Stripe customer ID
 * Used in webhook to map Stripe events → our users
 */
export async function getUserIdByStripeCustomer(
  serviceSupabase: any,
  stripeCustomerId: string
): Promise<string | null> {
  const { data } = await serviceSupabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single()

  if (data?.user_id) return data.user_id

  // Fallback: check profiles table
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single()

  return profile?.id ?? null
}
