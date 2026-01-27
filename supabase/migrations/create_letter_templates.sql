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

-- Stage 1: Initial Demand Letter (Tikan 428g)
INSERT INTO letter_templates (template_type, template_name, template_content)
VALUES (
  'initial_warning',
  'שלב א: מכתב דרישה ראשוני',
  'לכבוד
{{company_name}}
מחלקת פניות הציבור

הנדון: דרישה לפיצוי בגין אי-הפעלת שירות נסיעה - קו {{bus_line}}

אני הח"מ, {{full_name}}, ת.ז. {{id_number}}, פונה אליכם בדרישה לפיצוי כספי בהתאם לתקנות התעבורה (פיצוי בגין אי-הפעלת שירות נסיעה), התשפ"ג-2023 (תיקון 428ג).

פרטי האירוע:
- תאריך: {{incident_date}}
- קו: {{bus_line}}
- תחנה: {{station_name}}
- שעה מתוכננת: {{scheduled_time}}
- מה שקרה: {{incident_description}}

בהתאם לתקנות, הנני זכאי לפיצוי בסך {{total_compensation}} ש"ח.

הנני דורש כי תשלחו לי את הפיצוי המגיע לי תוך 21 יום מקבלת מכתב זה, בהתאם לדרישות התקנות.

לתשומת לבכם: אי-מענה תוך 21 יום יחשב כהסכמה לדרישה זו, והנני שומר על זכותי להגיש תביעה בבית המשפט לתביעות קטנות.

פרטי התקשרות:
טלפון: {{phone}}
כתובת: {{address}}

בכבוד רב,
{{full_name}}
תאריך: {{today_date}}
מספר אסמכתא: {{claim_id}}'
);

-- Stage 2: Warning Before Lawsuit
INSERT INTO letter_templates (template_type, template_name, template_content)
VALUES (
  'reminder_14_days',
  'שלב ב: התראה לפני תביעה',
  'לכבוד
{{company_name}}
מחלקת פניות הציבור

הנדון: התראה לפני הגשת תביעה - קו {{bus_line}}

מכתב זה מהווה התראה אחרונה לפני הגשת תביעה בבית המשפט לתביעות קטנות.

ביום {{initial_letter_date}} שלחתי אליכם מכתב דרישה בעניין אי-הפעלת שירות נסיעה בקו {{bus_line}} מתאריך {{incident_date}}.

למרות חלוף 14 ימים ממועד משלוח הדרישה - טרם קיבלתי מענה ו/או פיצוי.

אי לכך, הריני להודיעכם:

1. בהתאם לתקנות התעבורה (פיצוי בגין אי-הפעלת שירות נסיעה), התשפ"ג-2023, אי-מענה תוך 21 יום מהווה הסכמה לדרישה.

2. ככל שלא אקבל את הפיצוי בסך {{total_compensation}} ש"ח תוך 7 ימים מקבלת מכתב זה - אגיש תביעה בבית המשפט לתביעות קטנות.

3. במקרה של הגשת תביעה, אדרוש גם הוצאות משפט ופיצוי על עוגמת נפש.

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
התובע מגיש תביעה זו בגין נזקים שנגרמו לו עקב אי-הפעלת שירות נסיעה על ידי הנתבעת, בניגוד לתקנות התעבורה ולתנאי הרישיון שניתן לה.

2. העובדות
2.1 ביום {{incident_date}} המתין התובע בתחנה "{{station_name}}" לקו {{bus_line}} שהיה אמור להגיע בשעה {{scheduled_time}}.
2.2 האוטובוס {{incident_description}}.
2.3 התובע נפגע כתוצאה מכך.

3. פניות קודמות
3.1 ביום {{initial_letter_date}} שלח התובע לנתבעת מכתב דרישה לפיצוי.
3.2 הנתבעת לא השיבה / דחתה את הדרישה ללא הצדקה.
3.3 התובע שלח מכתב התראה נוסף, אך גם לו לא ניתן מענה מספק.

4. הנזק
4.1 פיצוי בסיסי לפי תקנה 428ג: {{base_compensation}} ש"ח
4.2 נזקים נוספים: {{damage_compensation}} ש"ח
4.3 סה"כ: {{total_compensation}} ש"ח

5. הסעד המבוקש
לחייב את הנתבעת לשלם לתובע סך של {{total_compensation}} ש"ח, בתוספת הוצאות משפט ופיצוי על עוגמת נפש.

6. ראיות
- תיעוד GPS של מיקום התובע בתחנה
- נתוני SIRI (מערכת מעקב האוטובוסים)
- העתקי מכתבי הדרישה וההתראה

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
