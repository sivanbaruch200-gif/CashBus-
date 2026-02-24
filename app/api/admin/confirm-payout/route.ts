/**
 * API Route: Confirm Customer Payout
 *
 * Admin confirms that 80% has been transferred to the customer's bank account.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { completeCustomerPayout } from '@/lib/commissionService'
import { handlePayoutCompleted } from '@/lib/collectionWorkflow'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables')
  }
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    // Verify authenticated user from JWT token (never trust body)
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role of the authenticated user
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { claimId, paymentId, reference } = body

    if (!claimId || !paymentId || !reference) {
      return NextResponse.json(
        { error: 'Missing required fields: claimId, paymentId, reference' },
        { status: 400 }
      )
    }

    // Verify payment exists and is pending
    const { data: payment, error: paymentError } = await supabase
      .from('incoming_payments')
      .select('*')
      .eq('id', paymentId)
      .eq('claim_id', claimId)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (payment.customer_payout_status === 'completed') {
      return NextResponse.json(
        { error: 'Payout already completed' },
        { status: 409 }
      )
    }

    // Complete the payout
    await completeCustomerPayout(paymentId, claimId, reference)

    // Send notifications
    try {
      await handlePayoutCompleted(claimId, payment.customer_payout, reference)
    } catch (notifError) {
      console.error('Notification error (payout still confirmed):', notifError)
    }

    return NextResponse.json({
      success: true,
      payout: {
        paymentId,
        claimId,
        customerPayout: payment.customer_payout,
        reference,
        completedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error in confirm-payout:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
