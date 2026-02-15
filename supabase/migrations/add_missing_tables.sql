-- =====================================================
-- CashBus - Missing Tables Migration
-- Date: 2026-02-03
--
-- Tables: parental_consents + email_logs
-- =====================================================

-- =====================================================
-- PART 1: PARENTAL CONSENTS (הסכמת הורים)
-- =====================================================

-- Add birthdate to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS birthdate DATE;

COMMENT ON COLUMN public.profiles.birthdate IS 'User birthdate - used for age verification (minors need parental consent)';

-- Create parental_consents table
CREATE TABLE IF NOT EXISTS public.parental_consents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Minor information
    minor_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    minor_name TEXT NOT NULL,
    minor_birthdate DATE NOT NULL,

    -- Parent information (filled by minor)
    parent_name TEXT NOT NULL,
    parent_email TEXT NOT NULL,

    -- Parent details (filled by parent in consent form)
    parent_full_name TEXT,
    parent_id_number TEXT,  -- Israeli ID (תעודת זהות)
    parent_phone TEXT,

    -- Consent status
    consent_token TEXT UNIQUE NOT NULL,  -- Unique token for consent link
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'expired', 'rejected')),

    -- Consent details (filled when parent signs)
    consent_given_at TIMESTAMP WITH TIME ZONE,
    consent_ip_address INET,
    consent_user_agent TEXT,

    -- Legal declaration checkbox
    confirmed_legal_guardian BOOLEAN DEFAULT FALSE,
    confirmed_terms_of_service BOOLEAN DEFAULT FALSE,
    confirmed_fee_model BOOLEAN DEFAULT FALSE,

    -- Email tracking
    email_sent_at TIMESTAMP WITH TIME ZONE,
    email_reminder_sent_at TIMESTAMP WITH TIME ZONE,
    email_reminder_count INTEGER DEFAULT 0,

    -- Expiration (token expires after 7 days)
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.parental_consents IS 'Parental consent records for minor users (under 18)';

-- Indexes for parental_consents
CREATE INDEX IF NOT EXISTS idx_parental_consents_minor_user_id ON public.parental_consents(minor_user_id);
CREATE INDEX IF NOT EXISTS idx_parental_consents_token ON public.parental_consents(consent_token);
CREATE INDEX IF NOT EXISTS idx_parental_consents_status ON public.parental_consents(status);
CREATE INDEX IF NOT EXISTS idx_parental_consents_expires ON public.parental_consents(expires_at) WHERE status = 'pending';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_parental_consents_updated_at ON public.parental_consents;
CREATE TRIGGER update_parental_consents_updated_at
BEFORE UPDATE ON public.parental_consents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for parental_consents
DROP POLICY IF EXISTS "parental_consents_select_own" ON public.parental_consents;
CREATE POLICY "parental_consents_select_own" ON public.parental_consents
FOR SELECT USING (auth.uid() = minor_user_id);

DROP POLICY IF EXISTS "parental_consents_insert_own" ON public.parental_consents;
CREATE POLICY "parental_consents_insert_own" ON public.parental_consents
FOR INSERT WITH CHECK (auth.uid() = minor_user_id);

DROP POLICY IF EXISTS "parental_consents_public_token" ON public.parental_consents;
CREATE POLICY "parental_consents_public_token" ON public.parental_consents
FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "parental_consents_update_token" ON public.parental_consents;
CREATE POLICY "parental_consents_update_token" ON public.parental_consents
FOR UPDATE USING (TRUE);

DROP POLICY IF EXISTS "parental_consents_admin_select" ON public.parental_consents;
CREATE POLICY "parental_consents_admin_select" ON public.parental_consents
FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "parental_consents_admin_update" ON public.parental_consents;
CREATE POLICY "parental_consents_admin_update" ON public.parental_consents
FOR UPDATE USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- Grant permissions for parental_consents
GRANT SELECT, INSERT, UPDATE ON public.parental_consents TO authenticated;
GRANT SELECT, UPDATE ON public.parental_consents TO anon;

