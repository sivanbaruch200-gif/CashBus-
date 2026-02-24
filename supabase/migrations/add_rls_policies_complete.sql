-- =====================================================
-- CashBus - Complete RLS Policies (Full Overhaul)
-- Date: 2026-02-22
-- Tables: subscriptions, user_points, points_transactions, incoming_payments
--
-- Security Model:
--   * USER (authenticated): sees/modifies ONLY their own rows
--   * ADMIN (role IN admin, super_admin): full CRUD on all rows
--   * service_role: bypasses RLS automatically (BYPASSRLS privilege in PostgreSQL)
--   * anon (unauthenticated): NO access (auth.uid() returns NULL → policies fail)
--
-- Key change from previous migrations:
--   * Removed direct INSERT/UPDATE for regular users on points tables
--     (security risk: users could award themselves points)
--   * service_role policy using auth.role() removed - unnecessary, service_role
--     already bypasses RLS at the PostgreSQL level (BYPASSRLS attribute)
--   * Added is_admin() helper function to avoid recursive RLS and improve performance
-- =====================================================


-- =====================================================
-- HELPER: is_admin() - reusable admin check
-- SECURITY DEFINER ensures it can read profiles even if
-- profiles has its own RLS (avoids infinite recursion).
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
$$;


-- =====================================================
-- 1. SUBSCRIPTIONS
-- =====================================================
-- Previous issues:
--   * "Service role can manage subscriptions" policy used auth.role() = 'service_role'
--     → Redundant (service_role bypasses RLS automatically), removed.
--   * No explicit UPDATE/INSERT policies for regular users.
-- =====================================================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies (clean slate)
DROP POLICY IF EXISTS "Users can view own subscription"         ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can manage all subscriptions"    ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can manage subscriptions"  ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_select_own"               ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_admin_all"                ON public.subscriptions;

-- Users: read their own subscription status only
CREATE POLICY "subscriptions_select_own"
    ON public.subscriptions
    FOR SELECT
    USING (user_id = auth.uid());

-- Users: NO INSERT / UPDATE / DELETE directly
-- All writes happen via backend API routes (service_role key → bypasses RLS)
-- Exception: Stripe webhook uses service_role → also bypasses RLS automatically

-- Admins: full access to all subscriptions
CREATE POLICY "subscriptions_admin_all"
    ON public.subscriptions
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- service_role: automatically bypasses RLS (BYPASSRLS) - no explicit policy needed.


-- =====================================================
-- 2. USER_POINTS
-- =====================================================
-- Previous issues:
--   * "Users can update own points" policy allowed users to UPDATE their own points
--     directly from the client → security risk (self-awarding points).
--   * "System can insert user_points" allowed users to INSERT their own row
--     directly from the client → same security risk.
-- Fix: remove user INSERT/UPDATE. Only service_role (backend) can write.
-- =====================================================

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own points"    ON public.user_points;
DROP POLICY IF EXISTS "Users can update own points"  ON public.user_points;
DROP POLICY IF EXISTS "System can insert user_points" ON public.user_points;
DROP POLICY IF EXISTS "Admins can manage user_points" ON public.user_points;
DROP POLICY IF EXISTS "user_points_select_own"        ON public.user_points;
DROP POLICY IF EXISTS "user_points_admin_all"          ON public.user_points;

-- Users: read-only access to their own points balance
CREATE POLICY "user_points_select_own"
    ON public.user_points
    FOR SELECT
    USING (user_id = auth.uid());

-- Users: NO INSERT / UPDATE / DELETE directly
-- All writes happen via:
--   * app/api/points/daily-login/route.ts  → service_role key
--   * lib/pointsService.ts                 → service_role key
-- service_role bypasses RLS → no additional policy needed.

-- Admins: full access (for manual adjustments, corrections, support)
CREATE POLICY "user_points_admin_all"
    ON public.user_points
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- =====================================================
-- 3. POINTS_TRANSACTIONS (append-only audit log)
-- =====================================================
-- Previous issues:
--   * "System can insert transactions" used WITH CHECK (user_id = auth.uid())
--     → Authenticated users could insert transactions directly, awarding
--     themselves arbitrary points (critical security vulnerability).
-- Fix: Remove INSERT for regular users entirely. Only service_role writes.
-- =====================================================

ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own transactions"      ON public.points_transactions;
DROP POLICY IF EXISTS "System can insert transactions"       ON public.points_transactions;
DROP POLICY IF EXISTS "Admins can manage points_transactions" ON public.points_transactions;
DROP POLICY IF EXISTS "points_tx_select_own"                ON public.points_transactions;
DROP POLICY IF EXISTS "points_tx_admin_all"                 ON public.points_transactions;

