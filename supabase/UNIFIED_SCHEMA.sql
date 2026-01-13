-- =====================================================
-- CashBus - UNIFIED DATABASE SCHEMA
-- Version: 1.0.0 (Final)
-- Date: 2026-01-09
--
-- This file contains the COMPLETE database schema.
-- Run this ONCE in Supabase SQL Editor to set up everything.
-- Safe to re-run - includes DROP statements for clean slate.
-- =====================================================

-- =====================================================
-- SECTION 0: CLEANUP - DROP EVERYTHING FOR CLEAN SLATE
-- =====================================================

-- Drop all views first (they depend on tables)
DROP VIEW IF EXISTS recent_admin_activity CASCADE;
DROP VIEW IF EXISTS claims_with_workflow CASCADE;
DROP VIEW IF EXISTS workflow_execution_stats CASCADE;

-- Drop all triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_incidents_updated_at ON public.incidents;
DROP TRIGGER IF EXISTS update_claims_updated_at ON public.claims;
DROP TRIGGER IF EXISTS update_legal_documents_updated_at ON public.legal_documents;
DROP TRIGGER IF EXISTS update_workflows_updated_at ON public.workflows;
DROP TRIGGER IF EXISTS update_workflow_executions_updated_at ON public.workflow_executions;
DROP TRIGGER IF EXISTS update_admin_settings_updated_at ON public.admin_settings;
DROP TRIGGER IF EXISTS update_document_generations_updated_at ON public.document_generations;
DROP TRIGGER IF EXISTS increment_incident_count ON public.incidents;
DROP TRIGGER IF EXISTS on_settlement_proof_uploaded ON public.settlement_proofs;
DROP TRIGGER IF EXISTS on_settlement_proof_verified ON public.settlement_proofs;
DROP TRIGGER IF EXISTS update_payment_requests_updated_at ON public.payment_requests;
DROP TRIGGER IF EXISTS update_settlement_proofs_updated_at ON public.settlement_proofs;
DROP TRIGGER IF EXISTS update_bus_companies_updated_at ON public.bus_companies;
DROP TRIGGER IF EXISTS update_legal_submissions_updated_at ON public.legal_submissions;

-- Drop all functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_profile_stats_on_incident() CASCADE;
DROP FUNCTION IF EXISTS calculate_commission(DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS update_commission_on_proof_upload() CASCADE;
DROP FUNCTION IF EXISTS finalize_commission_on_verification() CASCADE;
DROP FUNCTION IF EXISTS get_claim_total_revenue(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_outstanding_payments() CASCADE;
DROP FUNCTION IF EXISTS log_workflow_action(UUID, UUID, TEXT, TEXT, JSONB, BOOLEAN, TEXT, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_workflow_execution_status(UUID, TEXT, INTEGER, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_next_pending_execution() CASCADE;
DROP FUNCTION IF EXISTS get_company_submission_method(TEXT) CASCADE;

-- Drop all tables (in correct order due to foreign key dependencies)
DROP TABLE IF EXISTS public.execution_logs CASCADE;
DROP TABLE IF EXISTS public.document_generations CASCADE;
DROP TABLE IF EXISTS public.workflow_executions CASCADE;
DROP TABLE IF EXISTS public.workflow_step_definitions CASCADE;
DROP TABLE IF EXISTS public.workflows CASCADE;
DROP TABLE IF EXISTS public.admin_settings CASCADE;
DROP TABLE IF EXISTS public.legal_submissions CASCADE;
DROP TABLE IF EXISTS public.bus_companies CASCADE;
DROP TABLE IF EXISTS public.settlement_proofs CASCADE;
DROP TABLE IF EXISTS public.payment_requests CASCADE;
DROP TABLE IF EXISTS public.legal_documents CASCADE;
DROP TABLE IF EXISTS public.claims CASCADE;
DROP TABLE IF EXISTS public.incidents CASCADE;
DROP TABLE IF EXISTS public.admin_users CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- =====================================================
-- SECTION 1: EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- SECTION 2: CORE TABLES
-- =====================================================

-- -----------------------------------------------------
-- 2.1 PROFILES TABLE (User Information)
-- Extends Supabase auth.users with app-specific data
-- -----------------------------------------------------
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,

    -- User Information
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT, -- Synced from auth.users

    -- Israeli ID (MANDATORY for legal filings)
    id_number TEXT NOT NULL DEFAULT '000000000',

    -- Address fields (MANDATORY for small claims court)
    home_address TEXT,
    city TEXT,
    postal_code TEXT,
    address_verified BOOLEAN DEFAULT FALSE,

    -- Role (for admin access)
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),

    -- Financial Summary
    total_received DECIMAL(10, 2) DEFAULT 0.00,
    total_potential DECIMAL(10, 2) DEFAULT 0.00,

    -- Statistics
    total_incidents INTEGER DEFAULT 0,
    total_claims INTEGER DEFAULT 0,
    approved_claims INTEGER DEFAULT 0,

    -- Account Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Admin can view all profiles
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
        )
    );

-- Admin can update all profiles
CREATE POLICY "Admins can update all profiles"
    ON public.profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
        )
    );

