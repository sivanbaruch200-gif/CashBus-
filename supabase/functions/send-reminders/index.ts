/**
 * Reminder System - Send Reminders Edge Function (21-Day Cycle)
 *
 * This Supabase Edge Function sends automated reminder emails
 * following a 21-Day weekly cycle (per lawyer consultation 2026-02-17):
 *
 * Day 0: Initial demand letter (sent manually, 21-day deadline)
 * Day 7: First reminder + digital evidence summary
 * Day 14: Second reminder + legal escalation warning
 * Day 21: Final notice - lawsuit draft ready
 *
 * IMPORTANT: Lawyer ruled reminders every 2 days = harassment.
 * Minimum interval between reminders: 7 days.
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

// Email templates for each reminder type (21-day cycle, weekly intervals)
const getEmailContent = (type: string, data: ReminderRecord) => {
  const daysRemaining = 21 - data.days_since_initial

  switch (type) {
    case 'day_7':
      return {
        subject: `תזכורת - דרישת פיצוי מס' ${data.claim_id.slice(0, 8)} טרם נענתה`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
            <div style="background: #1e293b; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 22px;">CashBus Legal</h1>
              <p style="margin: 5px 0 0 0; font-size: 13px; color: #94a3b8;">תזכורת ראשונה - דרישת פיצוי</p>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="font-size: 15px; line-height: 1.8;">אל: חברת ${data.bus_company} בע"מ</p>
              <p style="font-size: 15px; line-height: 1.8;">בנוגע ל: דרישת פיצוי של ${data.customer_name}</p>
              <p style="font-size: 15px; line-height: 1.8;">לפני שבוע נשלח אליכם מכתב דרישה לפיצוי בגין הפרת חוזה הובלה. עד כה לא התקבלה תגובה מטעמכם.</p>
              <div style="background: #E3F2FD; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #0D47A1; margin-top: 0;">ראיות דיגיטליות שמורות במערכת</h3>
                <p>האירוע תועד בזמן אמת באמצעות מערכת CashBus:</p>
                <ul>
                  <li>אימות מיקום GPS (תיעוד בזמן אמת)</li>
                  <li>נתוני SIRI ממשרד התחבורה</li>
                  <li>תיעוד צילומי (ככל שרלוונטי)</li>
                </ul>
                <p><strong>כל הנתונים יוצגו כראיה בבית המשפט במידת הצורך.</strong></p>
              </div>
              <div style="background: #FFF8E1; padding: 15px; border-right: 4px solid #FFA726; margin: 20px 0;">
                <p style="margin: 0;"><strong>נותרו ${daysRemaining} ימים</strong> מתוך 21 ימי ההתראה למתן מענה לדרישה.</p>
              </div>
              <p style="font-size: 13px; color: #94a3b8;">מספר אסמכתא: ${data.claim_id.slice(0, 12)}</p>
            </div>
            <div style="background: #f8fafc; padding: 15px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">CashBus | legal@cashbuses.com | www.cashbuses.com</p>
            </div>
          </div>
        `,
      }

    case 'day_14':
      return {
        subject: `התראה לפני הגשת תביעה - דרישה ${data.claim_id.slice(0, 8)}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
            <div style="background: #1e293b; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 22px;">CashBus Legal</h1>
              <p style="margin: 5px 0 0 0; font-size: 13px; color: #94a3b8;">התראה לפני הגשת תביעה</p>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="font-size: 15px; line-height: 1.8;">אל: חברת ${data.bus_company} בע"מ</p>
              <p style="font-size: 15px; line-height: 1.8;">בנוגע ל: דרישת פיצוי של ${data.customer_name}</p>
              <div style="background: #FFF3E0; padding: 20px; border-right: 4px solid #F57C00; margin: 20px 0;">
                <h3 style="color: #E65100; margin-top: 0;">התיק הועבר להכנת כתב תביעה</h3>
                <p>חלפו 14 ימים ממכתב הדרישה המקורי ולא התקבלה תגובה מטעמכם. בהתאם, התיק הועבר להכנת כתב תביעה לבית המשפט לתביעות קטנות.</p>
                <p>לידיעתכם, בתק (י-ם) 5312/07 נפסק פיצוי של 2,000 ש"ח בגין איחור רכבת. בית המשפט קבע: "הקפדה על לוח זמנים היא אינטרס לאומי".</p>
              </div>
              <div style="background: #FFEBEE; padding: 15px; border-right: 4px solid #D32F2F; margin: 20px 0;">
                <p style="margin: 0;"><strong>נותרו ${daysRemaining} ימים</strong> להסדרת התשלום לפני הגשת התביעה.</p>
                <p style="margin: 10px 0 0 0; font-size: 14px;">במקרה של הגשת תביעה, יידרש גם פיצוי בגין הוצאות משפט, אגרות, ועוגמת נפש.</p>
              </div>
              <p style="font-size: 15px; line-height: 1.8;">כמו כן, אנו שוקלים לדווח על כשלי השירות למשרד התחבורה כחלק מתיעוד שיטתי.</p>
              <p style="font-size: 13px; color: #94a3b8;">מספר אסמכתא: ${data.claim_id.slice(0, 12)}</p>
            </div>
            <div style="background: #f8fafc; padding: 15px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">CashBus | legal@cashbuses.com | www.cashbuses.com</p>
            </div>
          </div>
        `,
      }

    case 'day_21':
      return {
        subject: `הודעה אחרונה - כתב תביעה מוכן להגשה - ${data.claim_id.slice(0, 8)}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
            <div style="background: #B71C1C; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 22px;">CashBus Legal</h1>
              <p style="margin: 5px 0 0 0; font-size: 13px; color: #ffcdd2;">הודעה אחרונה לפני הגשת תביעה</p>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="font-size: 15px; line-height: 1.8;">אל: חברת ${data.bus_company} בע"מ</p>
              <p style="font-size: 15px; line-height: 1.8;">בנוגע ל: דרישת פיצוי של ${data.customer_name}</p>
              <div style="background: #FFEBEE; padding: 25px; border: 2px solid #D32F2F; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #B71C1C; margin-top: 0; text-align: center;">21 ימי ההתראה הסתיימו</h3>
                <p>חלפו 21 ימים ממכתב הדרישה המקורי ולא התקבלה תגובה או תשלום מטעמכם.</p>
                <p><strong>כתב תביעה מוכן להגשה לבית המשפט לתביעות קטנות.</strong></p>
                <p><strong>תובע:</strong> ${data.customer_name}</p>
                <p><strong>מספר אסמכתא:</strong> ${data.claim_id.slice(0, 12)}</p>
              </div>
              <p style="font-size: 15px; line-height: 1.8;">כתב התביעה יוגש בצירוף כל הראיות הדיגיטליות שנאספו, לרבות:</p>
              <ul style="font-size: 15px; line-height: 1.8;">
                <li>תיעוד GPS בזמן אמת</li>
                <li>נתוני SIRI ממשרד התחבורה</li>
                <li>העתקי מכתבי הדרישה וההתראה</li>
              </ul>
              <p style="font-size: 15px; line-height: 1.8;">במקרה של הגשת תביעה, יידרש פיצוי כספי בתוספת הוצאות משפט, אגרות, עוגמת נפש, והפרשי הצמדה וריבית.</p>
              <p style="font-size: 13px; color: #94a3b8;">זוהי ההודעה האחרונה לפני נקיטת הליכים משפטיים.</p>
            </div>
            <div style="background: #f8fafc; padding: 15px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">CashBus | legal@cashbuses.com | www.cashbuses.com</p>
            </div>
          </div>
        `,
      }

    default:
      return {
        subject: `עדכון דרישת פיצוי - ${data.claim_id.slice(0, 8)}`,
        html: `<div dir="rtl"><p>תזכורת בנוגע לדרישת פיצוי ${data.claim_id.slice(0, 8)}</p></div>`,
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
            from: 'CashBus Legal <legal@cashbuses.com>',
            to: [reminder.customer_email],
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
