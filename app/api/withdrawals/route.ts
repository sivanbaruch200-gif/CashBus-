/**
 * GET /api/withdrawals
 *
 * Returns the current user's:
 *  - Claims with incoming payment but payout not yet completed (money waiting)
 *  - Existing withdrawal requests and their statuses
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()

    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Claims with money waiting (payment received, payout not done)
    const { data: pendingPayouts } = await supabase
      .from('claims')
      .select('id, bus_company, claim_amount, incoming_payment_amount, customer_payout_amount, customer_payout_completed, incoming_payment_date, status')
      .eq('user_id', user.id)
      .not('incoming_payment_amount', 'is', null)
      .eq('customer_payout_completed', false)
      .order('incoming_payment_date', { ascending: false })

    // Existing withdrawal requests
    const { data: withdrawalRequests } = await supabase
      .from('withdrawal_requests')
      .select('id, claim_id, amount, status, requested_at, processed_at')
      .eq('user_id', user.id)
      .order('requested_at', { ascending: false })

    return NextResponse.json({
      pendingPayouts: pendingPayouts || [],
      withdrawalRequests: withdrawalRequests || [],
    })
  } catch (error) {
    console.error('Error fetching withdrawals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
