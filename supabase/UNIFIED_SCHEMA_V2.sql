-- =====================================================
-- CashBus - UNIFIED DATABASE SCHEMA V2
-- Version: 2.0.0 (Clean Install)
-- Date: 2026-01-09
--
-- IMPORTANT: This script is designed to run on a CLEAN
-- Supabase project. All operations are properly ordered.
--
-- Order of operations:
-- 1. Extensions
-- 2. Drop existing objects (if any)
-- 3. Create ALL tables first
-- 4. Create ALL functions
-- 5. Create ALL triggers
-- 6. Create ALL RLS policies
-- 7. Create ALL views
-- 8. Insert seed data
-- 9. Grant permissions
-- =====================================================

-- =====================================================
-- SECTION 1: EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- SECTION 2: CLEANUP (Safe drops with IF EXISTS)
-- =====================================================

-- Drop views first
DROP VIEW IF EXISTS recent_admin_activity;
DROP VIEW IF EXISTS claims_with_workflow;
DROP VIEW IF EXISTS workflow_execution_stats;

-- Drop triggers (safe - won't error if table doesn't exist)
DO $$
BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS update_incidents_updated_at ON public.incidents; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS update_claims_updated_at ON public.claims; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS update_legal_documents_updated_at ON public.legal_documents; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS update_workflows_updated_at ON public.workflows; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS update_workflow_executions_updated_at ON public.workflow_executions; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS update_admin_settings_updated_at ON public.admin_settings; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS update_document_generations_updated_at ON public.document_generations; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS increment_incident_count ON public.incidents; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS on_settlement_proof_uploaded ON public.settlement_proofs; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS on_settlement_proof_verified ON public.settlement_proofs; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS update_payment_requests_updated_at ON public.payment_requests; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS update_settlement_proofs_updated_at ON public.settlement_proofs; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS update_bus_companies_updated_at ON public.bus_companies; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS update_legal_submissions_updated_at ON public.legal_submissions; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP TRIGGER IF EXISTS update_admin_users_updated_at ON public.admin_users; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Drop functions
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

-- Drop tables in reverse dependency order (CASCADE handles policies)
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
-- SECTION 3: CREATE ALL TABLES
-- Order: No foreign key dependencies first, then dependents
-- =====================================================

-- -----------------------------------------------------
-- 3.1 PROFILES TABLE (First - no dependencies)
-- -----------------------------------------------------
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,

    -- User Information
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,

    -- Israeli ID (MANDATORY for legal filings)
    id_number TEXT NOT NULL DEFAULT '000000000',

    -- Address fields (MANDATORY for small claims court)
    home_address TEXT,
    city TEXT,
    postal_code TEXT,
    address_verified BOOLEAN DEFAULT FALSE,

    -- Role (for admin access) - IMPORTANT for RLS
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

-- Comments
COMMENT ON TABLE public.profiles IS 'User profiles - extends auth.users with CashBus-specific data';
COMMENT ON COLUMN public.profiles.id_number IS 'Israeli ID number - MANDATORY for legal filings';
COMMENT ON COLUMN public.profiles.home_address IS 'Full home address - MANDATORY for small claims court filings';
COMMENT ON COLUMN public.profiles.role IS 'User role: user, admin, or super_admin';

-- -----------------------------------------------------
-- 3.2 ADMIN_USERS TABLE (Depends on auth.users only)
-- -----------------------------------------------------
CREATE TABLE public.admin_users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
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

COMMENT ON TABLE public.admin_users IS 'Admin users with special permissions';

-- -----------------------------------------------------
-- 3.3 INCIDENTS TABLE (Depends on profiles)
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

    -- Location Data (User)
    user_gps_lat DECIMAL(10, 8) NOT NULL,
    user_gps_lng DECIMAL(11, 8) NOT NULL,

    -- Incident Details
    incident_type TEXT NOT NULL CHECK (incident_type IN ('delay', 'no_stop', 'no_arrival')),
    incident_datetime TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Damage Information
    damage_type TEXT CHECK (damage_type IN ('taxi_cost', 'lost_workday', 'missed_exam', 'medical_appointment', 'other', NULL)),
    damage_amount DECIMAL(10, 2),
    damage_description TEXT,

    -- Evidence
    photo_urls TEXT[],

    -- Verification
    verified BOOLEAN DEFAULT FALSE,
    verification_data JSONB,
    verification_timestamp TIMESTAMP WITH TIME ZONE,

    -- Status
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'rejected', 'claimed')),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.incidents IS 'Incident reports from panic button';

