/**
 * API Route: Send Parental Consent Email
 *
 * Sends email to parent requesting consent for minor to use CashBus
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
    const { consentId, parentEmail, parentName, minorName, token } = body

    // Validate required fields
    if (!parentEmail || !parentName || !minorName || !token) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Build consent form URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cashbuses.com'
    const consentUrl = `${baseUrl}/consent/${token}`

    // Send email with Resend
    const { data, error } = await getResend().emails.send({
      from: 'CashBus <noreply@cashbuses.com>',
      replyTo: 'cash.bus200@gmail.com',
      to: [parentEmail],
      subject: `נדרשת הסכמתך - ${minorName} רוצה להשתמש ב-CashBus`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f97316; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">CashBus</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px;">בקשת הסכמת הורים</p>
          </div>

          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #374151;">שלום ${parentName},</p>

            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              <strong>${minorName}</strong> נרשם/ה לשירות CashBus ומכיוון שהוא/היא מתחת לגיל 18, נדרשת הסכמתך כהורה/אפוטרופוס.
            </p>

            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #92400e;">מה זה CashBus?</h3>
              <p style="margin: 0; color: #78350f; font-size: 14px;">
                CashBus הוא שירות לקבלת פיצוי אוטומטי כאשר אוטובוס מאחר, לא עוצר או לא מגיע.
                השירות מתעד את האירועים ומסייע בהגשת דרישות פיצוי מחברות התחבורה הציבורית.
              </p>
            </div>

            <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #1e40af;">מודל התשלום</h3>
              <p style="margin: 0; color: #1e3a8a; font-size: 14px;">
                <strong>אין תשלום מראש!</strong><br>
                רק במקרה של קבלת פיצוי: 80% ללקוח, 20% עמלת שירות.
              </p>
            </div>

            <p style="font-size: 16px; color: #374151; margin: 25px 0;">
              כדי לאשר את השימוש, יש ללחוץ על הכפתור הבא ולמלא את טופס ההסכמה:
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${consentUrl}"
                 style="display: inline-block; background-color: #f97316; color: white; padding: 15px 40px; font-size: 18px; font-weight: bold; text-decoration: none; border-radius: 8px;">
                לטופס הסכמת הורים
              </a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              <strong>שים לב:</strong> לינק זה תקף ל-7 ימים. אם לא תאשר/י בזמן, ${minorName} לא יוכל/תוכל להשתמש בשירות.
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
              הודעה זו נשלחה מ-CashBus בעקבות בקשת הרשמה.<br>
              אם לא ביקשת הסכמה זו או שאינך מכיר/ה את ${minorName}, ניתן להתעלם מהודעה זו.
            </p>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      // Log failed email
      await supabase.from('email_logs').insert({
        message_id: null,
        from_email: 'noreply@cashbuses.com',
        to_email: parentEmail,
        subject: `נדרשת הסכמתך - ${minorName} רוצה להשתמש ב-CashBus`,
        status: 'failed',
        error_message: error.message,
        consent_id: consentId || null,
        email_type: 'parental_consent',
        metadata: { minorName, parentName }
      })
      throw new Error(error.message)
    }

    // Log successful email to email_logs table (legal evidence)
    await supabase.from('email_logs').insert({
      message_id: data?.id,
      from_email: 'noreply@cashbuses.com',
      to_email: parentEmail,
      subject: `נדרשת הסכמתך - ${minorName} רוצה להשתמש ב-CashBus`,
      status: 'sent',
      consent_id: consentId || null,
      email_type: 'parental_consent',
      metadata: { minorName, parentName, consentUrl }
    })

    // Update the consent record with email sent timestamp
    if (consentId) {
      await supabase
        .from('parental_consents')
        .update({
          email_sent_at: new Date().toISOString(),
        })
        .eq('id', consentId)
    }

    return NextResponse.json({
      success: true,
      messageId: data?.id,
    })
  } catch (error) {
    console.error('Error sending consent email:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send email',
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
