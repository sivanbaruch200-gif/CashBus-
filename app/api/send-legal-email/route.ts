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

    // Download PDF from URL to attach to email
    const pdfResponse = await fetch(pdfUrl)
    if (!pdfResponse.ok) {
      throw new Error('Failed to download PDF from storage')
    }
    const pdfBuffer = await pdfResponse.arrayBuffer()

    // Send email with Resend
    const { data, error } = await getResend().emails.send({
      from: 'CashBus Legal <legal@cashbuses.com>',
      replyTo: 'cash.bus200@gmail.com',
      to: [to],
      bcc: bccList,
      subject: subject,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <pre style="white-space: pre-wrap; font-family: inherit;">${emailBody}</pre>
        </div>
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
