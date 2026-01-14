# CashBus - Deployment Checklist

## Environment Variables (Vercel)

וודאי שכל המשתנים הבאים מוגדרים ב-Vercel Dashboard:

### 1. Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Resend Email API
```
RESEND_API_KEY=your_resend_api_key
```

**איך להוסיף ב-Vercel:**
1. לכי ל-[Vercel Dashboard](https://vercel.com/dashboard)
2. בחרי בפרויקט CashBus
3. Settings → Environment Variables
4. הוסיפי כל משתנה עם הערך המתאים
5. וודאי שהמשתנים זמינים ל-Production, Preview, Development

---

## Database Setup (Supabase)

### Step 1: הוספת Admin User
הריצי את הקובץ `supabase/ADD_ADMIN_SIVAN.sql` ב-Supabase SQL Editor:

1. פתחי את [Supabase Dashboard](https://supabase.com/dashboard)
2. בחרי בפרויקט שלך
3. לכי ל-SQL Editor
4. העתיקי והדבקי את התוכן של `supabase/ADD_ADMIN_SIVAN.sql`
5. לחצי על Run

**תוצאה צפויה:** תראי שורה עם המייל `sivan.baruch200@gmail.com` ותפקיד `super_admin`.

---

## Email Setup (Resend)

### הגדרת Resend:
1. הירשמי ל-[Resend](https://resend.com)
2. אמתי את הדומיין `cashbus.co.il` (או השתמשי ב-onboarding domain)
3. צרי API Key חדש:
   - לכי ל-API Keys
   - לחצי Create API Key
   - תני שם: "CashBus Production"
   - העתיקי את ה-Key
4. הוסיפי את ה-Key ל-Vercel Environment Variables: `RESEND_API_KEY`

### בדיקת שליחת מיילים:
המערכת תשלח מיילים אוטומטית ל:
- **To:** חברת האוטובוסים (מתוך טבלת `bus_companies`)
- **BCC:** משרד התחבורה (`Pniotcrm@mot.gov.il`) - **אוטומטי ותמיד!**

---

## Post-Deployment Testing

### 1. בדיקת התחברות Admin
1. גשי ל-https://cash-bus.vercel.app/auth
2. התחברי עם המייל: `sivan.baruch200@gmail.com`
3. לאחר התחברות, גשי ל-https://cash-bus.vercel.app/admin
4. וודאי שאת רואה את ממשק הניהול

### 2. בדיקת כפתור Logout
1. וודאי שבדף הלקוח (dashboard) יש כפתור "התנתק" בצד שמאל למעלה
2. לחצי עליו ווודאי שאת מופנית ל-/auth

### 3. בדיקת שליחת מכתבים (אופציונלי - רק אם יש דיווח ממשי)
1. גשי לדף Admin → ניהול תביעות
2. בחרי דיווח
3. לחצי "יצא מכתב התראה"
4. לאחר שהמכתב נוצר, לחצי "שלח למייל החברה"
5. וודאי שהמייל נשלח למייל החברה + BCC למשרד התחבורה

---

## Troubleshooting

### אם לא מצליחה להיכנס ל-Admin:
- וודאי שהרצת את `ADD_ADMIN_SIVAN.sql` ב-Supabase
- בדקי שהמייל שלך קיים ב-`auth.users` (התחברת לפחות פעם אחת)
- בדקי שהטבלה `admin_users` קיימת

### אם שליחת מייל נכשלת:
- וודאי ש-`RESEND_API_KEY` מוגדר ב-Vercel
- בדקי שה-API Key תקף ב-Resend Dashboard
- וודאי שאימתת את הדומיין ב-Resend (או השתמשי ב-onboarding domain)

---

**Status:** Ready for Production 🚀
**Last Updated:** 2026-01-14