-- -----------------------------------------------------
-- 3.4 CLAIMS TABLE (Depends on profiles)
-- Note: workflow_execution_id FK added later after workflow_executions exists
-- -----------------------------------------------------
CREATE TABLE public.claims (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    -- Associated Incidents (cluster claims)
    incident_ids UUID[] NOT NULL,

    -- Claim Details
    claim_amount DECIMAL(10, 2) NOT NULL,
    claim_type TEXT DEFAULT 'warning_letter' CHECK (claim_type IN ('warning_letter', 'formal_claim', 'small_claims_court', 'class_action')),

    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'company_review', 'approved', 'rejected', 'in_court', 'settled', 'paid')),

    -- Dates
    letter_sent_date TIMESTAMP WITH TIME ZONE,
    company_response_date TIMESTAMP WITH TIME ZONE,
    compensation_received_date TIMESTAMP WITH TIME ZONE,

    -- Financial
    compensation_amount DECIMAL(10, 2),
    commission_amount DECIMAL(10, 2),
    payment_method TEXT CHECK (payment_method IN ('bank_transfer', 'check', 'cash', NULL)),

    -- Company
    bus_company TEXT NOT NULL,
    company_contact_email TEXT,

    -- Success Fee Model (29 NIS + 15%)
    final_settlement_amount DECIMAL(10, 2),
    actual_paid_amount DECIMAL(10, 2),
    opening_fee_amount DECIMAL(10, 2) DEFAULT 29.00,
    opening_fee_paid BOOLEAN DEFAULT FALSE,
    opening_fee_paid_at TIMESTAMP WITH TIME ZONE,
    system_commission_due DECIMAL(10, 2),
    commission_paid BOOLEAN DEFAULT FALSE,
    commission_paid_at TIMESTAMP WITH TIME ZONE,
    settlement_proof_url TEXT,
    settlement_date TIMESTAMP WITH TIME ZONE,

    -- Stripe
    opening_fee_stripe_payment_id TEXT,
    commission_stripe_payment_id TEXT,
    commission_stripe_invoice_id TEXT,

    -- Workflow (FK added later)
    current_workflow_execution_id UUID,
    workflow_status TEXT DEFAULT 'not_started' CHECK (workflow_status IN ('not_started', 'in_progress', 'completed', 'failed')),
    last_workflow_action_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.claims IS 'Legal compensation claims';

-- -----------------------------------------------------
-- 3.5 LEGAL_DOCUMENTS TABLE (Depends on claims, profiles)
-- -----------------------------------------------------
CREATE TABLE public.legal_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    -- Document Info
    document_type TEXT NOT NULL CHECK (document_type IN ('warning_letter', 'formal_claim', 'court_filing', 'settlement_agreement')),
    document_title TEXT NOT NULL,

    -- File Storage
    pdf_url TEXT,
    file_size INTEGER,

    -- Delivery
    sent_date TIMESTAMP WITH TIME ZONE,
    delivery_method TEXT CHECK (delivery_method IN ('email', 'postal', 'registered_mail', NULL)),
    delivery_status TEXT DEFAULT 'draft' CHECK (delivery_status IN ('draft', 'sent', 'delivered', 'read', 'bounced')),
    tracking_number TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------
-- 3.6 PAYMENT_REQUESTS TABLE (Depends on claims, profiles)
-- -----------------------------------------------------
CREATE TABLE public.payment_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    -- Payment details
    payment_type TEXT NOT NULL CHECK (payment_type IN ('opening_fee', 'commission')),
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'ILS',

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'paid', 'failed', 'cancelled')),

    -- Stripe
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

-- -----------------------------------------------------
-- 3.7 SETTLEMENT_PROOFS TABLE (Depends on claims, profiles, admin_users)
-- -----------------------------------------------------
CREATE TABLE public.settlement_proofs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    -- Proof details
    proof_type TEXT CHECK (proof_type IN ('check_photo', 'bank_transfer', 'cash_receipt', 'other')),
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_size_bytes INTEGER,

    -- Verification
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