-- Indexes
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_status ON public.profiles(status);

-- Comments
COMMENT ON TABLE public.profiles IS 'User profiles - extends auth.users with CashBus-specific data';
COMMENT ON COLUMN public.profiles.id_number IS 'Israeli ID number - MANDATORY for legal filings (תעודת זהות)';
COMMENT ON COLUMN public.profiles.home_address IS 'Full home address - MANDATORY for small claims court filings';
COMMENT ON COLUMN public.profiles.role IS 'User role: user, admin, or super_admin';

-- -----------------------------------------------------
-- 2.2 ADMIN_USERS TABLE (Admin Access Control)
-- Separate table for admin permissions
-- -----------------------------------------------------
CREATE TABLE public.admin_users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'case_manager' CHECK (role IN ('super_admin', 'case_manager', 'legal_reviewer')),

    -- Permissions
    can_approve_claims BOOLEAN DEFAULT FALSE,
    can_generate_letters BOOLEAN DEFAULT TRUE,
    can_view_all_users BOOLEAN DEFAULT FALSE,
    can_manage_workflows BOOLEAN DEFAULT FALSE,
    can_manage_settings BOOLEAN DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Admin users can view their own record
CREATE POLICY "Admin users can view own record"
    ON public.admin_users FOR SELECT
    USING (auth.uid() = id);

-- Super admins can manage all admin users
CREATE POLICY "Super admins can manage admin users"
    ON public.admin_users FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users au
            WHERE au.id = auth.uid() AND au.role = 'super_admin'
        )
    );

-- Comments
COMMENT ON TABLE public.admin_users IS 'Admin users with special permissions for managing the system';

-- -----------------------------------------------------
-- 2.3 INCIDENTS TABLE (Proof Events / Fault Tickets)
-- Records of bus service failures
-- -----------------------------------------------------
CREATE TABLE public.incidents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    -- Bus Information
    bus_line TEXT NOT NULL,
    bus_company TEXT NOT NULL,
    station_name TEXT NOT NULL,

    -- Location Data (Station)
    station_gps_lat DECIMAL(10, 8),
    station_gps_lng DECIMAL(11, 8),

    -- Location Data (User at time of incident)
    user_gps_lat DECIMAL(10, 8) NOT NULL,
    user_gps_lng DECIMAL(11, 8) NOT NULL,

    -- Incident Details
    incident_type TEXT NOT NULL CHECK (incident_type IN ('delay', 'no_stop', 'no_arrival')),
    incident_datetime TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Damage Information (Optional)
    damage_type TEXT CHECK (damage_type IN ('taxi_cost', 'lost_workday', 'missed_exam', 'medical_appointment', 'other', NULL)),
    damage_amount DECIMAL(10, 2),
    damage_description TEXT,

    -- Evidence
    photo_urls TEXT[], -- Array of image URLs

    -- Verification (Ministry API)
    verified BOOLEAN DEFAULT FALSE,
    verification_data JSONB, -- Store API response from Ministry of Transportation
    verification_timestamp TIMESTAMP WITH TIME ZONE,

    -- Status
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'rejected', 'claimed')),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for incidents
CREATE POLICY "Users can view own incidents"
    ON public.incidents FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own incidents"
    ON public.incidents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own incidents"
    ON public.incidents FOR UPDATE
    USING (auth.uid() = user_id);

-- Admin can view all incidents
CREATE POLICY "Admins can view all incidents"
    ON public.incidents FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

-- Admin can update all incidents
CREATE POLICY "Admins can update all incidents"
    ON public.incidents FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

-- Indexes for performance
CREATE INDEX idx_incidents_user_id ON public.incidents(user_id);
CREATE INDEX idx_incidents_datetime ON public.incidents(incident_datetime DESC);
CREATE INDEX idx_incidents_bus_company ON public.incidents(bus_company);
CREATE INDEX idx_incidents_status ON public.incidents(status);

-- Comments
COMMENT ON TABLE public.incidents IS 'Incident reports - fault tickets from panic button';
COMMENT ON COLUMN public.incidents.bus_company IS 'Common values: אגד, דן, קווים, מטרופולין, נתיב אקספרס, סופרבוס';

