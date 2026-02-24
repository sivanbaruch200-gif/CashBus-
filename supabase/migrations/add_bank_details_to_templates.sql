-- =====================================================
-- CashBus - Add CashBus Bank Payment Section to Templates
-- Date: 2026-02-19
-- Reason: Payment flow reversal - bus companies now pay
--         directly to CashBus account (not to customer)
-- =====================================================
-- Changes:
-- 1. Add {{cashbus_payment_section}} to initial_warning template
-- 2. Update cashbus_bank_* settings (admin fills in actual values)
-- =====================================================

-- =====================================================
-- STEP 1: Update initial_warning template
-- Add payment instructions section with CashBus bank
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

פרטי שולח הפיצוי:
טלפון: {{phone}}
כתובת: {{address}}

{{cashbus_payment_section}}

בכבוד רב,
{{full_name}}
תאריך: {{today_date}}
מספר אסמכתא: {{claim_id}}',
    version = version + 1,
    updated_at = NOW()
WHERE template_type = 'initial_warning';

-- =====================================================
-- STEP 2: Make sure app_settings has the bank fields
-- (Admin needs to fill in actual values in admin panel)
-- =====================================================

INSERT INTO app_settings (key, value, description) VALUES
    ('cashbus_bank_name', '""', 'שם הבנק של CashBus'),
    ('cashbus_bank_branch', '""', 'מספר סניף'),
    ('cashbus_bank_account', '""', 'מספר חשבון'),
    ('cashbus_iban', '""', 'מספר IBAN')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- DONE!
-- After running this migration, go to Admin > Settings
-- and fill in the actual CashBus bank account details.
-- =====================================================
