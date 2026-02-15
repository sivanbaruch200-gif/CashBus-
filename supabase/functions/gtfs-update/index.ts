/**
 * GTFS Update Edge Function
 *
 * This Supabase Edge Function fetches GTFS data from the Ministry of Transportation
 * and updates the routes and stops tables in Supabase.
 *
 * Scheduled to run daily via cron job.
 *
 * Deployment:
 *   supabase functions deploy gtfs-update
 *
 * Cron Setup (in Supabase Dashboard > Database > Extensions > pg_cron):
 *   SELECT cron.schedule(
 *     'gtfs-daily-update',
 *     '0 3 * * *',  -- Run at 3:00 AM daily
 *     $$
 *     SELECT
 *       net.http_post(
 *         url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/gtfs-update',
 *         headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
 *         body:='{}'::jsonb
 *       ) AS request_id;
 *     $$
 *   );
 */

// @deno-types="https://esm.sh/@supabase/supabase-js@2"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @deno-types="https://esm.sh/jszip@3"
import JSZip from 'https://esm.sh/jszip@3'

// GTFS file URLs - multiple sources for fallback
const GTFS_URLS = [
  'https://gtfs.mot.gov.il/gtfsfiles/israel-public-transportation.zip',
  'http://gtfs.mot.gov.il/gtfsfiles/israel-public-transportation.zip',
  'https://openbus-gtfs.s3.amazonaws.com/latest/israel-public-transportation.zip', // Hasadna mirror
]

// Types
interface GtfsRoute {
  route_id: string
  agency_id: string
  route_short_name: string
  route_long_name: string
  route_type: string
}

interface GtfsStop {
  stop_id: string
  stop_code?: string
  stop_name: string
  stop_lat: string
  stop_lon: string
  zone_id?: string
}

// CSV Parser
function parseCSV<T>(csvContent: string): T[] {
  const lines = csvContent.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const rows: T[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === headers.length) {
      const row: Record<string, string> = {}
      headers.forEach((header, idx) => {
        row[header] = values[idx]
      })
      rows.push(row as T)
    }
  }

  return rows
}

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

// Main handler
Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch GTFS ZIP file - try multiple URLs with detailed error handling
    let zipBuffer: ArrayBuffer | null = null
    let successUrl = ''
    const errors: string[] = []

    for (const url of GTFS_URLS) {
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/zip, application/octet-stream, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
          },
          redirect: 'follow',
        })

        // Log response details for debugging
        const contentType = response.headers.get('content-type') || 'unknown'
        const contentLength = response.headers.get('content-length') || 'unknown'
        if (!response.ok) {
          // Try to get error body for debugging
          const errorBody = await response.text().catch(() => 'Could not read response body')
          const errorMsg = `URL ${url} returned ${response.status} ${response.statusText}. Content-Type: ${contentType}. Body preview: ${errorBody.substring(0, 200)}`
          console.error(errorMsg)
          errors.push(errorMsg)
          continue
        }

        // Check if response is actually a ZIP file
        if (contentType.includes('text/html') || contentType.includes('text/plain')) {
          const bodyPreview = await response.text()
          const errorMsg = `URL ${url} returned HTML/text instead of ZIP. Content-Type: ${contentType}. Body: ${bodyPreview.substring(0, 500)}`
          console.error(errorMsg)
          errors.push(errorMsg)
          continue
        }

        const buffer = await response.arrayBuffer()

        // Verify it's actually a ZIP file (ZIP files start with PK\x03\x04)
        const header = new Uint8Array(buffer.slice(0, 4))
        const isZip = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04

        if (!isZip) {
          // Log what we actually received
          const textDecoder = new TextDecoder()
          const preview = textDecoder.decode(buffer.slice(0, 500))
          const errorMsg = `URL ${url} did not return a valid ZIP file. Header bytes: [${header.join(', ')}]. Content preview: ${preview.substring(0, 200)}`
          console.error(errorMsg)
          errors.push(errorMsg)
          continue
        }

        // Success!
        zipBuffer = buffer
        successUrl = url
        break

      } catch (fetchError) {
        const errorMsg = `Fetch error for ${url}: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    if (!zipBuffer) {
      throw new Error(`Failed to download GTFS from all sources. Errors:\n${errors.join('\n')}`)
    }

    const zip = await JSZip.loadAsync(zipBuffer)

    // Extract files
    const routesFile = zip.file('routes.txt')
    const stopsFile = zip.file('stops.txt')

    if (!routesFile || !stopsFile) {
      throw new Error('Required GTFS files not found in ZIP')
    }

    const [routesContent, stopsContent] = await Promise.all([
      routesFile.async('string'),
      stopsFile.async('string')
    ])

    const routes = parseCSV<GtfsRoute>(routesContent)
    const stops = parseCSV<GtfsStop>(stopsContent)

    // Update routes in batches
    const routeBatchSize = 1000
    let routesProcessed = 0
    let routeErrors = 0

    for (let i = 0; i < routes.length; i += routeBatchSize) {
      const batch = routes.slice(i, i + routeBatchSize).map(r => ({
        route_id: r.route_id,
        agency_id: r.agency_id,
        route_short_name: r.route_short_name,
        route_long_name: r.route_long_name,
        route_type: parseInt(r.route_type) || 3,
        updated_at: new Date().toISOString()
      }))

      const { error } = await supabase
        .from('gtfs_routes')
        .upsert(batch, { onConflict: 'route_id' })

      if (error) {
        console.error('Route batch error:', error)
        routeErrors += batch.length
      } else {
        routesProcessed += batch.length
      }
    }

    // Update stops in batches
    const stopBatchSize = 1000
    let stopsProcessed = 0
    let stopErrors = 0

    for (let i = 0; i < stops.length; i += stopBatchSize) {
      const batch = stops.slice(i, i + stopBatchSize).map(s => ({
        stop_id: s.stop_id,
        stop_code: s.stop_code || null,
        stop_name: s.stop_name,
        stop_lat: parseFloat(s.stop_lat),
        stop_lon: parseFloat(s.stop_lon),
        zone_id: s.zone_id || null,
        updated_at: new Date().toISOString()
      }))

      const { error } = await supabase
        .from('gtfs_stops')
        .upsert(batch, { onConflict: 'stop_id' })

      if (error) {
        console.error('Stop batch error:', error)
        stopErrors += batch.length
      } else {
        stopsProcessed += batch.length
      }
    }

    // Log update to admin settings
    await supabase
      .from('admin_settings')
      .upsert({
        setting_key: 'gtfs_last_update',
        setting_category: 'system',
        setting_value: {
          timestamp: new Date().toISOString(),
          routes_total: routes.length,
          routes_processed: routesProcessed,
          routes_errors: routeErrors,
          stops_total: stops.length,
          stops_processed: stopsProcessed,
          stops_errors: stopErrors
        },
        description: 'Last GTFS data update timestamp and statistics'
      }, { onConflict: 'setting_key' })

    const result = {
      success: true,
      message: 'GTFS update completed',
      stats: {
        routes: { total: routes.length, processed: routesProcessed, errors: routeErrors },
        stops: { total: stops.length, processed: stopsProcessed, errors: stopErrors }
      },
      timestamp: new Date().toISOString()
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('GTFS update error:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
