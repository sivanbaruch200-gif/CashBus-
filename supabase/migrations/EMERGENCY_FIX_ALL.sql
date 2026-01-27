-- =====================================================
-- EMERGENCY FIX: All Critical Issues
-- Date: 2026-01-15
-- Run this ENTIRE script in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: FIX INCIDENTS TABLE SCHEMA
-- =====================================================

-- 1.1 Add missing columns if they don't exist
ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS osm_address TEXT;

ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS user_gps_accuracy DECIMAL(10, 2);

ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS delay_minutes INTEGER;

ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS base_compensation DECIMAL(10, 2);

ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS damage_compensation DECIMAL(10, 2);

ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS total_compensation DECIMAL(10, 2);

ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS legal_basis TEXT;

ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS receipt_urls TEXT[];

-- 1.2 Make station_gps coordinates NULLABLE (they can be null with OSM fallback)
ALTER TABLE public.incidents
ALTER COLUMN station_gps_lat DROP NOT NULL;

ALTER TABLE public.incidents
ALTER COLUMN station_gps_lng DROP NOT NULL;

-- 1.3 Ensure station_name has a default (in case it's empty)
ALTER TABLE public.incidents
ALTER COLUMN station_name SET DEFAULT 'לא ידוע';

-- =====================================================
-- PART 2: FIX RLS POLICIES FOR INCIDENTS
-- =====================================================

-- Drop existing policies (if they exist)
DROP POLICY IF EXISTS "Users can view own incidents" ON public.incidents;
DROP POLICY IF EXISTS "Users can create own incidents" ON public.incidents;
DROP POLICY IF EXISTS "Users can update own incidents" ON public.incidents;
DROP POLICY IF EXISTS "Admins can view all incidents" ON public.incidents;
DROP POLICY IF EXISTS "Admins can update all incidents" ON public.incidents;

-- Create fresh policies
CREATE POLICY "Users can view own incidents"
    ON public.incidents FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own incidents"
    ON public.incidents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own incidents"
    ON public.incidents FOR UPDATE
    USING (auth.uid() = user_id);

-- Allow admins to view and update all incidents
CREATE POLICY "Admins can view all incidents"
    ON public.incidents FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

CREATE POLICY "Admins can update all incidents"
    ON public.incidents FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
    );

-- =====================================================
-- PART 3: AGGRESSIVE TRIGGER FIX
-- =====================================================

-- 3.1 DROP the old trigger completely
DROP TRIGGER IF EXISTS update_compensation_on_incident ON public.incidents;

-- 3.2 DROP the old function completely
DROP FUNCTION IF EXISTS update_profile_compensation() CASCADE;

-- 3.3 Create the function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION update_profile_compensation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Get the user_id from either NEW or OLD record
    target_user_id := COALESCE(NEW.user_id, OLD.user_id);

    -- Update profile stats
    UPDATE public.profiles
    SET
        total_incidents = (
            SELECT COUNT(*)
            FROM public.incidents
            WHERE user_id = target_user_id
        ),
        pending_compensation = (
            SELECT COALESCE(SUM(total_compensation), 0)
            FROM public.incidents
            WHERE user_id = target_user_id
            AND status != 'claimed'
        ),
        total_potential = (
            SELECT COALESCE(SUM(total_compensation), 0)
            FROM public.incidents
            WHERE user_id = target_user_id
        ),
        updated_at = NOW()
    WHERE id = target_user_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 3.4 Create the trigger (will be ENABLED by default)
CREATE TRIGGER update_compensation_on_incident
    AFTER INSERT OR UPDATE OR DELETE ON public.incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_compensation();

-- 3.5 Force enable the trigger (belt and suspenders)
ALTER TABLE public.incidents ENABLE TRIGGER update_compensation_on_incident;

-- =====================================================
-- PART 4: ADD PROFILE COLUMNS IF MISSING
-- =====================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS total_incidents INTEGER DEFAULT 0;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pending_compensation DECIMAL(10,2) DEFAULT 0;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS total_potential DECIMAL(10,2) DEFAULT 0;

-- =====================================================
-- PART 5: ONE-TIME SYNC ALL PROFILES
-- =====================================================

UPDATE public.profiles p
SET
    total_incidents = COALESCE((
        SELECT COUNT(*) FROM public.incidents WHERE user_id = p.id
    ), 0),
    pending_compensation = COALESCE((
        SELECT SUM(total_compensation) FROM public.incidents WHERE user_id = p.id AND status != 'claimed'
    ), 0),
    total_potential = COALESCE((
        SELECT SUM(total_compensation) FROM public.incidents WHERE user_id = p.id
    ), 0),
    updated_at = NOW();

-- =====================================================
-- PART 6: STORAGE BUCKET VERIFICATION
-- =====================================================

-- Check that receipts bucket exists (run this SELECT to verify)
-- SELECT * FROM storage.buckets WHERE name = 'receipts';

-- =====================================================
-- VERIFICATION QUERIES - Run these after the script
-- =====================================================

-- 1. Check trigger is ENABLED (should show 'O' for Origin/Enabled)
SELECT
    tgname as trigger_name,
    tgenabled as status,
    CASE tgenabled
        WHEN 'O' THEN '*** ENABLED ***'
        WHEN 'D' THEN 'DISABLED'
        WHEN 'R' THEN 'REPLICA'
        WHEN 'A' THEN 'ALWAYS'
        ELSE 'UNKNOWN'
    END as status_description
FROM pg_trigger
WHERE tgname = 'update_compensation_on_incident';

-- 2. Check profiles are synced
SELECT
    p.id,
    p.full_name,
    p.total_incidents,
    p.total_potential,
    p.pending_compensation,
    (SELECT COUNT(*) FROM incidents WHERE user_id = p.id) as actual_incidents,
    (SELECT COALESCE(SUM(total_compensation), 0) FROM incidents WHERE user_id = p.id) as actual_potential
FROM profiles p
ORDER BY p.total_incidents DESC
LIMIT 10;

-- 3. Check incidents table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'incidents'
ORDER BY ordinal_position;

-- 4. Check RLS policies for incidents
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'incidents';

-- 5. Check storage buckets
SELECT name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE name IN ('receipts', 'documents', 'incident-photos');