-- -----------------------------------------------------
-- 3.8 BUS_COMPANIES TABLE (No dependencies)
-- -----------------------------------------------------
CREATE TABLE public.bus_companies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Company Info
    company_name TEXT UNIQUE NOT NULL,
    company_name_en TEXT,

    -- Contact
    public_contact_email TEXT,
    online_form_url TEXT,
    requires_form_automation BOOLEAN DEFAULT FALSE,
    phone TEXT,
    fax TEXT,
    postal_address TEXT,

    -- Ministry
    report_to_ministry BOOLEAN DEFAULT TRUE,

    -- System
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------
-- 3.9 LEGAL_SUBMISSIONS TABLE (Depends on claims, profiles, bus_companies)
-- -----------------------------------------------------
CREATE TABLE public.legal_submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES public.bus_companies(id) ON DELETE SET NULL,

    -- Submission
    submission_type TEXT NOT NULL CHECK (submission_type IN ('email', 'web_form', 'postal')),
    submission_status TEXT DEFAULT 'pending' CHECK (submission_status IN ('pending', 'in_progress', 'sent', 'delivered', 'failed', 'bounced')),

    -- Email fields
    email_to TEXT,
    email_bcc TEXT DEFAULT 'Pniotcrm@mot.gov.il',
    email_subject TEXT,
    email_body TEXT,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    email_message_id TEXT,

    -- Web form fields
    form_url TEXT,
    form_data JSONB,
    form_submitted_at TIMESTAMP WITH TIME ZONE,
    form_confirmation_number TEXT,

    -- Document
    pdf_url TEXT,
    pdf_filename TEXT,

    -- Automation
    automation_method TEXT CHECK (automation_method IN ('manual', 'email_api', 'web_automation', 'api_integration')),
    automation_status TEXT,
    automation_error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,

    -- Delivery
    delivered_at TIMESTAMP WITH TIME ZONE,
    delivery_confirmation_data JSONB,

    -- Ministry
    ministry_notified BOOLEAN DEFAULT FALSE,
    ministry_notification_sent_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------
-- 3.10 WORKFLOWS TABLE (No dependencies)
-- -----------------------------------------------------
CREATE TABLE public.workflows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,

    -- Definition
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Trigger
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

-- -----------------------------------------------------
-- 3.11 WORKFLOW_STEP_DEFINITIONS TABLE (No dependencies)
-- -----------------------------------------------------
CREATE TABLE public.workflow_step_definitions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Step identity
    step_type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,

    -- Config
    config_schema JSONB DEFAULT '{}'::jsonb,
    default_config JSONB DEFAULT '{}'::jsonb,

    -- Execution
    timeout_seconds INTEGER DEFAULT 300,
    requires_admin_approval BOOLEAN DEFAULT FALSE,
    can_fail_silently BOOLEAN DEFAULT FALSE,

    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------
-- 3.12 WORKFLOW_EXECUTIONS TABLE (Depends on workflows, claims)
-- -----------------------------------------------------
CREATE TABLE public.workflow_executions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Relations
    workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- State
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    current_step_index INTEGER DEFAULT 0,
    current_step_name TEXT,

    -- Steps
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

    -- Context
    execution_context JSONB DEFAULT '{}'::jsonb,
    triggered_by UUID REFERENCES auth.users(id),
    trigger_type TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------
