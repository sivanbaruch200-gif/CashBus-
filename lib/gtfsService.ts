/**
 * GTFS Service - Ministry of Transportation Data Automation
 *
 * This service handles fetching and processing GTFS (General Transit Feed Specification)
 * data from the Israel Ministry of Transportation.
 *
 * GTFS Data Source: https://gtfs.mot.gov.il/
 *
 * The service is designed to:
 * 1. Fetch GTFS static data (routes, stops, trips) daily
 * 2. Parse and update Supabase tables with latest transit data
 * 3. Be called via Supabase Edge Function with cron scheduling
 */

import { supabase } from './supabase'
import JSZip from 'jszip'

// GTFS file URLs from Ministry of Transportation
const GTFS_BASE_URL = 'https://gtfs.mot.gov.il/gtfsfiles'
const GTFS_ZIP_URL = `${GTFS_BASE_URL}/israel-public-transportation.zip`

// Types for GTFS data
export interface GtfsRoute {
  route_id: string
  agency_id: string
  route_short_name: string
  route_long_name: string
  route_desc?: string
  route_type: number
  route_color?: string
  route_text_color?: string
}

export interface GtfsStop {
  stop_id: string
  stop_code?: string
  stop_name: string
  stop_desc?: string
  stop_lat: number
  stop_lon: number
  zone_id?: string
  location_type?: number
  parent_station?: string
}

export interface GtfsTrip {
  route_id: string
  service_id: string
  trip_id: string
  trip_headsign?: string
  direction_id?: number
  shape_id?: string
}

export interface GtfsAgency {
  agency_id: string
  agency_name: string
  agency_url: string
  agency_timezone: string
  agency_lang?: string
  agency_phone?: string
}

// Database table types for Supabase
export interface DbRoute {
  id?: string
  route_id: string
  agency_id: string
  route_short_name: string
  route_long_name: string
  route_type: number
  updated_at?: string
}

export interface DbStop {
  id?: string
  stop_id: string
  stop_code?: string
  stop_name: string
  stop_lat: number
  stop_lon: number
  zone_id?: string
  updated_at?: string
}

/**
 * Parse CSV content from GTFS file
 */
function parseCSV<T>(csvContent: string): T[] {
  const lines = csvContent.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const rows: T[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === headers.length) {
      const row: any = {}
      headers.forEach((header, idx) => {
        row[header] = values[idx]
      })
      rows.push(row)
    }
  }

  return rows
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values
}

/**
 * Fetch and unzip GTFS data from Ministry of Transportation
 */
