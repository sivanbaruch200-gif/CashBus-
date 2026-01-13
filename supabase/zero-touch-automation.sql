-- =====================================================
-- CashBus Zero-Touch Legal Automation System
-- This migration adds company database, mandatory user fields,
-- and infrastructure for automated legal submissions
-- =====================================================

-- =====================================================
-- PART 1: BUS COMPANIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.bus_companies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Company Information
    company_name TEXT UNIQUE NOT NULL,
    company_name_en TEXT, -- English name for API/system use

    -- Contact Methods
    public_contact_email TEXT, -- For email submissions
    online_form_url TEXT, -- URL to company's online form
    requires_form_automation BOOLEAN DEFAULT FALSE, -- If true, use web automation instead of email

    -- Additional Contact Info (for future use)
    phone TEXT,
    fax TEXT,
    postal_address TEXT,

    -- Ministry Reporting
    report_to_ministry BOOLEAN DEFAULT TRUE, -- BCC Ministry on all contacts

    -- System Fields
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT, -- Admin notes about company

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.bus_companies ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public read access (users need to see company info)
CREATE POLICY "Public can view active bus companies"
    ON public.bus_companies FOR SELECT
    USING (is_active = TRUE);

-- RLS Policy: Only admins can modify companies (will be enforced via admin_users table)
CREATE POLICY "Admins can insert bus companies"
    ON public.bus_companies FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can update bus companies"
    ON public.bus_companies FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can delete bus companies"
    ON public.bus_companies FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid()
        )
    );

-- Index for performance
CREATE INDEX idx_bus_companies_name ON public.bus_companies(company_name);
CREATE INDEX idx_bus_companies_active ON public.bus_companies(is_active);

-- =====================================================
-- PART 2: UPDATE PROFILES TABLE - ADD MANDATORY FIELDS
-- =====================================================

-- Add home address and make ID number NOT NULL (required for small claims)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS home_address TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS postal_code TEXT,
    ADD COLUMN IF NOT EXISTS address_verified BOOLEAN DEFAULT FALSE,
    ALTER COLUMN id_number SET NOT NULL; -- Make ID mandatory for legal submissions

-- Update existing profiles with placeholder ID if null (admin must verify)
UPDATE public.profiles
SET id_number = '000000000'
WHERE id_number IS NULL OR id_number = '';

-- Add comment explaining the importance
COMMENT ON COLUMN public.profiles.id_number IS 'Israeli ID number - MANDATORY for filing small claims and legal documents';
COMMENT ON COLUMN public.profiles.home_address IS 'Full home address - MANDATORY for small claims court filings';

-- =====================================================
-- PART 3: SUBMISSION TRACKING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.legal_submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- References
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.bus_companies(id) ON DELETE SET NULL,

    -- Submission Details
    submission_type TEXT NOT NULL CHECK (submission_type IN ('email', 'web_form', 'postal')),
    submission_status TEXT DEFAULT 'pending' CHECK (submission_status IN ('pending', 'in_progress', 'sent', 'delivered', 'failed', 'bounced')),

    -- Email Submission Fields
    email_to TEXT, -- Company email
    email_bcc TEXT DEFAULT 'Pniotcrm@mot.gov.il', -- Ministry of Transport (always BCC)
    email_subject TEXT,
    email_body TEXT,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    email_message_id TEXT, -- For tracking delivery

    -- Web Form Submission Fields
    form_url TEXT, -- URL of the form
    form_data JSONB, -- Form field values filled automatically
    form_submitted_at TIMESTAMP WITH TIME ZONE,
    form_confirmation_number TEXT, -- Confirmation from form submission

    -- Document Attachments
    pdf_url TEXT, -- URL to generated PDF
    pdf_filename TEXT,

    -- Automation Tracking
    automation_method TEXT CHECK (automation_method IN ('manual', 'email_api', 'web_automation', 'api_integration')),
    automation_status TEXT,
    automation_error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,

    -- Delivery Confirmation
    delivered_at TIMESTAMP WITH TIME ZONE,
    delivery_confirmation_data JSONB, -- Email read receipts, form confirmations, etc.

    -- Ministry Reporting
    ministry_notified BOOLEAN DEFAULT FALSE,
    ministry_notification_sent_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.legal_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own submissions"
    ON public.legal_submissions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all submissions"
    ON public.legal_submissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "System can insert submissions"
    ON public.legal_submissions FOR INSERT
    WITH CHECK (true); -- Controlled by backend logic

-- Indexes
CREATE INDEX idx_legal_submissions_claim_id ON public.legal_submissions(claim_id);
CREATE INDEX idx_legal_submissions_user_id ON public.legal_submissions(user_id);
CREATE INDEX idx_legal_submissions_status ON public.legal_submissions(submission_status);
CREATE INDEX idx_legal_submissions_company ON public.legal_submissions(company_id);

-- =====================================================
-- PART 4: TRIGGERS & FUNCTIONS
-- =====================================================

-- Trigger for updated_at on bus_companies
CREATE TRIGGER update_bus_companies_updated_at
    BEFORE UPDATE ON public.bus_companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on legal_submissions
CREATE TRIGGER update_legal_submissions_updated_at
    BEFORE UPDATE ON public.legal_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get submission method for a company
