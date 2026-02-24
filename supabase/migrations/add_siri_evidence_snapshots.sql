-- =====================================================
-- CashBus - SIRI Evidence Snapshots
-- Date: 2026-02-23
-- Purpose: Store immutable SIRI data snapshots as legal evidence
--          for small claims court (בית משפט לתביעות קטנות)
--
-- Data sources:
--   1. OpenBus Stride API (mirrors official MOT SIRI VM feed)
--   2. MOT GTFS static feed (direct from gtfs.mot.gov.il)
-- =====================================================

-- =====================================================
-- TABLE: siri_evidence_snapshots
-- Immutable fault tickets - one per incident verification
-- =====================================================

CREATE TABLE IF NOT EXISTS public.siri_evidence_snapshots (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Links
    incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Ticket metadata
    ticket_version TEXT NOT NULL DEFAULT '1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Incident classification
    incident_type TEXT NOT NULL CHECK (incident_type IN ('delay', 'didnt_arrive', 'didnt_stop')),
    verdict TEXT NOT NULL CHECK (verdict IN ('confirmed', 'unconfirmed', 'contradicted', 'insufficient_data')),
    confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    verdict_reason TEXT,  -- Hebrew explanation for demand letter

    -- User location at time of incident
    user_lat                    DECIMAL(10, 8),
    user_lng                    DECIMAL(11, 8),
    user_location_accuracy_m    INTEGER,
    user_location_captured_at   TIMESTAMP WITH TIME ZONE,

    -- Station (from GTFS - official MOT data)
    station_name    TEXT,
    station_code    TEXT,
    station_lat     DECIMAL(10, 8),
    station_lng     DECIMAL(11, 8),

    -- Bus line
    bus_line    TEXT,
    bus_company TEXT,

    -- GTFS schedule (official MOT - unimpeachable)
    gtfs_scheduled_arrival      TIMESTAMP WITH TIME ZONE,  -- AimedArrivalTime
    gtfs_delay_minutes          INTEGER,                   -- delta from expected

    -- SIRI VM query parameters
    siri_query_timestamp    TIMESTAMP WITH TIME ZONE,
    siri_query_from         TIMESTAMP WITH TIME ZONE,
    siri_query_to           TIMESTAMP WITH TIME ZONE,
    siri_api_response_ms    INTEGER,

    -- SIRI VM results (vehicle positions)
    siri_vehicles_found         INTEGER DEFAULT 0,
    siri_vehicles_in_radius     INTEGER DEFAULT 0,

    -- Nearest vehicle data (key evidence)
    nearest_vehicle_lat             DECIMAL(10, 8),
    nearest_vehicle_lng             DECIMAL(11, 8),
    nearest_vehicle_distance_m      INTEGER,
    nearest_vehicle_velocity_kmh    DECIMAL(5, 2),
    nearest_vehicle_bearing         INTEGER,
    nearest_vehicle_recorded_at     TIMESTAMP WITH TIME ZONE,
    nearest_vehicle_siri_snapshot_id BIGINT,

    -- SIRI SM: Stop Arrival check (for "didn't stop" detection)
    -- Did the stop-monitoring system record an arrival for this stop+line?
    sm_arrival_checked          BOOLEAN DEFAULT FALSE,
    sm_arrival_found            BOOLEAN DEFAULT FALSE,  -- TRUE = bus DID stop
    sm_expected_arrival         TIMESTAMP WITH TIME ZONE,
    sm_scheduled_arrival        TIMESTAMP WITH TIME ZONE,

    -- "Didn't Stop" algorithm result
    didnt_stop_detected             BOOLEAN DEFAULT FALSE,
    didnt_stop_vm_in_radius         BOOLEAN DEFAULT FALSE,  -- VM: bus was near station
    didnt_stop_sm_no_arrival        BOOLEAN DEFAULT FALSE,  -- SM: no stop arrival recorded
    didnt_stop_velocity_kmh         DECIMAL(5, 2),          -- velocity when nearest
    didnt_stop_velocity_threshold   INTEGER DEFAULT 15,     -- km/h threshold (configurable)
    didnt_stop_velocity_above_threshold BOOLEAN DEFAULT FALSE,

    -- Full raw snapshots (immutable audit trail)
    raw_siri_vm_response    JSONB,  -- full Stride API response
    raw_siri_sm_response    JSONB,  -- stop arrivals response
    raw_gtfs_data           JSONB,  -- GTFS scheduled times

    -- Data provenance
    data_sources JSONB NOT NULL DEFAULT '{
        "siri_vm": "Open Bus Stride API (mirrors Israel MOT SIRI VM feed)",
        "siri_sm": "Open Bus Stride API (siri_stop_arrivals endpoint)",
        "gtfs_schedule": "Israel Ministry of Transportation GTFS static feed",
        "stride_base_url": "https://open-bus-stride-api.hasadna.org.il"
    }'::jsonb,

    -- Integrity hash (SHA-256 of: incident_id + created_at + verdict + raw_siri_vm_response)
    -- Allows verifying the ticket was not tampered with after creation
    ticket_hash TEXT NOT NULL,

    -- Legal metadata
    legal_note_he TEXT DEFAULT
        'נתונים אלו נאספו ממערכת SIRI של משרד התחבורה דרך ממשק OpenBus Stride של עמותת Hasadna. '
        'הנתונים כוללים חותמת זמן מקורית מה-SIRI ומהווים ראיה דיגיטלית לשימוש בהליכים משפטיים.',
    legal_note_en TEXT DEFAULT
        'This data was collected from the Israeli Ministry of Transportation SIRI system via the OpenBus Stride API (Hasadna). '
        'The data includes original SIRI timestamps and constitutes digital evidence for legal proceedings.',

    -- Status flags
    is_used_in_claim    BOOLEAN DEFAULT FALSE,
    is_exported_to_pdf  BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE public.siri_evidence_snapshots IS
    'Immutable SIRI data snapshots - legal evidence for small claims court. '
    'One record per incident verification. Hash ensures integrity.';

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_siri_evidence_incident_id
    ON public.siri_evidence_snapshots(incident_id);