-- =====================================================
-- PART 2: EMAIL LOGS (תיעוד מיילים - הוכחה משפטית)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Resend tracking
    message_id TEXT,  -- מזהה ייחודי מ-Resend

    -- Timestamp
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Email details
    from_email TEXT NOT NULL,  -- claims@cashbuses.com
    to_email TEXT NOT NULL,    -- חברת אוטובוסים או הורה
    subject TEXT NOT NULL,

    -- Status tracking
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'bounced', 'failed', 'opened', 'clicked')),
    error_message TEXT,

    -- Links to other tables
    submission_id UUID REFERENCES public.legal_submissions(id) ON DELETE SET NULL,
    claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
    consent_id UUID REFERENCES public.parental_consents(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Email type classification
    email_type TEXT NOT NULL CHECK (email_type IN (
        'legal_demand',       -- מכתב התראה
        'legal_reminder',     -- תזכורת
        'parental_consent',   -- הסכמת הורים
        'payment_request',    -- בקשת תשלום
        'settlement_confirmation', -- אישור פשרה
        'system_notification' -- הודעות מערכת
    )),

    -- Additional metadata
    metadata JSONB DEFAULT '{}',  -- נתונים נוספים (headers, attachments info, etc.)

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.email_logs IS 'Log of all sent emails - legal evidence for court';
COMMENT ON COLUMN public.email_logs.message_id IS 'Unique message ID from Resend API';
COMMENT ON COLUMN public.email_logs.email_type IS 'Type of email: legal_demand, parental_consent, etc.';

-- Indexes for email_logs
CREATE INDEX IF NOT EXISTS idx_email_logs_message_id ON public.email_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_to_email ON public.email_logs(to_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON public.email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_claim_id ON public.email_logs(claim_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_email_logs_updated_at ON public.email_logs;
CREATE TRIGGER update_email_logs_updated_at
BEFORE UPDATE ON public.email_logs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_logs
-- Users can see their own email logs
DROP POLICY IF EXISTS "email_logs_select_own" ON public.email_logs;
CREATE POLICY "email_logs_select_own" ON public.email_logs
FOR SELECT USING (auth.uid() = user_id);

-- Admins can see all
DROP POLICY IF EXISTS "email_logs_admin_all" ON public.email_logs;
CREATE POLICY "email_logs_admin_all" ON public.email_logs
FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- Service role can insert (for API routes)
DROP POLICY IF EXISTS "email_logs_service_insert" ON public.email_logs;
CREATE POLICY "email_logs_service_insert" ON public.email_logs
FOR INSERT WITH CHECK (TRUE);

-- Grant permissions for email_logs
GRANT SELECT, INSERT, UPDATE ON public.email_logs TO authenticated;
GRANT INSERT ON public.email_logs TO anon;

-- =====================================================
-- PART 3: HELPER FUNCTIONS
-- =====================================================

-- Check if user is minor
CREATE OR REPLACE FUNCTION is_user_minor(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_birthdate DATE;
    age_years INTEGER;
BEGIN
    SELECT birthdate INTO user_birthdate
    FROM public.profiles
    WHERE id = user_id;

    IF user_birthdate IS NULL THEN
        RETURN FALSE;
    END IF;

    age_years := EXTRACT(YEAR FROM AGE(CURRENT_DATE, user_birthdate));
    RETURN age_years < 18;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if minor has valid consent
CREATE OR REPLACE FUNCTION has_valid_parental_consent(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.parental_consents
        WHERE minor_user_id = user_id
          AND status = 'approved'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Can user report incidents
CREATE OR REPLACE FUNCTION can_user_report(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT is_user_minor(user_id) THEN
        RETURN TRUE;
    END IF;
    RETURN has_valid_parental_consent(user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate Israeli ID
CREATE OR REPLACE FUNCTION validate_israeli_id(id_number TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    id_digits TEXT;
    total INTEGER := 0;
    digit INTEGER;
    multiplied INTEGER;
    i INTEGER;
BEGIN
    id_digits := REGEXP_REPLACE(id_number, '[^0-9]', '', 'g');
    id_digits := LPAD(id_digits, 9, '0');

    IF LENGTH(id_digits) != 9 THEN
        RETURN FALSE;
    END IF;

    FOR i IN 1..9 LOOP
        digit := CAST(SUBSTRING(id_digits, i, 1) AS INTEGER);
        IF i % 2 = 0 THEN
            multiplied := digit * 2;
        ELSE
            multiplied := digit * 1;
        END IF;
        IF multiplied > 9 THEN
            multiplied := multiplied - 9;
        END IF;
        total := total + multiplied;
    END LOOP;

    RETURN (total % 10) = 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION is_user_minor TO authenticated;
GRANT EXECUTE ON FUNCTION has_valid_parental_consent TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_report TO authenticated;
GRANT EXECUTE ON FUNCTION validate_israeli_id TO authenticated;
GRANT EXECUTE ON FUNCTION validate_israeli_id TO anon;

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'Tables created successfully!' AS status;
SELECT 'parental_consents' AS table_name, COUNT(*) AS rows FROM public.parental_consents
UNION ALL
SELECT 'email_logs' AS table_name, COUNT(*) AS rows FROM public.email_logs;
