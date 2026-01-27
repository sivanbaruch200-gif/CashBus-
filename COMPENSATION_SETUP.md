# תיעוד הכנת מערכת מחשבון הפיצויים והעלאת קבלות

## סיכום עבודה שבוצעה

סיימנו להכין את התשתית למחשבון הפיצויים והעלאת קבלות במסגרת תשתית GYRO.

### שינויים שבוצעו:

1. **רכיב מחשבון פיצוי חדש** (`components/CompensationCalculator.tsx`):
   - חישוב אוטומטי לפי תקנות: זמן המתנה (100 ש"ח לשעה), נזק ישיר והפסד השתכרות
   - העלאת קבלות (תמונה או PDF) עם תצוגה מקדימה
   - הצגת פילוח מפורט של הפיצוי (בסיס + נזק) + בסיס משפטי

2. **PanicButton.tsx** - עודכן כדי לכלול:
   - שדה `receiptFile` ב-`IncidentFormData`
   - שדות compensation: `baseCompensation`, `damageCompensation`, `totalCompensation`, `legalBasis`
   - חישוב פיצוי אוטומטי בזמן שליחת הדיווח

3. **Supabase Schema (`lib/supabase.ts`)** - עודכן:
   - הוספנו שדה `receipt_urls` לטבלת `Incident`
   - הוספנו שדות הפיצוי: `base_compensation`, `damage_compensation`, `total_compensation`, `legal_basis`, `delay_minutes`
   - פונקציה חדשה: `uploadReceipt()` להעלאת קבלות ל-Supabase Storage
   - `createIncidentWithPhoto()` עודכן לתמוך גם ב-`receiptFile`

4. **Dashboard (`app/dashboard/page.tsx`)**:
   - עודכן `handleIncidentSubmit()` לשלוח את כל נתוני הפיצוי והקבלה

5. **SQL Migration** (`supabase/migrations/add_compensation_fields.sql`):
   - הוספת שדות חדשים לטבלת `incidents`
   - טריגר אוטומטי לעדכון `profiles.pending_compensation` & `profiles.total_potential`

---

## צעדי הפעלה (Manual Steps)

### 1. הרצת SQL Migration ב-Supabase

**עליך להריץ את הקובץ:** `supabase/migrations/add_compensation_fields.sql`

**בצעי את הצעדים הבאים:**
1. היכנסי ל-[Supabase Dashboard](https://app.supabase.com/project/ltlfifqtprtkwprwwpxq)
2. עברי ל-**SQL Editor**
3. העתיקי את התוכן של הקובץ `supabase/migrations/add_compensation_fields.sql`
4. הדביקי ב-SQL Editor והריצי (לחצי על **RUN**)
5. וודאי שהטבלה עודכנה:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'incidents'
   AND column_name IN ('delay_minutes', 'base_compensation', 'damage_compensation', 'total_compensation', 'legal_basis', 'receipt_urls');
   ```

---

### 2. יצירת Storage Bucket לקבלות

**עליך ליצור Bucket חדש בשם `receipts`:**

1. עברי ל-**Storage** בתפריט הצד של Supabase
2. לחצי על **+ New Bucket**
3. הגדירי:
   - **Name:** `receipts`
   - **Public bucket:** ✅ (כן - כדי שנוכל להציג קבלות)
   - **File size limit:** 10MB
   - **Allowed MIME types:** `image/*`, `application/pdf`
4. לחצי על **Create bucket**

**הגדרת Policies (חשוב!):**

לאחר יצירת ה-Bucket, הוסיפי את ה-Policies הבאים:

```sql
-- Policy 1: Users can upload their own receipts
CREATE POLICY "Users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Users can view their own receipts
CREATE POLICY "Users can view own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Public access to receipts (if needed for legal documents)
CREATE POLICY "Public can view receipts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'receipts');
```

---

### 3. בדיקה מהירה

לאחר השלמת הצעדים לעיל:

1. עברי לדאשבורד: `http://localhost:3000/dashboard`
2. לחצי על כפתור ה-Panic
3. מלאי את הטופס כולל:
   - סוג התקלה
   - נזק נוסף (למשל "הוצאות מונית")
   - סכום נזק
   - העלאת קבלה
4. שלחי את הדיווח
5. בדקי ב-Supabase Storage שהקבלה הועלתה תחת `receipts/[user_id]/...`
6. בדקי בטבלת `incidents` שהשדות הבאים התמלאו:
   - `base_compensation`
   - `damage_compensation`
   - `total_compensation`
   - `legal_basis`
   - `receipt_urls`

---

## מה הבא? (השלבים הבאים)

אחרי שהתשתית מוכנה ופועלת:

1. **מבנה מכתב משפטי** (`lib/pdfGenerator.ts`):
   - עדכון התבנית לביסוס משפטי מדויק
   - כולל: ת.ז נוסע, פרטי אירוע, סכום מחשבון הפיצוי

2. **ממשק ניהול (Admin UI)**:
   - ניהול דיווחים (לקוחות + מנהל)
   - "תור מכתבים" (Queue) - טיוטות PDF לאישור ידני

3. **מודל ההתשה (GYRO)**:
   - מנגנון התראות: 7 ימים אחרי מכתב → תזכורת
   - התשה פרטנית על כל מקרה

---

## קבצים שנוצרו/עודכנו:

### קבצים חדשים:
- `components/CompensationCalculator.tsx`
- `supabase/migrations/add_compensation_fields.sql`
- `COMPENSATION_SETUP.md` (הקובץ הזה)

### קבצים מעודכנים:
- `components/PanicButton.tsx`
- `lib/supabase.ts`
- `app/dashboard/page.tsx`

---

## סטטוס עבודה:

✅ רכיב מחשבון פיצוי
✅ העלאת קבלות (Frontend)
✅ עדכון TypeScript types
✅ פונקציות Supabase לקבלות
✅ SQL Migration להוספת שדות
⏳ הרצת Migration על Supabase (Manual - ממתינה לביצוע)
⏳ יצירת Storage Bucket `receipts` (Manual - ממתינה לביצוע)

---

**מוכנה להמשיך?** אחרי שתשלימי את הצעדים הידניים (SQL + Storage), נוכל לבדוק שהכל עובד ולעבור לשלבים הבאים! 🚀