-- -----------------------------------------------------
-- 2.4 CLAIMS TABLE (Compensation Requests)
-- Legal claims against bus companies
-- -----------------------------------------------------
CREATE TABLE public.claims (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    -- Associated Incidents (Multiple incidents per claim - cluster claims)
    incident_ids UUID[] NOT NULL,

    -- Claim Details
    claim_amount DECIMAL(10, 2) NOT NULL,
    claim_type TEXT DEFAULT 'warning_letter' CHECK (claim_type IN ('warning_letter', 'formal_claim', 'small_claims_court', 'class_action')),

    -- Status Tracking
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'company_review', 'approved', 'rejected', 'in_court', 'settled', 'paid')),

    -- Dates
    letter_sent_date TIMESTAMP WITH TIME ZONE,
    company_response_date TIMESTAMP WITH TIME ZONE,
    compensation_received_date TIMESTAMP WITH TIME ZONE,

    -- Financial (Original)
    compensation_amount DECIMAL(10, 2), -- Actual amount received
    commission_amount DECIMAL(10, 2), -- Legacy: 20% commission
    payment_method TEXT CHECK (payment_method IN ('bank_transfer', 'check', 'cash', NULL)),

    -- Company Information
    bus_company TEXT NOT NULL,
    company_contact_email TEXT,

    -- Success Fee Model (29 NIS + 15%)
    final_settlement_amount DECIMAL(10, 2),
    actual_paid_amount DECIMAL(10, 2),
    opening_fee_amount DECIMAL(10, 2) DEFAULT 29.00,
    opening_fee_paid BOOLEAN DEFAULT FALSE,
    opening_fee_paid_at TIMESTAMP WITH TIME ZONE,
    system_commission_due DECIMAL(10, 2), -- 15% of actual_paid_amount
    commission_paid BOOLEAN DEFAULT FALSE,
    commission_paid_at TIMESTAMP WITH TIME ZONE,
    settlement_proof_url TEXT,
    settlement_date TIMESTAMP WITH TIME ZONE,

    -- Stripe Integration
    opening_fee_stripe_payment_id TEXT,
    commission_stripe_payment_id TEXT,
    commission_stripe_invoice_id TEXT,

    -- Workflow Integration (Phase 4)
    current_workflow_execution_id UUID, -- Will reference workflow_executions
    workflow_status TEXT DEFAULT 'not_started' CHECK (workflow_status IN ('not_started', 'in_progress', 'completed', 'failed')),
    last_workflow_action_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

-- RLS Policies for claims
CREATE POLICY "Users can view own claims"
    ON public.claims FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own claims"
    ON public.claims FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own claims"
    ON public.claims FOR UPDATE
    USING (auth.uid() = user_id);

-- Admin can view all claims
CREATE POLICY "Admins can view all claims"
    ON public.claims FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

-- Admin can update all claims
CREATE POLICY "Admins can update all claims"
    ON public.claims FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

-- Indexes
CREATE INDEX idx_claims_user_id ON public.claims(user_id);
CREATE INDEX idx_claims_status ON public.claims(status);
CREATE INDEX idx_claims_bus_company ON public.claims(bus_company);
CREATE INDEX idx_claims_workflow_status ON public.claims(workflow_status);
CREATE INDEX idx_claims_priority ON public.claims(priority);

-- Comments
COMMENT ON TABLE public.claims IS 'Legal claims - compensation requests against bus companies';
COMMENT ON COLUMN public.claims.opening_fee_amount IS 'Fixed fee: 29 NIS to open case (covers server costs, prevents spam)';
COMMENT ON COLUMN public.claims.system_commission_due IS 'Success fee: 15% of actual_paid_amount (only charged on win)';
COMMENT ON COLUMN public.claims.settlement_proof_url IS 'Client uploads photo of payment proof (check/bank transfer)';

-- -----------------------------------------------------
-- 2.5 LEGAL_DOCUMENTS TABLE
-- Generated PDFs and legal documents
-- -----------------------------------------------------
CREATE TABLE public.legal_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    -- Document Information
    document_type TEXT NOT NULL CHECK (document_type IN ('warning_letter', 'formal_claim', 'court_filing', 'settlement_agreement')),
    document_title TEXT NOT NULL,

    -- File Storage
    pdf_url TEXT,
    file_size INTEGER,

    -- Delivery Information
    sent_date TIMESTAMP WITH TIME ZONE,
    delivery_method TEXT CHECK (delivery_method IN ('email', 'postal', 'registered_mail', NULL)),
    delivery_status TEXT DEFAULT 'draft' CHECK (delivery_status IN ('draft', 'sent', 'delivered', 'read', 'bounced')),
    tracking_number TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own documents"
    ON public.legal_documents FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own documents"
    ON public.legal_documents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admin can view all documents
CREATE POLICY "Admins can view all documents"
    ON public.legal_documents FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

-- Indexes
CREATE INDEX idx_legal_docs_claim_id ON public.legal_documents(claim_id);
CREATE INDEX idx_legal_docs_user_id ON public.legal_documents(user_id);

-- =====================================================
-- SECTION 3: PAYMENT & COMMISSION TABLES
-- =====================================================

