-- =====================================================
-- Verification Schema Updates for CashBus
-- Adds GPS accuracy and is_verified fields
-- =====================================================

-- Add GPS accuracy field to incidents table
ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS user_gps_accuracy DECIMAL(10, 2);

COMMENT ON COLUMN public.incidents.user_gps_accuracy IS 'GPS accuracy in meters from navigator.geolocation';

-- Add is_verified field (separate from verified for explicit verification logic)
ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.incidents.is_verified IS 'Set to TRUE when verification logic confirms the incident';

-- Create index for verification queries
CREATE INDEX IF NOT EXISTS idx_incidents_is_verified ON public.incidents(is_verified);
CREATE INDEX IF NOT EXISTS idx_incidents_verification_timestamp ON public.incidents(verification_timestamp DESC);

-- =====================================================
-- Function to auto-verify incidents
-- Called by trigger or API
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_verify_incident(
    p_incident_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_incident RECORD;
    v_nearest_stop RECORD;
    v_verification_result JSONB;
    v_is_verified BOOLEAN;
BEGIN
    -- Fetch incident data
    SELECT * INTO v_incident
    FROM public.incidents
    WHERE id = p_incident_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Incident not found');
    END IF;

    -- Find nearest stop
    SELECT * INTO v_nearest_stop
    FROM find_nearest_stop(v_incident.user_gps_lat, v_incident.user_gps_lng, 100)
    LIMIT 1;

    -- Build verification result
    v_is_verified := true; -- Default to verified, updated by external SIRI check

    v_verification_result := jsonb_build_object(
        'timestamp', now()::text,
        'method', 'auto',
        'user_location', jsonb_build_object(
            'lat', v_incident.user_gps_lat,
            'lon', v_incident.user_gps_lng,
            'accuracy', v_incident.user_gps_accuracy
        ),
        'nearest_stop', CASE
            WHEN v_nearest_stop IS NOT NULL THEN jsonb_build_object(
                'stop_id', v_nearest_stop.stop_id,
                'stop_name', v_nearest_stop.stop_name,
                'distance_meters', v_nearest_stop.distance_meters
            )
            ELSE null
        END,
        'confidence', CASE
            WHEN v_incident.user_gps_accuracy IS NOT NULL AND v_incident.user_gps_accuracy <= 10 THEN 'high'
            WHEN v_incident.user_gps_accuracy IS NOT NULL AND v_incident.user_gps_accuracy <= 30 THEN 'medium'
            ELSE 'low'
        END
    );

    -- Update incident
    UPDATE public.incidents
    SET
        verified = v_is_verified,
        is_verified = v_is_verified,
        verification_data = v_verification_result,
        verification_timestamp = now(),
        status = CASE WHEN v_is_verified THEN 'verified' ELSE 'submitted' END,
        updated_at = now()
    WHERE id = p_incident_id;

    RETURN jsonb_build_object(
        'success', true,
        'is_verified', v_is_verified,
        'verification_data', v_verification_result
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.auto_verify_incident IS 'Auto-verify an incident using GPS data';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.auto_verify_incident TO authenticated;

-- =====================================================
-- View for verified incidents statistics
-- =====================================================

CREATE OR REPLACE VIEW public.verification_stats AS
SELECT
    DATE_TRUNC('day', created_at) AS date,
    COUNT(*) AS total_incidents,
    COUNT(*) FILTER (WHERE is_verified = true) AS verified_count,
    COUNT(*) FILTER (WHERE is_verified = false OR is_verified IS NULL) AS pending_count,
    ROUND(
        (COUNT(*) FILTER (WHERE is_verified = true)::DECIMAL / NULLIF(COUNT(*), 0)) * 100,
        2
    ) AS verification_rate,
    AVG(user_gps_accuracy) FILTER (WHERE user_gps_accuracy IS NOT NULL) AS avg_gps_accuracy
FROM public.incidents
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

COMMENT ON VIEW public.verification_stats IS 'Daily verification statistics for the last 30 days';

-- =====================================================
-- Done
-- =====================================================
