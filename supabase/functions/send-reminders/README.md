# Send Reminders Edge Function

מערכת שליחת תזכורות אוטומטיות (GYRO Model - 14-Day Loop)

## תיאור

Edge Function זה אחראי על שליחת מכתבי תזכורת אוטומטיים לחברות האוטובוסים במסגרת מודל ההתשה.

### לוח זמנים (14 ימים):

- **יום 0**: מכתב התראה ראשוני (נשלח ידנית)
- **יום 2**: בדיקת סטטוס - "טרם התקבל אישור קבלה"
- **יום 5**: התראה שנייה + נספח ראיות דיגיטלי
- **יום 8**: הודעה על הסלמה משפטית - התיק הועבר להכנת כתב תביעה
- **יום 11**: התראה אחרונה - 3 ימים להגשת תביעה
- **יום 12**: מייל יומי - "נותרו 2 ימים"
- **יום 13**: מייל יומי - "נותר יום אחד"
- **יום 14**: הודעה סופית - "כתב תביעה מוכן להגשה"

## דיפלוי (Deployment)

### 1. Set up environment variables

במסך Supabase Dashboard > Edge Functions > Secrets, הוסף:

```bash
RESEND_API_KEY=re_xxxxxxxxxx
```

### 2. Deploy the function

```bash
cd "c:\Users\sivan\OneDrive\Desktop\CashBus- Project"
supabase functions deploy send-reminders --no-verify-jwt
```

### 3. Set up cron job

ב-Supabase Dashboard > Database > SQL Editor, הרץ:

```sql
-- Schedule daily execution at 9:00 AM
SELECT cron.schedule(
  'send-daily-reminders',
  '0 9 * * *',  -- 9:00 AM every day
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) AS request_id;
  $$
);
```

החלף:
- `YOUR_PROJECT_REF` בפרויקט שלך מ-Supabase
- `YOUR_SERVICE_ROLE_KEY` ב-Service Role Key שלך

### 4. Manual trigger (for testing)

```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## מבנה Email Templates

כל תזכורת כוללת:
- כותרת דינמית לפי שלב
- ספירה לאחור של ימים נותרים
- פרטי התביעה (מספר, סכום, שם לקוח)
- קריאה לפעולה (CTA) ברורה
- עיצוב RTL עברי מותאם

### דוגמה ליום 14:

```html
🔴 הגשת כתב תביעה - תביעה XXXXXXXX
⚖️ כתב תביעה מוכן להגשה
הכתב מוכן להורדה ממערכת נט-המשפט
```

## Logs & Monitoring

### Check cron job status:

```sql
SELECT * FROM cron.job WHERE jobname = 'send-daily-reminders';
```

### View execution history:

```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'send-daily-reminders')
ORDER BY start_time DESC
LIMIT 10;
```

### Check function logs:

```bash
supabase functions logs send-reminders --tail
```

## Testing

### Manual test of a specific reminder:

```sql
-- Create a test reminder entry
INSERT INTO public.letter_reminders (claim_id, user_id, initial_letter_sent_at, status)
VALUES (
  'YOUR_CLAIM_ID',
  'YOUR_USER_ID',
  NOW() - INTERVAL '5 days',  -- Test day 5 reminder
  'active'
);

-- Then trigger the function manually
```

## Email Recipients

כל מייל נשלח ל:
- **TO**: אימייל הלקוח
- **BCC**:
  - כתובת החברה (נגזרת מ-bus_company)
  - `Pniotcrm@mot.gov.il` (משרד התחבורה)

## Integration with Resend

ה-Edge Function משתמש ב-Resend API לשליחת מיילים:
- `from`: `CashBus Legal <legal@cashbus.co.il>`
- עיצוב HTML מלא RTL
- תמיכה בתבניות דינמיות