-- -----------------------------------------------------
-- 3.1 PAYMENT_REQUESTS TABLE
-- Track payment requests (opening fee + commission)
-- -----------------------------------------------------
CREATE TABLE public.payment_requests (
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
    stripe_payment_url TEXT,

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
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

CREATE POLICY "Admins can manage payment requests"
    ON public.payment_requests FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

-- Indexes
CREATE INDEX idx_payment_requests_claim_id ON public.payment_requests(claim_id);
CREATE INDEX idx_payment_requests_user_id ON public.payment_requests(user_id);
CREATE INDEX idx_payment_requests_status ON public.payment_requests(status);

-- -----------------------------------------------------
-- 3.2 SETTLEMENT_PROOFS TABLE
-- User-uploaded proof of payment received
-- -----------------------------------------------------
CREATE TABLE public.settlement_proofs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- References
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    -- Proof details
    proof_type TEXT CHECK (proof_type IN ('check_photo', 'bank_transfer', 'cash_receipt', 'other')),
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_size_bytes INTEGER,

    -- Amount verification
    claimed_amount DECIMAL(10, 2),
    verified_amount DECIMAL(10, 2),
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES public.admin_users(id),
    verified_at TIMESTAMP WITH TIME ZONE,

    -- Notes
    user_notes TEXT,
    admin_notes TEXT,

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
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

CREATE POLICY "Admins can update settlement proofs"
    ON public.settlement_proofs FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

-- Indexes
CREATE INDEX idx_settlement_proofs_claim_id ON public.settlement_proofs(claim_id);
CREATE INDEX idx_settlement_proofs_verified ON public.settlement_proofs(verified);

-- =====================================================
-- SECTION 4: BUS COMPANIES & LEGAL SUBMISSIONS
-- Zero-Touch Automation Infrastructure
-- =====================================================

-- -----------------------------------------------------
-- 4.1 BUS_COMPANIES TABLE
-- Israeli bus company contact information
-- -----------------------------------------------------
CREATE TABLE public.bus_companies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Company Information
    company_name TEXT UNIQUE NOT NULL,
    company_name_en TEXT,

    -- Contact Methods
    public_contact_email TEXT,
    online_form_url TEXT,
    requires_form_automation BOOLEAN DEFAULT FALSE,

    -- Additional Contact Info
    phone TEXT,
    fax TEXT,
    postal_address TEXT,

    -- Ministry Reporting
    report_to_ministry BOOLEAN DEFAULT TRUE,

    -- System Fields
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.bus_companies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public can view active bus companies"
    ON public.bus_companies FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "Admins can manage bus companies"
    ON public.bus_companies FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

-- Indexes
CREATE INDEX idx_bus_companies_name ON public.bus_companies(company_name);
CREATE INDEX idx_bus_companies_active ON public.bus_companies(is_active);

-- Seed data: Israeli bus companies
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

-- -----------------------------------------------------
-- 4.2 LEGAL_SUBMISSIONS TABLE
-- Track automated submissions to companies
-- -----------------------------------------------------
CREATE TABLE public.legal_submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- References
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.bus_companies(id) ON DELETE SET NULL,

    -- Submission Details
    submission_type TEXT NOT NULL CHECK (submission_type IN ('email', 'web_form', 'postal')),
    submission_status TEXT DEFAULT 'pending' CHECK (submission_status IN ('pending', 'in_progress', 'sent', 'delivered', 'failed', 'bounced')),

    -- Email Submission Fields
    email_to TEXT,
    email_bcc TEXT DEFAULT 'Pniotcrm@mot.gov.il', -- Ministry of Transport
    email_subject TEXT,
    email_body TEXT,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    email_message_id TEXT,

    -- Web Form Submission Fields
    form_url TEXT,
    form_data JSONB,
    form_submitted_at TIMESTAMP WITH TIME ZONE,
    form_confirmation_number TEXT,

    -- Document Attachments
    pdf_url TEXT,
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
    delivery_confirmation_data JSONB,

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
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

CREATE POLICY "System can insert submissions"
    ON public.legal_submissions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can manage submissions"
    ON public.legal_submissions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

-- Indexes
CREATE INDEX idx_legal_submissions_claim_id ON public.legal_submissions(claim_id);
CREATE INDEX idx_legal_submissions_user_id ON public.legal_submissions(user_id);
CREATE INDEX idx_legal_submissions_status ON public.legal_submissions(submission_status);
CREATE INDEX idx_legal_submissions_company ON public.legal_submissions(company_id);

-- =====================================================
-- SECTION 5: WORKFLOW AUTOMATION TABLES (Phase 4)
-- =====================================================

-- -----------------------------------------------------
-- 5.1 WORKFLOWS TABLE
-- Workflow templates created by admin
-- -----------------------------------------------------
CREATE TABLE public.workflows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,

    -- Workflow definition (JSON array of steps)
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Trigger configuration
    trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'auto_on_claim', 'auto_on_incident')),
    trigger_conditions JSONB DEFAULT '{}'::jsonb,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,

    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Stats
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0
);

-- Enable Row Level Security
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage workflows"
    ON public.workflows FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

CREATE POLICY "Users can view active workflows"
    ON public.workflows FOR SELECT
    USING (is_active = TRUE);

-- Indexes
CREATE INDEX idx_workflows_active ON public.workflows(is_active, trigger_type);
CREATE INDEX idx_workflows_default ON public.workflows(is_default, trigger_type);

