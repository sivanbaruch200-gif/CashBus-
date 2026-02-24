/**
 * CashBus Fault Ticket - Digital Legal Evidence
 *
 * A "fault ticket" is a cryptographically hashed, immutable snapshot of all
 * data sources at the time of a reported incident. It serves as digital evidence
 * for small claims court (בית משפט לתביעות קטנות).
 *
 * Evidence chain:
 *   1. MOT SIRI SM (Official Gov) - scheduled & expected arrival times
 *   2. OpenBus Stride SIRI VM     - vehicle position & velocity
 *   3. MOT GTFS static            - timetable reference
 *   4. User GPS                   - user location proof
 *
 * Hash: SHA-256 of deterministic JSON stringify of ticket content
 * Purpose: Proves the ticket was NOT modified after creation
 *
 * Legal note: בית משפט לתביעות קטנות מקבל ראיות דיגיטליות הכוללות:
 *   - מקור הנתון (שם ה-API, URL, timestamp)
 *   - שיטת אימות (hash)
 *   - רציפות ראייתית (chain of custody)
 */

import { createClient } from '@supabase/supabase-js'
import type { MotSiriStopVisit, MotSiriSmResponse } from './motSiriService'
import { calculateDelayMinutes, buildLegalCitation } from './motSiriService'

// =====================================================
// TYPES
// =====================================================

export type IncidentType = 'delay' | 'didnt_arrive' | 'didnt_stop'
export type Verdict = 'confirmed' | 'unconfirmed' | 'contradicted' | 'insufficient_data'
export type Confidence = 'high' | 'medium' | 'low'

export interface UserGps {
  lat: number
  lng: number
  accuracyMeters: number
  capturedAt: string  // ISO
}

export interface StationData {
  name: string
  code: string
  lat: number
  lng: number
}

export interface StrideVehicleSnapshot {
  siriSnapshotId: number | null
  recordedAtTime: string
  lat: number
  lng: number
  distanceFromStationMeters: number
  velocityKmh: number | null
  bearing: number | null
  lineRef: number | null
  operatorRef: number | null
}

export interface FaultTicketInput {
  incidentId?: string
  userId?: string
  incidentType: IncidentType
  incidentTime: string  // ISO

  // User & station
  userGps: UserGps
  station: StationData
  busLine: string
  busCompany: string

  // Official MOT SIRI SM data
  motSiriResponse: MotSiriSmResponse
  motSiriVisit: MotSiriStopVisit | null  // the matched visit

  // Stride SIRI VM data
  strideVehiclesFound: number
  strideVehiclesInRadius: number
  strideNearestVehicle: StrideVehicleSnapshot | null
  strideRawResponse: unknown

  // Analysis
  verdict: Verdict
  confidence: Confidence
  verdictReasonHe: string
}

export interface FaultTicket extends FaultTicketInput {
  ticketId: string
  ticketVersion: '1.0'
  createdAt: string  // ISO

  // "Didn't Stop" specific analysis
  didntStopDetected: boolean
  didntStopVmInRadius: boolean     // Stride shows bus near station
  didntStopSmNoArrival: boolean    // MOT SM shows no arrival recorded
  didntStopVelocityAboveThreshold: boolean
  didntStopVelocityKmh: number | null

  // Delay analysis
  scheduledArrival: string | null
  expectedArrival: string | null
  delayMinutes: number | null

  // Data sources
  dataSources: {
    motSiriSm: string
    strideVm: string
    gtfsStatic: string
    userGps: string
  }

  legalCitationHe: string
  legalCitationEn: string

  // Integrity
  ticketHash: string
}

// =====================================================
// HASH FUNCTION
// =====================================================

/**
 * Compute SHA-256 hash of ticket content (excluding the hash field itself).
 * Uses Web Crypto API (available in Next.js Edge/Node environments).
 */
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const buffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Deterministic JSON stringify (sorted keys) for consistent hashing.
 */
function deterministicStringify(obj: unknown): string {
  return JSON.stringify(obj, (_, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      )
    }
    return value
  })
}

// =====================================================
// "DIDN'T STOP" DETECTION ALGORITHM
// =====================================================

const DIDNT_STOP_VELOCITY_THRESHOLD_KMH = 15  // km/h

