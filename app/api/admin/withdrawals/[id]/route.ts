/**
 * PATCH /api/admin/withdrawals/[id]
 *
 * Admin updates withdrawal request status:
 *   pending → processing → completed (or cancelled)
 *
 * On 'completed': marks claim payout done + emails customer.
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase()

    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!adminProfile || !['admin', 'super_admin'].includes(adminProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { status, adminNotes } = body

    if (!['processing', 'completed', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      status,
      admin_notes: adminNotes ?? null,
      updated_at: new Date().toISOString(),
    }

    if (status === 'completed' || status === 'cancelled') {
      updateData.processed_at = new Date().toISOString()
    }

    const { data: withdrawal, error: updateError } = await supabase
      .from('withdrawal_requests')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        profiles:user_id (full_name, email)
      `)
      .single()

    if (updateError || !withdrawal) {
      return NextResponse.json({ error: 'Failed to update withdrawal request' }, { status: 500 })
    }

    // On completion: mark claim payout done + send customer confirmation email
    if (status === 'completed') {
      await supabase
        .from('claims')
        .update({
          customer_payout_completed: true,
          customer_payout_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawal.claim_id)

      await supabase
        .from('incoming_payments')
        .update({
          customer_payout_status: 'completed',
          customer_payout_date: new Date().toISOString(),
          customer_payout_reference: `withdrawal-${params.id}`,
          updated_at: new Date().toISOString(),
        })
        .eq('claim_id', withdrawal.claim_id)

      const profile = Array.isArray(withdrawal.profiles)
        ? withdrawal.profiles[0]
        : withdrawal.profiles

      if (profile?.email) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY)
          await resend.emails.send({
            from: 'CashBus Legal <legal@cashbuses.com>',
            to: [profile.email],
            subject: `🎉 הכסף שלך הועבר! ₪${Number(withdrawal.amount).toLocaleString('he-IL')} בדרך לחשבונך`,
            html: `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fff;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;">🎉</div>
      <h1 style="color:#16a34a;margin:8px 0;">הפיצוי שלך הועבר!</h1>
    </div>

    <p>שלום ${profile.full_name},</p>
    <p>אנחנו שמחים לעדכן שהכסף בדרך אליך!</p>

    <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
      <div style="font-size:36px;font-weight:bold;color:#16a34a;">
        ₪${Number(withdrawal.amount).toLocaleString('he-IL')}
      </div>
      <div style="color:#15803d;margin-top:8px;">הועבר לחשבון הבנק שלך</div>
    </div>

    <p style="color:#666;font-size:14px;">הסכום יגיע תוך 1-3 ימי עסקים, בהתאם לבנק שלך.</p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="color:#9ca3af;font-size:12px;text-align:center;">
      CashBus — 80% הפיצוי שלך, ללא תשלום מראש
    </p>
  </div>
</body>
</html>`,
          })
        } catch (emailErr) {
          console.error('Failed to send customer confirmation email:', emailErr)
        }
      }
    }

    return NextResponse.json({ success: true, withdrawal })
  } catch (error) {
    console.error('Error updating withdrawal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
