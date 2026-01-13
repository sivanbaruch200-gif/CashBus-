-- =====================================================
-- Add Admin User: sivan.baruch200@gmail.com
-- =====================================================

-- This script will add the user as a super admin if they exist
-- Run this in the Supabase SQL editor

-- First, let's check if the user exists in auth.users
-- You'll need to get the user_id from the Supabase dashboard Auth section

-- Option 1: If you know the user_id, use this:
-- INSERT INTO admin_users (id, email, role, can_approve_claims, can_generate_letters, can_view_all_users)
-- VALUES ('YOUR-USER-ID-HERE', 'sivan.baruch200@gmail.com', 'super_admin', true, true, true)
-- ON CONFLICT (email) DO UPDATE SET
--   role = 'super_admin',
--   can_approve_claims = true,
--   can_generate_letters = true,
--   can_view_all_users = true;

-- Option 2: If the user exists in auth.users, use this query to find and insert:
INSERT INTO admin_users (id, email, role, can_approve_claims, can_generate_letters, can_view_all_users)
SELECT
  id,
  email,
  'super_admin',
  true,
  true,
  true
FROM auth.users
WHERE email = 'sivan.baruch200@gmail.com'
ON CONFLICT (email) DO UPDATE SET
  role = 'super_admin',
  can_approve_claims = true,
  can_generate_letters = true,
  can_view_all_users = true;

-- Verify the admin was added
SELECT * FROM admin_users WHERE email = 'sivan.baruch200@gmail.com';
