-- =====================================================
-- CashBus Success Fee Model - Financial Tracking
-- Business Model: 29 NIS opening fee + 15% success commission
-- =====================================================

-- =====================================================
-- PART 1: UPDATE CLAIMS TABLE - Add Financial Fields
-- =====================================================

ALTER TABLE public.claims
    -- Settlement amounts
    ADD COLUMN IF NOT EXISTS final_settlement_amount DECIMAL(10, 2), -- Amount settled with company
    ADD COLUMN IF NOT EXISTS actual_paid_amount DECIMAL(10, 2), -- Amount client actually received

    -- Commission tracking
    ADD COLUMN IF NOT EXISTS opening_fee_amount DECIMAL(10, 2) DEFAULT 29.00, -- Case opening fee
    ADD COLUMN IF NOT EXISTS opening_fee_paid BOOLEAN DEFAULT FALSE, -- Whether opening fee was paid
    ADD COLUMN IF NOT EXISTS opening_fee_paid_at TIMESTAMP WITH TIME ZONE,

    ADD COLUMN IF NOT EXISTS system_commission_due DECIMAL(10, 2), -- 15% commission due to us
    ADD COLUMN IF NOT EXISTS commission_paid BOOLEAN DEFAULT FALSE, -- Whether commission has been paid
    ADD COLUMN IF NOT EXISTS commission_paid_at TIMESTAMP WITH TIME ZONE,

    -- Payment proof
    ADD COLUMN IF NOT EXISTS settlement_proof_url TEXT, -- Photo of check/transfer uploaded by client
    ADD COLUMN IF NOT EXISTS settlement_date TIMESTAMP WITH TIME ZONE,

    -- Stripe payment tracking
    ADD COLUMN IF NOT EXISTS opening_fee_stripe_payment_id TEXT, -- Stripe payment ID for opening fee
    ADD COLUMN IF NOT EXISTS commission_stripe_payment_id TEXT, -- Stripe payment ID for commission
    ADD COLUMN IF NOT EXISTS commission_stripe_invoice_id TEXT; -- Stripe invoice ID

-- Add comments
COMMENT ON COLUMN claims.opening_fee_amount IS 'Fixed fee: 29 NIS to open case (covers server costs, prevents spam)';
COMMENT ON COLUMN claims.system_commission_due IS 'Success fee: 15% of actual_paid_amount (only charged on win)';
COMMENT ON COLUMN claims.settlement_proof_url IS 'Client uploads photo of payment proof (check/bank transfer)';

-- =====================================================
-- PART 2: CREATE PAYMENT REQUESTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.payment_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- References
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    -- Payment details
    payment_type TEXT NOT NULL CHECK (payment_type IN ('opening_fee', 'commission')),
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'ILS',

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'paid', 'failed', 'cancelled')),

    -- Stripe integration
    stripe_payment_intent_id TEXT,
    stripe_invoice_id TEXT,
    stripe_payment_url TEXT, -- Payment link sent to client

    -- Dates
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own payment requests"
    ON public.payment_requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payment requests"
    ON public.payment_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX idx_payment_requests_claim_id ON public.payment_requests(claim_id);
CREATE INDEX idx_payment_requests_user_id ON public.payment_requests(user_id);
CREATE INDEX idx_payment_requests_status ON public.payment_requests(status);

-- =====================================================
-- PART 3: CREATE SETTLEMENT PROOFS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.settlement_proofs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- References
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    -- Proof details
    proof_type TEXT CHECK (proof_type IN ('check_photo', 'bank_transfer', 'cash_receipt', 'other')),
    file_url TEXT NOT NULL, -- URL to uploaded file in Supabase Storage
    file_name TEXT,
    file_size_bytes INTEGER,

    -- Amount verification
    claimed_amount DECIMAL(10, 2), -- Amount user claims to have received
    verified_amount DECIMAL(10, 2), -- Amount verified by admin (may differ)
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES public.admin_users(id),
    verified_at TIMESTAMP WITH TIME ZONE,

    -- Notes
    user_notes TEXT, -- User explanation
    admin_notes TEXT, -- Admin verification notes

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.settlement_proofs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own settlement proofs"
    ON public.settlement_proofs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settlement proofs"
    ON public.settlement_proofs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all settlement proofs"
    ON public.settlement_proofs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can update settlement proofs"
    ON public.settlement_proofs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX idx_settlement_proofs_claim_id ON public.settlement_proofs(claim_id);
