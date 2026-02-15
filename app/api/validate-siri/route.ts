/**
 * API Route: Validate Bus Presence via SIRI (Stride API)
 *
 * POST /api/validate-siri
 *
 * This endpoint queries the Open Bus Stride API to verify if a bus
 * was present at a station at the time of reporting.
 *
 * STRICT DATA POLICY:
 * - NO guessing or AI-generated data
 * - Returns ONLY raw data from Stride API
 * - All timestamps and sources are transparent
 *
 * API Reference: https://open-bus-stride-api.hasadna.org.il/docs
 */

import { NextRequest, NextResponse } from 'next/server'

const STRIDE_API_BASE = 'https://open-bus-stride-api.hasadna.org.il'

// Time window for checking bus presence (10 minutes before and after)
const TIME_WINDOW_MINUTES = 10

// Distance threshold to consider bus "at station" in meters
const BUS_AT_STATION_RADIUS_METERS = 150

// Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Map company key to Stride operator_ref
const COMPANY_TO_OPERATOR: Record<string, number> = {
  'egged': 3,
  'dan': 5,
  'kavim': 7,
  'nateev_express': 10,
  'metropoline': 14,
  'superbus': 16,
  'afikim': 18,
  'galim': 23,
  'tnufa': 25,
  'golan': 31,
  'egged_taavura': 42,
}

