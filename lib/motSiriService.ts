/**
 * Israel Ministry of Transportation - Official SIRI SM (Stop Monitoring) Service
 *
 * Access granted by: Amir Tzfania, Raashan HaArtzit LeTachbura Tziburit, MOT
 * Contact: tzfaniaa@mot.gov.il | ptsupport@mot.gov.il
 *
 * Endpoint: https://moran.mot.gov.il/Channels/HTTPChannel/SmQuery/2.8
 * Test env: https://moran-t.mot.gov.il/Channels/HTTPChannel/SmQuery/2.8
 * Protocol: SIRI SM (Stop Monitoring) v2.8, XML format
 * Full protocol docs: https://www.gov.il/he/departments/general/real_time_information_siri
 *
 * Authentication: API Key via URL param (?Key=...)
 * IP Whitelist: Requests must originate from Fixie proxy (see FIXIE_URL env var)
 *
 * SECURITY: Never expose MOT_SIRI_KEY to client-side code.
 * Only use this service in server-side API routes.
 *
 * Data legal status: OFFICIAL GOVERNMENT DATA - admissible as evidence in Israeli courts.
 */

const MOT_SIRI_ENDPOINT = process.env.MOT_SIRI_ENDPOINT ||
  'https://moran.mot.gov.il/Channels/HTTPChannel/SmQuery/2.8'
const MOT_SIRI_KEY = process.env.MOT_SIRI_KEY || ''
const FIXIE_URL = process.env.FIXIE_URL || ''

// =====================================================
// TYPES
// =====================================================

export interface MotSiriStopVisit {
  // Journey identification
  lineRef: string           // bus line number
  operatorRef: string       // bus company code
  vehicleRef: string        // vehicle identifier
  journeyRef: string        // specific journey/trip ID
  destinationDisplay: string // destination shown on bus display

  // Stop timing (THE KEY LEGAL EVIDENCE FIELDS)
  stopPointRef: string          // stop code
  aimedArrivalTime: string      // scheduled arrival (from GTFS timetable)
  expectedArrivalTime: string   // real-time predicted arrival
  aimedDepartureTime: string    // scheduled departure
  expectedDepartureTime: string // real-time predicted departure

  // Delay (ISO 8601 duration, e.g. "PT5M" = 5 minutes)
  delay: string | null
  delayMinutes: number | null   // parsed from ISO duration

  // Vehicle position
  vehicleLat: number | null
  vehicleLng: number | null

  // Progress
  numberOfStopsAway: number | null  // how many stops until arrival
  progressRate: string | null       // "normalProgress" | "noProgress" | "unknown"

  // Snapshot metadata
  recordedAtTime: string   // when this SIRI reading was taken
}

export interface MotSiriSmResponse {
  success: boolean
  stopCode: string
  queryTimestamp: string
  apiResponseMs: number
  dataSource: 'MOT_SIRI_OFFICIAL'
  stopVisits: MotSiriStopVisit[]
  rawXml: string  // preserved for legal evidence
  error?: string
}

// =====================================================
// XML PARSER - SIRI SM v2.8 format
// =====================================================

/**
 * Parse ISO 8601 duration to minutes
 * e.g. "PT5M" → 5, "PT1H30M" → 90, "-PT3M" → -3
 */
function parseDurationToMinutes(duration: string | null): number | null {
  if (!duration) return null
  try {
    const negative = duration.startsWith('-')
    const abs = duration.replace('-', '')
    // Match PT[hours]H[minutes]M[seconds]S
    const match = abs.match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/)
    if (!match) return null
    const hours = parseInt(match[1] || '0')
    const minutes = parseInt(match[2] || '0')
    const total = hours * 60 + minutes
    return negative ? -total : total
  } catch {
    return null
  }
}

/**
 * Extract text content from an XML tag (simple, no external deps)
 * Handles: <Tag>value</Tag> and <ns:Tag>value</ns:Tag>
 */
function extractTag(xml: string, tag: string): string | null {
  // Try with and without namespace prefix
  const patterns = [
    new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([^<]*)<\/(?:[^:>]+:)?${tag}>`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = xml.match(pattern)
    if (match && match[1].trim()) return match[1].trim()
  }
  return null
}

/**
 * Extract all occurrences of a block tag
 */
function extractAllBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = []
  // Match both namespaced and non-namespaced
  const openPattern = new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>`, 'gi')
  const closePattern = new RegExp(`<\/(?:[^:>]+:)?${tag}>`, 'gi')

  let openMatch: RegExpExecArray | null
  while ((openMatch = openPattern.exec(xml)) !== null) {
    const start = openMatch.index
    closePattern.lastIndex = start
    const closeMatch = closePattern.exec(xml)
    if (closeMatch) {
      blocks.push(xml.slice(start, closeMatch.index + closeMatch[0].length))
    }
  }
  return blocks
}