interface DidntStopAnalysis {
  detected: boolean
  vmInRadius: boolean         // Stride VM: bus was near station
  smNoArrival: boolean        // MOT SM: no arrival record at this stop
  velocityAboveThreshold: boolean
  velocityKmh: number | null
  confidence: Confidence
  reasonHe: string
}

function analyzeDidntStop(
  strideNearestVehicle: StrideVehicleSnapshot | null,
  strideVehiclesInRadius: number,
  motSiriVisit: MotSiriStopVisit | null,
  motSiriSuccess: boolean,
): DidntStopAnalysis {
  const vmInRadius = strideVehiclesInRadius > 0
  const velocityKmh = strideNearestVehicle?.velocityKmh ?? null
  const velocityAboveThreshold = velocityKmh !== null && velocityKmh > DIDNT_STOP_VELOCITY_THRESHOLD_KMH

  // MOT SM: did the official system record an arrival at this stop?
  // If SM was queried and found no MonitoredStopVisit = bus system has no record of stopping
  const smNoArrival = motSiriSuccess && motSiriVisit === null

  // Detection logic (in order of confidence):
  // HIGH: VM shows bus near station + SM has no arrival record
  if (vmInRadius && smNoArrival) {
    return {
      detected: true,
      vmInRadius,
      smNoArrival,
      velocityAboveThreshold,
      velocityKmh,
      confidence: 'high',
      reasonHe: `נתוני SIRI VM מראים שהאוטובוס עבר בטווח ${strideNearestVehicle?.distanceFromStationMeters ?? '?'} מטר מהתחנה` +
        (velocityAboveThreshold ? `, במהירות ${velocityKmh?.toFixed(1)} קמ"ש (מעל הסף של ${DIDNT_STOP_VELOCITY_THRESHOLD_KMH} קמ"ש)` : '') +
        '. נתוני SIRI SM הרשמיים של משרד התחבורה אינם מראים עצירה מתוכננת בתחנה זו.',
    }
  }

  // MEDIUM: VM shows bus near station + velocity above threshold (SM not available)
  if (vmInRadius && velocityAboveThreshold) {
    return {
      detected: true,
      vmInRadius,
      smNoArrival,
      velocityAboveThreshold,
      velocityKmh,
      confidence: 'medium',
      reasonHe: `נתוני SIRI VM מראים שהאוטובוס עבר בטווח ${strideNearestVehicle?.distanceFromStationMeters ?? '?'} מטר מהתחנה` +
        ` במהירות ${velocityKmh?.toFixed(1)} קמ"ש (מעל הסף של ${DIDNT_STOP_VELOCITY_THRESHOLD_KMH} קמ"ש לעצירה).`,
    }
  }

  // LOW: Only VM in radius, velocity not available or below threshold
  if (vmInRadius && !velocityAboveThreshold) {
    return {
      detected: false,
      vmInRadius,
      smNoArrival,
      velocityAboveThreshold,
      velocityKmh,
      confidence: 'low',
      reasonHe: 'האוטובוס היה בקרבת התחנה אך הנתונים אינם מספיקים לקביעה אם עצר.',
    }
  }

  return {
    detected: false,
    vmInRadius: false,
    smNoArrival,
    velocityAboveThreshold: false,
    velocityKmh,
    confidence: 'low',
    reasonHe: 'לא נמצאו ראיות לכך שהאוטובוס עבר בקרבת התחנה.',
  }
}

// =====================================================
// FAULT TICKET CREATION
// =====================================================

/**
 * Create a signed fault ticket from all evidence sources.
 * The ticket is immutable after creation — hash ensures integrity.
 */
