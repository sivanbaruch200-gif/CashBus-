/**
 * POST /api/withdrawals/request
 *
 * Customer initiates a withdrawal request for their 80% share.
 * Validates bank details, creates the request, and notifies admin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()

    // Auth
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { claimId } = body

    if (!claimId) {
      return NextResponse.json({ error: 'claimId is required' }, { status: 400 })
    }

    // Get the claim (must belong to user, must have incoming payment, not yet paid out)
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('id, bus_company, incoming_payment_amount, customer_payout_amount, customer_payout_completed, status')
      .eq('id', claimId)
      .eq('user_id', user.id)
      .single()

    if (claimError || !claim) {
      return NextResponse.json({ error: 'תביעה לא נמצאה' }, { status: 404 })
    }

    if (!claim.incoming_payment_amount) {
      return NextResponse.json({ error: 'טרם התקבל תשלום עבור תביעה זו' }, { status: 400 })
    }

    if (claim.customer_payout_completed) {
      return NextResponse.json({ error: 'הפיצוי כבר הועבר לחשבונך' }, { status: 409 })
    }

    // Get user profile with bank details
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, bank_name, bank_branch, bank_account_number, bank_account_owner_name')
      .eq('id', user.id)
      .single()

    if (!profile?.bank_name || !profile?.bank_account_number) {
      return NextResponse.json({ error: 'no_bank_details' }, { status: 422 })
    }

    // Get the incoming payment record
    const { data: payment } = await supabase
      .from('incoming_payments')
      .select('id, customer_payout')
      .eq('claim_id', claimId)
      .single()

    if (!payment) {
      return NextResponse.json({ error: 'רשומת תשלום לא נמצאה' }, { status: 404 })
    }

    // Check no existing pending/processing request for this claim
    const { data: existingRequest } = await supabase
      .from('withdrawal_requests')
      .select('id, status')
      .eq('claim_id', claimId)
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing'])
      .maybeSingle()

    if (existingRequest) {
      return NextResponse.json({ error: 'בקשת משיכה כבר קיימת עבור תביעה זו' }, { status: 409 })
    }

    const amount = payment.customer_payout ?? claim.customer_payout_amount ?? 0

    // Create withdrawal request
    const { data: withdrawalRequest, error: insertError } = await supabase
      .from('withdrawal_requests')
      .insert({
        user_id: user.id,
        claim_id: claimId,
        incoming_payment_id: payment.id,
        amount,
        bank_name: profile.bank_name,
        bank_branch: profile.bank_branch,
        bank_account_number: profile.bank_account_number,
        bank_account_owner_name: profile.bank_account_owner_name || profile.full_name,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Notify admin via email (non-blocking)
    const adminEmail = process.env.ADMIN_EMAIL || 'cash.bus200@gmail.com'
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'CashBus <noreply@cashbuses.com>',
        replyTo: 'cash.bus200@gmail.com',
        to: [adminEmail],
        subject: `💰 בקשת משיכה חדשה — ${profile.full_name} — ₪${amount.toLocaleString('he-IL')}`,
        html: `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f0f1a;color:#e0e0e0;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#1e1e2e;border-radius:12px;padding:24px;border:1px solid #f59e0b33;">
      <h2 style="color:#f59e0b;margin-top:0;">💰 בקשת משיכה חדשה</h2>

      <div style="background:#2a2a3e;border-radius:8px;padding:16px;margin-bottom:16px;">
        <table width="100%">
          <tr><td style="color:#9ca3af;padding:4px 0;">לקוח:</td><td style="font-weight:bold;">${profile.full_name}</td></tr>
          <tr><td style="color:#9ca3af;padding:4px 0;">סכום למשיכה:</td><td style="font-weight:bold;color:#22c55e;font-size:20px;">₪${amount.toLocaleString('he-IL')}</td></tr>
          <tr><td style="color:#9ca3af;padding:4px 0;">חברת אוטובוסים:</td><td>${claim.bus_company}</td></tr>
          <tr><td style="color:#9ca3af;padding:4px 0;">מזהה תביעה:</td><td style="font-size:12px;color:#6b7280;">${claimId}</td></tr>
        </table>
      </div>

      <h3 style="color:#f59e0b;">פרטי בנק להעברה:</h3>
      <div style="background:#2a2a3e;border-radius:8px;padding:16px;margin-bottom:16px;">
        <table width="100%">
          <tr><td style="color:#9ca3af;padding:4px 0;">בנק:</td><td><strong>${profile.bank_name}</strong></td></tr>
          <tr><td style="color:#9ca3af;padding:4px 0;">סניף:</td><td>${profile.bank_branch || 'לא צוין'}</td></tr>
          <tr><td style="color:#9ca3af;padding:4px 0;">מספר חשבון:</td><td><strong>${profile.bank_account_number}</strong></td></tr>
          <tr><td style="color:#9ca3af;padding:4px 0;">שם בעל החשבון:</td><td>${profile.bank_account_owner_name || profile.full_name}</td></tr>
        </table>
      </div>

      <p style="color:#6b7280;font-size:13px;">
        לאחר ביצוע ההעברה — עדכן סטטוס ב:
        <a href="https://www.cashbuses.com/admin/withdrawals" style="color:#f59e0b;">לוח הבקרה</a>
      </p>
    </div>
  </div>
</body>
</html>`,
      })
    } catch (emailErr) {
      console.error('Admin notification email failed:', emailErr)
    }

    return NextResponse.json({ success: true, withdrawalRequest })
  } catch (error) {
    console.error('Error creating withdrawal request:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
