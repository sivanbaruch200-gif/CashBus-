-- =====================================================
-- FIX ALL RLS POLICIES - Final Version
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- STEP 1: Fix admin_users table RLS (No recursion)
-- =====================================================

-- Drop all existing policies on admin_users
DROP POLICY IF EXISTS "admin_users_select_own" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_super_admin" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view own record" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can manage all admins" ON public.admin_users;
DROP POLICY IF EXISTS "Users can check own admin status" ON public.admin_users;

-- Create simple SELECT policy - users can only see their own row
-- NO SUBQUERIES to avoid infinite recursion!
CREATE POLICY "Users can check own admin status"
    ON public.admin_users
    FOR SELECT
    USING (id = auth.uid());

-- =====================================================
-- STEP 2: Fix incidents table RLS for admin access
-- =====================================================

-- Drop existing admin policy
DROP POLICY IF EXISTS "Admins can view all incidents" ON public.incidents;
DROP POLICY IF EXISTS "Users can view own incidents" ON public.incidents;
DROP POLICY IF EXISTS "Users can insert own incidents" ON public.incidents;
DROP POLICY IF EXISTS "Admins can update all incidents" ON public.incidents;

-- Enable RLS
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Users can view their own incidents
CREATE POLICY "Users can view own incidents"
    ON public.incidents
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert their own incidents
CREATE POLICY "Users can insert own incidents"
    ON public.incidents
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Admins can view ALL incidents
CREATE POLICY "Admins can view all incidents"
    ON public.incidents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid() AND can_view_all_users = true AND is_active = true
        )
    );

-- Admins can update ALL incidents
CREATE POLICY "Admins can update all incidents"
    ON public.incidents
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid() AND can_approve_claims = true AND is_active = true
        )
    );

-- =====================================================
-- STEP 3: Fix profiles table RLS for admin access
-- =====================================================

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (id = auth.uid());

-- Admins can view ALL profiles
CREATE POLICY "Admins can view all profiles"
    ON public.profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid() AND can_view_all_users = true AND is_active = true
        )
    );

-- Admins can update ALL profiles (for marking payments, etc)
CREATE POLICY "Admins can update all profiles"
    ON public.profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid() AND can_approve_claims = true AND is_active = true
        )
    );

-- =====================================================
-- STEP 4: Fix claims table RLS
-- =====================================================

DROP POLICY IF EXISTS "Users can view own claims" ON public.claims;
DROP POLICY IF EXISTS "Users can insert own claims" ON public.claims;
DROP POLICY IF EXISTS "Admins can view all claims" ON public.claims;
DROP POLICY IF EXISTS "Admins can update all claims" ON public.claims;

-- Enable RLS if not already
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

-- Users can view their own claims
CREATE POLICY "Users can view own claims"
    ON public.claims
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert their own claims
CREATE POLICY "Users can insert own claims"
    ON public.claims
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Admins can view ALL claims
CREATE POLICY "Admins can view all claims"
    ON public.claims
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid() AND can_view_all_users = true AND is_active = true
        )
    );

-- Admins can update ALL claims
CREATE POLICY "Admins can update all claims"
    ON public.claims
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid() AND can_approve_claims = true AND is_active = true
        )
    );

-- =====================================================
-- STEP 5: Add letter_templates table for template management
-- =====================================================

-- Create letter_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.letter_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    template_type TEXT NOT NULL CHECK (template_type IN ('initial_warning', 'reminder_14_days', 'lawsuit_draft')),
    template_name TEXT NOT NULL,
    template_content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_by uuid REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.letter_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view templates
CREATE POLICY "Authenticated users can view templates"
    ON public.letter_templates
    FOR SELECT
    USING (auth.uid() IS NOT NULL AND is_active = true);

-- Only admins can manage templates
CREATE POLICY "Admins can manage templates"
    ON public.letter_templates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid() AND can_manage_settings = true AND is_active = true
        )
    );

-- Insert default templates if they don't exist
INSERT INTO public.letter_templates (template_type, template_name, template_content, is_active)
VALUES
    ('initial_warning', 'מכתב דרישה ראשוני - תקנה 428ג', E'לכבוד\n{{company_name}}\nמחלקת שירות לקוחות\n\nהנדון: דרישה לפיצוי בגין הפרת חוזה הובלה - תקנה 428ג\n\nאני, {{full_name}}, ת.ז. {{id_number}}, פונה אליכם בדרישה לפיצוי בסך {{total_compensation}} ש"ח.\n\nבתאריך {{incident_date}}, קו {{bus_line}} {{incident_description}}.\n\nתחנה: {{station_name}}\nשעה מתוכננת: {{scheduled_time}}\nשעה בפועל: {{actual_time}}\n\nאני דורש/ת לקבל את הפיצוי תוך 14 יום.\n\nבכבוד רב,\n{{full_name}}\nטלפון: {{phone}}\n\n---\nהופק על ידי CashBus', true),

    ('reminder_14_days', 'התראה לפני תביעה - 14 יום', E'לכבוד\n{{company_name}}\n\nהנדון: התראה אחרונה לפני הגשת תביעה\n\nבהמשך לפנייתי מיום {{initial_letter_date}}, ובהיעדר מענה מצדכם,\nהריני להודיעכם כי אם לא אקבל את הפיצוי בסך {{total_compensation}} ש"ח\nתוך 48 שעות - תוגש תביעה לבית המשפט לתביעות קטנות.\n\nמספר אסמכתא: {{claim_id}}\n\nבכבוד רב,\n{{full_name}}', true),

    ('lawsuit_draft', 'טיוטת כתב תביעה', E'בבית המשפט לתביעות קטנות\nב{{court_city}}\n\nת"ק _______\n\nבעניין:\n{{full_name}}, ת.ז. {{id_number}}\nכתובת: {{address}}\nטלפון: {{phone}}\n                                        התובע/ת\n\nנגד\n\n{{company_name}}\n                                        הנתבעת\n\nכתב תביעה\n\nהנני לתבוע מהנתבעת סך של {{total_compensation}} ש"ח בגין הנימוקים הבאים:\n\n1. העובדות:\n   בתאריך {{incident_date}}, {{incident_description}}.\n\n2. הבסיס המשפטי:\n   תקנות 428ג, 399א לתקנות התעבורה.\n\n3. הנזק:\n   - פיצוי בסיסי: {{base_compensation}} ש"ח\n   - נזקים נוספים: {{damage_compensation}} ש"ח\n   - סה"כ: {{total_compensation}} ש"ח\n\n4. המסמכים המצורפים:\n   - מכתב דרישה מיום {{initial_letter_date}}\n   - תיעוד GPS מאומת\n   - קבלות (אם רלוונטי)\n\nאשר על כן, אני מבקש/ת מבית המשפט הנכבד לחייב את הנתבעת לשלם לי את הסכום הנתבע.\n\n______________\n{{full_name}}\nתאריך: {{today_date}}', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'All RLS Policies Fixed Successfully!';
    RAISE NOTICE 'Letter Templates Table Created!';
    RAISE NOTICE '========================================';
END $$;