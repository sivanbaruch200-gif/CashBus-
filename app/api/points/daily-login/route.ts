/**
 * POST /api/points/daily-login
 *
 * Awards daily login points to the authenticated user.
 * Auth: Bearer token in Authorization header.
 *
 * Streak logic:
 *   - Same day → skip (alreadyLoggedInToday: true)
 *   - Consecutive day → streak++, bonus += POINTS_STREAK_BONUS (max 25)
 *   - Gap > 1 day → reset streak to 1
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  POINTS_PER_DAILY_LOGIN,
  POINTS_STREAK_BONUS,
  POINTS_STREAK_MAX_BONUS,
  type DailyLoginResult,
} from '@/lib/pointsService'
import { rateLimit, rateLimitResponse, getClientIP, RATE_LIMITS } from '@/lib/rateLimit'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    // --- Rate limit: IP-level burst guard (before auth, cheap check) ---
    const ip = getClientIP(request)
    const ipCheck = rateLimit(`daily-login-ip:${ip}`, RATE_LIMITS.ipBurst)
    if (!ipCheck.success) return rateLimitResponse(ipCheck)

    // Authenticate via Bearer token
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')

    const serviceSupabase = getServiceSupabase()

    let userId: string | null = null
    if (token) {
      const { data: { user } } = await serviceSupabase.auth.getUser(token)
      userId = user?.id ?? null
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // --- Rate limit: per-user (10 requests/min – they normally call once/day) ---
    const userCheck = rateLimit(`daily-login-user:${userId}`, RATE_LIMITS.dailyLogin)
    if (!userCheck.success) return rateLimitResponse(userCheck)

    const today = new Date().toISOString().split('T')[0]  // YYYY-MM-DD

    // Fetch current points record
    const { data: existing } = await serviceSupabase
      .from('user_points')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Already logged in today?
    if (existing?.last_login_date === today) {
      const result: DailyLoginResult = {
        pointsEarned: 0,
        streakBonus: 0,
        streakDays: existing.streak_days,
        totalPoints: existing.total_points,
        alreadyLoggedInToday: true,
      }
      return NextResponse.json(result)
    }

    // Calculate streak
    let newStreak = 1
    if (existing?.last_login_date) {
      const lastDate = new Date(existing.last_login_date)
      const todayDate = new Date(today)
      const diffDays = Math.round(
        (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (diffDays === 1) {
        newStreak = (existing.streak_days ?? 1) + 1
      }
      // diffDays > 1 → reset to 1
    }

    // Calculate points
    const streakBonus = Math.min((newStreak - 1) * POINTS_STREAK_BONUS, POINTS_STREAK_MAX_BONUS)
    const pointsEarned = POINTS_PER_DAILY_LOGIN + streakBonus

    const currentBalance = existing?.total_points ?? 0
    const currentLifetime = existing?.lifetime_earned ?? 0
    const newBalance = currentBalance + pointsEarned

    // Upsert user_points
    const { error: upsertError } = await serviceSupabase
      .from('user_points')
      .upsert({
        user_id: userId,
        total_points: newBalance,
        streak_days: newStreak,
        last_login_date: today,
        lifetime_earned: currentLifetime + pointsEarned,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (upsertError) {
      console.error('Error upserting user_points:', upsertError)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    // Log transaction
    await serviceSupabase.from('points_transactions').insert({
      user_id: userId,
      points: pointsEarned,
      transaction_type: 'daily_login',
      description: newStreak > 1
        ? `כניסה יומית (רצף ${newStreak} ימים) +${streakBonus} בונוס`
        : 'כניסה יומית',
      balance_after: newBalance,
    })

    const result: DailyLoginResult = {
      pointsEarned,
      streakBonus,
      streakDays: newStreak,
      totalPoints: newBalance,
      alreadyLoggedInToday: false,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in daily-login:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
