/**
 * GYRO Reminder System - Send Reminders Edge Function
 *
 * This Supabase Edge Function sends automated reminder emails
 * following the 14-Day Loop strategy:
 *
 * Day 0: Initial letter (sent manually)
 * Day 2: Status check reminder
 * Day 5: Second warning + evidence
 * Day 8: Legal escalation notice
 * Day 11: Final warning
 * Day 12-14: Daily pressure emails
 *
 * Deployment:
 *   supabase functions deploy send-reminders --no-verify-jwt
 *
 * Cron Setup (in Supabase Dashboard > Database > Extensions > pg_cron):
 *   SELECT cron.schedule(
 *     'send-daily-reminders',
 *     '0 9 * * *',  -- Run at 9:00 AM daily
 *     $$
 *     SELECT
 *       net.http_post(
 *         url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders',
 *         headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
 *         body:='{}'::jsonb
 *       ) AS request_id;
 *     $$
 *   );
 */

// @deno-types="https://esm.sh/@supabase/supabase-js@2"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReminderRecord {
  reminder_id: string
  claim_id: string
  user_id: string
  days_since_initial: number
  next_reminder_type: string
  customer_name: string
  customer_email: string
  bus_company: string
  total_compensation: number
}

// Email templates for each reminder type
const getEmailContent = (type: string, data: ReminderRecord) => {
  const daysRemaining = 14 - data.days_since_initial

  switch (type) {
    case 'day_2':
      return {
        subject: `בדיקת סטטוס - תביעה מס' ${data.claim_id.slice(0, 8)}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
            <div style="background: white; padding: 30px; border-radius: 8px;">
              <h2 style="color: #FF8C00;">שלום ${data.customer_name},</h2>
              <p>טרם התקבל אישור קבלת פנייה מחברת ${data.bus_company} בנוגע לתביעה שהוגשה ביום א'.</p>
              <p><strong>מספר תביעה:</strong> ${data.claim_id.slice(0, 12)}</p>
              <p><strong>סכום פיצוי:</strong> ${data.total_compensation} ₪</p>
              <div style="background: #FFF8E1; padding: 15px; border-right: 4px solid #FFA726; margin: 20px 0;">
                <p style="margin: 0;"><strong>⏱ נותרו ${daysRemaining} ימים</strong> עד להגשת כתב תביעה לבית המשפט.</p>
              </div>
              <p style="color: #666; font-size: 14px;">מכתב זה נשלח אוטומטית על ידי מערכת CashBus.</p>
            </div>
          </div>
        `,
      }

    case 'day_5':
      return {
        subject: `התראה שנייה - תביעה ${data.claim_id.slice(0, 8)} + נספח ראיות`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
            <div style="background: white; padding: 30px; border-radius: 8px;">
              <h2 style="color: #D32F2F;">התראה שנייה - הוספת ראיות דיגיטליות</h2>
              <p>שלום ${data.customer_name},</p>
              <p>עברו 5 ימים ממכתב ההתראה הראשוני ולא התקבלה תגובה מחברת ${data.bus_company}.</p>
              <div style="background: #E3F2FD; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #0D47A1; margin-top: 0;">🔒 אימות דיגיטלי - נספח ראיות</h3>
                <p>האירוע תועד בזמן אמת באמצעות מערכת CashBus. הראיות הדיגיטליות שמורות במערכת:</p>
                <ul>
                  <li>אימות מיקום GPS (דיוק של 8-15 מטרים)</li>
                  <li>תיעוד צילומי של קבלות הוצאות</li>
                  <li>אימות נתוני SIRI ממשרד התחבורה</li>
                </ul>
                <p><strong>כל הנתונים יוצגו כראיה בבית המשפט.</strong></p>
              </div>
              <div style="background: #FFEBEE; padding: 15px; border-right: 4px solid #D32F2F; margin: 20px 0;">
                <p style="margin: 0;"><strong>⏱ נותרו ${daysRemaining} ימים</strong> עד להגשת כתב תביעה.</p>
                <p style="margin: 10px 0 0 0; font-size: 14px;">סכום התביעה: <strong>${data.total_compensation} ₪</strong></p>
              </div>
            </div>
          </div>
        `,
      }

    case 'day_8':
      return {
        subject: `הודעה על הסלמה משפטית - תביעה ${data.claim_id.slice(0, 8)}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
            <div style="background: white; padding: 30px; border-radius: 8px;">
              <h2 style="color: #C62828;">⚖️ הודעה על הסלמה משפטית</h2>
              <p>אל: חברת ${data.bus_company} בע"מ</p>
              <p>בנוגע ל: תביעת פיצויים של ${data.customer_name}</p>
              <div style="background: #FFF3E0; padding: 20px; border-right: 4px solid #F57C00; margin: 20px 0;">
                <h3 style="color: #E65100; margin-top: 0;">התיק הועבר להכנת כתב תביעה</h3>
                <p>נוכח העדר תגובה מטעמכם, התיק הועבר למערכת CashBus להכנת כתב תביעה אוטומטי לבית המשפט לתביעות קטנות.</p>
                <p><strong>סכום התביעה:</strong> ${data.total_compensation} ₪</p>
                <p><strong>עלויות משפט צפויות:</strong> אגרות בית משפט + שכ"ט עו"ד + הפסדי זמן נוספים</p>
              </div>
              <div style="background: #FFEBEE; padding: 15px; border-right: 4px solid #D32F2F; margin: 20px 0;">
                <p style="margin: 0;"><strong>⏱ ${daysRemaining} ימים</strong> להסדרת התשלום לפני הגשת התביעה.</p>
              </div>
            </div>
          </div>
        `,
      }

    case 'day_11':
      return {
        subject: `התראה אחרונה - 3 ימים להגשת תביעה`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
            <div style="background: white; padding: 30px; border-radius: 8px;">
              <h2 style="color: #B71C1C;">🚨 התראה אחרונה לפני הגשת תביעה</h2>
              <p>אל: חברת ${data.bus_company} בע"מ</p>
              <div style="background: #FFEBEE; padding: 25px; border: 2px solid #D32F2F; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #B71C1C; margin-top: 0; text-align: center;">⏱ נותרו 3 ימים בלבד</h3>
                <p style="text-align: center; font-size: 18px; margin: 0;"><strong>תאריך יעד: ${new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000).toLocaleDateString('he-IL')}</strong></p>
              </div>
              <p>זו ההזדמנות האחרונה להסדיר את התשלום לפני הגשת כתב תביעה לבית המשפט.</p>
              <p><strong>סכום לתשלום:</strong> ${data.total_compensation} ₪</p>
              <p><strong>במידה ולא יתקבל תשלום תוך 3 ימים:</strong></p>
              <ul style="color: #D32F2F;">
                <li>יוגש כתב תביעה אוטומטי לבית המשפט</li>
                <li>החברה תחויב בהוצאות משפט ואגרות נוספות</li>
                <li>ההליך יועבר לכפייה משפטית</li>
              </ul>
              <div style="background: #F5F5F5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #666;">מכתב זה מהווה התראה רשמית. כל הנתונים והראיות הדיגיטליות שמורים במערכת CashBus.</p>
              </div>
            </div>
          </div>
        `,
      }

    case 'day_12':
    case 'day_13':
      const dayNum = type === 'day_12' ? 12 : 13
      return {
        subject: `⚠️ ${daysRemaining} ימים להגשת תביעה - תביעה ${data.claim_id.slice(0, 8)}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
            <div style="background: #D32F2F; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 32px;">${daysRemaining}</h1>
              <p style="margin: 5px 0; font-size: 18px;">ימים עד הגשת התביעה</p>
            </div>
            <div style="background: white; padding: 30px;">
              <p>חברת ${data.bus_company} בע"מ,</p>
              <p>זהו יום ${dayNum} מתוך 14 ימי ההתראה.</p>
              <p><strong>סכום לתשלום:</strong> ${data.total_compensation} ₪</p>
              <p>ביום 14 יוגש כתב תביעה אוטומטי לבית המשפט ללא כל התראה נוספת.</p>
              <div style="background: #FFEBEE; padding: 15px; margin: 20px 0; border-radius: 8px;">
                <p style="margin: 0; text-align: center; font-weight: bold; color: #D32F2F;">
                  הספירה לאחור החלה
                </p>
              </div>
            </div>
          </div>
        `,
      }

    case 'day_14':
      return {
        subject: `🔴 הגשת כתב תביעה - תביעה ${data.claim_id.slice(0, 8)}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
            <div style="background: #B71C1C; color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 36px;">⚖️</h1>
              <h2 style="margin: 10px 0 0 0;">כתב תביעה מוכן להגשה</h2>
            </div>
            <div style="background: white; padding: 30px;">
              <p>חברת ${data.bus_company} בע"מ,</p>
              <p>14 ימי ההתראה הסתיימו ללא קבלת תשלום או תגובה מטעמכם.</p>
              <div style="background: #FFEBEE; padding: 25px; border: 2px solid #D32F2F; margin: 20px 0;">
                <h3 style="color: #B71C1C; margin-top: 0;">כתב תביעה מוכן להגשה לבית המשפט</h3>
                <p><strong>סכום תביעה:</strong> ${data.total_compensation} ₪</p>
                <p><strong>תובע:</strong> ${data.customer_name}</p>
                <p><strong>מספר תביעה:</strong> ${data.claim_id.slice(0, 12)}</p>
                <p style="margin: 15px 0 0 0; color: #D32F2F;">
                  הכתב מוכן להורדה ממערכת נט-המשפט במידה ולא יתקבל תשלום תוך 24 שעות.
                </p>
              </div>
              <p style="font-size: 14px; color: #666;">זוהי ההודעה האחרונה לפני הגשת התביעה הפורמלית.</p>
            </div>
          </div>
        `,
      }

    default:
      return {
        subject: `עדכון תביעה - ${data.claim_id.slice(0, 8)}`,
        html: `<p>תזכורת בנוגע לתביעה ${data.claim_id.slice(0, 8)}</p>`,
      }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }

    if (!resendApiKey) {
      throw new Error('Missing RESEND_API_KEY environment variable')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get all pending reminders
    const { data: pendingReminders, error: fetchError } = await supabase
      .rpc('get_pending_reminders')

    if (fetchError) {
      throw new Error(`Failed to fetch reminders: ${fetchError.message}`)
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending reminders to send',
          sent: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    const results = []

    // Process each reminder
    for (const reminder of pendingReminders) {
      try {
        // Skip if no reminder needed
        if (reminder.next_reminder_type === 'none') {
          continue
        }

        // Get email content
        const emailContent = getEmailContent(reminder.next_reminder_type, reminder)

        // Send email via Resend
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'CashBus Legal <legal@cashbus.co.il>',
            to: [reminder.customer_email],
            bcc: [`${reminder.bus_company.toLowerCase().replace(/\s/g, '')}@example.com`, 'Pniotcrm@mot.gov.il'],
            subject: emailContent.subject,
            html: emailContent.html,
          }),
        })

        if (!emailResponse.ok) {
          const error = await emailResponse.text()
          throw new Error(`Resend API error: ${error}`)
        }

        // Mark reminder as sent
        await supabase.rpc('mark_reminder_sent', {
          p_reminder_id: reminder.reminder_id,
          p_reminder_type: reminder.next_reminder_type,
        })

        results.push({
          claim_id: reminder.claim_id,
          reminder_type: reminder.next_reminder_type,
          status: 'sent',
        })
      } catch (err) {
        results.push({
          claim_id: reminder.claim_id,
          reminder_type: reminder.next_reminder_type,
          status: 'failed',
          error: err.message,
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} reminders`,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in send-reminders function:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
