/**
 * Points / Loyalty Service
 *
 * Business Rules:
 * - 10 points per incident report
 * - 50 points per claim created
 * - 5 points per daily login + streak bonus (5 per day, max 25)
 * - 300 points = 1 free subscription month
 */

import { supabase } from './supabase'

// =====================================================
// Constants
// =====================================================

export const POINTS_PER_INCIDENT = 10
export const POINTS_PER_CLAIM = 50
export const POINTS_PER_DAILY_LOGIN = 5
export const POINTS_STREAK_BONUS = 5
export const POINTS_STREAK_MAX_BONUS = 25
export const POINTS_FOR_FREE_MONTH = 300

// =====================================================
// Types
// =====================================================

export interface UserPoints {
  id: string
  user_id: string
  total_points: number
  streak_days: number
  last_login_date: string | null
  lifetime_earned: number
  lifetime_redeemed: number
  created_at: string
  updated_at: string
}

export interface PointsTransaction {
  id: string
  user_id: string
  points: number
  transaction_type: 'daily_login' | 'incident_report' | 'claim_created' | 'redeem_subscription' | 'admin_adjustment' | 'streak_bonus'
  description: string | null
  reference_id: string | null
  balance_after: number
  created_at: string
}

export interface DailyLoginResult {
  pointsEarned: number
  streakDays: number
  streakBonus: number
  totalPoints: number
  alreadyLoggedInToday: boolean
}

// =====================================================
// Read points
// =====================================================

/**
 * Get the current user's points record.
 * Returns null if not logged in or no record yet.
 */
export async function getUserPoints(): Promise<UserPoints | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_points')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null  // No row yet
    console.error('Error fetching user points:', error)
    return null
  }

  return data
}

/**
 * Get recent points transactions for the current user.
 */
export async function getPointsTransactions(limit = 20): Promise<PointsTransaction[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('points_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching points transactions:', error)
    return []
  }

  return data ?? []
}

// =====================================================
// Award points (client-side – calls API route)
// =====================================================

/**
 * Record daily login via API route (server handles upsert + streak).
 * Returns the login result from the server.
 */
export async function recordDailyLogin(): Promise<DailyLoginResult | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const res = await fetch('/api/points/daily-login', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// =====================================================
// Redeem points for subscription month
// =====================================================

/**
 * Attempt to redeem 300 points for 1 free subscription month.
 * Called from the subscription page.
 * Returns { success, newBalance, error? }
 */
export async function redeemPointsForSubscription(): Promise<{
  success: boolean
  newBalance: number
  error?: string
}> {
  const pts = await getUserPoints()

  if (!pts) {
    return { success: false, newBalance: 0, error: 'משתמש לא מחובר' }
  }

  if (pts.total_points < POINTS_FOR_FREE_MONTH) {
    return {
      success: false,
      newBalance: pts.total_points,
      error: `נדרשים ${POINTS_FOR_FREE_MONTH} נקודות. יש לך ${pts.total_points}.`,
    }
  }

  const newBalance = pts.total_points - POINTS_FOR_FREE_MONTH
  const newLifetimeRedeemed = pts.lifetime_redeemed + POINTS_FOR_FREE_MONTH

  // Deduct points
  const { error: updateError } = await supabase
    .from('user_points')
    .update({
      total_points: newBalance,
      lifetime_redeemed: newLifetimeRedeemed,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', pts.user_id)

  if (updateError) {
    console.error('Error deducting points:', updateError)
    return { success: false, newBalance: pts.total_points, error: 'שגיאה בניכוי נקודות' }
  }

  // Log transaction
  await supabase.from('points_transactions').insert({
    user_id: pts.user_id,
    points: -POINTS_FOR_FREE_MONTH,
    transaction_type: 'redeem_subscription',
    description: 'פדיון נקודות - חודש מנוי חינמי',
    balance_after: newBalance,
  })

  return { success: true, newBalance }
}

// =====================================================
// Helper: Award points (used server-side via service role)
// Exported for use in claim/incident API routes
// =====================================================

/**
 * Award points to a user.
 * Designed to be called from API routes using the service-role client.
 */
export async function awardPoints(
  serviceSupabase: any,
  params: {
    userId: string
    points: number
    transactionType: PointsTransaction['transaction_type']
    description: string
    referenceId?: string
  }
): Promise<void> {
  // Upsert user_points row
  const { data: existing } = await serviceSupabase
    .from('user_points')
    .select('total_points, lifetime_earned')
    .eq('user_id', params.userId)
    .single()

  const currentBalance = existing?.total_points ?? 0
  const currentLifetime = existing?.lifetime_earned ?? 0
  const newBalance = currentBalance + params.points
  const newLifetime = currentLifetime + params.points

  await serviceSupabase
    .from('user_points')
    .upsert({
      user_id: params.userId,
      total_points: newBalance,
      lifetime_earned: newLifetime,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  // Log transaction
  await serviceSupabase.from('points_transactions').insert({
    user_id: params.userId,
    points: params.points,
    transaction_type: params.transactionType,
    description: params.description,
    reference_id: params.referenceId ?? null,
    balance_after: newBalance,
  })
}
