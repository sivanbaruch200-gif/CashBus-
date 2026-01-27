-- =====================================================
-- Fix Profile Trigger to Update Incident Count
-- Date: 2026-01-15
-- Purpose: Update total_incidents counter in profiles when incidents are created
-- =====================================================

-- Update the function to also count incidents
CREATE OR REPLACE FUNCTION update_profile_compensation()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate all profile stats for the user
    UPDATE public.profiles
    SET
        -- Count total incidents
        total_incidents = (
            SELECT COUNT(*)
            FROM public.incidents
            WHERE user_id = NEW.user_id
        ),
        -- Calculate pending (unclaimed) compensation
        pending_compensation = (
            SELECT COALESCE(SUM(total_compensation), 0)
            FROM public.incidents
            WHERE user_id = NEW.user_id
            AND status != 'claimed'
        ),
        -- Calculate total potential compensation
        total_potential = (
            SELECT COALESCE(SUM(total_compensation), 0)
            FROM public.incidents
            WHERE user_id = NEW.user_id
        ),
        updated_at = NOW()
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger to fire on INSERT as well
DROP TRIGGER IF EXISTS update_compensation_on_incident ON public.incidents;

CREATE TRIGGER update_compensation_on_incident
    AFTER INSERT OR UPDATE OF total_compensation, status ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION update_profile_compensation();

-- Ensure total_incidents column exists and has default value
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS total_incidents INTEGER DEFAULT 0;

-- One-time update to sync existing incidents with profile counts
UPDATE public.profiles p
SET
    total_incidents = (
        SELECT COUNT(*) FROM public.incidents WHERE user_id = p.id
    ),
    total_potential = (
        SELECT COALESCE(SUM(total_compensation), 0) FROM public.incidents WHERE user_id = p.id
    );

-- Verify the trigger exists
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'update_compensation_on_incident';
