-- =====================================================
-- CashBus - Reminder System (21-Day Cycle, Weekly)
-- Migration: Add letter_reminders table and automation
-- Date: 2026-02-17 (Updated per lawyer consultation)
-- =====================================================
-- IMPORTANT: Lawyer ruled that reminders every 2 days = harassment.
-- Minimum interval: 7 days (weekly). Deadline: 21 days.
-- =====================================================

-- =====================================================
-- SECTION 1: Create letter_reminders table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.letter_reminders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    -- Timeline tracking
    initial_letter_sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    days_since_initial INTEGER DEFAULT 0,

    -- Reminder schedule (21-Day Cycle, Weekly intervals)
    -- Day 0: Initial demand letter (21-day deadline)
    -- Day 7: First reminder + digital evidence summary
    -- Day 14: Second reminder + legal escalation warning
    -- Day 21: Final notice - lawsuit draft ready

    day_7_sent BOOLEAN DEFAULT FALSE,
    day_7_sent_at TIMESTAMP WITH TIME ZONE,

    day_14_sent BOOLEAN DEFAULT FALSE,
    day_14_sent_at TIMESTAMP WITH TIME ZONE,

    day_21_sent BOOLEAN DEFAULT FALSE,
    day_21_sent_at TIMESTAMP WITH TIME ZONE,

    -- Status tracking
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'cancelled', 'filed')),
    payment_received_at TIMESTAMP WITH TIME ZONE,
    lawsuit_filed BOOLEAN DEFAULT FALSE,
    lawsuit_filed_at TIMESTAMP WITH TIME ZONE,

    -- Email tracking
    total_emails_sent INTEGER DEFAULT 0,
    last_email_sent_at TIMESTAMP WITH TIME ZONE,

    -- Company response
    company_responded BOOLEAN DEFAULT FALSE,
    company_response_date TIMESTAMP WITH TIME ZONE,
    company_response_details TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.letter_reminders IS '21-Day reminder automation: weekly intervals per lawyer guidance';
COMMENT ON COLUMN public.letter_reminders.days_since_initial IS 'Auto-calculated: days since initial letter sent';
COMMENT ON COLUMN public.letter_reminders.status IS 'active: sending reminders | paid: company paid | cancelled: user cancelled | filed: lawsuit filed';

-- =====================================================
-- SECTION 2: Add indexes for performance
-- =====================================================

CREATE INDEX idx_letter_reminders_claim_id ON public.letter_reminders(claim_id);
CREATE INDEX idx_letter_reminders_status ON public.letter_reminders(status);
CREATE INDEX idx_letter_reminders_days_since ON public.letter_reminders(days_since_initial);
CREATE INDEX idx_letter_reminders_active_pending ON public.letter_reminders(status, initial_letter_sent_at)
    WHERE status = 'active';

-- =====================================================
-- SECTION 3: Add columns to legal_documents
-- =====================================================

ALTER TABLE public.legal_documents
    ADD COLUMN IF NOT EXISTS letter_sequence INTEGER DEFAULT 0;

ALTER TABLE public.legal_documents
    ADD COLUMN IF NOT EXISTS reminder_type TEXT CHECK (reminder_type IN (
        'initial',
        'first_reminder',
        'escalation_warning',
        'final_notice',
        NULL
    ));

COMMENT ON COLUMN public.legal_documents.letter_sequence IS '0=initial letter, 1=day 7, 2=day 14, 3=day 21';
COMMENT ON COLUMN public.legal_documents.reminder_type IS 'Type of reminder letter for tracking purposes';

-- =====================================================
-- SECTION 4: Create function to calculate days_since_initial
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_days_since_initial()
RETURNS TRIGGER AS $$
BEGIN
    NEW.days_since_initial := EXTRACT(DAY FROM (NOW() - NEW.initial_letter_sent_at))::INTEGER;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_days_since_initial
    BEFORE UPDATE ON public.letter_reminders
    FOR EACH ROW
    EXECUTE FUNCTION calculate_days_since_initial();