export async function POST(request: NextRequest) {
  const requestTimestamp = new Date().toISOString()
  const apiCallStart = Date.now()

  try {
    const body = await request.json()
    const {
      stationLat,
      stationLng,
      stationName,
      stationCode,
      busLine,
      busCompany,
      reportTime // ISO string of when incident was reported
    } = body

    // Validate required fields
    if (!stationLat || !stationLng || !busLine) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields (stationLat, stationLng, busLine)',
        timestamp: requestTimestamp
      }, { status: 400 })
    }

    const lat = parseFloat(stationLat)
    const lng = parseFloat(stationLng)
    const reportDateTime = reportTime ? new Date(reportTime) : new Date()

    // Calculate time window
    const fromTime = new Date(reportDateTime.getTime() - TIME_WINDOW_MINUTES * 60000)
    const toTime = new Date(reportDateTime.getTime() + TIME_WINDOW_MINUTES * 60000)

    // Get operator_ref if company provided
    const operatorRef = busCompany ? COMPANY_TO_OPERATOR[busCompany.toLowerCase()] : null

    // Build query parameters for Stride API
    // Using siri_vehicle_locations/list endpoint
    const params = new URLSearchParams({
      recorded_at_time_from: fromTime.toISOString(),
      recorded_at_time_to: toTime.toISOString(),
      limit: '100',
      order_by: 'recorded_at_time'
    })

    // Add line_ref if provided (Stride uses line_ref for route number)
    if (busLine) {
      params.append('line_refs', busLine)
    }

    // Add operator filter if available
    if (operatorRef) {
      params.append('operator_refs', operatorRef.toString())
    }

    // Calculate bounding box for location filter (approximately 500m around station)
    const latDelta = 0.005 // ~500m in latitude
    const lngDelta = 0.005 / Math.cos(lat * Math.PI / 180) // Adjust for longitude

    params.append('lat__greater_or_equal', (lat - latDelta).toString())
    params.append('lat__lower_or_equal', (lat + latDelta).toString())
    params.append('lon__greater_or_equal', (lng - lngDelta).toString())
    params.append('lon__lower_or_equal', (lng + lngDelta).toString())

    // Make API call to Stride
    const strideUrl = `${STRIDE_API_BASE}/siri_vehicle_locations/list?${params}`

    const strideResponse = await fetch(strideUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CashBus-Legal-Evidence/1.0'
      },
      // 15 second timeout
      signal: AbortSignal.timeout(15000)
    })

    const apiCallDuration = Date.now() - apiCallStart

    if (!strideResponse.ok) {
      const errorText = await strideResponse.text()
      console.error('Stride API error:', strideResponse.status, errorText)

      return NextResponse.json({
        success: false,
        error: 'Stride API request failed',
        errorCode: 'STRIDE_API_ERROR',
        httpStatus: strideResponse.status,
        details: errorText,
        timestamp: requestTimestamp,
        apiCallDuration: `${apiCallDuration}ms`,
        dataSource: 'Open Bus Stride API'
      }, { status: 502 })
    }

    const vehicleLocations = await strideResponse.json()

    // Check if any vehicles were found
    if (!vehicleLocations || vehicleLocations.length === 0) {
      // No bus found - this validates the user's report
      return NextResponse.json({
        success: true,
        busFound: false,
        verified: true,
        message: 'אימות דיגיטלי הושלם: האוטובוס לא נמצא במערכת SIRI בקרבת התחנה.',
        messageEn: 'Digital verification complete: The bus was not found in the SIRI system near the station.',
        messageType: 'success',
        color: 'green',
        details: {
          searchParameters: {
            stationName,
            stationCode,
            busLine,
            busCompany,
            searchRadius: `${BUS_AT_STATION_RADIUS_METERS}m`,
            timeWindow: `±${TIME_WINDOW_MINUTES} minutes`,
            fromTime: fromTime.toISOString(),
            toTime: toTime.toISOString()
          },
          vehiclesFound: 0,
          nearestVehicle: null
        },
        evidenceChain: {
          apiEndpoint: 'siri_vehicle_locations/list',
          apiCallTimestamp: requestTimestamp,
          apiResponseTime: `${apiCallDuration}ms`,
          dataSource: 'Open Bus Stride API (Hasadna)',
          originalDataSource: 'Israel Ministry of Transportation SIRI Feed',
          searchCoordinates: { lat, lng },
          timeWindowMinutes: TIME_WINDOW_MINUTES,
          result: 'NO_BUS_FOUND'
        },
        timestamp: requestTimestamp
      })
    }

    // Vehicles found - calculate distances and find nearest
    let nearestVehicle: any = null
    let minDistance = Infinity
    const vehiclesInRadius: any[] = []

    for (const vehicle of vehicleLocations) {
      if (vehicle.lat && vehicle.lon) {
        const distance = calculateDistance(lat, lng, vehicle.lat, vehicle.lon)

        if (distance < minDistance) {
          minDistance = distance
          nearestVehicle = {
            ...vehicle,
            distance_meters: Math.round(distance)
          }
        }

        if (distance <= BUS_AT_STATION_RADIUS_METERS) {
          vehiclesInRadius.push({
            recorded_at: vehicle.recorded_at_time,
            lat: vehicle.lat,
            lon: vehicle.lon,
            distance_meters: Math.round(distance),
            velocity: vehicle.velocity,
            bearing: vehicle.bearing
          })
        }
      }
    }

    // Check if any vehicle was within station radius
    if (vehiclesInRadius.length > 0) {
      // Bus WAS present - warning to user
      return NextResponse.json({
        success: true,
        busFound: true,
        verified: false,
        message: 'נתוני SIRI מראים שהאוטובוס עבר או נמצא בקרבת התחנה.',
        messageEn: 'SIRI data shows that the bus has passed or is near the station.',
        messageType: 'warning',
        color: 'orange',
        details: {
          searchParameters: {
            stationName,
            stationCode,
            busLine,
            busCompany,
            searchRadius: `${BUS_AT_STATION_RADIUS_METERS}m`,
            timeWindow: `±${TIME_WINDOW_MINUTES} minutes`,
            fromTime: fromTime.toISOString(),
            toTime: toTime.toISOString()
          },
          vehiclesFound: vehicleLocations.length,
          vehiclesInRadius: vehiclesInRadius.length,
          nearestVehicle: nearestVehicle ? {
            distance: nearestVehicle.distance_meters,
            recordedAt: nearestVehicle.recorded_at_time,
            velocity: nearestVehicle.velocity
          } : null,
          vehiclePassings: vehiclesInRadius.slice(0, 5) // Limit to 5 for display
        },
        evidenceChain: {
          apiEndpoint: 'siri_vehicle_locations/list',
          apiCallTimestamp: requestTimestamp,
          apiResponseTime: `${apiCallDuration}ms`,
          dataSource: 'Open Bus Stride API (Hasadna)',
          originalDataSource: 'Israel Ministry of Transportation SIRI Feed',
          searchCoordinates: { lat, lng },
          timeWindowMinutes: TIME_WINDOW_MINUTES,
          result: 'BUS_FOUND_IN_RADIUS',
          vehicleCount: vehiclesInRadius.length
        },
        timestamp: requestTimestamp
      })
    }

    // Vehicles found but none within radius - still validates report
    return NextResponse.json({
      success: true,
      busFound: true,
      verified: true,
      message: 'אימות דיגיטלי הושלם: האוטובוס לא נמצא בטווח התחנה בזמן הדיווח.',
      messageEn: 'Digital verification complete: The bus was not within station range at report time.',
      messageType: 'success',
      color: 'green',
      details: {
        searchParameters: {
          stationName,
          stationCode,
          busLine,
          busCompany,
          searchRadius: `${BUS_AT_STATION_RADIUS_METERS}m`,
          timeWindow: `±${TIME_WINDOW_MINUTES} minutes`,
          fromTime: fromTime.toISOString(),
          toTime: toTime.toISOString()
        },
        vehiclesFound: vehicleLocations.length,
        vehiclesInRadius: 0,
        nearestVehicle: nearestVehicle ? {
          distance: nearestVehicle.distance_meters,
          recordedAt: nearestVehicle.recorded_at_time,
          note: `האוטובוס הקרוב ביותר היה במרחק ${nearestVehicle.distance_meters} מטר`
        } : null
      },
      evidenceChain: {
        apiEndpoint: 'siri_vehicle_locations/list',
        apiCallTimestamp: requestTimestamp,
        apiResponseTime: `${apiCallDuration}ms`,
        dataSource: 'Open Bus Stride API (Hasadna)',
        originalDataSource: 'Israel Ministry of Transportation SIRI Feed',
        searchCoordinates: { lat, lng },
        timeWindowMinutes: TIME_WINDOW_MINUTES,
        result: 'BUS_NOT_IN_RADIUS',
        nearestDistance: nearestVehicle?.distance_meters
      },
      timestamp: requestTimestamp
    })

  } catch (error) {
    console.error('SIRI validation error:', error)

    // Handle timeout specifically
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({
        success: false,
        error: 'Stride API timeout',
        errorCode: 'STRIDE_TIMEOUT',
        message: 'שרת ה-SIRI לא הגיב בזמן. נסו שוב.',
        timestamp: requestTimestamp,
        dataSource: 'Open Bus Stride API'
      }, { status: 504 })
    }

    return NextResponse.json({
      success: false,
      error: 'SIRI validation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: requestTimestamp
    }, { status: 500 })
  }
}
