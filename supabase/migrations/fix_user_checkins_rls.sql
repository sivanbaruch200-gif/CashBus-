-- =====================================================
-- Fix: user_checkins RLS policies (resolve 406 error)
-- Date: 2026-02-24
--
-- Problem: add_challenge_tables.sql and add_gamification_tables.sql
-- both create user_checkins with conflicting/duplicate RLS policies.
-- This migration cleans up and re-creates all policies correctly.
-- RUN IN SUPABASE SQL EDITOR.
-- =====================================================

-- Step 1: Ensure table exists with correct schema
CREATE TABLE IF NOT EXISTS public.user_checkins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    check_date DATE NOT NULL,
    points_earned INTEGER NOT NULL DEFAULT 0,
    had_incident BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, check_date)
);

-- Add had_incident column if missing (safe: IF NOT EXISTS)
ALTER TABLE public.user_checkins
    ADD COLUMN IF NOT EXISTS had_incident BOOLEAN DEFAULT false;

-- Step 2: Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_user_checkins_user_id ON public.user_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_checkins_date ON public.user_checkins(check_date);
CREATE INDEX IF NOT EXISTS idx_user_checkins_user_date ON public.user_checkins(user_id, check_date);

-- Step 3: Enable RLS
ALTER TABLE public.user_checkins ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop ALL existing policies on user_checkins to avoid duplicates
DROP POLICY IF EXISTS "Users can view own checkins" ON public.user_checkins;
DROP POLICY IF EXISTS "Users can insert own checkins" ON public.user_checkins;
DROP POLICY IF EXISTS "Admins can manage checkins" ON public.user_checkins;
DROP POLICY IF EXISTS "Service role full access checkins" ON public.user_checkins;

-- Step 5: Recreate policies cleanly

-- Users can read their own check-ins
CREATE POLICY "Users can view own checkins"
    ON public.user_checkins FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert their own check-ins (browser client from challengeService.ts)
CREATE POLICY "Users can insert own checkins"
    ON public.user_checkins FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Admins can manage all check-ins
CREATE POLICY "Admins can manage checkins"
    ON public.user_checkins FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- Service role (API routes) can read/write all rows
-- Note: service_role already bypasses RLS, but this is explicit documentation
CREATE POLICY "Service role full access checkins"
    ON public.user_checkins FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- Verify:
-- SELECT COUNT(*) FROM public.user_checkins;
-- SELECT policyname FROM pg_policies WHERE tablename = 'user_checkins';
-- =====================================================