CREATE INDEX idx_settlement_proofs_verified ON public.settlement_proofs(verified);

-- =====================================================
-- PART 4: FUNCTIONS FOR COMMISSION CALCULATION
-- =====================================================

-- Function to calculate 15% commission
CREATE OR REPLACE FUNCTION calculate_commission(amount DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    -- 15% of actual paid amount
    RETURN ROUND(amount * 0.15, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to update commission when settlement proof is uploaded
CREATE OR REPLACE FUNCTION update_commission_on_proof_upload()
RETURNS TRIGGER AS $$
DECLARE
    claim_record RECORD;
BEGIN
    -- Get the claim
    SELECT * INTO claim_record
    FROM public.claims
    WHERE id = NEW.claim_id;

    -- Calculate commission (15% of claimed amount)
    UPDATE public.claims
    SET
        actual_paid_amount = NEW.claimed_amount,
        system_commission_due = calculate_commission(NEW.claimed_amount),
        settlement_proof_url = NEW.file_url,
        settlement_date = NOW(),
        updated_at = NOW()
    WHERE id = NEW.claim_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate commission when proof uploaded
CREATE TRIGGER on_settlement_proof_uploaded
    AFTER INSERT ON public.settlement_proofs
    FOR EACH ROW
    EXECUTE FUNCTION update_commission_on_proof_upload();

-- Function to finalize commission after admin verification
CREATE OR REPLACE FUNCTION finalize_commission_on_verification()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger when verification changes from false to true
    IF NEW.verified = TRUE AND (OLD.verified IS NULL OR OLD.verified = FALSE) THEN
        -- Update claim with verified amount
        UPDATE public.claims
        SET
            actual_paid_amount = NEW.verified_amount,
            system_commission_due = calculate_commission(NEW.verified_amount),
            updated_at = NOW()
        WHERE id = NEW.claim_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update commission when admin verifies
CREATE TRIGGER on_settlement_proof_verified
    AFTER UPDATE ON public.settlement_proofs
    FOR EACH ROW
    EXECUTE FUNCTION finalize_commission_on_verification();

-- =====================================================
-- PART 5: HELPER FUNCTIONS
-- =====================================================

-- Get total revenue for a claim (opening fee + commission)
CREATE OR REPLACE FUNCTION get_claim_total_revenue(claim_id_input UUID)
RETURNS DECIMAL AS $$
DECLARE
    total DECIMAL;
BEGIN
    SELECT
        COALESCE(opening_fee_amount, 0) + COALESCE(system_commission_due, 0)
    INTO total
    FROM public.claims
    WHERE id = claim_id_input;

    RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql;

-- Get total outstanding payments (not yet paid)
CREATE OR REPLACE FUNCTION get_outstanding_payments()
RETURNS TABLE (
    claim_id UUID,
    user_id UUID,
    opening_fee_due DECIMAL,
    commission_due DECIMAL,
    total_due DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS claim_id,
        c.user_id,
        CASE WHEN c.opening_fee_paid = FALSE THEN c.opening_fee_amount ELSE 0 END AS opening_fee_due,
        CASE WHEN c.commission_paid = FALSE THEN COALESCE(c.system_commission_due, 0) ELSE 0 END AS commission_due,
        (CASE WHEN c.opening_fee_paid = FALSE THEN c.opening_fee_amount ELSE 0 END) +
        (CASE WHEN c.commission_paid = FALSE THEN COALESCE(c.system_commission_due, 0) ELSE 0 END) AS total_due
    FROM public.claims c
    WHERE
        c.opening_fee_paid = FALSE
        OR (c.commission_paid = FALSE AND c.system_commission_due IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 6: TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE TRIGGER update_payment_requests_updated_at
    BEFORE UPDATE ON public.payment_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlement_proofs_updated_at
    BEFORE UPDATE ON public.settlement_proofs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PART 7: VERIFICATION QUERIES
-- =====================================================

-- Check if tables were created
SELECT
    'payment_requests' AS table_name,
    COUNT(*) AS record_count
FROM public.payment_requests
UNION ALL
SELECT
    'settlement_proofs' AS table_name,
    COUNT(*) AS record_count
FROM public.settlement_proofs;

-- Check if columns were added to claims
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'claims'
    AND column_name IN (
        'final_settlement_amount',
        'actual_paid_amount',
        'system_commission_due',
        'opening_fee_amount',
        'opening_fee_paid',
        'commission_paid',
        'settlement_proof_url'
    )
ORDER BY column_name;

-- Test commission calculation
SELECT calculate_commission(1000.00) AS commission_for_1000_nis; -- Should return 150.00

-- =====================================================
-- PART 8: SEED DATA (Example)
-- =====================================================

-- Example: Mark a claim as settled and calculate commission
-- (Run this manually for testing)

/*
-- Example claim flow:
-- 1. User wins claim for 1000 NIS
UPDATE claims
SET
    status = 'approved',
    final_settlement_amount = 1000.00
WHERE id = 'YOUR_CLAIM_ID';

-- 2. User uploads settlement proof (via app)
INSERT INTO settlement_proofs (claim_id, user_id, proof_type, file_url, claimed_amount)
VALUES (
    'YOUR_CLAIM_ID',
    'YOUR_USER_ID',
    'bank_transfer',
    'https://storage.supabase.co/.../proof.jpg',
    1000.00
);

-- 3. Trigger automatically calculates 15% = 150 NIS commission
-- 4. Admin verifies proof
UPDATE settlement_proofs
SET
    verified = TRUE,
    verified_amount = 1000.00,
    verified_by = 'ADMIN_USER_ID'
WHERE claim_id = 'YOUR_CLAIM_ID';

-- 5. System creates payment request for 150 NIS commission
-- 6. User pays via Stripe
-- 7. Mark commission as paid
UPDATE claims
SET
    commission_paid = TRUE,
    commission_paid_at = NOW(),
    commission_stripe_payment_id = 'pi_xxxxx'
WHERE id = 'YOUR_CLAIM_ID';
*/

-- =====================================================
-- NOTES FOR IMPLEMENTATION
-- =====================================================

/*
BUSINESS LOGIC:

Opening Fee (29 NIS):
- Charged when user first creates claim
- Prevents spam/frivolous claims
- Covers server costs (PDF generation, email sending, storage)
- Payment via Stripe before claim is submitted

Success Fee (15%):
- Only charged if user WINS and receives money
- Calculated on actual_paid_amount (what user actually got)
- Client uploads proof of payment (check photo, bank transfer screenshot)
- Admin verifies proof
- System auto-calculates 15%
- Invoice sent via Stripe
- User pays commission
- Platform profits aligned with user success!

Flow:
1. User reports incidents → Free
2. System creates claim → User pays 29 NIS opening fee
3. System sends legal letter → Automated
4. Company agrees to pay → User wins!
5. User receives money → User uploads proof
6. Admin verifies proof → System calculates 15%
7. System sends invoice → User pays commission
8. Everyone happy! 🎉

Revenue Model:
- Opening fees: 29 NIS × N claims = Predictable base revenue
- Success fees: 15% × Actual payouts = Performance-based revenue
- Total revenue = Opening fees + Success fees

Example:
- 100 users file claims → 100 × 29 = 2,900 NIS
- 70 users win (70% success rate)
- Average payout: 1,000 NIS
- Commission: 70 × (1,000 × 0.15) = 10,500 NIS
- Total revenue: 2,900 + 10,500 = 13,400 NIS

This aligns platform success with user success! 💰
*/
