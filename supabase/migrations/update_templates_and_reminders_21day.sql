-- =====================================================
-- CashBus - Update Templates & Reminder System
-- Date: 2026-02-17
-- Reason: Lawyer consultation feedback
-- =====================================================
-- Changes:
-- 1. Update letter templates (remove specific amounts, add legal basis)
-- 2. Migrate reminder system from 14-day/2-day to 21-day/weekly
-- 3. Update reminder_14_days → reminder_21_days template type
-- =====================================================

-- =====================================================
-- STEP 1: Update initial_warning template
-- Remove "בהתאם לתקנות, הנני זכאי לפיצוי בסך X ש"ח"
-- Add breach of contract basis + Ministry threat
-- =====================================================

UPDATE letter_templates
SET template_content = 'לכבוד
{{company_name}}
מחלקת פניות הציבור

הנדון: דרישה לפיצוי בגין אי-הפעלת שירות נסיעה - קו {{bus_line}}

אני הח"מ, {{full_name}}, ת.ז. {{id_number}}, פונה אליכם בדרישה לפיצוי כספי בגין הפרת חוזה הובלה והפרת חובה חקוקה, בהתאם לתקנות התעבורה (תקנות 399א, 428ג).

פרטי האירוע:
- תאריך: {{incident_date}}
- קו: {{bus_line}}
- תחנה: {{station_name}}
- שעה מתוכננת: {{scheduled_time}}
- מה שקרה: {{incident_description}}

האירוע תועד בזמן אמת באמצעות מערכת GPS ונתוני SIRI ממשרד התחבורה, ומהווה ראיה דיגיטלית חד-משמעית להפרת חובת ההובלה.

רכישת כרטיס נסיעה מהווה חוזה מחייב בינכם לבין הנוסע. אי-הפעלת השירות כמתוכנן מהווה הפרה יסודית של חוזה זה, המזכה בפיצוי כספי בגין הנזקים שנגרמו, בתוספת הפרשי הצמדה וריבית.

לידיעתכם, בתק (י-ם) 5312/07 נפסק פיצוי של 2,000 ש"ח בגין איחור רכבת, ובית המשפט קבע כי "הקפדה על לוח זמנים היא אינטרס לאומי".

הנני דורש כי תשלחו לי את הפיצוי המגיע לי תוך 21 יום מקבלת מכתב זה.

לתשומת לבכם:
1. אי-מענה תוך 21 יום ייחשב כהסכמה לדרישה זו, והנני שומר על זכותי להגיש תביעה בבית המשפט לתביעות קטנות.
2. במקרה של אי-מענה, אשקול לדווח על התקלה למשרד התחבורה כחלק מתיעוד שיטתי של כשלי שירות בקו {{bus_line}}.

פרטי התקשרות:
טלפון: {{phone}}
כתובת: {{address}}

בכבוד רב,
{{full_name}}
תאריך: {{today_date}}
מספר אסמכתא: {{claim_id}}',
    version = version + 1,
    updated_at = NOW()
WHERE template_type = 'initial_warning';

-- =====================================================
-- STEP 1.5: Update template_type constraint
-- Must run BEFORE changing template_type to reminder_21_days
-- =====================================================

ALTER TABLE letter_templates
    DROP CONSTRAINT IF EXISTS letter_templates_template_type_check;

ALTER TABLE letter_templates
    ADD CONSTRAINT letter_templates_template_type_check
    CHECK (template_type IN ('initial_warning', 'reminder_14_days', 'reminder_21_days', 'lawsuit_draft'));

-- =====================================================
-- STEP 2: Update reminder template (14 → 21 days)
-- Remove specific compensation amount
-- Add Ministry threat + interest escalation
-- =====================================================

UPDATE letter_templates
SET template_type = 'reminder_21_days',
    template_content = 'לכבוד
{{company_name}}
מחלקת פניות הציבור

הנדון: התראה לפני הגשת תביעה - קו {{bus_line}}

מכתב זה מהווה התראה אחרונה לפני הגשת תביעה בבית המשפט לתביעות קטנות.

ביום {{initial_letter_date}} שלחתי אליכם מכתב דרישה בעניין אי-הפעלת שירות נסיעה בקו {{bus_line}} מתאריך {{incident_date}}.

למרות חלוף המועד שנקבע במכתב הדרישה - טרם קיבלתי מענה ו/או פיצוי.

אי לכך, הריני להודיעכם:

1. אי-מענה לדרישה תוך המועד שנקבע מהווה הסכמה בשתיקה לדרישה.

2. ככל שלא אקבל את הפיצוי המגיע לי תוך 7 ימים מקבלת מכתב זה - אגיש תביעה בבית המשפט לתביעות קטנות.