export async function fetchGtfsData(): Promise<{
  routes: GtfsRoute[]
  stops: GtfsStop[]
  agencies: GtfsAgency[]
} | null> {
  try {
    console.log('Fetching GTFS data from Ministry of Transportation...')

    const response = await fetch(GTFS_ZIP_URL, {
      headers: {
        'Accept': 'application/zip',
        'User-Agent': 'CashBus-Legal-Platform/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch GTFS: ${response.status} ${response.statusText}`)
    }

    const zipBuffer = await response.arrayBuffer()
    const zip = await JSZip.loadAsync(zipBuffer)

    // Extract required files
    const routesFile = zip.file('routes.txt')
    const stopsFile = zip.file('stops.txt')
    const agencyFile = zip.file('agency.txt')

    if (!routesFile || !stopsFile) {
      throw new Error('Required GTFS files not found in ZIP')
    }

    const [routesContent, stopsContent, agencyContent] = await Promise.all([
      routesFile.async('string'),
      stopsFile.async('string'),
      agencyFile?.async('string') || ''
    ])

    const routes = parseCSV<GtfsRoute>(routesContent)
    const stops = parseCSV<GtfsStop>(stopsContent)
    const agencies = agencyContent ? parseCSV<GtfsAgency>(agencyContent) : []

    console.log(`Parsed ${routes.length} routes, ${stops.length} stops, ${agencies.length} agencies`)

    return { routes, stops, agencies }
  } catch (error) {
    console.error('Error fetching GTFS data:', error)
    return null
  }
}

/**
 * Map agency ID to Hebrew company name
 */
const AGENCY_NAME_MAP: Record<string, string> = {
  '3': 'אגד',
  '5': 'דן',
  '6': 'נסיעות ותיירות',
  '7': 'קווים',
  '10': 'נתיב אקספרס',
  '14': 'מטרופולין',
  '15': 'קווים',
  '16': 'סופרבוס',
  '18': 'אפיקים',
  '21': 'סופרבוס',
  '23': 'גלים',
  '25': 'תנופה',
  '31': 'גולן',
  '32': 'שלמה סיקסט',
  '34': 'אלקטרה אפיקים',
  '42': 'אגד תעבורה',
  '45': 'רכבת ישראל',
  '91': 'מטרופולין דרום',
}

/**
 * Update routes table in Supabase
 */
export async function updateRoutesTable(routes: GtfsRoute[]): Promise<{ inserted: number; updated: number; errors: number }> {
  const stats = { inserted: 0, updated: 0, errors: 0 }

  // Process in batches of 1000
  const batchSize = 1000
  for (let i = 0; i < routes.length; i += batchSize) {
    const batch = routes.slice(i, i + batchSize)

    const routeData: DbRoute[] = batch.map(r => ({
      route_id: r.route_id,
      agency_id: r.agency_id,
      route_short_name: r.route_short_name,
      route_long_name: r.route_long_name,
      route_type: r.route_type,
      updated_at: new Date().toISOString()
    }))

    const { error } = await supabase
      .from('gtfs_routes')
      .upsert(routeData, {
        onConflict: 'route_id',
        ignoreDuplicates: false
      })

    if (error) {
      console.error('Error upserting routes batch:', error)
      stats.errors += batch.length
    } else {
      stats.inserted += batch.length
    }
  }

  return stats
}

/**
 * Update stops table in Supabase
 */
export async function updateStopsTable(stops: GtfsStop[]): Promise<{ inserted: number; updated: number; errors: number }> {
  const stats = { inserted: 0, updated: 0, errors: 0 }

  // Process in batches of 1000
  const batchSize = 1000
  for (let i = 0; i < stops.length; i += batchSize) {
    const batch = stops.slice(i, i + batchSize)

    const stopData: DbStop[] = batch.map(s => ({
      stop_id: s.stop_id,
      stop_code: s.stop_code,
      stop_name: s.stop_name,
      stop_lat: parseFloat(String(s.stop_lat)),
      stop_lon: parseFloat(String(s.stop_lon)),
      zone_id: s.zone_id,
      updated_at: new Date().toISOString()
    }))

    const { error } = await supabase
      .from('gtfs_stops')
      .upsert(stopData, {
        onConflict: 'stop_id',
        ignoreDuplicates: false
      })

    if (error) {
      console.error('Error upserting stops batch:', error)
      stats.errors += batch.length
    } else {
      stats.inserted += batch.length
    }
  }

  return stats
}

/**
 * Find nearest stop to given coordinates
 */
export async function findNearestStop(lat: number, lon: number, radiusMeters: number = 100): Promise<DbStop | null> {
  // Use Haversine formula in SQL for accurate distance calculation
  const { data, error } = await supabase.rpc('find_nearest_stop', {
    user_lat: lat,
    user_lon: lon,
    radius_meters: radiusMeters
  })

  if (error) {
    console.error('Error finding nearest stop:', error)
    return null
  }

  return data?.[0] || null
}

/**
 * Get route information by line number
 */
export async function getRouteByLineNumber(lineNumber: string): Promise<GtfsRoute | null> {
  const { data, error } = await supabase
    .from('gtfs_routes')
    .select('*')
    .eq('route_short_name', lineNumber)
    .limit(1)
    .single()

  if (error) {
    console.error('Error fetching route:', error)
    return null
  }

  return data
}

/**
 * Get company name from agency ID
 */
export function getCompanyNameFromAgencyId(agencyId: string): string {
  return AGENCY_NAME_MAP[agencyId] || 'אחר'
}

/**
 * Main function to run GTFS update (called by Edge Function)
 */
export async function runGtfsUpdate(): Promise<{
  success: boolean
  message: string
  stats?: {
    routes: { inserted: number; updated: number; errors: number }
    stops: { inserted: number; updated: number; errors: number }
  }
}> {
  try {
    console.log('Starting GTFS data update...')

    const data = await fetchGtfsData()
    if (!data) {
      return {
        success: false,
        message: 'Failed to fetch GTFS data from Ministry of Transportation'
      }
    }

    // Update database tables
    const routeStats = await updateRoutesTable(data.routes)
    const stopStats = await updateStopsTable(data.stops)

    // Log update to admin settings
    await supabase
      .from('admin_settings')
      .upsert({
        setting_key: 'gtfs_last_update',
        setting_category: 'system',
        setting_value: {
          timestamp: new Date().toISOString(),
          routes_count: data.routes.length,
          stops_count: data.stops.length,
          route_stats: routeStats,
          stop_stats: stopStats
        },
        description: 'Last GTFS data update timestamp and statistics'
      }, { onConflict: 'setting_key' })

    return {
      success: true,
      message: `GTFS update completed. Routes: ${data.routes.length}, Stops: ${data.stops.length}`,
      stats: {
        routes: routeStats,
        stops: stopStats
      }
    }
  } catch (error) {
    console.error('GTFS update failed:', error)
    return {
      success: false,
      message: `GTFS update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}
