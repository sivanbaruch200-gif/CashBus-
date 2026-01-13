/**
 * OpenBus Stride API Service
 *
 * This service connects to the OpenBus Stride API to fetch real-time SIRI data
 * for public transportation in Israel.
 *
 * API Documentation: https://open-bus-stride-api.hasadna.org.il/docs
 *
 * Key endpoints used:
 * - /siri/vehicle-locations - Real-time vehicle positions
 * - /siri/stop-arrivals - Arrival times at stops
 * - /gtfs/routes - Route information
 * - /gtfs/stops - Stop information
 */

const STRIDE_API_BASE = 'https://open-bus-stride-api.hasadna.org.il'

// Types for SIRI/Stride API responses
export interface VehicleLocation {
  id: number
  siri_snapshot_id: number
  siri_ride_stop_id: number
  recorded_at_time: string
  lon: number
  lat: number
  bearing: number
  velocity: number
  distance_from_journey_start: number
  distance_from_siri_ride_stop_meters: number
  siri_routes__id: number
  siri_route__line_ref: number
  siri_route__operator_ref: number
}

export interface StopArrival {
  id: number
  gtfs_stop_id: number
  recorded_at_time: string
  expected_arrival_time: string
  scheduled_arrival_time: string
  line_ref: number
  operator_ref: number
  destination_display: string
}

export interface SiriRide {
  id: number
  journey_ref: string
  scheduled_start_time: string
  vehicle_ref: string
  operator_ref: number
  line_ref: number
  route_short_name: string
  gtfs_route_id: string
}

export interface StrideStop {
  id: number
  code: number
  name: string
  lat: number
  lon: number
  city: string
}

export interface StrideRoute {
  id: number
  operator_ref: number
  line_ref: number
  route_short_name: string
  route_long_name: string
  route_type: number
}

// Operator mapping (agency_id to Hebrew name)
export const OPERATOR_MAP: Record<number, string> = {
  3: 'אגד',
  5: 'דן',
  7: 'קווים',
  10: 'נתיב אקספרס',
  14: 'מטרופולין',
  15: 'קווים',
  16: 'סופרבוס',
  18: 'אפיקים',
  21: 'סופרבוס',
  23: 'גלים',
  25: 'תנופה',
  31: 'גולן',
  42: 'אגד תעבורה',
  45: 'רכבת ישראל',
  91: 'מטרופולין דרום',
}

/**
 * Fetch vehicle locations near a specific point
 */
export async function getVehicleLocationsNear(
  lat: number,
  lon: number,
  radiusKm: number = 0.5,
  lineNumber?: string
): Promise<VehicleLocation[]> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      radius_km: radiusKm.toString(),
      limit: '50',
      order: 'desc',
      order_by: 'recorded_at_time'
    })

    if (lineNumber) {
      params.append('line_ref', lineNumber)
    }

    const response = await fetch(
      `${STRIDE_API_BASE}/siri_vehicle_locations/list?${params}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CashBus-Legal-Platform/1.0'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Stride API error: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching vehicle locations:', error)
    return []
  }
}

/**
 * Fetch arrivals at a specific stop
 */
export async function getStopArrivals(
  stopCode: string,
  minutesBefore: number = 30,
  minutesAfter: number = 30
): Promise<StopArrival[]> {
  try {
    const now = new Date()
    const fromTime = new Date(now.getTime() - minutesBefore * 60000)
    const toTime = new Date(now.getTime() + minutesAfter * 60000)

    const params = new URLSearchParams({
      gtfs_stop__code: stopCode,
      recorded_at_time_from: fromTime.toISOString(),
      recorded_at_time_to: toTime.toISOString(),
      limit: '100',
      order: 'desc'
    })

    const response = await fetch(
      `${STRIDE_API_BASE}/siri_stop_arrivals/list?${params}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CashBus-Legal-Platform/1.0'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Stride API error: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching stop arrivals:', error)
    return []
  }
}

/**
 * Get SIRI rides for a specific line at a specific time
 */
export async function getSiriRidesForLine(
  lineNumber: string,
  operatorRef: number,
  fromTime: Date,
  toTime: Date
): Promise<SiriRide[]> {
  try {
    const params = new URLSearchParams({
      line_ref: lineNumber,
      operator_ref: operatorRef.toString(),
      scheduled_start_time_from: fromTime.toISOString(),
      scheduled_start_time_to: toTime.toISOString(),
      limit: '50',
      order: 'desc'
    })

    const response = await fetch(
      `${STRIDE_API_BASE}/siri_rides/list?${params}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CashBus-Legal-Platform/1.0'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Stride API error: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching SIRI rides:', error)
    return []
  }
}

/**
 * Find a stop by code or name
 */
export async function findStop(query: string): Promise<StrideStop[]> {
  try {
    const params = new URLSearchParams({
      search: query,
      limit: '10'
    })

    const response = await fetch(
      `${STRIDE_API_BASE}/gtfs_stops/list?${params}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CashBus-Legal-Platform/1.0'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Stride API error: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error finding stop:', error)
    return []
  }
}