-- -----------------------------------------------------
-- 5.2 WORKFLOW_STEP_DEFINITIONS TABLE
-- Reusable step templates
-- -----------------------------------------------------
CREATE TABLE public.workflow_step_definitions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Step identity
    step_type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,

    -- Configuration schema
    config_schema JSONB DEFAULT '{}'::jsonb,
    default_config JSONB DEFAULT '{}'::jsonb,

    -- Execution settings
    timeout_seconds INTEGER DEFAULT 300,
    requires_admin_approval BOOLEAN DEFAULT FALSE,
    can_fail_silently BOOLEAN DEFAULT FALSE,

    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.workflow_step_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage step definitions"
    ON public.workflow_step_definitions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

CREATE POLICY "Users can view active step definitions"
    ON public.workflow_step_definitions FOR SELECT
    USING (is_active = TRUE);

-- Indexes
CREATE INDEX idx_step_definitions_active ON public.workflow_step_definitions(is_active, step_type);

-- Seed data: Common workflow steps
INSERT INTO public.workflow_step_definitions (step_type, name, description, icon, default_config) VALUES
    ('data_verification', 'אימות נתונים', 'בדיקה אוטומטית של נתוני האירוע מול API משרד התחבורה', 'CheckCircle', '{"verify_gps": true, "verify_bus_line": true}'::jsonb),
    ('pdf_generation', 'יצירת מכתב התראה', 'יצירת PDF משפטי עם פרטי התביעה', 'FileText', '{"template": "warning_letter", "include_photos": true}'::jsonb),
    ('status_update', 'עדכון סטטוס', 'שינוי סטטוס התביעה ועדכון הלקוח', 'RefreshCw', '{"new_status": "submitted", "notify_customer": true}'::jsonb),
    ('email_send', 'שליחת אימייל', 'שליחת מייל ללקוח או לחברת האוטובוס', 'Mail', '{"to": "customer", "template": "claim_submitted"}'::jsonb),
    ('approval_required', 'דרוש אישור מנהל', 'עצירת הזרימה עד אישור ידני של מנהל', 'AlertCircle', '{"notify_admins": true}'::jsonb),
    ('compensation_calculation', 'חישוב פיצוי', 'חישוב אוטומטי של סכום הפיצוי לפי תקנה 428ז', 'Calculator', '{"include_damages": true}'::jsonb),
    ('webhook_call', 'קריאה לשירות חיצוני', 'שליחת נתונים לשירות חיצוני (CRM, חשבונאות וכו)', 'Zap', '{"url": "", "method": "POST"}'::jsonb)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------
-- 5.3 WORKFLOW_EXECUTIONS TABLE
-- Individual workflow runs per claim
-- -----------------------------------------------------
CREATE TABLE public.workflow_executions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Relations
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Execution state
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    current_step_index INTEGER DEFAULT 0,
    current_step_name TEXT,

    -- Step data
    steps_completed JSONB DEFAULT '[]'::jsonb,
    steps_remaining JSONB DEFAULT '[]'::jsonb,

    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    execution_context JSONB DEFAULT '{}'::jsonb,
    triggered_by UUID REFERENCES auth.users(id),
    trigger_type TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage workflow executions"
    ON public.workflow_executions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

CREATE POLICY "Users can view their own workflow executions"
    ON public.workflow_executions FOR SELECT
    USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_workflow_executions_claim ON public.workflow_executions(claim_id);
CREATE INDEX idx_workflow_executions_status ON public.workflow_executions(status);
CREATE INDEX idx_workflow_executions_workflow ON public.workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_next_retry ON public.workflow_executions(next_retry_at) WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- Now add foreign key to claims for workflow_execution_id
ALTER TABLE public.claims
    ADD CONSTRAINT fk_claims_workflow_execution
    FOREIGN KEY (current_workflow_execution_id)
    REFERENCES public.workflow_executions(id)
    ON DELETE SET NULL;

CREATE INDEX idx_claims_workflow_execution ON public.claims(current_workflow_execution_id);

-- -----------------------------------------------------
-- 5.4 EXECUTION_LOGS TABLE
-- Detailed audit trail of all actions
-- -----------------------------------------------------
CREATE TABLE public.execution_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Relations
    workflow_execution_id UUID REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE,
    performed_by UUID REFERENCES auth.users(id),

    -- Action details
    action_type TEXT NOT NULL,
    step_name TEXT,

    -- Details
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,

    -- Result
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,

    -- Metadata
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all execution logs"
    ON public.execution_logs FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

CREATE POLICY "Users can view logs for their own claims"
    ON public.execution_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.claims c
            WHERE c.id = execution_logs.claim_id
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert execution logs"
    ON public.execution_logs FOR INSERT
    WITH CHECK (true);

-- Indexes
CREATE INDEX idx_execution_logs_execution ON public.execution_logs(workflow_execution_id);
CREATE INDEX idx_execution_logs_claim ON public.execution_logs(claim_id);
CREATE INDEX idx_execution_logs_performed_by ON public.execution_logs(performed_by);
CREATE INDEX idx_execution_logs_created_at ON public.execution_logs(created_at DESC);
CREATE INDEX idx_execution_logs_action_type ON public.execution_logs(action_type);