3. במקרה של הגשת תביעה, אדרוש פיצוי כספי בגין הנזקים שנגרמו, בתוספת הוצאות משפט, אגרת בית משפט, פיצוי על עוגמת נפש, והפרשי הצמדה וריבית מיום האירוע.

4. כמו כן, אשקול לדווח על התקלה למשרד התחבורה כחלק מתיעוד שיטתי של כשלי שירות בקו {{bus_line}}.

זוהי התראה אחרונה לפני נקיטת הליכים משפטיים.

בכבוד רב,
{{full_name}}
ת.ז. {{id_number}}
טלפון: {{phone}}
תאריך: {{today_date}}
מספר אסמכתא: {{claim_id}}',
    version = version + 1,
    updated_at = NOW()
WHERE template_type = 'reminder_14_days';

-- =====================================================
-- STEP 3: Update lawsuit_draft template
-- Remove "פיצוי בסיסי לפי תקנה 428ג: X ש"ח"
-- Add breach of contract + legal precedent basis
-- User fills in amount when filing
-- =====================================================

UPDATE letter_templates
SET template_content = 'בבית המשפט לתביעות קטנות
ב{{court_city}}

ת.ק. ____________

התובע: {{full_name}}
ת.ז. {{id_number}}
כתובת: {{address}}
טלפון: {{phone}}

נגד

הנתבעת: {{company_name}}
(חברת תחבורה ציבורית מורשית)

כתב תביעה

1. מבוא
התובע מגיש תביעה זו בגין נזקים שנגרמו לו עקב הפרת חוזה הובלה והפרת חובה חקוקה על ידי הנתבעת, בניגוד לתקנות התעבורה ולתנאי הרישיון שניתן לה להפעלת קווי תחבורה ציבורית.

2. העובדות
2.1 ביום {{incident_date}} המתין התובע בתחנה "{{station_name}}" לקו {{bus_line}} המופעל על ידי הנתבעת, שהיה אמור להגיע בשעה {{scheduled_time}}.
2.2 האוטובוס {{incident_description}}.
2.3 כתוצאה מכך נגרמו לתובע נזקים ועוגמת נפש.

3. פניות קודמות
3.1 ביום {{initial_letter_date}} שלח התובע לנתבעת מכתב דרישה לפיצוי.
3.2 הנתבעת לא השיבה / דחתה את הדרישה ללא הצדקה.
3.3 התובע שלח מכתב התראה נוסף, אך גם לו לא ניתן מענה מספק.

4. הבסיס המשפטי
4.1 הפרת חוזה הובלה - רכישת כרטיס נסיעה מהווה חוזה בין הנוסע למפעיל. אי-הפעלת השירות מהווה הפרה יסודית של חוזה זה.
4.2 הפרת חובה חקוקה - בניגוד לתקנות התעבורה (תקנות 399א, 428ג) המחייבות הפעלת שירות סדיר.
4.3 תקדים משפטי - תק (י-ם) 5312/07, בית המשפט לתביעות קטנות בירושלים (31.03.2008), נפסק פיצוי של 2,000 ש"ח בגין איחור רכבת. בית המשפט קבע: "הקפדה על לוח זמנים היא אינטרס לאומי".

5. הנזק
הנני לתבוע מהנתבעת פיצוי כספי בגין הנימוקים הבאים:
5.1 הפרת חוזה הובלה ועוגמת נפש
5.2 נזקים ישירים ועקיפים שנגרמו כתוצאה מאי-הגעת/איחור האוטובוס
5.3 הוצאות נסיעה חלופיות ואובדן זמן
(הסכום ייקבע על ידי התובע בעת הגשת התביעה בפועל)

6. הסעד המבוקש
לחייב את הנתבעת לשלם לתובע פיצוי כספי כמפורט בסעיף 5 לעיל, בתוספת הוצאות משפט, אגרת בית משפט, ופיצוי על עוגמת נפש, בצירוף הפרשי הצמדה וריבית מיום האירוע ועד למועד התשלום בפועל.

7. ראיות
- תיעוד GPS של מיקום התובע בתחנה (תיעוד בזמן אמת)
- נתוני SIRI ממשרד התחבורה (מערכת מעקב אוטובוסים)
- העתקי מכתבי הדרישה וההתראה
- קבלות הוצאות נסיעה חלופיות (ככל שרלוונטי)

ולראיה באתי על החתום,
{{full_name}}
תאריך: {{today_date}}',
    version = version + 1,
    updated_at = NOW()
WHERE template_type = 'lawsuit_draft';

-- =====================================================
-- STEP 4: Migrate reminder columns (14-day → 21-day)
-- Add new columns, drop old ones
-- =====================================================