-- 3.13 EXECUTION_LOGS TABLE (Depends on workflow_executions, claims)
-- -----------------------------------------------------
CREATE TABLE public.execution_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Relations
    workflow_execution_id UUID REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE,
    performed_by UUID REFERENCES auth.users(id),

    -- Action
    action_type TEXT NOT NULL,
    step_name TEXT,
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,

    -- Result
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,

    -- Meta
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------
-- 3.14 ADMIN_SETTINGS TABLE (No dependencies)
-- -----------------------------------------------------
CREATE TABLE public.admin_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Setting
    setting_key TEXT UNIQUE NOT NULL,
    setting_category TEXT NOT NULL CHECK (setting_category IN ('templates', 'notifications', 'system', 'automation')),
    setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Meta
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------
-- 3.15 DOCUMENT_GENERATIONS TABLE (Depends on claims, workflow_executions)
-- -----------------------------------------------------
CREATE TABLE public.document_generations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Relations
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE,
    workflow_execution_id UUID REFERENCES public.workflow_executions(id) ON DELETE SET NULL,

    -- Document
    document_type TEXT NOT NULL CHECK (document_type IN ('warning_letter', 'formal_claim', 'court_filing')),
    template_used TEXT NOT NULL,

    -- File
    file_path TEXT,
    file_url TEXT,
    file_size_bytes INTEGER,

    -- Generation
    generated_by UUID REFERENCES auth.users(id),
    generation_method TEXT DEFAULT 'automatic' CHECK (generation_method IN ('automatic', 'manual')),
    document_data JSONB DEFAULT '{}'::jsonb,

    -- Status
    status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'sent', 'delivered', 'failed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SECTION 4: ADD FOREIGN KEY CONSTRAINTS (After all tables exist)
-- =====================================================

-- Add FK from claims to workflow_executions
ALTER TABLE public.claims
    ADD CONSTRAINT fk_claims_workflow_execution
    FOREIGN KEY (current_workflow_execution_id)
    REFERENCES public.workflow_executions(id)
    ON DELETE SET NULL;

-- =====================================================
-- SECTION 5: CREATE ALL INDEXES
-- =====================================================

-- Profiles indexes
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_status ON public.profiles(status);

-- Incidents indexes
CREATE INDEX idx_incidents_user_id ON public.incidents(user_id);
CREATE INDEX idx_incidents_datetime ON public.incidents(incident_datetime DESC);
CREATE INDEX idx_incidents_bus_company ON public.incidents(bus_company);
CREATE INDEX idx_incidents_status ON public.incidents(status);

-- Claims indexes
CREATE INDEX idx_claims_user_id ON public.claims(user_id);
CREATE INDEX idx_claims_status ON public.claims(status);
CREATE INDEX idx_claims_bus_company ON public.claims(bus_company);
CREATE INDEX idx_claims_workflow_status ON public.claims(workflow_status);
CREATE INDEX idx_claims_priority ON public.claims(priority);
CREATE INDEX idx_claims_workflow_execution ON public.claims(current_workflow_execution_id);

-- Legal documents indexes
CREATE INDEX idx_legal_docs_claim_id ON public.legal_documents(claim_id);
CREATE INDEX idx_legal_docs_user_id ON public.legal_documents(user_id);

-- Payment requests indexes
CREATE INDEX idx_payment_requests_claim_id ON public.payment_requests(claim_id);
CREATE INDEX idx_payment_requests_user_id ON public.payment_requests(user_id);
CREATE INDEX idx_payment_requests_status ON public.payment_requests(status);

-- Settlement proofs indexes
CREATE INDEX idx_settlement_proofs_claim_id ON public.settlement_proofs(claim_id);
CREATE INDEX idx_settlement_proofs_verified ON public.settlement_proofs(verified);

-- Bus companies indexes
CREATE INDEX idx_bus_companies_name ON public.bus_companies(company_name);
CREATE INDEX idx_bus_companies_active ON public.bus_companies(is_active);

-- Legal submissions indexes
CREATE INDEX idx_legal_submissions_claim_id ON public.legal_submissions(claim_id);
CREATE INDEX idx_legal_submissions_user_id ON public.legal_submissions(user_id);
CREATE INDEX idx_legal_submissions_status ON public.legal_submissions(submission_status);
CREATE INDEX idx_legal_submissions_company ON public.legal_submissions(company_id);

-- Workflows indexes
CREATE INDEX idx_workflows_active ON public.workflows(is_active, trigger_type);
CREATE INDEX idx_workflows_default ON public.workflows(is_default, trigger_type);

-- Workflow step definitions indexes
CREATE INDEX idx_step_definitions_active ON public.workflow_step_definitions(is_active, step_type);

