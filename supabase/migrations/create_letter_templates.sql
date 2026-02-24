-- ============================================
-- CashBus - Letter Templates Table
-- ============================================
-- This migration creates the letter_templates table
-- for storing legal letter templates (3 stages)
-- ============================================

-- Drop existing table if exists (for clean setup)
DROP TABLE IF EXISTS letter_templates CASCADE;

-- Create the letter_templates table
CREATE TABLE letter_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type VARCHAR(50) NOT NULL UNIQUE,
  template_name VARCHAR(255) NOT NULL,
  template_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_letter_templates_type ON letter_templates(template_type);
CREATE INDEX idx_letter_templates_active ON letter_templates(is_active);

-- Enable RLS
ALTER TABLE letter_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Allow all authenticated users to read active templates
CREATE POLICY "Anyone can read active templates"
  ON letter_templates FOR SELECT
  USING (is_active = true);

-- Allow admins to manage templates
CREATE POLICY "Admins can manage templates"
  ON letter_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Insert default templates

-- Stage 1: Initial Demand Letter
INSERT INTO letter_templates (template_type, template_name, template_content)
VALUES (
  'initial_warning',
  'שלב א: מכתב דרישה ראשוני',
  'לכבוד
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
מספר אסמכתא: {{claim_id}}'
);

-- Stage 2: Warning Before Lawsuit (21-day deadline)
INSERT INTO letter_templates (template_type, template_name, template_content)
VALUES (
  'reminder_21_days',
  'שלב ב: התראה לפני תביעה',
  'לכבוד
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
מספר אסמכתא: {{claim_id}}'
);

-- Stage 3: Lawsuit Draft
INSERT INTO letter_templates (template_type, template_name, template_content)
VALUES (
  'lawsuit_draft',
  'שלב ג: טיוטת כתב תביעה',
  'בבית המשפט לתביעות קטנות
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
תאריך: {{today_date}}'
);

-- Grant permissions
GRANT SELECT ON letter_templates TO authenticated;
GRANT ALL ON letter_templates TO service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Letter templates table created successfully with 3 default templates!';
END $$;
