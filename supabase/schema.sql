-- CashBus Database Schema
-- Run this SQL in your Supabase SQL Editor
-- https://app.supabase.com/project/ltlfifqtprtkwprwwpxq/editor

-- =====================================================
-- PART 1: PROFILES TABLE (User Information)
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,

    -- User Information
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    id_number TEXT, -- Israeli ID number (encrypted in production)

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

-- =====================================================
-- PART 2: INCIDENTS TABLE (Proof Events / Fault Tickets)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.incidents (
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

    -- Verification
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

-- Indexes for performance
CREATE INDEX idx_incidents_user_id ON public.incidents(user_id);
CREATE INDEX idx_incidents_datetime ON public.incidents(incident_datetime DESC);
CREATE INDEX idx_incidents_bus_company ON public.incidents(bus_company);
CREATE INDEX idx_incidents_status ON public.incidents(status);

-- =====================================================
-- PART 3: CLAIMS TABLE (Compensation Requests)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.claims (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    -- Associated Incidents (Multiple incidents per claim)
    incident_ids UUID[] NOT NULL, -- Array of incident IDs

    -- Claim Details
    claim_amount DECIMAL(10, 2) NOT NULL,
    claim_type TEXT DEFAULT 'warning_letter' CHECK (claim_type IN ('warning_letter', 'formal_claim', 'small_claims_court', 'class_action')),

    -- Status Tracking
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'company_review', 'approved', 'rejected', 'in_court', 'settled', 'paid')),

    -- Dates
    letter_sent_date TIMESTAMP WITH TIME ZONE,
    company_response_date TIMESTAMP WITH TIME ZONE,
    compensation_received_date TIMESTAMP WITH TIME ZONE,

    -- Financial
    compensation_amount DECIMAL(10, 2), -- Actual amount received
    commission_amount DECIMAL(10, 2), -- 20% commission for platform
    payment_method TEXT CHECK (payment_method IN ('bank_transfer', 'check', 'cash', NULL)),

    -- Company Information
    bus_company TEXT NOT NULL,
    company_contact_email TEXT,

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

-- Indexes
CREATE INDEX idx_claims_user_id ON public.claims(user_id);
CREATE INDEX idx_claims_status ON public.claims(status);
CREATE INDEX idx_claims_bus_company ON public.claims(bus_company);

-- =====================================================
-- PART 4: LEGAL DOCUMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.legal_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

    -- Document Information
    document_type TEXT NOT NULL CHECK (document_type IN ('warning_letter', 'formal_claim', 'court_filing', 'settlement_agreement')),
    document_title TEXT NOT NULL,

    -- File Storage
    pdf_url TEXT, -- Supabase Storage URL
    file_size INTEGER, -- in bytes

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

-- Indexes
CREATE INDEX idx_legal_docs_claim_id ON public.legal_documents(claim_id);
CREATE INDEX idx_legal_docs_user_id ON public.legal_documents(user_id);

-- =====================================================
-- PART 5: ADMIN USERS TABLE (Future Phase)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'case_manager' CHECK (role IN ('super_admin', 'case_manager', 'legal_reviewer')),

    -- Permissions
    can_approve_claims BOOLEAN DEFAULT FALSE,
    can_generate_letters BOOLEAN DEFAULT TRUE,
    can_view_all_users BOOLEAN DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 6: FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON public.claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_legal_documents_updated_at BEFORE UPDATE ON public.legal_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'משתמש חדש'),
        COALESCE(NEW.raw_user_meta_data->>'phone', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile automatically
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update profile statistics when incident is created
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

CREATE TRIGGER increment_incident_count
    AFTER INSERT ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION update_profile_stats_on_incident();

-- =====================================================
-- PART 7: SEED DATA (Optional - for testing)
-- =====================================================

-- Bus companies enum (for future use)
-- Common Israeli bus companies
COMMENT ON COLUMN incidents.bus_company IS 'Common values: Egged, Kavim, Dan, Metropoline, Nateev Express, Superbus';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'incidents', 'claims', 'legal_documents', 'admin_users');

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