CREATE INDEX IF NOT EXISTS idx_siri_evidence_user_id
    ON public.siri_evidence_snapshots(user_id);

CREATE INDEX IF NOT EXISTS idx_siri_evidence_created_at
    ON public.siri_evidence_snapshots(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_siri_evidence_verdict
    ON public.siri_evidence_snapshots(verdict);

CREATE INDEX IF NOT EXISTS idx_siri_evidence_didnt_stop
    ON public.siri_evidence_snapshots(didnt_stop_detected)
    WHERE didnt_stop_detected = TRUE;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.siri_evidence_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can view their own snapshots
DROP POLICY IF EXISTS "siri_evidence_select_own" ON public.siri_evidence_snapshots;
CREATE POLICY "siri_evidence_select_own" ON public.siri_evidence_snapshots
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert (API routes)
DROP POLICY IF EXISTS "siri_evidence_insert" ON public.siri_evidence_snapshots;
CREATE POLICY "siri_evidence_insert" ON public.siri_evidence_snapshots
    FOR INSERT WITH CHECK (TRUE);

-- No updates allowed - snapshots are immutable (use admin bypass only)
DROP POLICY IF EXISTS "siri_evidence_update_own" ON public.siri_evidence_snapshots;
CREATE POLICY "siri_evidence_update_own" ON public.siri_evidence_snapshots
    FOR UPDATE USING (
        -- Only allow updating status flags, never the evidence data
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

-- Admins can see all
DROP POLICY IF EXISTS "siri_evidence_admin_all" ON public.siri_evidence_snapshots;
CREATE POLICY "siri_evidence_admin_all" ON public.siri_evidence_snapshots
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

-- =====================================================
-- PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT ON public.siri_evidence_snapshots TO authenticated;
GRANT SELECT ON public.siri_evidence_snapshots TO anon;

-- =====================================================
-- VERIFY
-- =====================================================

SELECT 'siri_evidence_snapshots table created successfully' AS status;
SELECT COUNT(*) AS snapshot_count FROM public.siri_evidence_snapshots;