-- Workflow executions indexes
CREATE INDEX idx_workflow_executions_claim ON public.workflow_executions(claim_id);
CREATE INDEX idx_workflow_executions_status ON public.workflow_executions(status);
CREATE INDEX idx_workflow_executions_workflow ON public.workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_next_retry ON public.workflow_executions(next_retry_at) WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- Execution logs indexes
CREATE INDEX idx_execution_logs_execution ON public.execution_logs(workflow_execution_id);
CREATE INDEX idx_execution_logs_claim ON public.execution_logs(claim_id);
CREATE INDEX idx_execution_logs_performed_by ON public.execution_logs(performed_by);
CREATE INDEX idx_execution_logs_created_at ON public.execution_logs(created_at DESC);
CREATE INDEX idx_execution_logs_action_type ON public.execution_logs(action_type);

-- Admin settings indexes
CREATE INDEX idx_admin_settings_category ON public.admin_settings(setting_category);
CREATE INDEX idx_admin_settings_active ON public.admin_settings(is_active);

-- Document generations indexes
CREATE INDEX idx_document_generations_claim ON public.document_generations(claim_id);
CREATE INDEX idx_document_generations_status ON public.document_generations(status);
CREATE INDEX idx_document_generations_type ON public.document_generations(document_type);

-- =====================================================
-- SECTION 6: CREATE ALL FUNCTIONS
-- =====================================================

-- 6.1 Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6.2 Handle new user signup
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

-- 6.3 Update profile stats on incident
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

-- 6.4 Calculate commission (15%)
CREATE OR REPLACE FUNCTION calculate_commission(amount DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    RETURN ROUND(amount * 0.15, 2);
END;
$$ LANGUAGE plpgsql;

-- 6.5 Update commission on proof upload
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

-- 6.6 Finalize commission on verification
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

-- 6.7 Get claim total revenue
CREATE OR REPLACE FUNCTION get_claim_total_revenue(claim_id_input UUID)
RETURNS DECIMAL AS $$
DECLARE
    total DECIMAL;
BEGIN
    SELECT COALESCE(opening_fee_amount, 0) + COALESCE(system_commission_due, 0)
    INTO total
    FROM public.claims
    WHERE id = claim_id_input;
    RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql;

-- 6.8 Get outstanding payments
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
    WHERE c.opening_fee_paid = FALSE
        OR (c.commission_paid = FALSE AND c.system_commission_due IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- 6.9 Get company submission method
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

-- 6.10 Log workflow action
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
        workflow_execution_id, claim_id, action_type, description,
        details, success, error_message, performed_by, step_name
    ) VALUES (
        p_workflow_execution_id, p_claim_id, p_action_type, p_description,
        p_details, p_success, p_error_message, COALESCE(p_performed_by, auth.uid()), p_step_name
    ) RETURNING id INTO v_log_id;
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.11 Update workflow execution status
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

-- 6.12 Get next pending execution
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
-- SECTION 7: CREATE ALL TRIGGERS
-- =====================================================

-- Auto signup trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON public.admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON public.claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_legal_documents_updated_at BEFORE UPDATE ON public.legal_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_requests_updated_at BEFORE UPDATE ON public.payment_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlement_proofs_updated_at BEFORE UPDATE ON public.settlement_proofs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bus_companies_updated_at BEFORE UPDATE ON public.bus_companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_legal_submissions_updated_at BEFORE UPDATE ON public.legal_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_executions_updated_at BEFORE UPDATE ON public.workflow_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_settings_updated_at BEFORE UPDATE ON public.admin_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_generations_updated_at BEFORE UPDATE ON public.document_generations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Business logic triggers
CREATE TRIGGER increment_incident_count
    AFTER INSERT ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION update_profile_stats_on_incident();

CREATE TRIGGER on_settlement_proof_uploaded
    AFTER INSERT ON public.settlement_proofs
    FOR EACH ROW EXECUTE FUNCTION update_commission_on_proof_upload();

CREATE TRIGGER on_settlement_proof_verified
    AFTER UPDATE ON public.settlement_proofs
    FOR EACH ROW EXECUTE FUNCTION finalize_commission_on_verification();

-- =====================================================
-- SECTION 8: ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_step_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_generations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECTION 9: CREATE ALL RLS POLICIES
-- =====================================================

-- ----- PROFILES POLICIES -----
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_admin_select" ON public.profiles FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- ----- ADMIN_USERS POLICIES -----
CREATE POLICY "admin_users_select_own" ON public.admin_users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "admin_users_super_admin" ON public.admin_users FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.id = auth.uid() AND au.role = 'super_admin'));