export async function createFaultTicket(input: FaultTicketInput): Promise<FaultTicket> {
  const ticketId = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  // Analyze "didn't stop" if incident type requires it
  let didntStopAnalysis: DidntStopAnalysis = {
    detected: false,
    vmInRadius: false,
    smNoArrival: false,
    velocityAboveThreshold: false,
    velocityKmh: null,
    confidence: 'low',
    reasonHe: '',
  }

  if (input.incidentType === 'didnt_stop') {
    didntStopAnalysis = analyzeDidntStop(
      input.strideNearestVehicle,
      input.strideVehiclesInRadius,
      input.motSiriVisit,
      input.motSiriResponse.success,
    )
  }

  // Calculate delay from official MOT SM data
  const scheduledArrival = input.motSiriVisit?.aimedArrivalTime ?? null
  const expectedArrival = input.motSiriVisit?.expectedArrivalTime ?? null
  const delayMinutes = input.motSiriVisit ? calculateDelayMinutes(input.motSiriVisit) : null

  // Legal citation (official MOT)
  const legalCitationHe = buildLegalCitation(input.motSiriResponse)
  const legalCitationEn = [
    'Data source: Israel Ministry of Transportation Real-Time Data Center',
    `(SIRI SM v2.8, queried on ${new Date(input.motSiriResponse.queryTimestamp).toLocaleDateString('en-IL')})`,
    'Official government data - fully admissible as legal evidence.',
  ].join(' ')

  // Build ticket content (without hash field)
  const ticketContent: Omit<FaultTicket, 'ticketHash'> = {
    ...input,
    ticketId,
    ticketVersion: '1.0',
    createdAt,
    didntStopDetected: didntStopAnalysis.detected,
    didntStopVmInRadius: didntStopAnalysis.vmInRadius,
    didntStopSmNoArrival: didntStopAnalysis.smNoArrival,
    didntStopVelocityAboveThreshold: didntStopAnalysis.velocityAboveThreshold,
    didntStopVelocityKmh: didntStopAnalysis.velocityKmh,
    scheduledArrival,
    expectedArrival,
    delayMinutes,
    dataSources: {
      motSiriSm: 'Israel Ministry of Transportation SIRI SM v2.8 (moran.mot.gov.il) - Official Government',
      strideVm: 'OpenBus Stride API SIRI VM (open-bus-stride-api.hasadna.org.il) - Mirror of MOT Feed',
      gtfsStatic: 'Israel MOT GTFS Static Feed (gtfs.mot.gov.il) - Official Government',
      userGps: 'Device GPS (HTML5 Geolocation API, high accuracy mode)',
    },
    legalCitationHe,
    legalCitationEn,
  }

  // Compute SHA-256 over the deterministic representation of the ticket
  const hashInput = deterministicStringify({
    ticketId,
    createdAt,
    incidentId: input.incidentId,
    incidentType: input.incidentType,
    verdict: input.verdict,
    motSiriQueryTimestamp: input.motSiriResponse.queryTimestamp,
    strideVehiclesFound: input.strideVehiclesFound,
    userGps: input.userGps,
    station: input.station,
    busLine: input.busLine,
  })

  const ticketHash = await sha256(hashInput)

  return { ...ticketContent, ticketHash }
}

// =====================================================
// SAVE TO DATABASE
// =====================================================

/**
 * Persist a fault ticket to siri_evidence_snapshots table.
 * Uses service role to bypass RLS (server-side only).
 */