/**
 * Parse a single MonitoredStopVisit XML block into typed object
 */
function parseStopVisit(visitXml: string): MotSiriStopVisit {
  const aimedArrival = extractTag(visitXml, 'AimedArrivalTime') || ''
  const expectedArrival = extractTag(visitXml, 'ExpectedArrivalTime') || ''
  const delayStr = extractTag(visitXml, 'Delay')
  const delayMinutes = parseDurationToMinutes(delayStr)

  // Vehicle location
  const latStr = extractTag(visitXml, 'Latitude')
  const lngStr = extractTag(visitXml, 'Longitude')

  return {
    lineRef: extractTag(visitXml, 'LineRef') || '',
    operatorRef: extractTag(visitXml, 'OperatorRef') || '',
    vehicleRef: extractTag(visitXml, 'VehicleRef') || '',
    journeyRef: extractTag(visitXml, 'FramedVehicleJourneyRef') || extractTag(visitXml, 'VehicleJourneyRef') || '',
    destinationDisplay: extractTag(visitXml, 'DestinationDisplay') || '',
    stopPointRef: extractTag(visitXml, 'StopPointRef') || '',
    aimedArrivalTime: aimedArrival,
    expectedArrivalTime: expectedArrival,
    aimedDepartureTime: extractTag(visitXml, 'AimedDepartureTime') || '',
    expectedDepartureTime: extractTag(visitXml, 'ExpectedDepartureTime') || '',
    delay: delayStr,
    delayMinutes,
    vehicleLat: latStr ? parseFloat(latStr) : null,
    vehicleLng: lngStr ? parseFloat(lngStr) : null,
    numberOfStopsAway: (() => {
      const v = extractTag(visitXml, 'NumberOfStopsAway')
      return v ? parseInt(v) : null
    })(),
    progressRate: extractTag(visitXml, 'ProgressRate'),
    recordedAtTime: extractTag(visitXml, 'RecordedAtTime') || new Date().toISOString(),
  }
}

/**
 * Parse full SIRI SM XML response
 */
function parseSiriSmXml(xml: string, stopCode: string): MotSiriStopVisit[] {
  const visitBlocks = extractAllBlocks(xml, 'MonitoredStopVisit')
  return visitBlocks.map(parseStopVisit).filter(v =>
    // Keep only visits for this stop (or if stopPointRef not found, keep all)
    !v.stopPointRef || v.stopPointRef === stopCode || v.stopPointRef.endsWith(stopCode)
  )
}

// =====================================================
// PROXY-AWARE FETCH
// Requests must go through Fixie proxy (static IP whitelist)
// =====================================================

async function fetchViaProxy(url: string): Promise<Response> {
  if (FIXIE_URL) {
    try {
      // Next.js 14 (Node.js 18+): use undici ProxyAgent for proxy support
      // undici is built into Node.js and used by Next.js internally
      // @ts-ignore - undici is available in Node.js 18+ runtime used by Next.js
      const { ProxyAgent, fetch: undiciFetch } = await import('undici')
      const dispatcher = new ProxyAgent(FIXIE_URL)
      // @ts-ignore - undici fetch is compatible with global fetch interface
      return undiciFetch(url, {
        dispatcher,
        headers: {
          'Accept': 'application/xml, text/xml',
          'User-Agent': 'CashBus-Legal-Evidence/1.0 (ptsupport@mot.gov.il)',
        },
        signal: AbortSignal.timeout(20000),
      }) as Promise<Response>
    } catch (proxyErr) {
      console.warn('[MOT SIRI] Proxy unavailable, falling back to direct:', proxyErr)
    }
  }

  // Fallback: direct fetch (works in dev without IP restriction)
  return fetch(url, {
    headers: {
      'Accept': 'application/xml, text/xml',
      'User-Agent': 'CashBus-Legal-Evidence/1.0',
    },
    signal: AbortSignal.timeout(20000),
  })
}

// =====================================================
// MAIN API FUNCTION
// =====================================================

/**
 * Query the official MOT SIRI SM endpoint for a specific stop.
 *
 * @param stopCode - The GTFS/MOT stop code (MonitoringRef)
 * @param lineRef  - Optional: filter by line number
 * @returns Official MOT SIRI SM data with parsed arrivals
 *
 * URL pattern:
 * https://moran.mot.gov.il/Channels/HTTPChannel/SmQuery/2.8/xml
 *   ?Key=SB272341
 *   &MonitoringRef=32902
 *   [&LineRef=51]
 */
