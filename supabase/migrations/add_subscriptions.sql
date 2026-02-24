-- =====================================================
-- CashBus - Subscription System
-- Date: 2026-02-19
-- Business model: 2 free claims, then 29 NIS/month
-- =====================================================

-- =====================================================
-- STEP 1: Create subscriptions table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'free'
        CHECK (status IN ('free', 'active', 'past_due', 'canceled', 'trialing')),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    free_claims_used INTEGER NOT NULL DEFAULT 0,
    free_claims_limit INTEGER NOT NULL DEFAULT 2,
    plan_amount INTEGER DEFAULT 2900,   -- in agorot (29.00 NIS)
    plan_currency TEXT DEFAULT 'ils',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- =====================================================
-- STEP 2: Add subscription columns to profiles
-- =====================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free'
        CHECK (subscription_status IN ('free', 'active', 'past_due', 'canceled', 'trialing')),
    ADD COLUMN IF NOT EXISTS claims_created_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- =====================================================
-- STEP 3: Add subscription settings to app_settings
-- =====================================================

INSERT INTO app_settings (key, value, description) VALUES
    ('subscription_price_agorot', '2900', 'Monthly subscription price in agorot (29 NIS)'),
    ('subscription_free_claims_limit', '2', 'Number of free claims before subscription required'),
    ('stripe_subscription_price_id', '""', 'Stripe Price ID for monthly subscription')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- STEP 4: Function to check if user can create a claim
-- =====================================================

CREATE OR REPLACE FUNCTION can_user_create_claim(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_sub subscriptions%ROWTYPE;
BEGIN
    SELECT * INTO v_sub FROM public.subscriptions WHERE user_id = p_user_id;

    -- No subscription record yet → treat as free with 0 used
    IF NOT FOUND THEN
        RETURN TRUE;
    END IF;

    -- Active/trialing subscription → always allowed
    IF v_sub.status IN ('active', 'trialing') THEN
        RETURN TRUE;
    END IF;

    -- Free tier: check free claim slots
    IF v_sub.free_claims_used < v_sub.free_claims_limit THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 5: Function to increment claim count (called on claim insert)
-- =====================================================

CREATE OR REPLACE FUNCTION increment_user_claims_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Upsert subscription row and increment
    INSERT INTO public.subscriptions (user_id, free_claims_used)
    VALUES (NEW.user_id, 1)
    ON CONFLICT (user_id) DO UPDATE
        SET free_claims_used = CASE
                WHEN subscriptions.status IN ('active', 'trialing') THEN subscriptions.free_claims_used
                ELSE subscriptions.free_claims_used + 1
            END,
            updated_at = NOW();

    -- Also update denormalized counter on profiles
    UPDATE public.profiles
    SET claims_created_count = claims_created_count + 1
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_claim_created ON public.claims;
CREATE TRIGGER on_claim_created
    AFTER INSERT ON public.claims
    FOR EACH ROW
    EXECUTE FUNCTION increment_user_claims_count();

-- =====================================================
-- STEP 6: RLS for subscriptions
-- =====================================================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription"
    ON public.subscriptions FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can manage all subscriptions"
    ON public.subscriptions FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can manage subscriptions"
    ON public.subscriptions FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- STEP 7: Backfill existing users
-- (create a free subscription row for each existing profile)
-- =====================================================

INSERT INTO public.subscriptions (user_id, free_claims_used)
SELECT
    p.id,
    COALESCE(p.claims_created_count, 0)
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM public.subscriptions s WHERE s.user_id = p.id
);

-- =====================================================
-- DONE! Run in Supabase SQL Editor.
-- =====================================================
