# מדריך דיפלוי - מערכת GYRO (14-Day Loop)

מדריך מלא להטמעת מערכת התזכורות האוטומטיות של CashBus

## סקירה כללית

מערכת GYRO (Get Your Rights Onward) היא מערכת אוטומטית לשליחת מכתבי התראה ותזכורות לחברות אוטובוסים במודל ה-14 ימים האינטנסיבי.

### לוח זמנים (The 14-Day Loop):

| יום | סוג תזכורת | תוכן |
|-----|-----------|------|
| 0 | מכתב התראה ראשוני | PDF משפטי מלא עם בסיס משפטי + ראיות דיגיטליות |
| 2 | בדיקת סטטוס | "טרם התקבל אישור קבלה מחברת X" |
| 5 | התראה שנייה + ראיות | הוספת נספח ראיות דיגיטלי (GPS + SIRI) |
| 8 | הסלמה משפטית | "התיק הועבר להכנת כתב תביעה" |
| 11 | התראה אחרונה | "נותרו 3 ימים להגשת התביעה" |
| 12-13 | לחץ יומי | ספירה לאחור ("נותרו X ימים") |
| 14 | כתב תביעה מוכן | PDF מוכן להגשה בנט-המשפט |

---

## שלב 1: Database Migration

### 1.1 הרצת ה-SQL Migration

ב-Supabase Dashboard > SQL Editor:

```sql
-- הרץ את הקובץ:
-- supabase/migrations/add_reminder_system.sql
```

או דרך CLI:

```bash
cd "c:\Users\sivan\OneDrive\Desktop\CashBus- Project"
supabase db push
```

### 1.2 אימות שהטבלה נוצרה

```sql
-- בדוק שהטבלה נוצרה
SELECT * FROM information_schema.tables
WHERE table_name = 'letter_reminders';

-- בדוק שהפונקציות נוצרו
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN ('get_pending_reminders', 'mark_reminder_sent');
```

---

## שלב 2: Deploy Edge Function

### 2.1 הוספת Secrets

ב-Supabase Dashboard > Edge Functions > Secrets:

```
RESEND_API_KEY=re_xxxxxxxxxxxx
```

### 2.2 Deploy the Function

```bash
cd "c:\Users\sivan\OneDrive\Desktop\CashBus- Project"
supabase functions deploy send-reminders --no-verify-jwt
```

### 2.3 בדיקת ה-Deployment

```bash
# Test manually
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

---

## שלב 3: Set Up Cron Job

### 3.1 Enable pg_cron Extension

ב-Supabase Dashboard > Database > Extensions:

- חפש `pg_cron`
- לחץ על "Enable"

### 3.2 Create Daily Schedule

ב-Supabase Dashboard > SQL Editor:

```sql
-- Schedule daily execution at 9:00 AM Israel time
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

**החלף:**
- `YOUR_PROJECT_REF` - ה-Project Reference שלך מ-Supabase
- `YOUR_SERVICE_ROLE_KEY` - ה-Service Role Key (Settings > API)

### 3.3 אימות ש-Cron פועל

```sql
-- בדוק שה-cron job נוצר
SELECT * FROM cron.job WHERE jobname = 'send-daily-reminders';

-- ראה היסטוריית ריצות
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'send-daily-reminders')
ORDER BY start_time DESC
LIMIT 10;
```

---

## שלב 4: הטמעת Admin Queue UI

### 4.1 הוספת לינק לתפריט Admin

ערוך את `app/admin/page.tsx` או את הניווט הראשי:

```tsx
<Link href="/admin/letter-queue">
  📧 תור מכתבים
</Link>
```

### 4.2 גישה לממשק

נווט ל:
```
http://localhost:3000/admin/letter-queue
```

או:
```
https://your-domain.com/admin/letter-queue
```

---

## שלב 5: תהליך השימוש (Workflow)

### 5.1 יצירת תביעה חדשה

1. משתמש מדווח על אירוע (Panic Button)
2. מערכת יוצרת `claim` חדש
3. Admin נכנס ל-Letter Queue

### 5.2 שליחת מכתב התראה ראשוני

1. ב-Letter Queue, לחץ על "📄 הצג PDF" - preview של המכתב
2. לחץ על "📧 אשר שליחה"
3. המערכת:
   - יוצרת רשומה ב-`letter_reminders`
   - מעדכנת את `claims.letter_sent_date`
   - משנה סטטוס ל-`company_review`
   - (אופציונלי: שולחת את המכתב דרך Resend)

### 5.3 אוטומציה של תזכורות

**החל מיום 2, ה-Edge Function יפעל אוטומטית:**

- ✅ **9:00 בבוקר כל יום** - ה-Cron מפעיל את `send-reminders`
- ✅ הפונקציה מחפשת תביעות פעילות דרך `get_pending_reminders()`
- ✅ שולחת מייל בהתאם ליום (2, 5, 8, 11, 12, 13, 14)
- ✅ מעדכנת את `letter_reminders` עם חותמת זמן
- ✅ שומרת לוג ב-DB

