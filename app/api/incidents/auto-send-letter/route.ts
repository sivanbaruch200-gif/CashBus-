/**
 * API Route: Auto-Send Demand Letter
 *
 * Called immediately after incident creation.
 * Fills the initial_warning template with incident data
 * and sends the demand letter to the bus company automatically.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import * as Sentry from '@sentry/nextjs'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'cash.bus200@gmail.com'
// NOTE: Per lawyer advice - DO NOT actually send to Ministry (Pniotcrm@mot.gov.il).
// Ministry reporting stays as a THREAT in the letter only. Courts handle compensation, not the Ministry.

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY')
  return new Resend(process.env.RESEND_API_KEY)
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Replace {{tag}} placeholders with HTML-escaped values */
function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => escapeHtml(vars[key] ?? `[${key}]`))
}

/** Human-readable incident description in Hebrew */
function getIncidentDescription(type: string, delayMinutes?: number): string {
  if (type === 'no_arrival') return 'האוטובוס לא הגיע לתחנה'
  if (type === 'no_stop') return 'האוטובוס לא עצר בתחנה'
  if (type === 'delay') return `האוטובוס איחר ${delayMinutes ?? '?'} דקות`
  return 'שיבוש בשירות'
}

export async function POST(request: NextRequest) {
  let incidentId: string | undefined
  try {
    const body = await request.json()
    incidentId = body.incidentId
    if (!incidentId) {
      return NextResponse.json({ error: 'Missing incidentId' }, { status: 400 })
    }

    const db = getSupabase()

    // 1. Fetch incident + user profile
    const { data: incident, error: incidentError } = await db
      .from('incidents')
      .select('*, profiles:user_id (full_name, id_number, phone, home_address, city)')
      .eq('id', incidentId)
      .single()

    if (incidentError || !incident) {
      console.error('[auto-send] Incident fetch failed:', incidentError?.message, 'id:', incidentId)
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 })
    }

    const profile = Array.isArray(incident.profiles) ? incident.profiles[0] : incident.profiles

    // 2. Look up bus company email
    const { data: company } = await db
      .from('bus_companies')
      .select('id, public_contact_email')
      .eq('company_name', incident.bus_company)
      .eq('is_active', true)
      .maybeSingle()

    // Fall back to admin email when company has no email (or during testing)
    const companyEmail = company?.public_contact_email || ADMIN_EMAIL

    // 3. Fetch the initial_warning letter template
    const { data: templateRow } = await db
      .from('letter_templates')
      .select('template_content')
      .eq('template_type', 'initial_warning')
      .eq('is_active', true)
      .single()

    if (!templateRow) {
      return NextResponse.json({ error: 'Letter template not found' }, { status: 500 })
    }

    // 4. Create claim record
    const { data: claim, error: claimError } = await db
      .from('claims')
      .insert({
        user_id: incident.user_id,
        incident_ids: [incidentId],
        bus_company: incident.bus_company,
        claim_amount: incident.total_compensation || 0,
        claim_type: 'warning_letter',
        status: 'submitted',
      })
      .select()
      .single()

    if (claimError || !claim) {
      throw new Error('Failed to create claim: ' + claimError?.message)
    }

    // 5. Fill template variables
    const incidentDate = new Date(incident.incident_datetime)
    const address = [profile?.home_address, profile?.city].filter(Boolean).join(', ') || 'לא ידוע'
    const claimShortId = claim.id.slice(0, 8).toUpperCase()
    const todayStr = new Date().toLocaleDateString('he-IL')

    const vars: Record<string, string> = {
      full_name: profile?.full_name || 'לא ידוע',
      id_number: profile?.id_number || 'לא ידוע',
      phone: profile?.phone || 'לא ידוע',
      address,
      company_name: incident.bus_company,
      bus_line: incident.bus_line,
      station_name: incident.station_name || 'לא ידוע',
      incident_date: incidentDate.toLocaleDateString('he-IL'),
      incident_description: getIncidentDescription(incident.incident_type, incident.delay_minutes),
      scheduled_time: 'לא זמין',
      actual_time: 'לא זמין',
      base_compensation: `₪${(incident.base_compensation || 0).toLocaleString('he-IL')}`,
      damage_compensation: `₪${(incident.damage_compensation || 0).toLocaleString('he-IL')}`,
      total_compensation: `₪${(incident.total_compensation || 0).toLocaleString('he-IL')}`,
      claim_id: claimShortId,
      today_date: todayStr,
      initial_letter_date: todayStr,
      court_city: profile?.city || 'תל אביב',
    }

    const filledLetter = fillTemplate(templateRow.template_content, vars)

    // 6. Send email to bus company (BCC: admin + ministry)
    const subject = `מכתב דרישה - קו ${incident.bus_line} - אסמכתא ${claimShortId}`
    const sentAt = new Date().toISOString()

    const { data: emailData, error: emailError } = await getResend().emails.send({
      from: 'CashBus Legal <legal@cashbuses.com>',
      replyTo: ADMIN_EMAIL,
      to: [companyEmail],
      bcc: [ADMIN_EMAIL],
      subject,
      html: `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;direction:rtl;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#1e293b;color:white;padding:20px 30px;border-radius:8px 8px 0 0;text-align:center;">
      <h1 style="margin:0;font-size:20px;">CashBus Legal</h1>
      <p style="margin:5px 0 0;font-size:12px;color:#94a3b8;">מכתב דרישה רשמי | אסמכתא ${claimShortId}</p>
    </div>
    <div style="background:#fff;padding:30px;border:1px solid #e2e8f0;border-top:none;">
      <div style="font-size:15px;line-height:2;color:#1e293b;white-space:pre-wrap;text-align:right;">${filledLetter}</div>
    </div>
    <div style="background:#f8fafc;padding:15px 30px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;text-align:center;">
      <p style="font-size:11px;color:#94a3b8;margin:0;">CashBus | legal@cashbuses.com | www.cashbuses.com</p>
    </div>
  </div>
</body>
</html>`,
    })

    // 7. Log the legal submission
    await db.from('legal_submissions').insert({
      claim_id: claim.id,
      user_id: incident.user_id,
      company_id: company?.id || null,
      submission_type: 'email',
      submission_status: emailError ? 'failed' : 'sent',
      email_to: companyEmail,
      email_bcc: ADMIN_EMAIL,
      email_subject: subject,
      email_body: filledLetter,
      email_sent_at: sentAt,
      email_message_id: emailData?.id || null,
      ministry_notified: false,
      ministry_notification_sent_at: null,
      automation_method: 'email_api',
      automation_status: emailError ? 'failed' : 'success',
      automation_error_message: emailError?.message || null,
      retry_count: 0,
    })

    // 8. Create letter reminder tracking record
    await db.from('letter_reminders').insert({
      claim_id: claim.id,
      user_id: incident.user_id,
      initial_letter_sent_at: sentAt,
      status: 'active',
      total_emails_sent: emailError ? 0 : 1,
      last_email_sent_at: emailError ? null : sentAt,
    })

    if (emailError) {
      // Claim created, but email failed — admin can retry from letter queue
      return NextResponse.json({
        success: false,
        claimId: claim.id,
        error: 'Email failed: ' + emailError.message,
      }, { status: 207 })
    }

    return NextResponse.json({
      success: true,
      claimId: claim.id,
      emailTo: companyEmail,
      messageId: emailData?.id,
    })
  } catch (error) {
    console.error('Auto-send letter error:', error)
    Sentry.captureException(error, {
      tags: { route: 'auto-send-letter' },
      extra: { incidentId },
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send letter' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
