/**
 * API Route: Validate Location Against GTFS Stops
 *
 * POST /api/validate-location
 *
 * This endpoint validates user GPS coordinates against the gtfs_stops table.
 * Uses Haversine formula for accurate distance calculation.
 *
 * STRICT DATA POLICY:
 * - NO guessing or AI-generated data
 * - Returns ONLY raw data from database
 * - If no station found within 300m, validation fails
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Maximum distance in meters to consider "near a station"
const MAX_STATION_DISTANCE_METERS = 300

// Haversine formula to calculate distance between two points
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distance in meters
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

export async function POST(request: NextRequest) {
  const requestTimestamp = new Date().toISOString()

  try {
    const body = await request.json()
    const { lat, lng, accuracy } = body

    // Validate required fields
    if (lat === undefined || lng === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Missing required coordinates (lat, lng)',
        timestamp: requestTimestamp
      }, { status: 400 })
    }

    const userLat = parseFloat(lat)
    const userLng = parseFloat(lng)
    const gpsAccuracy = accuracy ? parseFloat(accuracy) : null

    // Validate coordinate ranges
    if (isNaN(userLat) || isNaN(userLng) ||
        userLat < -90 || userLat > 90 ||
        userLng < -180 || userLng > 180) {
      return NextResponse.json({
        success: false,
        error: 'Invalid coordinates',
        timestamp: requestTimestamp
      }, { status: 400 })
    }

    // Query gtfs_stops table with bounding box for performance
    // Then calculate exact Haversine distance
    const boundingBoxDelta = MAX_STATION_DISTANCE_METERS / 111000 // Approximate degrees

    const { data: stops, error: dbError } = await supabase
      .from('gtfs_stops')
      .select('stop_id, stop_code, stop_name, stop_lat, stop_lon')
      .gte('stop_lat', userLat - boundingBoxDelta)
      .lte('stop_lat', userLat + boundingBoxDelta)
      .gte('stop_lon', userLng - boundingBoxDelta)
      .lte('stop_lon', userLng + boundingBoxDelta)
      .limit(50)

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json({
        success: false,
        error: 'Database query failed',
        errorCode: 'DB_ERROR',
        details: dbError.message,
        timestamp: requestTimestamp,
        dataSource: 'gtfs_stops table'
      }, { status: 500 })
    }

    // Check if gtfs_stops table has data
    if (!stops || stops.length === 0) {
      // Check if table is empty
      const { count } = await supabase
        .from('gtfs_stops')
        .select('*', { count: 'exact', head: true })

      if (count === 0) {
        return NextResponse.json({
          success: false,
          error: 'GTFS data not loaded',
          errorCode: 'GTFS_EMPTY',
          message: 'טבלת התחנות ריקה. יש להריץ את סקריפט טעינת הנתונים של משרד התחבורה.',
          timestamp: requestTimestamp,
          dataSource: 'gtfs_stops table',
          actionRequired: 'Run GTFS Edge Function to populate stops data'
        }, { status: 503 })
      }

      // Table has data but no stops near user
      return NextResponse.json({
        success: true,
        validated: false,
        station: null,
        message: 'לא זוהתה תחנה בקרבת מקום על פי נתוני לוויין.',
        messageEn: 'No station detected nearby based on satellite data.',
        userLocation: {
          lat: userLat,
          lng: userLng,
          accuracy: gpsAccuracy
        },
        searchRadius: MAX_STATION_DISTANCE_METERS,
        timestamp: requestTimestamp,
        dataSource: 'gtfs_stops table (Ministry of Transportation)'
      })
    }

    // Calculate exact distance for each stop and find nearest
    let nearestStop: any = null
    let minDistance = Infinity

    for (const stop of stops) {
      const distance = calculateHaversineDistance(
        userLat,
        userLng,
        parseFloat(stop.stop_lat),
        parseFloat(stop.stop_lon)
      )

      if (distance < minDistance) {
        minDistance = distance
        nearestStop = {
          ...stop,
          distance_meters: Math.round(distance)
        }
      }
    }

    // Check if nearest stop is within acceptable range
    if (minDistance > MAX_STATION_DISTANCE_METERS) {
      return NextResponse.json({
        success: true,
        validated: false,
        station: null,
        nearestStation: {
          name: nearestStop?.stop_name,
          distance: Math.round(minDistance)
        },
        message: 'לא זוהתה תחנה בקרבת מקום על פי נתוני לוויין.',
        messageEn: 'No station detected nearby based on satellite data.',
        details: `התחנה הקרובה ביותר (${nearestStop?.stop_name}) נמצאת במרחק ${Math.round(minDistance)} מטר, מעבר לטווח המקסימלי של ${MAX_STATION_DISTANCE_METERS} מטר.`,
        userLocation: {
          lat: userLat,
          lng: userLng,
          accuracy: gpsAccuracy
        },
        searchRadius: MAX_STATION_DISTANCE_METERS,
        timestamp: requestTimestamp,
        dataSource: 'gtfs_stops table (Ministry of Transportation)'
      })
    }

    // Station found within range - validation successful
    return NextResponse.json({
      success: true,
      validated: true,
      station: {
        stopId: nearestStop.stop_id,
        stopCode: nearestStop.stop_code,
        name: nearestStop.stop_name,
        lat: parseFloat(nearestStop.stop_lat),
        lng: parseFloat(nearestStop.stop_lon),
        distance: nearestStop.distance_meters
      },
      message: `מיקום אומת: תחנת ${nearestStop.stop_name}`,
      messageEn: `Location verified: ${nearestStop.stop_name} station`,
      userLocation: {
        lat: userLat,
        lng: userLng,
        accuracy: gpsAccuracy
      },
      searchRadius: MAX_STATION_DISTANCE_METERS,
      timestamp: requestTimestamp,
      dataSource: 'gtfs_stops table (Ministry of Transportation)',
      evidenceChain: {
        gpsTimestamp: requestTimestamp,
        gpsAccuracy: gpsAccuracy,
        stationId: nearestStop.stop_id,
        stationCode: nearestStop.stop_code,
        distanceMeters: nearestStop.distance_meters,
        calculationMethod: 'Haversine formula',
        dataSource: 'Israel Ministry of Transportation GTFS'
      }
    })

  } catch (error) {
    console.error('Location validation error:', error)
    return NextResponse.json({
      success: false,
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: requestTimestamp
    }, { status: 500 })
  }
}