-- -----------------------------------------------------
-- 5.5 ADMIN_SETTINGS TABLE
-- Global configuration and templates
-- -----------------------------------------------------
CREATE TABLE public.admin_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Setting identity
    setting_key TEXT UNIQUE NOT NULL,
    setting_category TEXT NOT NULL CHECK (setting_category IN ('templates', 'notifications', 'system', 'automation')),

    -- Value
    setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Metadata
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage settings"
    ON public.admin_settings FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

CREATE POLICY "Users can view active settings"
    ON public.admin_settings FOR SELECT
    USING (is_active = TRUE);

-- Indexes
CREATE INDEX idx_admin_settings_category ON public.admin_settings(setting_category);
CREATE INDEX idx_admin_settings_active ON public.admin_settings(is_active);

-- Seed data: Default settings
INSERT INTO public.admin_settings (setting_key, setting_category, setting_value, description) VALUES
    (
        'status_messages',
        'templates',
        '{
            "submitted": "התביעה שלך התקבלה ונמצאת בטיפול",
            "verified": "האירוע אומת מול נתוני משרד התחבורה",
            "rejected": "התביעה נדחתה - פרטים נוספים נשלחו למייל",
            "company_review": "מכתב ההתראה נשלח לחברת האוטובוס",
            "approved": "חברת האוטובוס אישרה את התביעה!",
            "in_court": "התביעה הועברה להליכים משפטיים",
            "settled": "הגענו להסדר עם החברה",
            "paid": "הפיצוי הועבר לחשבונך - מזל טוב!"
        }'::jsonb,
        'הודעות סטטוס המוצגות ללקוח'
    ),
    (
        'email_templates',
        'templates',
        '{
            "claim_submitted": {
                "subject": "התביעה שלך נקלטה במערכת CashBus",
                "body": "שלום {{customer_name}},\n\nהתביעה שלך נגד חברת {{bus_company}} בסך {{claim_amount}} ₪ התקבלה.\n\nמספר תביעה: {{claim_id}}\n\nנעדכן אותך בהמשך."
            },
            "warning_letter_sent": {
                "subject": "מכתב ההתראה נשלח לחברת האוטובוס",
                "body": "שלום {{customer_name}},\n\nמכתב התראה רשמי נשלח לחברת {{bus_company}}.\n\nהם מחויבים לענות תוך 7 ימים.\n\nנעדכן אותך בתגובתם."
            }
        }'::jsonb,
        'תבניות אימייל ללקוחות'
    ),
    (
        'pdf_templates',
        'templates',
        '{
            "warning_letter": {
                "header": "מכתב התראה לפי תקנה 428ז לתקנות השירותים הציבוריים",
                "footer": "במידה ולא תתקבל תשובה תוך 7 ימים, נאלץ לפנות לבית המשפט.",
                "include_company_logo": false,
                "include_incident_photos": true,
                "legal_citations": ["תקנה 428ז", "חוק השירותים הציבוריים"]
            }
        }'::jsonb,
        'תבניות PDF למכתבים משפטיים'
    ),
    (
        'automation_config',
        'automation',
        '{
            "auto_verify_incidents": true,
            "auto_generate_letters": false,
            "auto_send_emails": false,
            "require_admin_approval_above": 5000,
            "max_retry_attempts": 3,
            "retry_delay_minutes": 30
        }'::jsonb,
        'הגדרות אוטומציה כלליות'
    )
ON CONFLICT (setting_key) DO NOTHING;

-- -----------------------------------------------------
-- 5.6 DOCUMENT_GENERATIONS TABLE
-- Track all generated PDFs
-- -----------------------------------------------------
CREATE TABLE public.document_generations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Relations
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE,
    workflow_execution_id UUID REFERENCES public.workflow_executions(id) ON DELETE SET NULL,

    -- Document info
    document_type TEXT NOT NULL CHECK (document_type IN ('warning_letter', 'formal_claim', 'court_filing')),
    template_used TEXT NOT NULL,

    -- File storage
    file_path TEXT,
    file_url TEXT,
    file_size_bytes INTEGER,

    -- Generation details
    generated_by UUID REFERENCES auth.users(id),
    generation_method TEXT DEFAULT 'automatic' CHECK (generation_method IN ('automatic', 'manual')),

    -- Content
    document_data JSONB DEFAULT '{}'::jsonb,

    -- Status
    status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'sent', 'delivered', 'failed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.document_generations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage document generations"
    ON public.document_generations FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

CREATE POLICY "Users can view their own documents"
    ON public.document_generations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.claims c
            WHERE c.id = document_generations.claim_id
            AND c.user_id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX idx_document_generations_claim ON public.document_generations(claim_id);
CREATE INDEX idx_document_generations_status ON public.document_generations(status);
CREATE INDEX idx_document_generations_type ON public.document_generations(document_type);

-- =====================================================
-- SECTION 6: FUNCTIONS
-- =====================================================

