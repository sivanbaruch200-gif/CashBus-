-- =====================================================
-- SIMPLE ADMIN FIX - Run this in Supabase SQL Editor
-- Date: 2026-01-18
-- This is a minimal, safe fix for the admin detection issue
-- =====================================================

-- =====================================================
-- STEP 1: Check current admin_users table structure
-- =====================================================
SELECT 'Current admin_users columns:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'admin_users'
ORDER BY ordinal_position;

-- =====================================================
-- STEP 2: Drop ALL existing policies on admin_users
-- (This ensures no conflicting policies)
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
DROP POLICY IF EXISTS "admin_users_read_own" ON public.admin_users;

-- =====================================================
-- STEP 3: Enable RLS and create ONE simple policy
-- =====================================================
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- This is the ONLY policy needed - users can read their own admin record
CREATE POLICY "admin_users_read_own"
    ON public.admin_users
    FOR SELECT
    USING (id = auth.uid());

-- =====================================================
-- STEP 4: Ensure Sivan is in admin_users table
-- Uses ONLY columns from the base schema
-- =====================================================
INSERT INTO public.admin_users (id, email, role, can_approve_claims, can_generate_letters, can_view_all_users)
SELECT
    id,
    email,
    'super_admin',
    true,
    true,
    true
FROM auth.users
WHERE email = 'sivan.baruch200@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    role = 'super_admin',
    can_approve_claims = true,
    can_generate_letters = true,
    can_view_all_users = true;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check if admin was inserted/updated
SELECT '=== ADMIN USER CHECK ===' as section;
SELECT id, email, role, can_view_all_users
FROM public.admin_users
WHERE email = 'sivan.baruch200@gmail.com';

-- Check policies on admin_users (should be exactly 1)
SELECT '=== POLICIES ON admin_users ===' as section;
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'admin_users';

-- Success message
SELECT '=== DONE ===' as section;
SELECT 'Admin fix complete! Sign out and sign back in to see the admin badge.' as message;