-- Add new weekly columns
ALTER TABLE public.letter_reminders
    ADD COLUMN IF NOT EXISTS day_7_sent BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS day_7_sent_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS day_21_sent BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS day_21_sent_at TIMESTAMP WITH TIME ZONE;

-- Drop old aggressive-schedule columns (if they exist)
ALTER TABLE public.letter_reminders
    DROP COLUMN IF EXISTS day_2_sent,
    DROP COLUMN IF EXISTS day_2_sent_at,
    DROP COLUMN IF EXISTS day_5_sent,
    DROP COLUMN IF EXISTS day_5_sent_at,
    DROP COLUMN IF EXISTS day_8_sent,
    DROP COLUMN IF EXISTS day_8_sent_at,
    DROP COLUMN IF EXISTS day_11_sent,
    DROP COLUMN IF EXISTS day_11_sent_at,
    DROP COLUMN IF EXISTS day_12_sent,
    DROP COLUMN IF EXISTS day_12_sent_at,
    DROP COLUMN IF EXISTS day_13_sent,
    DROP COLUMN IF EXISTS day_13_sent_at;

-- day_14_sent already exists, keep it

-- =====================================================
-- STEP 5: Update get_pending_reminders function
-- =====================================================

CREATE OR REPLACE FUNCTION get_pending_reminders()
RETURNS TABLE (
    reminder_id UUID,
    claim_id UUID,
    user_id UUID,
    days_since_initial INTEGER,
    next_reminder_type TEXT,
    customer_name TEXT,
    customer_email TEXT,
    bus_company TEXT,
    total_compensation DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        lr.id AS reminder_id,
        lr.claim_id,
        lr.user_id,
        EXTRACT(DAY FROM (NOW() - lr.initial_letter_sent_at))::INTEGER AS days_since_initial,
        CASE
            WHEN EXTRACT(DAY FROM (NOW() - lr.initial_letter_sent_at))::INTEGER >= 21 AND NOT lr.day_21_sent THEN 'day_21'
            WHEN EXTRACT(DAY FROM (NOW() - lr.initial_letter_sent_at))::INTEGER >= 14 AND NOT lr.day_14_sent THEN 'day_14'
            WHEN EXTRACT(DAY FROM (NOW() - lr.initial_letter_sent_at))::INTEGER >= 7 AND NOT lr.day_7_sent THEN 'day_7'
            ELSE 'none'
        END AS next_reminder_type,
        p.full_name AS customer_name,
        p.email AS customer_email,
        c.bus_company,
        c.claim_amount AS total_compensation
    FROM public.letter_reminders lr
    JOIN public.profiles p ON lr.user_id = p.id
    JOIN public.claims c ON lr.claim_id = c.id
    WHERE lr.status = 'active'
        AND EXTRACT(DAY FROM (NOW() - lr.initial_letter_sent_at))::INTEGER <= 21
    ORDER BY days_since_initial DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 6: Update mark_reminder_sent function
-- =====================================================

CREATE OR REPLACE FUNCTION mark_reminder_sent(
    p_reminder_id UUID,
    p_reminder_type TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE public.letter_reminders
    SET
        total_emails_sent = total_emails_sent + 1,
        last_email_sent_at = NOW(),
        updated_at = NOW(),
        day_7_sent = CASE WHEN p_reminder_type = 'day_7' THEN TRUE ELSE day_7_sent END,
        day_7_sent_at = CASE WHEN p_reminder_type = 'day_7' THEN NOW() ELSE day_7_sent_at END,
        day_14_sent = CASE WHEN p_reminder_type = 'day_14' THEN TRUE ELSE day_14_sent END,
        day_14_sent_at = CASE WHEN p_reminder_type = 'day_14' THEN NOW() ELSE day_14_sent_at END,
        day_21_sent = CASE WHEN p_reminder_type = 'day_21' THEN TRUE ELSE day_21_sent END,
        day_21_sent_at = CASE WHEN p_reminder_type = 'day_21' THEN NOW() ELSE day_21_sent_at END
    WHERE id = p_reminder_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 7: Update legal_documents reminder_type constraint
-- =====================================================

ALTER TABLE public.legal_documents
    DROP CONSTRAINT IF EXISTS legal_documents_reminder_type_check;

ALTER TABLE public.legal_documents
    ADD CONSTRAINT legal_documents_reminder_type_check
    CHECK (reminder_type IN ('initial', 'first_reminder', 'escalation_warning', 'final_notice', NULL));

-- Update comment
COMMENT ON COLUMN public.legal_documents.letter_sequence IS '0=initial letter, 1=day 7, 2=day 14, 3=day 21';

-- =====================================================
-- DONE! Run this migration in Supabase SQL Editor.
-- Then deploy updated Edge Function:
--   supabase functions deploy send-reminders --no-verify-jwt
-- =====================================================
