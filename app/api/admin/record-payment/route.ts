/**
 * API Route: Record Incoming Payment from Bus Company
 *
 * Admin records that a bus company paid compensation to CashBus bank account.
 * The DB trigger auto-calculates the 80/20 split.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleIncomingPaymentRecorded } from '@/lib/collectionWorkflow'
import * as Sentry from '@sentry/nextjs'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables')
  }
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  let claimId: string | undefined
  let amount: number | undefined
  let adminId: string | undefined
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
    adminId = user.id  // use authenticated user ID, not body

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
    ;({ claimId, amount } = body)
    const {
      paymentSource,
      paymentMethod,
      referenceNumber,
      receivedDate,
      notes,
    } = body

    if (!claimId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: claimId, amount' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be positive' },
        { status: 400 }
      )
    }

    // Verify claim exists
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('id, incoming_payment_amount')
      .eq('id', claimId)
      .single()

    if (claimError || !claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    if (claim.incoming_payment_amount) {
      return NextResponse.json(
        { error: 'Payment already recorded for this claim' },
        { status: 409 }
      )
    }

    // Record incoming payment (DB trigger handles split calculation)
    const { data: payment, error: paymentError } = await supabase
      .from('incoming_payments')
      .insert({
        claim_id: claimId,
        amount,
        payment_source: paymentSource || null,
        payment_method: paymentMethod || null,
        reference_number: referenceNumber || null,
        received_date: receivedDate || new Date().toISOString(),
        recorded_by: adminId,
        notes: notes || null,
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Error recording payment:', paymentError)
      return NextResponse.json(
        { error: 'Failed to record payment' },
        { status: 500 }
      )
    }

    // Trigger workflow notifications
    try {
      await handleIncomingPaymentRecorded(claimId, payment.id, amount)
    } catch (notifError) {
      console.error('Notification error (payment still recorded):', notifError)
    }

    const commissionAmount = Math.round(amount * 0.20 * 100) / 100
    const customerPayout = Math.round(amount * 0.80 * 100) / 100

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        amount,
        commissionAmount,
        customerPayout,
        receivedDate: payment.received_date,
      },
    })
  } catch (error) {
    console.error('Error in record-payment:', error)
    Sentry.captureException(error, {
      tags: { route: 'record-payment' },
      extra: { claimId, amount, adminId },
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
