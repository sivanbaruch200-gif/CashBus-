/**
 * API Route: Send Email (Simple Text)
 *
 * Sends simple text emails without attachments
 * Used for system notifications, reminders, etc.
 */

import { NextRequest, NextResponse } from 'next/server'
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
    const { to, subject, body: emailBody, userId, claimId, emailType } = body

    // Validate required fields
    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      )
    }

    // Send email with Resend
    const { data, error } = await getResend().emails.send({
      from: 'CashBus <noreply@cashbuses.com>',
      replyTo: 'cash.bus200@gmail.com',
      to: [to],
      subject: subject,
      html: `<!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl;">
          <pre style="white-space: pre-wrap; font-family: inherit;">${emailBody}</pre>
        </body>
        </html>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      // Log failed email
      await supabase.from('email_logs').insert({
        message_id: null,
        from_email: 'noreply@cashbuses.com',
        to_email: to,
        subject: subject,
        status: 'failed',
        error_message: error.message,
        user_id: userId || null,
        claim_id: claimId || null,
        email_type: emailType || 'system_notification',
        metadata: {}
      })
      throw new Error(error.message)
    }

    // Log successful email to email_logs table
    await supabase.from('email_logs').insert({
      message_id: data.id,
      from_email: 'noreply@cashbuses.com',
      to_email: to,
      subject: subject,
      status: 'sent',
      user_id: userId || null,
      claim_id: claimId || null,
      email_type: emailType || 'system_notification',
      metadata: {}
    })

    return NextResponse.json({
      success: true,
      messageId: data.id,
      to,
    })
  } catch (error) {
    console.error('Error sending email:', error)
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
