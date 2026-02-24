-- =====================================================
-- CashBus - Withdrawal Requests Table
-- Date: 2026-02-22
-- Purpose: Customer-initiated payout requests
--   When a bus company pays CashBus, the 80% customer
--   share sits in the DB until the customer explicitly
--   requests it. This table tracks those requests.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
    incoming_payment_id UUID REFERENCES public.incoming_payments(id) ON DELETE CASCADE NOT NULL,
    -- The 80% customer payout amount
    amount DECIMAL(10, 2) NOT NULL,
    -- Bank details snapshot at time of request (in case user later changes them)
    bank_name TEXT,
    bank_branch TEXT,
    bank_account_number TEXT,
    bank_account_owner_name TEXT,
    -- Status flow: pending → processing → completed (or cancelled)
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    -- Notes
    user_notes TEXT,
    admin_notes TEXT,
    -- Timestamps
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id
    ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_claim_id
    ON public.withdrawal_requests(claim_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status
    ON public.withdrawal_requests(status);

-- =====================================================
-- RLS
-- =====================================================

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can view own withdrawal requests"
    ON public.withdrawal_requests FOR SELECT
    USING (user_id = auth.uid());

-- Users can create their own requests
DROP POLICY IF EXISTS "Users can insert own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can insert own withdrawal requests"
    ON public.withdrawal_requests FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Admins can manage all
DROP POLICY IF EXISTS "Admins can manage withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Admins can manage withdrawal requests"
    ON public.withdrawal_requests FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- =====================================================
-- DONE! Run in Supabase SQL Editor.
-- =====================================================