### 5.4 יום 14 - כתב תביעה

כאשר `days_since_initial = 14`:

1. ב-Letter Queue יופיע כפתור **"⚖️ כתב תביעה"**
2. לחיצה תוליד PDF מוכן להגשה בנט-המשפט
3. ה-PDF כולל:
   - פרטי התובע והנתבע
   - בסיס משפטי מלא
   - פירוט נזקים
   - נספח ראיות
   - מוכן להדפסה וחתימה

---

## שלב 6: מעקב וניטור

### 6.1 Logs של Edge Function

```bash
# View live logs
supabase functions logs send-reminders --tail

# View recent logs
supabase functions logs send-reminders --limit 50
```

### 6.2 מעקב ב-Database

```sql
-- כמה תזכורות פעילות?
SELECT COUNT(*) FROM letter_reminders WHERE status = 'active';

-- תביעות שמגיעות ליום 14
SELECT
  lr.claim_id,
  lr.days_since_initial,
  c.claim_amount,
  p.full_name
FROM letter_reminders lr
JOIN claims c ON lr.claim_id = c.id
JOIN profiles p ON lr.user_id = p.id
WHERE lr.status = 'active' AND lr.days_since_initial >= 14;

-- סטטיסטיקות
SELECT
  AVG(days_since_initial) AS avg_days,
  MAX(total_emails_sent) AS max_emails,
  COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
  COUNT(*) FILTER (WHERE status = 'active') AS active_count
FROM letter_reminders;
```

### 6.3 Resend Dashboard

נווט ל-[Resend Dashboard](https://resend.com/emails):
- בדוק שהמיילים נשלחו בהצלחה
- ראה bounce rate
- עקוב אחר open rate (אם מופעל)

---

## שלב 7: Customization

### 7.1 שינוי תבניות Email

ערוך את `supabase/functions/send-reminders/index.ts`:

```typescript
// חפש את הפונקציה getEmailContent
const getEmailContent = (type: string, data: ReminderRecord) => {
  // ערוך את התבניות כאן
}
```

### 7.2 שינוי לוח הזמנים

ערוך את `supabase/migrations/add_reminder_system.sql`:

```sql
-- בפונקציה get_pending_reminders(), שנה את התנאים:
WHEN EXTRACT(DAY FROM (NOW() - lr.initial_letter_sent_at))::INTEGER >= X
```

### 7.3 הוספת שדות למכתבים

ערוך את `lib/pdfGenerator.ts`:

```typescript
export interface WarningLetterData {
  // הוסף שדות חדשים כאן
  myCustomField?: string
}
```

---

## Troubleshooting

### בעיה: Edge Function לא מתריץ

```bash
# בדוק שה-cron פעיל
SELECT cron.schedule_in_database();

# בדוק errors ב-logs
SELECT * FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC;
```

### בעיה: מיילים לא נשלחים

1. בדוק שה-`RESEND_API_KEY` הוגדר נכון:
   ```bash
   supabase secrets list
   ```

2. בדוק את Resend Dashboard לשגיאות

3. ודא ש-`from` domain מאומת ב-Resend

### בעיה: PDF לא נוצר

1. בדוק שהחסרים כל השדות הנדרשים ב-`WarningLetterData`
2. בדוק console errors בדפדפן
3. ודא ש-`jsPDF` מותקן:
   ```bash
   npm install jspdf
   ```

---

## העלאת כניסה ליצרנות (Production Checklist)

- [ ] הרץ את ה-migration ב-Production DB
- [ ] Deploy Edge Function לפרודקשן
- [ ] הגדר `RESEND_API_KEY` ב-Production secrets
- [ ] צור cron job ב-Production
- [ ] אמת ש-domain מאומת ב-Resend
- [ ] בדוק ש-`from` email עובד (`legal@cashbus.co.il`)
- [ ] הפעל manual trigger test
- [ ] עקוב אחר logs למשך 24 שעות
- [ ] הוסף monitoring/alerts (Sentry, etc.)

---

## Next Steps - שיפורים עתידיים

1. **Webhook מ-Resend** - קבלת אישור קבלה/פתיחת מייל
2. **SMS Reminders** - תזכורות גם ב-SMS (Twilio)
3. **WhatsApp Integration** - שליחת מכתבים גם ב-WhatsApp Business
4. **AI Response Detection** - זיהוי אוטומטי של תשובות מהחברה
5. **Auto-Filing** - הגשה אוטומטית לנט-המשפט ביום 14

---

## תמיכה

- **Docs:** ראה את `supabase/functions/send-reminders/README.md`
- **Issues:** פתח issue ב-GitHub repo
- **Email:** support@cashbus.co.il

---

**גרסה:** 1.0.0
**תאריך עדכון אחרון:** 2026-01-15
