-- =====================================================
-- CashBus: Add Sivan as Super Admin
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Check if the table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'admin_users'
  ) THEN
    -- Create admin_users table if it doesn't exist
    CREATE TABLE public.admin_users (
      id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      role TEXT DEFAULT 'case_manager' CHECK (role IN ('super_admin', 'case_manager', 'legal_reviewer')),

      -- Permissions
      can_approve_claims BOOLEAN DEFAULT FALSE,
      can_generate_letters BOOLEAN DEFAULT TRUE,
      can_view_all_users BOOLEAN DEFAULT FALSE,
      can_manage_workflows BOOLEAN DEFAULT FALSE,
      can_manage_settings BOOLEAN DEFAULT FALSE,

      -- Metadata
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_login TIMESTAMP WITH TIME ZONE
    );

    -- Enable RLS
    ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

    -- Create RLS policies
    CREATE POLICY "Admin users can view their own record"
      ON public.admin_users FOR SELECT
      USING (auth.uid() = id);

    CREATE POLICY "Super admins can view all admin users"
      ON public.admin_users FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.admin_users
          WHERE id = auth.uid() AND role = 'super_admin'
        )
      );

    RAISE NOTICE 'admin_users table created successfully';
  ELSE
    RAISE NOTICE 'admin_users table already exists';
  END IF;
END $$;

-- Step 2: Insert/Update Sivan as super admin
-- This will automatically find your user_id from auth.users based on email
INSERT INTO public.admin_users (id, email, role, can_approve_claims, can_generate_letters, can_view_all_users, can_manage_workflows, can_manage_settings)
SELECT
  id,
  email,
  'super_admin',
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
  updated_at = NOW();

-- Step 3: Verify the admin was added successfully
SELECT
  id,
  email,
  role,
  can_approve_claims,
  can_generate_letters,
  can_view_all_users,
  can_manage_workflows,
  can_manage_settings,
  created_at,
  updated_at
FROM public.admin_users
WHERE email = 'sivan.baruch200@gmail.com';

-- Expected Result:
-- If you see a row with your email and role='super_admin', you're all set!
-- If you see "0 rows", it means the user doesn't exist in auth.users yet.
-- In that case, you need to sign up first at https://cash-bus.vercel.app/auth
