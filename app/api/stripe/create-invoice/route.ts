/**
 * API Route: Create Stripe Invoice for Commission Payment
 *
 * Creates a Stripe invoice for the 15% success fee.
 * Called from admin panel or collection workflow.
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
  try {
    const body = await request.json()
    const { userId, claimId, amount, currency, description } = body

    if (!userId || !claimId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, claimId, amount' },
        { status: 400 }
      )
    }

    // Get user details from database
    const { data: profile } = await getSupabase()
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', userId)
      .single()

    if (!profile || !profile.email) {
      return NextResponse.json({ error: 'User not found or missing email' }, { status: 404 })
    }

    const stripe = getStripe()

    // 1. Create or find Stripe customer
    const existingCustomers = await stripe.customers.list({
      email: profile.email,
      limit: 1,
    })

    let customer: Stripe.Customer
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0]
    } else {
      customer = await stripe.customers.create({
        email: profile.email,
        name: profile.full_name || undefined,
        phone: profile.phone || undefined,
        metadata: { user_id: userId },
      })
    }

    // 2. Create invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 14,
      currency: (currency || 'ils').toLowerCase(),
      description: description || `עמלת הצלחה - תביעה ${claimId.slice(0, 8)}`,
      metadata: {
        claim_id: claimId,
        user_id: userId,
        payment_type: 'commission',
      },
    })

    // 3. Create invoice item (amount in agorot)
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: Math.round(amount * 100),
      currency: (currency || 'ils').toLowerCase(),
      description: description || 'עמלת הצלחה (15%)',
    })

    // 4. Finalize invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id)

    return NextResponse.json({
      success: true,
      invoiceId: finalizedInvoice.id,
      invoiceUrl: finalizedInvoice.hosted_invoice_url,
      invoicePdf: finalizedInvoice.invoice_pdf,
      amount,
      currency: (currency || 'ILS').toUpperCase(),
    })
  } catch (error) {
    console.error('Error creating Stripe invoice:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create invoice',
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