-- ----- INCIDENTS POLICIES -----
CREATE POLICY "incidents_select_own" ON public.incidents FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "incidents_insert_own" ON public.incidents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "incidents_update_own" ON public.incidents FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "incidents_admin_select" ON public.incidents FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "incidents_admin_update" ON public.incidents FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- ----- CLAIMS POLICIES -----
CREATE POLICY "claims_select_own" ON public.claims FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "claims_insert_own" ON public.claims FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "claims_update_own" ON public.claims FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "claims_admin_select" ON public.claims FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "claims_admin_update" ON public.claims FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- ----- LEGAL_DOCUMENTS POLICIES -----
CREATE POLICY "legal_docs_select_own" ON public.legal_documents FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "legal_docs_insert_own" ON public.legal_documents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "legal_docs_admin_select" ON public.legal_documents FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- ----- PAYMENT_REQUESTS POLICIES -----
CREATE POLICY "payment_requests_select_own" ON public.payment_requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "payment_requests_admin_all" ON public.payment_requests FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- ----- SETTLEMENT_PROOFS POLICIES -----
CREATE POLICY "settlement_proofs_select_own" ON public.settlement_proofs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "settlement_proofs_insert_own" ON public.settlement_proofs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "settlement_proofs_admin_select" ON public.settlement_proofs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "settlement_proofs_admin_update" ON public.settlement_proofs FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- ----- BUS_COMPANIES POLICIES -----
CREATE POLICY "bus_companies_public_select" ON public.bus_companies FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "bus_companies_admin_all" ON public.bus_companies FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- ----- LEGAL_SUBMISSIONS POLICIES -----
CREATE POLICY "legal_submissions_select_own" ON public.legal_submissions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "legal_submissions_admin_all" ON public.legal_submissions FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "legal_submissions_system_insert" ON public.legal_submissions FOR INSERT
    WITH CHECK (true);

-- ----- WORKFLOWS POLICIES -----
CREATE POLICY "workflows_public_select" ON public.workflows FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "workflows_admin_all" ON public.workflows FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- ----- WORKFLOW_STEP_DEFINITIONS POLICIES -----
CREATE POLICY "step_defs_public_select" ON public.workflow_step_definitions FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "step_defs_admin_all" ON public.workflow_step_definitions FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- ----- WORKFLOW_EXECUTIONS POLICIES -----
CREATE POLICY "executions_select_own" ON public.workflow_executions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "executions_admin_all" ON public.workflow_executions FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- ----- EXECUTION_LOGS POLICIES -----
CREATE POLICY "logs_select_own_claims" ON public.execution_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.claims c WHERE c.id = execution_logs.claim_id AND c.user_id = auth.uid()));

CREATE POLICY "logs_admin_select" ON public.execution_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "logs_system_insert" ON public.execution_logs FOR INSERT
    WITH CHECK (true);

-- ----- ADMIN_SETTINGS POLICIES -----
CREATE POLICY "settings_public_select" ON public.admin_settings FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "settings_admin_all" ON public.admin_settings FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- ----- DOCUMENT_GENERATIONS POLICIES -----
CREATE POLICY "doc_gens_select_own" ON public.document_generations FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.claims c WHERE c.id = document_generations.claim_id AND c.user_id = auth.uid()));

CREATE POLICY "doc_gens_admin_all" ON public.document_generations FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- =====================================================
-- SECTION 10: CREATE VIEWS
-- =====================================================

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
-- SECTION 11: SEED DATA
-- =====================================================