export async function queryMotSiriSm(
  stopCode: string,
  lineRef?: string
): Promise<MotSiriSmResponse> {
  const queryTimestamp = new Date().toISOString()
  const startMs = Date.now()

  if (!MOT_SIRI_KEY) {
    return {
      success: false,
      stopCode,
      queryTimestamp,
      apiResponseMs: 0,
      dataSource: 'MOT_SIRI_OFFICIAL',
      stopVisits: [],
      rawXml: '',
      error: 'MOT_SIRI_KEY not configured',
    }
  }

  try {
    // Build URL - Key goes in query param (NOT in response/logs)
    const params = new URLSearchParams({
      Key: MOT_SIRI_KEY,
      MonitoringRef: stopCode,
    })
    if (lineRef) {
      params.append('LineRef', lineRef)
    }

    const url = `${MOT_SIRI_ENDPOINT}/xml?${params.toString()}`

    const response = await fetchViaProxy(url)
    const apiResponseMs = Date.now() - startMs

    if (!response.ok) {
      const body = await response.text()
      return {
        success: false,
        stopCode,
        queryTimestamp,
        apiResponseMs,
        dataSource: 'MOT_SIRI_OFFICIAL',
        stopVisits: [],
        rawXml: body,
        error: `MOT SIRI API error: HTTP ${response.status}`,
      }
    }

    const rawXml = await response.text()
    const stopVisits = parseSiriSmXml(rawXml, stopCode)

    return {
      success: true,
      stopCode,
      queryTimestamp,
      apiResponseMs,
      dataSource: 'MOT_SIRI_OFFICIAL',
      stopVisits,
      rawXml,  // preserved for legal evidence
    }
  } catch (err) {
    const apiResponseMs = Date.now() - startMs
    return {
      success: false,
      stopCode,
      queryTimestamp,
      apiResponseMs,
      dataSource: 'MOT_SIRI_OFFICIAL',
      stopVisits: [],
      rawXml: '',
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

// =====================================================
// ANALYSIS HELPERS
// =====================================================

/**
 * Find the closest scheduled arrival to a given time for a specific line.
 * Returns the best matching StopVisit + delay info.
 */
export function findRelevantArrival(
  visits: MotSiriStopVisit[],
  targetTime: Date,
  lineRef?: string,
  toleranceMinutes: number = 30
): {
  visit: MotSiriStopVisit | null
  delayMinutes: number | null
  wasScheduled: boolean
  hadExpectedArrival: boolean
} {
  const candidates = lineRef
    ? visits.filter(v => v.lineRef === lineRef || v.lineRef.endsWith(lineRef))
    : visits

  if (candidates.length === 0) {
    return { visit: null, delayMinutes: null, wasScheduled: false, hadExpectedArrival: false }
  }

  let bestVisit: MotSiriStopVisit | null = null
  let bestDiff = Infinity

  for (const v of candidates) {
    const aimed = v.aimedArrivalTime ? new Date(v.aimedArrivalTime) : null
    if (!aimed) continue
    const diff = Math.abs(aimed.getTime() - targetTime.getTime()) / 60000
    if (diff < bestDiff && diff <= toleranceMinutes) {
      bestDiff = diff
      bestVisit = v
    }
  }

  if (!bestVisit) {
    return { visit: null, delayMinutes: null, wasScheduled: false, hadExpectedArrival: false }
  }

  return {
    visit: bestVisit,
    delayMinutes: bestVisit.delayMinutes,
    wasScheduled: !!bestVisit.aimedArrivalTime,
    hadExpectedArrival: !!bestVisit.expectedArrivalTime,
  }
}

/**
 * Calculate delay in minutes from aimed vs expected arrival.
 * Positive = late, Negative = early.
 */
export function calculateDelayMinutes(visit: MotSiriStopVisit): number | null {
  if (!visit.aimedArrivalTime || !visit.expectedArrivalTime) return null
  const aimed = new Date(visit.aimedArrivalTime)
  const expected = new Date(visit.expectedArrivalTime)
  return Math.round((expected.getTime() - aimed.getTime()) / 60000)
}

/**
 * Build the official data source citation string for demand letters.
 * Uses Hebrew phrasing appropriate for legal documents.
 */
export function buildLegalCitation(response: MotSiriSmResponse): string {
  return [
    'מקור הנתונים: מרכז נתוני זמן אמת של משרד התחבורה',
    `(SIRI SM גרסה 2.8, שאילתה מתאריך ${new Date(response.queryTimestamp).toLocaleDateString('he-IL')})`,
    'נתונים רשמיים של הממשלה — מהימנות מלאה לשימוש בהליכים משפטיים.',
  ].join(' ')
}