-- Users: read-only view of their own transaction history
-- (so they can see the points log in the UI)
CREATE POLICY "points_tx_select_own"
    ON public.points_transactions
    FOR SELECT
    USING (user_id = auth.uid());

-- Users: NO INSERT / UPDATE / DELETE
-- All writes via backend (service_role), which bypasses RLS.
-- This prevents users from inserting fake point awards from the client.

-- Admins: full access (manual adjustments / reversals if needed)
CREATE POLICY "points_tx_admin_all"
    ON public.points_transactions
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- =====================================================
-- 4. INCOMING_PAYMENTS
-- (covers both "payment_records" and "payout_confirmations" functionality)
-- =====================================================
-- Previous issues:
--   * Policy referenced claim_id without table qualifier → potential ambiguity.
--   * No service_role comment to clarify intent.
-- Fix: explicit table alias, clean policy names.
-- =====================================================

ALTER TABLE public.incoming_payments ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Admins can manage incoming_payments"     ON public.incoming_payments;
DROP POLICY IF EXISTS "Users can view own incoming_payments"    ON public.incoming_payments;
DROP POLICY IF EXISTS "incoming_payments_select_own"           ON public.incoming_payments;
DROP POLICY IF EXISTS "incoming_payments_admin_all"            ON public.incoming_payments;

-- Users: read-only view of payment records linked to THEIR OWN claims
-- (so users can see their compensation status in the dashboard)
CREATE POLICY "incoming_payments_select_own"
    ON public.incoming_payments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.claims c
            WHERE c.id = incoming_payments.claim_id
              AND c.user_id = auth.uid()
        )
    );

-- Users: NO INSERT / UPDATE / DELETE
-- All payment recording is done by admins via:
--   * app/api/admin/record-payment/route.ts  → service_role key
--   * app/api/admin/confirm-payout/route.ts  → service_role key

-- Admins: full CRUD (record payments, confirm payouts, update references)
CREATE POLICY "incoming_payments_admin_all"
    ON public.incoming_payments
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- service_role: automatically bypasses RLS (BYPASSRLS) - no explicit policy needed.


-- =====================================================
-- VERIFICATION QUERIES
-- Run these in Supabase SQL Editor AFTER applying this migration
-- to confirm everything is set up correctly.
-- =====================================================

-- 1. Confirm RLS is ENABLED on all 4 tables:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('subscriptions', 'user_points', 'points_transactions', 'incoming_payments')
-- ORDER BY tablename;
-- Expected: rowsecurity = TRUE for all 4 rows.

-- 2. List all active policies per table:
-- SELECT tablename, policyname, cmd, permissive,
--        roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('subscriptions', 'user_points', 'points_transactions', 'incoming_payments')
-- ORDER BY tablename, cmd, policyname;

-- 3. Confirm is_admin() function exists:
-- SELECT proname, prosecdef, provolatile
-- FROM pg_proc
-- WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace;
-- Expected: prosecdef = TRUE (SECURITY DEFINER)

-- =====================================================
-- TESTING NOTES
-- =====================================================
-- To test as a regular user (using Supabase client with user JWT):
--   SELECT * FROM subscriptions;              → should return only user's own row
--   SELECT * FROM user_points;               → should return only user's own row
--   SELECT * FROM points_transactions;       → should return only user's own rows
--   SELECT * FROM incoming_payments;         → should return rows where claim belongs to user
--   INSERT INTO user_points ...              → should FAIL (permission denied)
--   INSERT INTO points_transactions ...      → should FAIL (permission denied)
--
-- To test as admin (user with role='admin' in profiles):
--   SELECT * FROM subscriptions;             → should return ALL rows
--   SELECT * FROM incoming_payments;         → should return ALL rows
--
-- =====================================================
-- DONE! Run in Supabase SQL Editor.
-- =====================================================
