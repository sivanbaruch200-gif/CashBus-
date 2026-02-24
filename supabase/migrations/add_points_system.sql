-- =====================================================
-- CashBus - Points / Loyalty System
-- Date: 2026-02-20
-- Business Rules:
--   - 10 points per incident report
--   - 50 points per claim created
--   - 5 points per daily login (streak bonus: +5 per consecutive day, max +25)
--   - 300 points = 1 free month subscription
-- =====================================================

-- =====================================================
-- STEP 1: user_points table (one row per user)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_points (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    total_points INTEGER NOT NULL DEFAULT 0,
    streak_days INTEGER NOT NULL DEFAULT 0,
    last_login_date DATE,
    lifetime_earned INTEGER NOT NULL DEFAULT 0,
    lifetime_redeemed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON public.user_points(user_id);

-- =====================================================
-- STEP 2: points_transactions table (audit log)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.points_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    points INTEGER NOT NULL,          -- positive = earned, negative = redeemed
    transaction_type TEXT NOT NULL
        CHECK (transaction_type IN (
            'daily_login',
            'incident_report',
            'claim_created',
            'redeem_subscription',
            'admin_adjustment',
            'streak_bonus'
        )),
    description TEXT,
    reference_id UUID,                -- claim_id or incident_id if applicable
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_tx_user_id ON public.points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_tx_type ON public.points_transactions(transaction_type);

-- =====================================================
-- STEP 3: Points settings in app_settings
-- =====================================================

INSERT INTO app_settings (key, value, description) VALUES
    ('points_per_incident',       '10',  'Points awarded for each incident report'),
    ('points_per_claim',          '50',  'Points awarded for each claim created'),
    ('points_per_daily_login',    '5',   'Base points for daily login'),
    ('points_streak_bonus',       '5',   'Additional points per consecutive login day'),
    ('points_streak_max_bonus',   '25',  'Maximum streak bonus points per day'),
    ('points_redeem_per_month',   '300', 'Points required to redeem 1 free subscription month')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- STEP 4: RLS for user_points
-- =====================================================

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own points" ON public.user_points;
CREATE POLICY "Users can view own points"
    ON public.user_points FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own points" ON public.user_points;
CREATE POLICY "Users can update own points"
    ON public.user_points FOR UPDATE
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert user_points" ON public.user_points;
CREATE POLICY "System can insert user_points"
    ON public.user_points FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage user_points" ON public.user_points;
CREATE POLICY "Admins can manage user_points"
    ON public.user_points FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- =====================================================
-- STEP 5: RLS for points_transactions
-- =====================================================

ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.points_transactions;
CREATE POLICY "Users can view own transactions"
    ON public.points_transactions FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert transactions" ON public.points_transactions;
CREATE POLICY "System can insert transactions"
    ON public.points_transactions FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage points_transactions" ON public.points_transactions;
CREATE POLICY "Admins can manage points_transactions"
    ON public.points_transactions FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- =====================================================
-- DONE! Run in Supabase SQL Editor.
-- =====================================================
