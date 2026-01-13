/**
 * API Route: Send Legal Email
 *
 * Sends legal warning letters via email with MANDATORY BCC to Ministry of Transport
 * Uses Resend (or SendGrid) for reliable email delivery
 */

import { NextRequest, NextResponse } from 'next/server'
import { MINISTRY_EMAIL } from '@/lib/legalSubmissions'

// TODO: Install Resend: npm install resend
// import { Resend } from 'resend'
// const resend = new Resend(process.env.RESEND_API_KEY)

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

    // TODO: Uncomment when Resend is installed
    /*
    const { data, error } = await resend.emails.send({
      from: 'CashBus Legal <legal@cashbus.co.il>',
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
        'X-CashBus-Submission-ID': submissionId,
      },
    })

    if (error) {
      console.error('Resend error:', error)
      throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      messageId: data.id,
      to,
      bcc: bccList,
      ministryNotified: true,
    })
    */

    // TEMPORARY: Mock response for development
    console.log('📧 MOCK EMAIL SENT')
    console.log('To:', to)
    console.log('BCC:', bccList)
    console.log('Subject:', subject)
    console.log('Ministry Notified:', bccList.includes(MINISTRY_EMAIL))

    return NextResponse.json({
      success: true,
      messageId: `mock-${Date.now()}`,
      to,
      bcc: bccList,
      ministryNotified: true,
      mock: true,
      note: 'Install Resend to enable real email sending: npm install resend',
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
