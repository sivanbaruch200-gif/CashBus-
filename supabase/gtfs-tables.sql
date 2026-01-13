-- =====================================================
-- GTFS Tables for CashBus
-- Static transit data from Ministry of Transportation
-- =====================================================

-- -----------------------------------------------------
-- GTFS Routes Table
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gtfs_routes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    route_id TEXT UNIQUE NOT NULL,
    agency_id TEXT NOT NULL,
    route_short_name TEXT NOT NULL,  -- Line number (e.g., "480", "5")
    route_long_name TEXT,             -- Full route description
    route_type INTEGER DEFAULT 3,     -- 3 = Bus
    route_color TEXT,
    route_text_color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_gtfs_routes_short_name ON public.gtfs_routes(route_short_name);
CREATE INDEX IF NOT EXISTS idx_gtfs_routes_agency ON public.gtfs_routes(agency_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_routes_updated ON public.gtfs_routes(updated_at DESC);

COMMENT ON TABLE public.gtfs_routes IS 'GTFS routes from Ministry of Transportation - updated daily';
COMMENT ON COLUMN public.gtfs_routes.route_short_name IS 'Bus line number (e.g., 480, 5, 25)';
COMMENT ON COLUMN public.gtfs_routes.agency_id IS 'Transit operator ID (maps to bus company)';

-- -----------------------------------------------------
-- GTFS Stops Table
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gtfs_stops (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    stop_id TEXT UNIQUE NOT NULL,
    stop_code TEXT,                   -- Station code displayed at stop
    stop_name TEXT NOT NULL,          -- Station name in Hebrew
    stop_lat DECIMAL(10, 8) NOT NULL,
    stop_lon DECIMAL(11, 8) NOT NULL,
    zone_id TEXT,
    location_type INTEGER DEFAULT 0,  -- 0 = stop, 1 = station
    parent_station TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_gtfs_stops_code ON public.gtfs_stops(stop_code);
CREATE INDEX IF NOT EXISTS idx_gtfs_stops_name ON public.gtfs_stops(stop_name);
CREATE INDEX IF NOT EXISTS idx_gtfs_stops_location ON public.gtfs_stops(stop_lat, stop_lon);
CREATE INDEX IF NOT EXISTS idx_gtfs_stops_updated ON public.gtfs_stops(updated_at DESC);

-- Spatial index for geo queries (if PostGIS extension is available)
-- CREATE INDEX IF NOT EXISTS idx_gtfs_stops_geom ON public.gtfs_stops USING GIST (
--     ST_SetSRID(ST_MakePoint(stop_lon, stop_lat), 4326)
-- );

COMMENT ON TABLE public.gtfs_stops IS 'GTFS stops/stations from Ministry of Transportation - updated daily';
COMMENT ON COLUMN public.gtfs_stops.stop_lat IS 'Latitude in decimal degrees';
COMMENT ON COLUMN public.gtfs_stops.stop_lon IS 'Longitude in decimal degrees';

-- -----------------------------------------------------
-- Function to find nearest stop using Haversine formula
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION find_nearest_stop(
    user_lat DECIMAL,
    user_lon DECIMAL,
    radius_meters INTEGER DEFAULT 100
)
RETURNS TABLE (
    stop_id TEXT,
    stop_code TEXT,
    stop_name TEXT,
    stop_lat DECIMAL,
    stop_lon DECIMAL,
    distance_meters DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.stop_id,
        s.stop_code,
        s.stop_name,
        s.stop_lat,
        s.stop_lon,
        -- Haversine formula for distance in meters
        (6371000 * acos(
            cos(radians(user_lat)) * cos(radians(s.stop_lat)) *
            cos(radians(s.stop_lon) - radians(user_lon)) +
            sin(radians(user_lat)) * sin(radians(s.stop_lat))
        ))::DECIMAL AS distance_meters
    FROM public.gtfs_stops s
    WHERE
        -- Bounding box filter for performance
        s.stop_lat BETWEEN user_lat - (radius_meters / 111000.0) AND user_lat + (radius_meters / 111000.0)
        AND s.stop_lon BETWEEN user_lon - (radius_meters / (111000.0 * cos(radians(user_lat))))
            AND user_lon + (radius_meters / (111000.0 * cos(radians(user_lat))))
    ORDER BY distance_meters ASC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_nearest_stop IS 'Find nearest bus stops within given radius using Haversine formula';

-- -----------------------------------------------------
-- Agency mapping table (for reference)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gtfs_agencies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agency_id TEXT UNIQUE NOT NULL,
    agency_name TEXT NOT NULL,
    agency_name_he TEXT,              -- Hebrew name
    bus_company_id UUID REFERENCES public.bus_companies(id),
    agency_url TEXT,
    agency_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed agency mappings
INSERT INTO public.gtfs_agencies (agency_id, agency_name, agency_name_he) VALUES
    ('3', 'Egged', 'אגד'),
    ('5', 'Dan', 'דן'),
    ('7', 'Kavim', 'קווים'),
    ('10', 'Nateev Express', 'נתיב אקספרס'),
    ('14', 'Metropoline', 'מטרופולין'),
    ('15', 'Kavim', 'קווים'),
    ('16', 'Superbus', 'סופרבוס'),
    ('18', 'Afikim', 'אפיקים'),
    ('21', 'Superbus', 'סופרבוס'),
    ('23', 'Galim', 'גלים'),
    ('25', 'Tnufa', 'תנופה'),
    ('31', 'Golan', 'גולן'),
    ('42', 'Egged Taavura', 'אגד תעבורה'),
    ('45', 'Israel Railways', 'רכבת ישראל'),
    ('91', 'Metropoline South', 'מטרופולין דרום')
ON CONFLICT (agency_id) DO UPDATE SET
    agency_name = EXCLUDED.agency_name,
    agency_name_he = EXCLUDED.agency_name_he,
    updated_at = NOW();

-- -----------------------------------------------------
-- RLS Policies
-- -----------------------------------------------------
ALTER TABLE public.gtfs_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_agencies ENABLE ROW LEVEL SECURITY;

-- Public read access for all users
CREATE POLICY "gtfs_routes_public_select" ON public.gtfs_routes FOR SELECT USING (true);
CREATE POLICY "gtfs_stops_public_select" ON public.gtfs_stops FOR SELECT USING (true);
CREATE POLICY "gtfs_agencies_public_select" ON public.gtfs_agencies FOR SELECT USING (true);

-- Admin write access
CREATE POLICY "gtfs_routes_admin_all" ON public.gtfs_routes FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "gtfs_stops_admin_all" ON public.gtfs_stops FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "gtfs_agencies_admin_all" ON public.gtfs_agencies FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

-- Service role can always write (for Edge Functions)
CREATE POLICY "gtfs_routes_service_role" ON public.gtfs_routes FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "gtfs_stops_service_role" ON public.gtfs_stops FOR ALL
    USING (auth.role() = 'service_role');

-- -----------------------------------------------------
-- Permissions
-- -----------------------------------------------------
GRANT SELECT ON public.gtfs_routes TO authenticated;
GRANT SELECT ON public.gtfs_stops TO authenticated;
GRANT SELECT ON public.gtfs_agencies TO authenticated;

-- =====================================================
-- DONE
-- Run this SQL in your Supabase SQL Editor to create
-- the GTFS tables. Then deploy the gtfs-update Edge
-- Function and set up the cron job.
-- =====================================================