-- =====================================================
-- SECTION 5: Create function to get pending reminders
-- =====================================================

CREATE OR REPLACE FUNCTION get_pending_reminders()
RETURNS TABLE (
    reminder_id UUID,
    claim_id UUID,
    user_id UUID,
    days_since_initial INTEGER,
    next_reminder_type TEXT,
    customer_name TEXT,
    customer_email TEXT,
    bus_company TEXT,
    total_compensation DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        lr.id AS reminder_id,
        lr.claim_id,
        lr.user_id,
        EXTRACT(DAY FROM (NOW() - lr.initial_letter_sent_at))::INTEGER AS days_since_initial,
        CASE
            WHEN EXTRACT(DAY FROM (NOW() - lr.initial_letter_sent_at))::INTEGER >= 21 AND NOT lr.day_21_sent THEN 'day_21'
            WHEN EXTRACT(DAY FROM (NOW() - lr.initial_letter_sent_at))::INTEGER >= 14 AND NOT lr.day_14_sent THEN 'day_14'
            WHEN EXTRACT(DAY FROM (NOW() - lr.initial_letter_sent_at))::INTEGER >= 7 AND NOT lr.day_7_sent THEN 'day_7'
            ELSE 'none'
        END AS next_reminder_type,
        p.full_name AS customer_name,
        p.email AS customer_email,
        c.bus_company,
        c.claim_amount AS total_compensation
    FROM public.letter_reminders lr
    JOIN public.profiles p ON lr.user_id = p.id
    JOIN public.claims c ON lr.claim_id = c.id
    WHERE lr.status = 'active'
        AND EXTRACT(DAY FROM (NOW() - lr.initial_letter_sent_at))::INTEGER <= 21
    ORDER BY days_since_initial DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECTION 6: Create function to mark reminder as sent
-- =====================================================

CREATE OR REPLACE FUNCTION mark_reminder_sent(
    p_reminder_id UUID,
    p_reminder_type TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE public.letter_reminders
    SET
        total_emails_sent = total_emails_sent + 1,
        last_email_sent_at = NOW(),
        updated_at = NOW(),
        day_7_sent = CASE WHEN p_reminder_type = 'day_7' THEN TRUE ELSE day_7_sent END,
        day_7_sent_at = CASE WHEN p_reminder_type = 'day_7' THEN NOW() ELSE day_7_sent_at END,
        day_14_sent = CASE WHEN p_reminder_type = 'day_14' THEN TRUE ELSE day_14_sent END,
        day_14_sent_at = CASE WHEN p_reminder_type = 'day_14' THEN NOW() ELSE day_14_sent_at END,
        day_21_sent = CASE WHEN p_reminder_type = 'day_21' THEN TRUE ELSE day_21_sent END,
        day_21_sent_at = CASE WHEN p_reminder_type = 'day_21' THEN NOW() ELSE day_21_sent_at END
    WHERE id = p_reminder_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECTION 7: Create trigger for updated_at
-- =====================================================

CREATE TRIGGER update_letter_reminders_updated_at
    BEFORE UPDATE ON public.letter_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SECTION 8: Enable RLS
-- =====================================================

ALTER TABLE public.letter_reminders ENABLE ROW LEVEL SECURITY;

-- Users can see their own reminders
CREATE POLICY "letter_reminders_select_own" ON public.letter_reminders FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can see all reminders
CREATE POLICY "letter_reminders_admin_select" ON public.letter_reminders FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- Admins can update all reminders
CREATE POLICY "letter_reminders_admin_update" ON public.letter_reminders FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- System can insert reminders
CREATE POLICY "letter_reminders_system_insert" ON public.letter_reminders FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- DONE! Reminder system tables created successfully.
--
-- Next steps:
-- 1. Create Edge Function: send-reminders
-- 2. Set up cron job to run daily at 9:00 AM
-- 3. Integrate with Resend API for email automation
-- =====================================================
