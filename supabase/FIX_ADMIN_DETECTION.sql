-- =====================================================
-- FIX ADMIN DETECTION V2 - FIXES INFINITE RECURSION
-- Run this in Supabase SQL Editor
-- =====================================================

-- STEP 1: Add is_active column if missing
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- STEP 2: Drop ALL existing policies on admin_users
DROP POLICY IF EXISTS "Users can check own admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins full access" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_select_own" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_super_admin" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_check_own_status" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_super_admin_manage" ON public.admin_users;
DROP POLICY IF EXISTS "Admin users can view their own record" ON public.admin_users;
DROP POLICY IF EXISTS "Admin users can view own record" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can view all admin users" ON public.admin_users;

-- STEP 3: Create ONE simple policy - no recursion!
-- This allows any user to SELECT their own row (if it exists)
CREATE POLICY "admin_users_select_self"
    ON public.admin_users
    FOR SELECT
    USING (auth.uid() = id);

-- For INSERT/UPDATE/DELETE, we use service role only (from backend)
-- No recursive check needed - admins manage through Supabase Dashboard

-- STEP 4: Fix profiles table policies that might also have recursion
DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;

-- Recreate profiles admin policies WITHOUT recursion
-- Use the profile's own role column instead of checking admin_users
CREATE POLICY "profiles_admin_can_view_all"
    ON public.profiles
    FOR SELECT
    USING (
        auth.uid() = id
        OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
    );

-- STEP 5: Fix incidents table policies
DROP POLICY IF EXISTS "incidents_admin_select" ON public.incidents;
DROP POLICY IF EXISTS "incidents_admin_update" ON public.incidents;

CREATE POLICY "incidents_admin_can_view_all"
    ON public.incidents
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
    );

CREATE POLICY "incidents_admin_can_update_all"
    ON public.incidents
    FOR UPDATE
    USING (
        auth.uid() = user_id
        OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
    );

-- STEP 6: Ensure Sivan is in admin_users AND has correct profile role
INSERT INTO public.admin_users (id, email, role, can_approve_claims, can_generate_letters, can_view_all_users, can_manage_workflows, can_manage_settings, is_active)
SELECT
    id, email, 'super_admin', true, true, true, true, true, true
FROM auth.users
WHERE email = 'sivan.baruch200@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    role = 'super_admin',
    can_approve_claims = true,
    can_view_all_users = true,
    can_manage_workflows = true,
    can_manage_settings = true,
    is_active = true;

-- Update profile role (THIS is what we'll use for RLS checks)
UPDATE public.profiles
SET role = 'super_admin'
WHERE id IN (SELECT id FROM auth.users WHERE email = 'sivan.baruch200@gmail.com');

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT '✅ Admin Users:' as status;
SELECT id, email, role, is_active FROM public.admin_users;

SELECT '✅ Profile Role:' as status;
SELECT id, full_name, role FROM public.profiles
WHERE id IN (SELECT id FROM auth.users WHERE email = 'sivan.baruch200@gmail.com');

SELECT '✅ Policies on admin_users:' as status;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'admin_users';

SELECT '✅ Done! Sign out and sign back in.' as status;
