-- =====================================================
-- FINAL FIX: Dashboard Trigger - One Complete Solution
-- Date: 2026-01-15
-- Purpose: Delete disabled trigger, recreate as ENABLED, sync all data
-- Run this ENTIRE script in Supabase SQL Editor
-- =====================================================

-- Step 1: Drop the old trigger (any state - enabled or disabled)
DROP TRIGGER IF EXISTS update_compensation_on_incident ON public.incidents;

-- Step 2: Drop and recreate the function with improved logic
CREATE OR REPLACE FUNCTION update_profile_compensation()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate all profile stats for the affected user
    UPDATE public.profiles
    SET
        -- Count total incidents
        total_incidents = (
            SELECT COUNT(*)
            FROM public.incidents
            WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
        ),
        -- Calculate pending (unclaimed) compensation
        pending_compensation = (
            SELECT COALESCE(SUM(total_compensation), 0)
            FROM public.incidents
            WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
            AND status != 'claimed'
        ),
        -- Calculate total potential compensation
        total_potential = (
            SELECT COALESCE(SUM(total_compensation), 0)
            FROM public.incidents
            WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.user_id, OLD.user_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create NEW trigger (enabled by default)
CREATE TRIGGER update_compensation_on_incident
    AFTER INSERT OR UPDATE OR DELETE ON public.incidents
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_compensation();

-- Step 4: Explicitly enable the trigger (belt and suspenders)
ALTER TABLE public.incidents ENABLE TRIGGER update_compensation_on_incident;

-- Step 5: Ensure required columns exist with defaults
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS total_incidents INTEGER DEFAULT 0;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pending_compensation DECIMAL(10,2) DEFAULT 0;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS total_potential DECIMAL(10,2) DEFAULT 0;

-- Step 6: ONE-TIME SYNC - Update all profiles based on existing incidents
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
-- VERIFICATION - Run these to confirm success
-- =====================================================

-- Check trigger exists and is ENABLED (tgenabled = 'O' means enabled)
SELECT
    tgname as trigger_name,
    tgenabled as status,
    CASE tgenabled
        WHEN 'O' THEN 'ENABLED (Origin)'
        WHEN 'D' THEN 'DISABLED'
        WHEN 'R' THEN 'REPLICA'
        WHEN 'A' THEN 'ALWAYS'
        ELSE 'UNKNOWN'
    END as status_description
FROM pg_trigger
WHERE tgname = 'update_compensation_on_incident';

-- Check profile stats are synced
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