-- Bus companies
INSERT INTO public.bus_companies (company_name, company_name_en, public_contact_email, online_form_url, requires_form_automation, is_active, notes)
VALUES
    ('אגד', 'Egged', NULL, 'https://www.egged.co.il/contact-us/', TRUE, TRUE, 'חברת האוטובוסים הגדולה בישראל'),
    ('דן', 'Dan', 'service@dan.co.il', NULL, FALSE, TRUE, 'מפעילה בגוש דן'),
    ('קווים', 'Kavim', 'service@kavim-t.co.il', NULL, FALSE, TRUE, 'מפעילה במרכז ובדרום'),
    ('מטרופולין', 'Metropoline', 'info@metropoline.com', NULL, FALSE, TRUE, 'מפעילה באזור חיפה והצפון'),
    ('נתיב אקספרס', 'Nateev Express', 'service@nateevexpress.com', NULL, FALSE, TRUE, 'קווים בין עירוניים'),
    ('סופרבוס', 'Superbus', 'info@superbus.co.il', NULL, FALSE, TRUE, 'מפעילה במחוז הדרום'),
    ('אפיקים', 'Afikim', 'service@afikim-t.co.il', NULL, FALSE, TRUE, 'מפעילה במחוז הצפון'),
    ('גלים', 'Galim', 'info@galimbus.co.il', NULL, FALSE, TRUE, 'מפעילה באזור חדרה והסביבה'),
    ('רכבת ישראל', 'Israel Railways', 'service@rail.co.il', 'https://www.rail.co.il/contact', FALSE, TRUE, 'רכבת ישראל')
ON CONFLICT (company_name) DO NOTHING;

-- Workflow step definitions
INSERT INTO public.workflow_step_definitions (step_type, name, description, icon, default_config) VALUES
    ('data_verification', 'אימות נתונים', 'בדיקה אוטומטית של נתוני האירוע', 'CheckCircle', '{"verify_gps": true}'::jsonb),
    ('pdf_generation', 'יצירת מכתב התראה', 'יצירת PDF משפטי', 'FileText', '{"template": "warning_letter"}'::jsonb),
    ('status_update', 'עדכון סטטוס', 'שינוי סטטוס התביעה', 'RefreshCw', '{"notify_customer": true}'::jsonb),
    ('email_send', 'שליחת אימייל', 'שליחת מייל', 'Mail', '{"to": "customer"}'::jsonb),
    ('approval_required', 'דרוש אישור מנהל', 'עצירת הזרימה עד אישור', 'AlertCircle', '{"notify_admins": true}'::jsonb),
    ('compensation_calculation', 'חישוב פיצוי', 'חישוב סכום הפיצוי', 'Calculator', '{"include_damages": true}'::jsonb),
    ('webhook_call', 'קריאה לשירות חיצוני', 'שליחת נתונים לשירות חיצוני', 'Zap', '{"method": "POST"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Admin settings
INSERT INTO public.admin_settings (setting_key, setting_category, setting_value, description) VALUES
    ('status_messages', 'templates', '{"submitted": "התביעה התקבלה", "verified": "האירוע אומת", "approved": "התביעה אושרה!", "paid": "הפיצוי הועבר!"}'::jsonb, 'הודעות סטטוס'),
    ('automation_config', 'automation', '{"auto_verify_incidents": true, "max_retry_attempts": 3}'::jsonb, 'הגדרות אוטומציה')
ON CONFLICT (setting_key) DO NOTHING;

-- =====================================================
-- SECTION 12: PERMISSIONS
-- =====================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =====================================================
-- SECTION 13: VERIFICATION
-- =====================================================

-- Check tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Test commission calculation
SELECT calculate_commission(1000.00) AS commission_for_1000_nis;

-- =====================================================
-- DONE! Schema created successfully.
--
-- Next steps:
-- 1. Create storage buckets in Supabase Dashboard:
--    - incident-photos (public: true)
--    - documents (public: false)
--    - settlement-proofs (public: false)
--
-- 2. Make yourself admin (after signing up):
--    INSERT INTO public.admin_users (id, email, role, can_approve_claims, can_view_all_users, can_manage_workflows, can_manage_settings)
--    VALUES ('YOUR_USER_ID', 'your@email.com', 'super_admin', true, true, true, true);
--
--    UPDATE public.profiles SET role = 'super_admin' WHERE id = 'YOUR_USER_ID';
-- =====================================================

COMMENT ON SCHEMA public IS 'CashBus - Legal-Tech Platform v2.0';