CREATE OR REPLACE FUNCTION get_company_submission_method(company_name_input TEXT)
RETURNS TEXT AS $$
DECLARE
    company_record RECORD;
BEGIN
    SELECT * INTO company_record
    FROM public.bus_companies
    WHERE company_name = company_name_input AND is_active = TRUE;

    IF NOT FOUND THEN
        RETURN 'unknown';
    END IF;

    -- Priority: Form automation > Email > Manual
    IF company_record.requires_form_automation AND company_record.online_form_url IS NOT NULL THEN
        RETURN 'web_form';
    ELSIF company_record.public_contact_email IS NOT NULL THEN
        RETURN 'email';
    ELSE
        RETURN 'manual';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 5: SEED DATA - Israeli Bus Companies
-- =====================================================

INSERT INTO public.bus_companies (company_name, company_name_en, public_contact_email, online_form_url, requires_form_automation, is_active, notes)
VALUES
    ('אגד', 'Egged', NULL, 'https://www.egged.co.il/contact-us/', TRUE, TRUE, 'חברת האוטובוסים הגדולה בישראל. משתמשת בטופס אונליין בלבד'),
    ('דן', 'Dan', 'service@dan.co.il', NULL, FALSE, TRUE, 'מפעילה בגוש דן. יש אימייל ישיר'),
    ('קווים', 'Kavim', 'service@kavim-t.co.il', NULL, FALSE, TRUE, 'מפעילה במרכז ובדרום'),
    ('מטרופולין', 'Metropoline', 'info@metropoline.com', NULL, FALSE, TRUE, 'מפעילה באזור חיפה והצפון'),
    ('נתיב אקספרס', 'Nateev Express', 'service@nateevexpress.com', NULL, FALSE, TRUE, 'קווים בין עירוניים'),
    ('סופרבוס', 'Superbus', 'info@superbus.co.il', NULL, FALSE, TRUE, 'מפעילה במחוז הדרום'),
    ('אפיקים', 'Afikim', 'service@afikim-t.co.il', NULL, FALSE, TRUE, 'מפעילה במחוז הצפון'),
    ('גלים', 'Galim', 'info@galimbus.co.il', NULL, FALSE, TRUE, 'מפעילה באזור חדרה והסביבה'),
    ('רכבת ישראל', 'Israel Railways', 'service@rail.co.il', 'https://www.rail.co.il/contact', FALSE, TRUE, 'רכבת ישראל - לא אוטובוס אבל רלוונטי לתביעות')
ON CONFLICT (company_name) DO NOTHING;

-- =====================================================
-- PART 6: VERIFICATION QUERIES
-- =====================================================

-- Verify bus_companies table
SELECT 'bus_companies table created' AS status, COUNT(*) AS company_count
FROM public.bus_companies;

-- Verify profiles table has new fields
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name IN ('home_address', 'city', 'postal_code', 'id_number');

-- Verify legal_submissions table
SELECT 'legal_submissions table created' AS status, COUNT(*) AS submission_count
FROM public.legal_submissions;

-- Test submission method function
SELECT
    company_name,
    get_company_submission_method(company_name) AS submission_method,
    public_contact_email,
    online_form_url,
    requires_form_automation
FROM public.bus_companies
ORDER BY company_name;

-- =====================================================
-- NOTES FOR IMPLEMENTATION
-- =====================================================

/*
ZERO-TOUCH AUTOMATION LOGIC:

1. When user reports incident -> System logs it
2. When threshold reached (e.g., 3+ incidents) -> Auto-generate claim
3. Claim generation triggers workflow:
   a. Gather user data (id_number, home_address from profiles)
   b. Generate PDF warning letter (AI-powered)
   c. Lookup company in bus_companies table
   d. Determine submission method:
      - If has email AND NOT requires_form_automation -> Send email with PDF
      - If requires_form_automation -> Use Puppeteer/Playwright to fill form
      - Always BCC: Pniotcrm@mot.gov.il
   e. Track submission in legal_submissions table
   f. Send confirmation to user

4. Web Automation (for companies like Egged):
   - Use Puppeteer/Playwright on backend
   - Fill form fields with user data from profile
   - Attach PDF if form supports it
   - Screenshot confirmation page
   - Save confirmation number

5. Email Automation:
   - Use Resend/SendGrid API
   - From: noreply@cashbus.co.il
   - To: company email
   - BCC: Pniotcrm@mot.gov.il
   - Subject: "דרישה לפיצוי - תיעוד עיכובים בקו {bus_line}"
   - Body: Professional Hebrew letter
   - Attachment: PDF warning letter
   - Track: message_id, delivery status, read receipts

6. Ministry Reporting:
   - EVERY outgoing contact MUST BCC: Pniotcrm@mot.gov.il
   - Log ministry_notified = TRUE
   - Keep audit trail in legal_submissions table

NEXT STEPS:
1. Create TypeScript types for new tables
2. Implement smart submission service (lib/submissions.ts)
3. Create web automation service (lib/webAutomation.ts)
4. Create email service with Ministry BCC (lib/emailService.ts)
5. Build admin UI for managing companies
6. Update user profile forms to collect address + ID
*/