/**
 * Get route information
 */
export async function getRoute(lineNumber: string, operatorRef?: number): Promise<StrideRoute | null> {
  try {
    const params = new URLSearchParams({
      route_short_name: lineNumber,
      limit: '1'
    })

    if (operatorRef) {
      params.append('operator_ref', operatorRef.toString())
    }

    const response = await fetch(
      `${STRIDE_API_BASE}/gtfs_routes/list?${params}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CashBus-Legal-Platform/1.0'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Stride API error: ${response.status}`)
    }

    const data = await response.json()
    return data[0] || null
  } catch (error) {
    console.error('Error fetching route:', error)
    return null
  }
}

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(
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

/**
 * Get operator Hebrew name from ID
 */
export function getOperatorName(operatorRef: number): string {
  return OPERATOR_MAP[operatorRef] || 'אחר'
}

/**
 * Get operator ID from Hebrew name
 */
export function getOperatorIdByName(hebrewName: string): number | null {
  const entries = Object.entries(OPERATOR_MAP)
  for (const [id, name] of entries) {
    if (name === hebrewName) {
      return parseInt(id)
    }
  }
  return null
}

// Company name to operator ID mapping
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

/**
 * Get operator ID from company key
 */
export function getOperatorIdFromCompanyKey(companyKey: string): number | null {
  return COMPANY_TO_OPERATOR[companyKey.toLowerCase()] || null
}

/**
 * Fetch real-time data for incident verification
 *
 * This function is called when a user reports an incident to fetch
 * current bus location data for verification purposes.
 */
export async function fetchRealTimeDataForVerification(params: {
  userLat: number
  userLon: number
  busLine: string
  busCompany: string
  incidentTime: Date
}): Promise<{
  vehicleLocations: VehicleLocation[]
  nearestVehicle: VehicleLocation | null
  distanceToNearestVehicle: number | null
  operatorRef: number | null
}> {
  const { userLat, userLon, busLine, busCompany, incidentTime } = params

  // Get operator ID from company key
  const operatorRef = getOperatorIdFromCompanyKey(busCompany)

  // Fetch vehicle locations near the user
  const vehicleLocations = await getVehicleLocationsNear(
    userLat,
    userLon,
    1.0, // 1km radius
    busLine
  )

  // Find nearest vehicle
  let nearestVehicle: VehicleLocation | null = null
  let minDistance = Infinity

  for (const vehicle of vehicleLocations) {
    const distance = calculateDistance(userLat, userLon, vehicle.lat, vehicle.lon)
    if (distance < minDistance) {
      minDistance = distance
      nearestVehicle = vehicle
    }
  }

  return {
    vehicleLocations,
    nearestVehicle,
    distanceToNearestVehicle: nearestVehicle ? minDistance : null,
    operatorRef
  }
}

/**
 * Check if a bus was at/near a stop at a specific time
 */
export async function checkBusPresenceAtStop(params: {
  stopCode: string
  lineNumber: string
  operatorRef: number
  checkTime: Date
  toleranceMinutes?: number
}): Promise<{
  wasPresent: boolean
  arrivals: StopArrival[]
  closestArrival: StopArrival | null
  timeDifferenceMinutes: number | null
}> {
  const { stopCode, lineNumber, operatorRef, checkTime, toleranceMinutes = 15 } = params

  // Fetch arrivals at the stop
  const arrivals = await getStopArrivals(stopCode, toleranceMinutes, toleranceMinutes)

  // Filter for the specific line and operator
  const relevantArrivals = arrivals.filter(a =>
    a.line_ref.toString() === lineNumber &&
    a.operator_ref === operatorRef
  )

  if (relevantArrivals.length === 0) {
    return {
      wasPresent: false,
      arrivals: [],
      closestArrival: null,
      timeDifferenceMinutes: null
    }
  }

  // Find closest arrival to the check time
  let closestArrival: StopArrival | null = null
  let minTimeDiff = Infinity

  for (const arrival of relevantArrivals) {
    const arrivalTime = new Date(arrival.expected_arrival_time || arrival.scheduled_arrival_time)
    const timeDiff = Math.abs(arrivalTime.getTime() - checkTime.getTime()) / 60000 // in minutes
    if (timeDiff < minTimeDiff) {
      minTimeDiff = timeDiff
      closestArrival = arrival
    }
  }

  return {
    wasPresent: minTimeDiff <= toleranceMinutes,
    arrivals: relevantArrivals,
    closestArrival,
    timeDifferenceMinutes: closestArrival ? minTimeDiff : null
  }
}
