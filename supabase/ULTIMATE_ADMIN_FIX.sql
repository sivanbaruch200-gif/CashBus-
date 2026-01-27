-- =====================================================
-- ULTIMATE ADMIN FIX - THE FINAL SOLUTION
-- Run this ONCE in Supabase SQL Editor
-- Date: 2026-01-18
-- =====================================================
-- This script:
-- 1. Shows current table structure
-- 2. Fixes RLS policies (removes all, creates ONE simple policy)
-- 3. Ensures Sivan is in admin_users
-- =====================================================

-- =====================================================
-- DIAGNOSTIC: Show what columns exist
-- =====================================================
SELECT 'STEP 0: Current columns in admin_users' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'admin_users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- =====================================================
-- STEP 1: Drop ALL existing policies on admin_users
-- =====================================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'admin_users' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.admin_users', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- =====================================================
-- STEP 2: Enable RLS and create ONE simple policy
-- =====================================================
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- This is the ONLY policy - authenticated users can check if THEY are an admin
CREATE POLICY "admin_check_self"
    ON public.admin_users
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- =====================================================
-- STEP 3: Ensure Sivan exists in admin_users
-- Uses ONLY the base columns that definitely exist
-- =====================================================
INSERT INTO public.admin_users (id, email, role, can_approve_claims, can_generate_letters, can_view_all_users)
SELECT
    u.id,
    u.email,
    'super_admin'::text,
    true,
    true,
    true
FROM auth.users u
WHERE u.email = 'sivan.baruch200@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = 'super_admin',
    can_approve_claims = true,
    can_generate_letters = true,
    can_view_all_users = true;

-- =====================================================
-- STEP 4: Also grant to letter_templates table
-- =====================================================
-- Drop existing policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'letter_templates' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.letter_templates', pol.policyname);
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE public.letter_templates ENABLE ROW LEVEL SECURITY;

-- Admins can read templates
CREATE POLICY "templates_admin_read"
    ON public.letter_templates
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.id = auth.uid()
        )
    );

-- Admins can update templates
CREATE POLICY "templates_admin_update"
    ON public.letter_templates
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.id = auth.uid()
        )
    );

-- Admins can insert templates
CREATE POLICY "templates_admin_insert"
    ON public.letter_templates
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.id = auth.uid()
        )
    );

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'VERIFICATION RESULTS' as section;

-- Show admin user
SELECT '1. Admin User:' as check_type;
SELECT id, email, role, can_view_all_users
FROM public.admin_users
WHERE email = 'sivan.baruch200@gmail.com';

-- Show policies on admin_users
SELECT '2. Policies on admin_users:' as check_type;
SELECT policyname, cmd, permissive
FROM pg_policies
WHERE tablename = 'admin_users';

-- Show policies on letter_templates
SELECT '3. Policies on letter_templates:' as check_type;
SELECT policyname, cmd, permissive
FROM pg_policies
WHERE tablename = 'letter_templates';

-- Success message
SELECT '=== DONE! ===' as status;
SELECT 'Now sign out completely from the app and sign back in.' as next_step;
SELECT 'The purple admin badge should appear in the dashboard header.' as expected_result;
