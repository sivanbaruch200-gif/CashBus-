-- =====================================================
-- FIX: Admin Users RLS Policy (V2 - No Recursion)
-- =====================================================
-- Problem: Previous policies caused infinite recursion because
-- they tried to query admin_users from within admin_users policies.
--
-- Solution: Use a simple policy that only checks auth.uid() = id
-- without any subqueries to admin_users itself.
-- =====================================================

-- Step 1: Drop ALL existing policies
DROP POLICY IF EXISTS "admin_users_select_own" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_super_admin" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view own record" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can manage all admins" ON public.admin_users;
DROP POLICY IF EXISTS "Users can check own admin status" ON public.admin_users;

-- Step 2: Create a simple SELECT policy - users can only see their own row
-- NO SUBQUERIES to avoid recursion!
CREATE POLICY "Users can check own admin status"
    ON public.admin_users
    FOR SELECT
    USING (id = auth.uid());

-- Step 3: For INSERT/UPDATE/DELETE, use service role only (no RLS policy needed)
-- Super admins will manage other admins via Supabase Dashboard or service role API

-- =====================================================
-- VERIFICATION: Run this to check your admin record exists
-- =====================================================
-- SELECT
--     id,
--     email,
--     role,
--     can_view_all_users,
--     is_active
-- FROM public.admin_users
-- WHERE email = 'sivan.baruch200@gmail.com';

-- =====================================================
-- If no record found, run this to add yourself as admin:
-- (Replace the UUID with your actual user ID from auth.users)
-- =====================================================
-- INSERT INTO public.admin_users (
--     id,
--     email,
--     role,
--     can_approve_claims,
--     can_generate_letters,
--     can_view_all_users,
--     can_manage_workflows,
--     can_manage_settings,
--     is_active
-- )
-- SELECT
--     id,
--     email,
--     'super_admin',
--     true,
--     true,
--     true,
--     true,
--     true,
--     true
-- FROM auth.users
-- WHERE email = 'sivan.baruch200@gmail.com'
-- ON CONFLICT (id) DO UPDATE SET
--     role = 'super_admin',
--     can_view_all_users = true,
--     is_active = true;

-- =====================================================
-- Also fix incidents RLS to allow admins to view all
-- =====================================================
-- First, drop existing admin policy if exists
DROP POLICY IF EXISTS "Admins can view all incidents" ON public.incidents;

-- Create policy that allows admins to view ALL incidents
CREATE POLICY "Admins can view all incidents"
    ON public.incidents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid() AND can_view_all_users = true
        )
    );

-- =====================================================
-- Fix profiles RLS to allow admins to view all profiles
-- (Needed for the JOIN in getAllIncidentsForAdmin)
-- =====================================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create policy that allows admins to view ALL profiles
CREATE POLICY "Admins can view all profiles"
    ON public.profiles
    FOR SELECT
    USING (
        -- User can view their own profile
        id = auth.uid()
        OR
        -- Or admin can view all profiles
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid() AND can_view_all_users = true
        )
    );

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RLS Policies Fixed Successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Verify your admin record exists in admin_users table';
    RAISE NOTICE '2. Make sure can_view_all_users = true';
    RAISE NOTICE '3. Refresh the Claims page in your app';
    RAISE NOTICE '========================================';
END $$;