-- -----------------------------------------------------
-- 6.1 Update timestamp function
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- 6.2 Handle new user signup
-- Creates profile automatically when user registers
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'משתמש חדש'),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------
-- 6.3 Update profile stats when incident created
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION update_profile_stats_on_incident()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET
        total_incidents = total_incidents + 1,
        updated_at = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- 6.4 Calculate 15% commission
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_commission(amount DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    RETURN ROUND(amount * 0.15, 2);
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- 6.5 Update commission when settlement proof uploaded
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION update_commission_on_proof_upload()
RETURNS TRIGGER AS $$
BEGIN
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

-- -----------------------------------------------------
-- 6.6 Finalize commission after admin verification
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION finalize_commission_on_verification()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.verified = TRUE AND (OLD.verified IS NULL OR OLD.verified = FALSE) THEN
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

-- -----------------------------------------------------
-- 6.7 Get claim total revenue
-- -----------------------------------------------------
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

-- -----------------------------------------------------
-- 6.8 Get outstanding payments
-- -----------------------------------------------------
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
        CASE WHEN c.opening_fee_paid = FALSE THEN c.opening_fee_amount ELSE 0::DECIMAL END AS opening_fee_due,
        CASE WHEN c.commission_paid = FALSE THEN COALESCE(c.system_commission_due, 0::DECIMAL) ELSE 0::DECIMAL END AS commission_due,
        (CASE WHEN c.opening_fee_paid = FALSE THEN c.opening_fee_amount ELSE 0::DECIMAL END) +
        (CASE WHEN c.commission_paid = FALSE THEN COALESCE(c.system_commission_due, 0::DECIMAL) ELSE 0::DECIMAL END) AS total_due
    FROM public.claims c
    WHERE
        c.opening_fee_paid = FALSE
        OR (c.commission_paid = FALSE AND c.system_commission_due IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- 6.9 Get company submission method
-- -----------------------------------------------------
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

    IF company_record.requires_form_automation AND company_record.online_form_url IS NOT NULL THEN
        RETURN 'web_form';
    ELSIF company_record.public_contact_email IS NOT NULL THEN
        RETURN 'email';
    ELSE
        RETURN 'manual';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- 6.10 Log workflow action (audit trail)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION log_workflow_action(
    p_workflow_execution_id UUID,
    p_claim_id UUID,
    p_action_type TEXT,
    p_description TEXT,
    p_details JSONB DEFAULT '{}'::jsonb,
    p_success BOOLEAN DEFAULT TRUE,
    p_error_message TEXT DEFAULT NULL,
    p_performed_by UUID DEFAULT NULL,
    p_step_name TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.execution_logs (
        workflow_execution_id,
        claim_id,
        action_type,
        description,
        details,
        success,
        error_message,
        performed_by,
        step_name
    ) VALUES (
        p_workflow_execution_id,
        p_claim_id,
        p_action_type,
        p_description,
        p_details,
        p_success,
        p_error_message,
        COALESCE(p_performed_by, auth.uid()),
        p_step_name
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------
-- 6.11 Update workflow execution status
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION update_workflow_execution_status(
    p_execution_id UUID,
    p_status TEXT,
    p_current_step_index INTEGER DEFAULT NULL,
    p_current_step_name TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE public.workflow_executions
    SET
        status = p_status,
        current_step_index = COALESCE(p_current_step_index, current_step_index),
        current_step_name = COALESCE(p_current_step_name, current_step_name),
        error_message = p_error_message,
        updated_at = NOW(),
        completed_at = CASE WHEN p_status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END
    WHERE id = p_execution_id;

    UPDATE public.claims
    SET
        workflow_status = CASE
            WHEN p_status = 'completed' THEN 'completed'
            WHEN p_status = 'failed' THEN 'failed'
            WHEN p_status = 'cancelled' THEN 'not_started'
            ELSE 'in_progress'
        END,
        last_workflow_action_at = NOW()
    WHERE current_workflow_execution_id = p_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------
-- 6.12 Get next pending execution (for automation engine)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION get_next_pending_execution()
RETURNS TABLE (
    execution_id UUID,
    workflow_id UUID,
    claim_id UUID,
    current_step_index INTEGER,
    steps_remaining JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        we.id AS execution_id,
        we.workflow_id,
        we.claim_id,
        we.current_step_index,
        we.steps_remaining
    FROM public.workflow_executions we
    WHERE we.status = 'in_progress'
        AND (we.next_retry_at IS NULL OR we.next_retry_at <= NOW())
    ORDER BY we.started_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECTION 7: TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamps
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at
    BEFORE UPDATE ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at
    BEFORE UPDATE ON public.claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_legal_documents_updated_at
    BEFORE UPDATE ON public.legal_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at
    BEFORE UPDATE ON public.workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_executions_updated_at
    BEFORE UPDATE ON public.workflow_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_settings_updated_at
    BEFORE UPDATE ON public.admin_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_generations_updated_at
    BEFORE UPDATE ON public.document_generations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_requests_updated_at
    BEFORE UPDATE ON public.payment_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlement_proofs_updated_at
    BEFORE UPDATE ON public.settlement_proofs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bus_companies_updated_at
    BEFORE UPDATE ON public.bus_companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_legal_submissions_updated_at
    BEFORE UPDATE ON public.legal_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Increment incident count
CREATE TRIGGER increment_incident_count
    AFTER INSERT ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION update_profile_stats_on_incident();

-- Commission calculation triggers
CREATE TRIGGER on_settlement_proof_uploaded
    AFTER INSERT ON public.settlement_proofs
    FOR EACH ROW EXECUTE FUNCTION update_commission_on_proof_upload();

CREATE TRIGGER on_settlement_proof_verified
    AFTER UPDATE ON public.settlement_proofs
    FOR EACH ROW EXECUTE FUNCTION finalize_commission_on_verification();

-- =====================================================
-- SECTION 8: VIEWS
-- =====================================================

-- -----------------------------------------------------
-- 8.1 Workflow execution statistics
-- -----------------------------------------------------
CREATE OR REPLACE VIEW workflow_execution_stats AS
SELECT
    w.id AS workflow_id,
    w.name AS workflow_name,
    COUNT(we.id) AS total_executions,
    COUNT(CASE WHEN we.status = 'completed' THEN 1 END) AS completed_count,
    COUNT(CASE WHEN we.status = 'failed' THEN 1 END) AS failed_count,
    COUNT(CASE WHEN we.status = 'in_progress' THEN 1 END) AS in_progress_count,
    AVG(EXTRACT(EPOCH FROM (we.completed_at - we.started_at))) AS avg_duration_seconds,
    MAX(we.completed_at) AS last_execution
FROM public.workflows w
LEFT JOIN public.workflow_executions we ON w.id = we.workflow_id
GROUP BY w.id, w.name;

-- -----------------------------------------------------
-- 8.2 Claims with workflow status
-- -----------------------------------------------------
CREATE OR REPLACE VIEW claims_with_workflow AS
SELECT
    c.*,
    we.status AS execution_status,
    we.current_step_name,
    we.error_message AS execution_error,
    w.name AS workflow_name,
    p.full_name AS customer_name,
    p.phone AS customer_phone
FROM public.claims c
LEFT JOIN public.workflow_executions we ON c.current_workflow_execution_id = we.id
LEFT JOIN public.workflows w ON we.workflow_id = w.id
LEFT JOIN public.profiles p ON c.user_id = p.id;

-- -----------------------------------------------------
-- 8.3 Recent admin activity
-- -----------------------------------------------------
CREATE OR REPLACE VIEW recent_admin_activity AS
SELECT
    el.id,
    el.action_type,
    el.description,
    el.created_at,
    el.success,
    p.full_name AS performed_by_name,
    c.id AS claim_id,
    c.claim_amount
FROM public.execution_logs el
LEFT JOIN public.profiles p ON el.performed_by = p.id
LEFT JOIN public.claims c ON el.claim_id = c.id
ORDER BY el.created_at DESC
LIMIT 100;

-- =====================================================
-- SECTION 9: STORAGE BUCKETS SETUP
-- Run this separately if storage not set up
-- =====================================================

-- Note: Storage bucket creation must be done via Supabase Dashboard
-- or using the Storage API, not SQL. Instructions:
--
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create bucket: incident-photos (public: true)
-- 3. Create bucket: documents (public: false)
-- 4. Create bucket: settlement-proofs (public: false)

-- =====================================================
-- SECTION 10: PERMISSIONS
-- =====================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =====================================================
-- SECTION 11: VERIFICATION
-- =====================================================

-- Verify tables were created
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Test commission calculation
SELECT calculate_commission(1000.00) AS commission_for_1000_nis; -- Should return 150.00

-- =====================================================
-- SCHEMA COMPLETE!
-- =====================================================

-- Summary of tables created:
-- 1. profiles - User accounts with legal fields
-- 2. admin_users - Admin permissions
-- 3. incidents - Fault tickets from panic button
-- 4. claims - Legal compensation claims
-- 5. legal_documents - Generated PDFs
-- 6. payment_requests - Stripe payment tracking
-- 7. settlement_proofs - User-uploaded proof of payment
-- 8. bus_companies - Israeli bus company contacts
-- 9. legal_submissions - Automated submission tracking
-- 10. workflows - Workflow templates
-- 11. workflow_step_definitions - Reusable step templates
-- 12. workflow_executions - Individual workflow runs
-- 13. execution_logs - Audit trail
-- 14. admin_settings - System configuration
-- 15. document_generations - PDF generation tracking

-- Views created:
-- 1. workflow_execution_stats - Workflow performance metrics
-- 2. claims_with_workflow - Claims joined with workflow data
-- 3. recent_admin_activity - Admin activity feed

COMMENT ON SCHEMA public IS 'CashBus - Legal-Tech Platform for Public Transportation Compensation Claims';
