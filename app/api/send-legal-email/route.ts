/**
 * API Route: Send Legal Email
 *
 * Sends legal warning letters via email with MANDATORY BCC to Ministry of Transport
 * Uses Resend (or SendGrid) for reliable email delivery
 */

import { NextRequest, NextResponse } from 'next/server'
import { MINISTRY_EMAIL } from '@/lib/legalSubmissions'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, rateLimitResponse, getClientIP, RATE_LIMITS } from '@/lib/rateLimit'

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Missing RESEND_API_KEY environment variable')
  }
  return new Resend(process.env.RESEND_API_KEY)
}

// Supabase client with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function POST(request: NextRequest) {
  try {
    // --- Rate limit: IP-based (5 emails per 5 min – Resend quota & anti-spam) ---
    const ip = getClientIP(request)
    const ipCheck = rateLimit(`send-legal-email:${ip}`, RATE_LIMITS.sendLegalEmail)
    if (!ipCheck.success) return rateLimitResponse(ipCheck)

    const body = await request.json()
    const { to, bcc, subject, body: emailBody, pdfUrl, submissionId } = body

    // Validate required fields
    if (!to || !subject || !emailBody || !pdfUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body, pdfUrl' },
        { status: 400 }
      )
    }

    // CRITICAL: Ensure Ministry is ALWAYS BCC'd
    const bccList = [MINISTRY_EMAIL]
    if (bcc && bcc !== MINISTRY_EMAIL) {
      bccList.push(bcc)
    }

    // Validate pdfUrl is from our Supabase storage only (prevent SSRF)
    const supabaseStorageBase = process.env.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object'
    if (!pdfUrl.startsWith(supabaseStorageBase)) {
      return NextResponse.json({ error: 'Invalid PDF URL' }, { status: 400 })
    }

    // Download PDF from URL to attach to email
    const pdfResponse = await fetch(pdfUrl)
    if (!pdfResponse.ok) {
      throw new Error('Failed to download PDF from storage')
    }
    // Enforce size limit (10 MB)
    const contentLength = pdfResponse.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      throw new Error('PDF file too large')
    }
    const pdfBuffer = await pdfResponse.arrayBuffer()
    if (pdfBuffer.byteLength > 10 * 1024 * 1024) {
      throw new Error('PDF file too large')
    }

    // Send email with Resend
    const { data, error } = await getResend().emails.send({
      from: 'CashBus Legal <legal@cashbuses.com>',
      replyTo: 'cash.bus200@gmail.com',
      to: [to],
      bcc: bccList,
      subject: subject,
      html: `<!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head><meta charset="utf-8"></head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: Arial, sans-serif; direction: rtl;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <!-- Header -->
            <div style="background-color: #1e293b; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 22px; font-weight: bold;">CashBus Legal</h1>
              <p style="margin: 5px 0 0 0; font-size: 13px; color: #94a3b8;">מכתב משפטי רשמי</p>
            </div>
            <!-- Body -->
            <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
              <div style="font-size: 15px; line-height: 1.8; color: #1e293b; white-space: pre-wrap;">${emailBody}</div>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
              <p style="font-size: 13px; color: #64748b; margin: 0;">
                מכתב זה נשלח באמצעות מערכת CashBus.<br>
                קובץ PDF מצורף להודעה זו מכיל את המכתב המלא.
              </p>
            </div>
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 15px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                CashBus | legal@cashbuses.com | www.cashbuses.com
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: 'warning-letter.pdf',
          content: Buffer.from(pdfBuffer),
        },
      ],
      headers: {
        'X-CashBus-Submission-ID': submissionId || 'unknown',
      },
    })

    if (error) {
      console.error('Resend error:', error)
      // Log failed email
      await supabase.from('email_logs').insert({
        message_id: null,
        from_email: 'legal@cashbuses.com',
        to_email: to,
        subject: subject,
        status: 'failed',
        error_message: error.message,
        submission_id: submissionId || null,
        email_type: 'legal_demand',
        metadata: { bcc: bccList }
      })
      throw new Error(error.message)
    }

    // Log successful email to email_logs table (legal evidence)
    await supabase.from('email_logs').insert({
      message_id: data.id,
      from_email: 'legal@cashbuses.com',
      to_email: to,
      subject: subject,
      status: 'sent',
      submission_id: submissionId || null,
      email_type: 'legal_demand',
      metadata: { bcc: bccList, attachments: ['warning-letter.pdf'] }
    })

    return NextResponse.json({
      success: true,
      messageId: data.id,
      to,
      bcc: bccList,
      ministryNotified: true,
    })
  } catch (error) {
    console.error('Error sending legal email:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send email',
      },
      { status: 500 }
    )
  }
}

/**
 * Configuration for API route
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
