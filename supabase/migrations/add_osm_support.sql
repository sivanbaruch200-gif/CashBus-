-- =====================================================
-- Add OSM Support and GPS Accuracy to Incidents Table
-- Date: 2026-01-15
-- Purpose: Support fallback location verification via OpenStreetMap
-- =====================================================

-- Add GPS accuracy field to incidents table
ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS user_gps_accuracy DECIMAL(10, 2);

COMMENT ON COLUMN public.incidents.user_gps_accuracy IS 'GPS accuracy in meters from user device';

-- Add receipt URLs field if not exists (for damage compensation)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'incidents'
          AND column_name = 'receipt_urls'
    ) THEN
        ALTER TABLE public.incidents
        ADD COLUMN receipt_urls TEXT[];
    END IF;
END $$;

COMMENT ON COLUMN public.incidents.receipt_urls IS 'URLs of receipts uploaded for damage compensation (e.g., taxi receipts)';

-- Note: station_name field already exists and supports both GTFS station names and OSM addresses
COMMENT ON COLUMN public.incidents.station_name IS 'Station name from GTFS or address from OpenStreetMap (fallback)';

-- Add osm_address field for storing complete address from OpenStreetMap (for legal documents)
ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS osm_address TEXT;

COMMENT ON COLUMN public.incidents.osm_address IS 'Full formatted address from OpenStreetMap geocoding (used in legal documents when GTFS unavailable)';
