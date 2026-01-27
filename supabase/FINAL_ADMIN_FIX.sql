-- =====================================================
-- FINAL ADMIN FIX - Run this ONCE in Supabase SQL Editor
-- This replaces ALL previous admin-related SQL files
-- =====================================================
-- Date: 2026-01-18
-- Problem: Admin badge not showing due to RLS infinite recursion
-- =====================================================

-- =====================================================
-- STEP 1: Disable RLS temporarily on admin_users
-- =====================================================
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 2: Drop ALL existing policies on admin_users
-- =====================================================
DROP POLICY IF EXISTS "Users can check own admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins full access" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_select_own" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_super_admin" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_check_own_status" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_super_admin_manage" ON public.admin_users;
DROP POLICY IF EXISTS "Admin users can view their own record" ON public.admin_users;
DROP POLICY IF EXISTS "Admin users can view own record" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can view all admin users" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_select_self" ON public.admin_users;

-- =====================================================
-- STEP 3: Add is_active column if missing
-- =====================================================
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =====================================================
-- STEP 4: Re-enable RLS with ONE simple policy
-- =====================================================
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- THE ONLY POLICY - users can read their own admin record
-- No subqueries = No recursion!
CREATE POLICY "admin_users_read_own"
    ON public.admin_users
    FOR SELECT
    USING (id = auth.uid());

-- =====================================================
-- STEP 5: Make sure Sivan is in admin_users
-- =====================================================
INSERT INTO public.admin_users (id, email, role, can_approve_claims, can_generate_letters, can_view_all_users, can_manage_workflows, can_manage_settings, is_active)
SELECT
    id,
    email,
    'super_admin',
    true,
    true,
    true,
    true,
    true,
    true
FROM auth.users
WHERE email = 'sivan.baruch200@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    role = 'super_admin',
    can_approve_claims = true,
    can_generate_letters = true,
    can_view_all_users = true,
    can_manage_workflows = true,
    can_manage_settings = true,
    is_active = true,
    updated_at = NOW();

-- =====================================================
-- STEP 6: Fix incidents RLS for admin access
-- =====================================================
-- Drop ALL existing incidents policies
DROP POLICY IF EXISTS "Admins can view all incidents" ON public.incidents;
DROP POLICY IF EXISTS "Users can view own incidents" ON public.incidents;
DROP POLICY IF EXISTS "Users can insert own incidents" ON public.incidents;
DROP POLICY IF EXISTS "Admins can update all incidents" ON public.incidents;
DROP POLICY IF EXISTS "incidents_select_own" ON public.incidents;
DROP POLICY IF EXISTS "incidents_insert_own" ON public.incidents;
DROP POLICY IF EXISTS "incidents_update_own" ON public.incidents;
DROP POLICY IF EXISTS "incidents_admin_select" ON public.incidents;
DROP POLICY IF EXISTS "incidents_admin_update" ON public.incidents;
DROP POLICY IF EXISTS "incidents_admin_can_view_all" ON public.incidents;
DROP POLICY IF EXISTS "incidents_admin_can_update_all" ON public.incidents;

-- Enable RLS
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Recreate policies
CREATE POLICY "incidents_user_select"
    ON public.incidents FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "incidents_user_insert"
    ON public.incidents FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "incidents_admin_select"
    ON public.incidents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.id = auth.uid()
              AND admin_users.can_view_all_users = true
        )
    );

CREATE POLICY "incidents_admin_update"
    ON public.incidents FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.id = auth.uid()
              AND admin_users.can_approve_claims = true
        )
    );

-- =====================================================
-- STEP 7: Fix profiles RLS for admin access
-- =====================================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_can_view_all" ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_user_select"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "profiles_user_update"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "profiles_user_insert"
    ON public.profiles FOR INSERT
    WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_admin_select"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.id = auth.uid()
              AND admin_users.can_view_all_users = true
        )
    );

CREATE POLICY "profiles_admin_update"
    ON public.profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.id = auth.uid()
              AND admin_users.can_approve_claims = true
        )
    );

-- =====================================================
-- STEP 8: Fix claims RLS for admin access
-- =====================================================
DROP POLICY IF EXISTS "Users can view own claims" ON public.claims;
DROP POLICY IF EXISTS "Users can insert own claims" ON public.claims;
DROP POLICY IF EXISTS "Admins can view all claims" ON public.claims;
DROP POLICY IF EXISTS "Admins can update all claims" ON public.claims;
DROP POLICY IF EXISTS "claims_select_own" ON public.claims;
DROP POLICY IF EXISTS "claims_insert_own" ON public.claims;
DROP POLICY IF EXISTS "claims_update_own" ON public.claims;
DROP POLICY IF EXISTS "claims_admin_select" ON public.claims;
DROP POLICY IF EXISTS "claims_admin_update" ON public.claims;

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claims_user_select"
    ON public.claims FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "claims_user_insert"
    ON public.claims FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "claims_admin_select"
    ON public.claims FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.id = auth.uid()
              AND admin_users.can_view_all_users = true
        )
    );

CREATE POLICY "claims_admin_update"
    ON public.claims FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.id = auth.uid()
              AND admin_users.can_approve_claims = true
        )
    );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check admin_users table
SELECT '=== ADMIN USERS ===' as section;
SELECT id, email, role, can_view_all_users, is_active
FROM public.admin_users
WHERE email = 'sivan.baruch200@gmail.com';

-- Check policies on admin_users (should be only 1)
SELECT '=== ADMIN_USERS POLICIES ===' as section;
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'admin_users';

-- Check policies on incidents
SELECT '=== INCIDENTS POLICIES ===' as section;
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'incidents';

-- Check policies on profiles
SELECT '=== PROFILES POLICIES ===' as section;
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'profiles';

-- Success message
SELECT '=== SUCCESS ===' as section;
SELECT 'Admin fix complete! Please sign out and sign back in.' as message;
