-- =====================================================
-- CashBus - Gamification Tables (DailyChallenge)
-- Date: 2026-02-22
-- Tables: user_gamification, user_checkins
-- =====================================================

-- =====================================================
-- STEP 1: user_gamification (one row per user)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_gamification (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    total_points INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    level TEXT NOT NULL DEFAULT 'beginner',
    last_checkin_date DATE,
    achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_gamification_user_id ON public.user_gamification(user_id);

-- =====================================================
-- STEP 2: user_checkins (one row per user per day)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_checkins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    check_date DATE NOT NULL,
    points_earned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, check_date)
);

CREATE INDEX IF NOT EXISTS idx_user_checkins_user_id ON public.user_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_checkins_date ON public.user_checkins(check_date);

-- =====================================================
-- STEP 3: RLS for user_gamification
-- =====================================================

ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own gamification" ON public.user_gamification;
CREATE POLICY "Users can view own gamification"
    ON public.user_gamification FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own gamification" ON public.user_gamification;
CREATE POLICY "Users can insert own gamification"
    ON public.user_gamification FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own gamification" ON public.user_gamification;
CREATE POLICY "Users can update own gamification"
    ON public.user_gamification FOR UPDATE
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage gamification" ON public.user_gamification;
CREATE POLICY "Admins can manage gamification"
    ON public.user_gamification FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- =====================================================
-- STEP 4: RLS for user_checkins
-- =====================================================

ALTER TABLE public.user_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own checkins" ON public.user_checkins;
CREATE POLICY "Users can view own checkins"
    ON public.user_checkins FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own checkins" ON public.user_checkins;
CREATE POLICY "Users can insert own checkins"
    ON public.user_checkins FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage checkins" ON public.user_checkins;
CREATE POLICY "Admins can manage checkins"
    ON public.user_checkins FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- =====================================================
-- DONE! Run in Supabase SQL Editor.
-- =====================================================
