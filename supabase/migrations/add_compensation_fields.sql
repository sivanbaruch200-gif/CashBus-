-- =====================================================
-- MIGRATION: Add Compensation Calculator Fields
-- Date: 2026-01-14
-- Description: Add fields for compensation calculation and receipt storage
-- =====================================================

-- Add compensation-related fields to incidents table
ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS delay_minutes INTEGER,
ADD COLUMN IF NOT EXISTS base_compensation DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS damage_compensation DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_compensation DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS legal_basis TEXT,
ADD COLUMN IF NOT EXISTS receipt_urls TEXT[]; -- Array of receipt image URLs

-- Add comments for documentation
COMMENT ON COLUMN incidents.delay_minutes IS 'Duration of delay in minutes (for delay type incidents)';
COMMENT ON COLUMN incidents.base_compensation IS 'Base compensation amount calculated per legal regulations';
COMMENT ON COLUMN incidents.damage_compensation IS 'Additional damage compensation (taxi, lost wages, etc.)';
COMMENT ON COLUMN incidents.total_compensation IS 'Total compensation = base + damage';
COMMENT ON COLUMN incidents.legal_basis IS 'Legal regulation reference for compensation calculation';
COMMENT ON COLUMN incidents.receipt_urls IS 'URLs of uploaded receipts (taxi, expenses) stored in Supabase Storage';

-- Create index for compensation queries
CREATE INDEX IF NOT EXISTS idx_incidents_total_compensation ON public.incidents(total_compensation DESC);

-- Update profiles table to track compensation
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pending_compensation DECIMAL(10, 2) DEFAULT 0.00;

COMMENT ON COLUMN profiles.pending_compensation IS 'Sum of total_compensation from incidents not yet claimed';

-- Function to update profile compensation on incident insert/update
CREATE OR REPLACE FUNCTION update_profile_compensation()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate pending compensation for the user
    UPDATE public.profiles
    SET pending_compensation = (
        SELECT COALESCE(SUM(total_compensation), 0)
        FROM public.incidents
        WHERE user_id = NEW.user_id
        AND status != 'claimed'
    ),
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

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_compensation_on_incident ON public.incidents;
CREATE TRIGGER update_compensation_on_incident
    AFTER INSERT OR UPDATE OF total_compensation, status ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION update_profile_compensation();

-- Verify migration
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'incidents'
    AND column_name IN ('delay_minutes', 'base_compensation', 'damage_compensation', 'total_compensation', 'legal_basis', 'receipt_urls')
ORDER BY ordinal_position;