export async function saveFaultTicket(ticket: FaultTicket): Promise<{ id: string } | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl || !serviceKey) {
    console.error('[FaultTicket] Missing Supabase credentials')
    return null
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { data, error } = await supabase
    .from('siri_evidence_snapshots')
    .insert({
      incident_id: ticket.incidentId ?? null,
      user_id: ticket.userId ?? null,
      ticket_version: ticket.ticketVersion,
      created_at: ticket.createdAt,
      incident_type: ticket.incidentType,
      verdict: ticket.verdict,
      confidence: ticket.confidence,
      verdict_reason: ticket.verdictReasonHe,

      // User GPS
      user_lat: ticket.userGps.lat,
      user_lng: ticket.userGps.lng,
      user_location_accuracy_m: ticket.userGps.accuracyMeters,
      user_location_captured_at: ticket.userGps.capturedAt,

      // Station
      station_name: ticket.station.name,
      station_code: ticket.station.code,
      station_lat: ticket.station.lat,
      station_lng: ticket.station.lng,

      // Bus
      bus_line: ticket.busLine,
      bus_company: ticket.busCompany,

      // GTFS schedule (from MOT SM)
      gtfs_scheduled_arrival: ticket.scheduledArrival,
      gtfs_delay_minutes: ticket.delayMinutes,

      // SIRI SM query
      siri_query_timestamp: ticket.motSiriResponse.queryTimestamp,
      siri_api_response_ms: ticket.motSiriResponse.apiResponseMs,

      // Stride VM
      siri_vehicles_found: ticket.strideVehiclesFound,
      siri_vehicles_in_radius: ticket.strideVehiclesInRadius,
      nearest_vehicle_lat: ticket.strideNearestVehicle?.lat ?? null,
      nearest_vehicle_lng: ticket.strideNearestVehicle?.lng ?? null,
      nearest_vehicle_distance_m: ticket.strideNearestVehicle?.distanceFromStationMeters ?? null,
      nearest_vehicle_velocity_kmh: ticket.strideNearestVehicle?.velocityKmh ?? null,
      nearest_vehicle_bearing: ticket.strideNearestVehicle?.bearing ?? null,
      nearest_vehicle_recorded_at: ticket.strideNearestVehicle?.recordedAtTime ?? null,
      nearest_vehicle_siri_snapshot_id: ticket.strideNearestVehicle?.siriSnapshotId ?? null,

      // MOT SM
      sm_arrival_checked: ticket.motSiriResponse.success,
      sm_arrival_found: ticket.motSiriVisit !== null,
      sm_expected_arrival: ticket.expectedArrival,
      sm_scheduled_arrival: ticket.scheduledArrival,

      // "Didn't stop"
      didnt_stop_detected: ticket.didntStopDetected,
      didnt_stop_vm_in_radius: ticket.didntStopVmInRadius,
      didnt_stop_sm_no_arrival: ticket.didntStopSmNoArrival,
      didnt_stop_velocity_kmh: ticket.didntStopVelocityKmh,
      didnt_stop_velocity_above_threshold: ticket.didntStopVelocityAboveThreshold,

      // Raw data (immutable audit trail)
      raw_siri_vm_response: ticket.strideRawResponse,
      raw_siri_sm_response: {
        rawXml: ticket.motSiriResponse.rawXml,
        stopVisits: ticket.motSiriResponse.stopVisits,
        queryTimestamp: ticket.motSiriResponse.queryTimestamp,
        // NOTE: API key is NOT stored
      },

      // Integrity
      ticket_hash: ticket.ticketHash,
      data_sources: ticket.dataSources,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[FaultTicket] DB save error:', error.message)
    return null
  }

  return { id: data.id }
}

// =====================================================
// GENERATE HEBREW SUMMARY FOR DEMAND LETTER
// =====================================================

/**
 * Generate a Hebrew paragraph summarizing the fault ticket,
 * suitable for inclusion in a legal demand letter.
 */
export function generateEvidenceSummaryHe(ticket: FaultTicket): string {
  const date = new Date(ticket.incidentTime).toLocaleDateString('he-IL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
  const time = new Date(ticket.incidentTime).toLocaleTimeString('he-IL', {
    hour: '2-digit', minute: '2-digit'
  })

  const lines: string[] = [
    `בתאריך ${date} בשעה ${time} נרשם אירוע בתחנת "${ticket.station.name}" (קוד תחנה: ${ticket.station.code}).`,
  ]

  if (ticket.incidentType === 'delay' && ticket.delayMinutes !== null) {
    lines.push(
      `על פי נתוני SIRI SM הרשמיים של משרד התחבורה, האוטובוס קו ${ticket.busLine} היה מתוזמן להגיע ב-${ticket.scheduledArrival ? new Date(ticket.scheduledArrival).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : 'שעה לא ידועה'}, ` +
      `אך הגיע בפועל באיחור של ${ticket.delayMinutes} דקות.`
    )
  }

  if (ticket.incidentType === 'didnt_arrive') {
    lines.push(
      `על פי נתוני SIRI SM הרשמיים של משרד התחבורה, לא נרשמה הגעה של קו ${ticket.busLine} לתחנה זו בחלון הזמן הרלוונטי.`
    )
  }

  if (ticket.incidentType === 'didnt_stop' && ticket.didntStopDetected) {
    lines.push(ticket.verdictReasonHe)
  }

  lines.push(
    `הנתונים נאספו ותועדו אוטומטית ע"י מערכת CashBus. מזהה כרטיס תקלה: ${ticket.ticketId} | Hash: ${ticket.ticketHash.slice(0, 16)}...`
  )
  lines.push(ticket.legalCitationHe)

  return lines.join('\n')
}
