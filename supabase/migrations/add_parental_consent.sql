-- =====================================================
-- CashBus - Parental Consent System
-- Version: 1.0.0
-- Date: 2026-02-03
--
-- Purpose: Add age gate and parental consent for minors
-- =====================================================

-- -----------------------------------------------------
-- 1. Add birthdate to profiles table
-- -----------------------------------------------------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS birthdate DATE;

COMMENT ON COLUMN public.profiles.birthdate IS 'User birthdate - used for age verification (minors need parental consent)';

-- -----------------------------------------------------
-- 2. Create parental_consents table
-- -----------------------------------------------------
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

-- Comments
COMMENT ON TABLE public.parental_consents IS 'Parental consent records for minor users (under 18)';
COMMENT ON COLUMN public.parental_consents.consent_token IS 'Unique token used in consent link sent to parent email';
COMMENT ON COLUMN public.parental_consents.parent_id_number IS 'Israeli ID number - for legal verification of parent identity';

-- -----------------------------------------------------
-- 3. Create indexes
-- -----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_parental_consents_minor_user_id
ON public.parental_consents(minor_user_id);

CREATE INDEX IF NOT EXISTS idx_parental_consents_token
ON public.parental_consents(consent_token);

CREATE INDEX IF NOT EXISTS idx_parental_consents_status
ON public.parental_consents(status);

CREATE INDEX IF NOT EXISTS idx_parental_consents_expires
ON public.parental_consents(expires_at)
WHERE status = 'pending';

-- -----------------------------------------------------
-- 4. Add updated_at trigger
-- -----------------------------------------------------
CREATE TRIGGER update_parental_consents_updated_at
BEFORE UPDATE ON public.parental_consents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- 5. Enable RLS
-- -----------------------------------------------------
ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- 6. RLS Policies
-- -----------------------------------------------------

-- Minors can see their own consent records
CREATE POLICY "parental_consents_select_own" ON public.parental_consents
FOR SELECT USING (auth.uid() = minor_user_id);

-- Minors can create consent requests
CREATE POLICY "parental_consents_insert_own" ON public.parental_consents
FOR INSERT WITH CHECK (auth.uid() = minor_user_id);

-- Public access for consent form (using token) - no auth required
CREATE POLICY "parental_consents_public_token" ON public.parental_consents
FOR SELECT USING (TRUE);  -- Token validation happens in API

-- Allow updates via consent token (parent filling form)
CREATE POLICY "parental_consents_update_token" ON public.parental_consents
FOR UPDATE USING (TRUE);  -- Token validation happens in API

-- Admins can see all
CREATE POLICY "parental_consents_admin_select" ON public.parental_consents
FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- Admins can update all
CREATE POLICY "parental_consents_admin_update" ON public.parental_consents
FOR UPDATE USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- -----------------------------------------------------
-- 7. Helper function: Check if user is minor
-- -----------------------------------------------------
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
        RETURN FALSE;  -- If no birthdate, assume adult
    END IF;

    age_years := EXTRACT(YEAR FROM AGE(CURRENT_DATE, user_birthdate));
    RETURN age_years < 18;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_user_minor IS 'Returns TRUE if user is under 18 based on birthdate';

-- -----------------------------------------------------
-- 8. Helper function: Check if minor has valid consent
-- -----------------------------------------------------
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

COMMENT ON FUNCTION has_valid_parental_consent IS 'Returns TRUE if minor has approved parental consent';

-- -----------------------------------------------------
-- 9. Helper function: Can user report incidents
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION can_user_report(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- If user is not a minor, they can report
    IF NOT is_user_minor(user_id) THEN
        RETURN TRUE;
    END IF;

    -- If user is a minor, check for valid consent
    RETURN has_valid_parental_consent(user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_user_report IS 'Returns TRUE if user can report incidents (adults or minors with consent)';

-- -----------------------------------------------------
-- 10. Helper function: Validate Israeli ID (Checksum)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION validate_israeli_id(id_number TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    id_digits TEXT;
    total INTEGER := 0;
    digit INTEGER;
    multiplied INTEGER;
    i INTEGER;
BEGIN
    -- Remove any non-digit characters
    id_digits := REGEXP_REPLACE(id_number, '[^0-9]', '', 'g');

    -- Pad with leading zeros to 9 digits
    id_digits := LPAD(id_digits, 9, '0');

    -- Must be exactly 9 digits
    IF LENGTH(id_digits) != 9 THEN
        RETURN FALSE;
    END IF;

    -- Israeli ID checksum algorithm
    FOR i IN 1..9 LOOP
        digit := CAST(SUBSTRING(id_digits, i, 1) AS INTEGER);

        -- Multiply by 1 or 2 alternating
        IF i % 2 = 0 THEN
            multiplied := digit * 2;
        ELSE
            multiplied := digit * 1;
        END IF;

        -- If result > 9, subtract 9 (same as sum of digits)
        IF multiplied > 9 THEN
            multiplied := multiplied - 9;
        END IF;

        total := total + multiplied;
    END LOOP;

    -- Valid if total is divisible by 10
    RETURN (total % 10) = 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION validate_israeli_id IS 'Validates Israeli ID number using checksum algorithm';

-- -----------------------------------------------------
-- 11. Grant permissions
-- -----------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.parental_consents TO authenticated;
GRANT SELECT, UPDATE ON public.parental_consents TO anon;  -- For consent form access
GRANT EXECUTE ON FUNCTION is_user_minor TO authenticated;
GRANT EXECUTE ON FUNCTION has_valid_parental_consent TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_report TO authenticated;
GRANT EXECUTE ON FUNCTION validate_israeli_id TO authenticated;
GRANT EXECUTE ON FUNCTION validate_israeli_id TO anon;

-- -----------------------------------------------------
-- VERIFICATION
-- -----------------------------------------------------
SELECT 'Parental consent system created successfully!' AS status;

-- Test Israeli ID validation
SELECT validate_israeli_id('123456782') AS valid_id_test;  -- Should be TRUE (valid checksum)
SELECT validate_israeli_id('123456789') AS invalid_id_test;  -- Should be FALSE (invalid checksum)
