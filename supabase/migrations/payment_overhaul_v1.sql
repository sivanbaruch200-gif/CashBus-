-- =====================================================
-- CashBus - Payment System Overhaul V1
-- Date: 2026-02-18
-- Reason: Fix commission 15%->20%, reverse payment flow
-- =====================================================
-- Changes:
-- 1. Update calculate_commission function (0.15 -> 0.20)
-- 2. Add bank details to profiles
-- 3. Add CashBus bank details to app_settings
-- 4. Add incoming payment tracking to claims
-- 5. Create incoming_payments table with auto 80/20 split
-- =====================================================

-- =====================================================
-- STEP 1: Update commission calculation function
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_commission(amount DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    RETURN ROUND(amount * 0.20, 2);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 2: Add bank details to profiles
-- (for transferring 80% to customers)
-- =====================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS bank_name TEXT,
    ADD COLUMN IF NOT EXISTS bank_branch TEXT,
    ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
    ADD COLUMN IF NOT EXISTS bank_account_owner_name TEXT;

-- =====================================================
-- STEP 3: Add CashBus bank details + commission rate
-- to app_settings
-- =====================================================

INSERT INTO app_settings (key, value, description) VALUES
    ('cashbus_bank_name', '""', 'Bank name for CashBus account'),
    ('cashbus_bank_branch', '""', 'Branch number'),
    ('cashbus_bank_account', '""', 'Account number'),
    ('cashbus_iban', '""', 'IBAN number'),
    ('commission_rate', '0.20', 'Success fee percentage (20%)')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- STEP 4: Add incoming payment tracking to claims
-- =====================================================

ALTER TABLE public.claims
    ADD COLUMN IF NOT EXISTS incoming_payment_amount DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS incoming_payment_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS incoming_payment_reference TEXT,
    ADD COLUMN IF NOT EXISTS incoming_payment_recorded_by UUID,
    ADD COLUMN IF NOT EXISTS customer_payout_amount DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS customer_payout_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS customer_payout_reference TEXT,
    ADD COLUMN IF NOT EXISTS customer_payout_completed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cashbus_commission_amount DECIMAL(10, 2);

-- =====================================================
-- STEP 5: Create incoming_payments audit table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.incoming_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_source TEXT,
    payment_method TEXT,
    reference_number TEXT,
    received_date TIMESTAMP WITH TIME ZONE NOT NULL,
    recorded_by UUID,
    proof_url TEXT,
    notes TEXT,
    commission_amount DECIMAL(10, 2),
    customer_payout DECIMAL(10, 2),
    customer_payout_status TEXT DEFAULT 'pending'
        CHECK (customer_payout_status IN ('pending', 'initiated', 'completed', 'failed')),
    customer_payout_date TIMESTAMP WITH TIME ZONE,
    customer_payout_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_incoming_payments_claim_id ON public.incoming_payments(claim_id);
CREATE INDEX IF NOT EXISTS idx_incoming_payments_status ON public.incoming_payments(customer_payout_status);

-- =====================================================
-- STEP 6: Auto-calculate 80/20 split on insert
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_payment_split()
RETURNS TRIGGER AS $$
BEGIN
    NEW.commission_amount := ROUND(NEW.amount * 0.20, 2);
    NEW.customer_payout := ROUND(NEW.amount * 0.80, 2);

    UPDATE public.claims SET
        incoming_payment_amount = NEW.amount,
        incoming_payment_date = NEW.received_date,
        incoming_payment_reference = NEW.reference_number,
        incoming_payment_recorded_by = NEW.recorded_by,
        cashbus_commission_amount = NEW.commission_amount,
        customer_payout_amount = NEW.customer_payout,
        system_commission_due = NEW.commission_amount,
        actual_paid_amount = NEW.amount,
        status = 'paid',
        compensation_received_date = NOW(),
        updated_at = NOW()
    WHERE id = NEW.claim_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_incoming_payment ON public.incoming_payments;
CREATE TRIGGER on_incoming_payment
    BEFORE INSERT ON public.incoming_payments
    FOR EACH ROW
    EXECUTE FUNCTION calculate_payment_split();

-- =====================================================
-- STEP 7: RLS for incoming_payments
-- =====================================================

ALTER TABLE public.incoming_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage incoming_payments" ON public.incoming_payments;
CREATE POLICY "Admins can manage incoming_payments"
    ON public.incoming_payments FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Users can view own incoming_payments" ON public.incoming_payments;
CREATE POLICY "Users can view own incoming_payments"
    ON public.incoming_payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM claims c WHERE c.id = claim_id AND c.user_id = auth.uid()
        )
    );

-- =====================================================
-- STEP 8: Update existing commission_amount fields
-- that used 0.15 to use 0.20
-- =====================================================

UPDATE public.claims
SET system_commission_due = ROUND(actual_paid_amount * 0.20, 2)
WHERE actual_paid_amount IS NOT NULL
  AND actual_paid_amount > 0
  AND commission_paid = false;

-- =====================================================
-- DONE! Run in Supabase SQL Editor.
-- =====================================================
