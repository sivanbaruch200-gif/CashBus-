/**
 * API Route: Validate Bus Presence via SIRI (Multi-Source)
 *
 * POST /api/validate-siri
 *
 * Evidence chain (in order of legal authority):
 *   1. MOT SIRI SM (Official) - scheduled vs expected arrival, official stop record
 *   2. OpenBus Stride SIRI VM  - vehicle position & velocity near station
 *   3. GTFS static             - schedule reference
 *
 * STRICT DATA POLICY:
 * - NO guessing or AI-generated data
 * - Returns ONLY raw data from official/verified APIs
 * - All timestamps and sources are transparent
 * - Saves an immutable fault ticket to DB on every successful validation
 *
 * Proxy: Requests to MOT SIRI go through Fixie (static IP whitelist)
 */

import { NextRequest, NextResponse } from 'next/server'
import { queryMotSiriSm, findRelevantArrival } from '@/lib/motSiriService'
import {
  createFaultTicket,
  saveFaultTicket,
  type FaultTicketInput,
  type IncidentType,
  type Verdict,
  type Confidence,
} from '@/lib/faultTicket'

const STRIDE_API_BASE = 'https://open-bus-stride-api.hasadna.org.il'
const BUS_AT_STATION_RADIUS_METERS = 150
const TIME_WINDOW_MINUTES = 10
// Velocity thresholds for "did the bus actually stop?" (km/h)
// Bus at a stop creeps at <5 km/h. Moving without stopping: >12 km/h.
const STOPPED_VELOCITY_KMH = 5
const MOVING_VELOCITY_KMH = 12

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

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(request: NextRequest) {
  const requestTimestamp = new Date().toISOString()

  try {
    const body = await request.json()
    const {
      stationLat,
      stationLng,
      stationName,
      stationCode,
      busLine,
      busCompany,
      reportTime,
      incidentType = 'delay',  // 'delay' | 'didnt_arrive' | 'didnt_stop'
      // User GPS (for fault ticket)
      userLat,
      userLng,
      userAccuracyMeters,
      userLocationCapturedAt,
      // Optional: save fault ticket to DB
      incidentId,
      userId,
      saveToDB = false,
    } = body

    if (!stationLat || !stationLng || !busLine) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields (stationLat, stationLng, busLine)',
        timestamp: requestTimestamp,
      }, { status: 400 })
    }

    const validIncidentTypes = ['delay', 'didnt_arrive', 'didnt_stop']
    if (!validIncidentTypes.includes(incidentType)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid incidentType. Must be: delay | didnt_arrive | didnt_stop',
        timestamp: requestTimestamp,
      }, { status: 400 })
    }

    const lat = parseFloat(stationLat)
    const lng = parseFloat(stationLng)
    const reportDateTime = reportTime ? new Date(reportTime) : new Date()
    const fromTime = new Date(reportDateTime.getTime() - TIME_WINDOW_MINUTES * 60000)
    const toTime = new Date(reportDateTime.getTime() + TIME_WINDOW_MINUTES * 60000)

    // =====================================================
    // PARALLEL: Query MOT SIRI SM (official) + Stride VM
    // =====================================================

    const [motSiriResult, strideResult] = await Promise.allSettled([
      // 1. Official MOT SIRI SM - queried by stop code
      stationCode
        ? queryMotSiriSm(stationCode, busLine)
        : Promise.resolve({ success: false, stopCode: '', queryTimestamp: requestTimestamp, apiResponseMs: 0, dataSource: 'MOT_SIRI_OFFICIAL' as const, stopVisits: [], rawXml: '', error: 'No station code' }),

      // 2. Stride SIRI VM - queried by area + time
      (async () => {
        const operatorRef = busCompany ? COMPANY_TO_OPERATOR[busCompany.toLowerCase()] : null
        const latDelta = 0.005
        const lngDelta = 0.005 / Math.cos(lat * Math.PI / 180)
        const params = new URLSearchParams({
          recorded_at_time_from: fromTime.toISOString(),
          recorded_at_time_to: toTime.toISOString(),
          lat__greater_or_equal: (lat - latDelta).toString(),
          lat__lower_or_equal: (lat + latDelta).toString(),
          lon__greater_or_equal: (lng - lngDelta).toString(),
          lon__lower_or_equal: (lng + lngDelta).toString(),
          limit: '100',
          order_by: 'recorded_at_time',
        })
        if (busLine) params.append('line_refs', busLine)
        if (operatorRef) params.append('operator_refs', operatorRef.toString())

        const res = await fetch(`${STRIDE_API_BASE}/siri_vehicle_locations/list?${params}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'CashBus-Legal-Evidence/1.0' },
          signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) throw new Error(`Stride API error: ${res.status}`)
        return res.json()
      })(),
    ])

    // =====================================================
    // PROCESS MOT SIRI SM (official)
    // =====================================================

    const motSiriResponse = motSiriResult.status === 'fulfilled'
      ? motSiriResult.value
      : { success: false, stopCode: stationCode || '', queryTimestamp: requestTimestamp, apiResponseMs: 0, dataSource: 'MOT_SIRI_OFFICIAL' as const, stopVisits: [], rawXml: '', error: String(motSiriResult.reason) }

    const { visit: motSiriVisit, delayMinutes: motDelay } = findRelevantArrival(
      motSiriResponse.stopVisits,
      reportDateTime,
      busLine,
    )

    // =====================================================
    // PROCESS Stride SIRI VM
    // =====================================================

    const vehicleLocations: any[] = strideResult.status === 'fulfilled' ? (strideResult.value || []) : []
    const strideError = strideResult.status === 'rejected' ? String(strideResult.reason) : null

    let nearestVehicle: any = null
    let minDistance = Infinity
    const vehiclesInRadius: any[] = []

    for (const v of vehicleLocations) {
      if (v.lat && v.lon) {
        const dist = haversineMeters(lat, lng, v.lat, v.lon)
        if (dist < minDistance) {
          minDistance = dist
          nearestVehicle = { ...v, distance_meters: Math.round(dist) }
        }
        if (dist <= BUS_AT_STATION_RADIUS_METERS) {
          vehiclesInRadius.push({
            recorded_at: v.recorded_at_time,
            lat: v.lat,
            lon: v.lon,
            distance_meters: Math.round(dist),
            velocity: v.velocity,
            bearing: v.bearing,
            siri_snapshot_id: v.siri_snapshot_id,
          })
        }
      }
    }

    // =====================================================
    // DETERMINE VERDICT
    // =====================================================

    let verdict: Verdict = 'insufficient_data'
    let confidence: Confidence = 'low'
    let verdictReasonHe = ''
    let busFoundNearStation = false
    let messageType: 'success' | 'warning' | 'error' = 'success'
    let color = 'green'
    let messageHe = ''

    const vmBusInRadius = vehiclesInRadius.length > 0
    const smHasArrival = motSiriVisit !== null
    const smAvailable = motSiriResponse.success

    if (incidentType === 'didnt_stop') {
      // Velocity analysis from Stride VM (km/h; null = data not available)
      const vehiclesWithVelocity = vehiclesInRadius.filter(v => v.velocity !== null && v.velocity !== undefined)
      const minVelocityInRadius = vehiclesWithVelocity.length > 0
        ? Math.min(...vehiclesWithVelocity.map(v => v.velocity as number))
        : null
      const busActuallyStopped = minVelocityInRadius !== null && minVelocityInRadius < STOPPED_VELOCITY_KMH
      const busMovedThrough   = minVelocityInRadius !== null && minVelocityInRadius > MOVING_VELOCITY_KMH

      if (!vmBusInRadius) {
        // Bus wasn't detected near station at all
        verdict = 'confirmed'
        confidence = 'medium'
        verdictReasonHe = 'האוטובוס לא נמצא כלל בקרבת התחנה בזמן הדיווח.'
        messageType = 'success'
        color = 'green'
        messageHe = 'אימות דיגיטלי הושלם: האוטובוס לא נמצא בקרבת התחנה.'
      } else if (busActuallyStopped || smHasArrival) {
        // Bus was near station AND stopped (low velocity) OR SM confirms a stop record
        verdict = 'contradicted'
        confidence = 'high'
        busFoundNearStation = true
        messageType = 'warning'
        color = 'orange'
        if (busActuallyStopped && smHasArrival) {
          verdictReasonHe = `נתוני VM מראים מהירות ${Math.round(minVelocityInRadius!)} קמ"ש בתחנה ו-SM מאשר עצירה — האוטובוס עצר. הנוסע לא עלה.`
          messageHe = `נתוני SIRI מאשרים שהאוטובוס עצר בתחנה (מהירות ${Math.round(minVelocityInRadius!)} קמ"ש). לא ניתן לדווח "לא עצר".`
        } else if (busActuallyStopped) {
          verdictReasonHe = `נתוני VM מראים שהאוטובוס עמד בתחנה — מהירות ${Math.round(minVelocityInRadius!)} קמ"ש בלבד.`
          messageHe = `נתוני Stride VM מראים שהאוטובוס עצר (מהירות ${Math.round(minVelocityInRadius!)} קמ"ש). לא ניתן לדווח "לא עצר".`
        } else {
          verdictReasonHe = 'נתוני SIRI SM מאשרים שהאוטובוס עצר בתחנה.'
          messageHe = 'נתוני SIRI SM מראים שהאוטובוס עצר בתחנה זו.'
        }
      } else if (busMovedThrough && !smHasArrival) {
        // Bus was near station but moving fast — didn't stop
        verdict = 'confirmed'
        confidence = 'high'
        busFoundNearStation = true
        verdictReasonHe = `נתוני VM מראים שהאוטובוס עבר בטווח ${vehiclesInRadius[0]?.distance_meters ?? '?'} מטר במהירות ${Math.round(minVelocityInRadius!)} קמ"ש. SM לא מאשר עצירה.`
        messageType = 'success'
        color = 'green'
        messageHe = `אירוע מאומת: האוטובוס עבר ליד התחנה (${Math.round(minVelocityInRadius!)} קמ"ש) מבלי לעצור — מאושר על ידי SIRI.`
      } else {
        // Bus in radius but velocity unknown — rely on SM only
        if (smHasArrival) {
          verdict = 'contradicted'
          confidence = 'medium'
          busFoundNearStation = true
          verdictReasonHe = 'SM מאשר הגעה לתחנה; נתוני מהירות VM לא זמינים.'
          messageType = 'warning'
          color = 'orange'
          messageHe = 'נתוני SM מראים שהאוטובוס עצר. לא ניתן לדווח "לא עצר".'
        } else {
          verdict = 'unconfirmed'
          confidence = 'low'
          busFoundNearStation = true
          verdictReasonHe = 'האוטובוס נמצא בקרבת התחנה אך נתוני מהירות ועצירה חלקיים.'
          messageType = 'warning'
          color = 'orange'
          messageHe = 'נתוני SIRI חלקיים — לא ניתן לאמת אם האוטובוס עצר.'
        }
      }
    } else if (incidentType === 'didnt_arrive') {
      if (vehicleLocations.length === 0) {
        verdict = 'confirmed'
        confidence = smAvailable && !smHasArrival ? 'high' : 'medium'
        verdictReasonHe = 'האוטובוס לא נמצא במערכת SIRI בקרבת התחנה.'
        messageType = 'success'
        color = 'green'
        messageHe = 'אימות דיגיטלי הושלם: האוטובוס לא הגיע לתחנה.'
      } else if (vmBusInRadius) {
        verdict = 'contradicted'
        confidence = 'high'
        verdictReasonHe = 'נתוני SIRI מראים שהאוטובוס היה בקרבת התחנה.'
        busFoundNearStation = true
        messageType = 'warning'
        color = 'orange'
        messageHe = 'נתוני SIRI מראים שהאוטובוס עבר או נמצא בקרבת התחנה.'
      } else {
        verdict = 'unconfirmed'
        confidence = 'medium'
        verdictReasonHe = 'האוטובוס נמצא אך לא בטווח התחנה.'
        messageType = 'success'
        color = 'green'
        messageHe = 'אוטובוס נמצא אך לא בקרבת התחנה המדווחת.'
      }
    } else {
      // delay
      if (smAvailable && motSiriVisit && motDelay !== null && motDelay > 0) {
        verdict = 'confirmed'
        confidence = 'high'
        verdictReasonHe = `נתוני SIRI SM הרשמיים מאשרים איחור של ${motDelay} דקות.`
        messageType = 'success'
        color = 'green'
        messageHe = `אירוע מאומת: איחור של ${motDelay} דקות — מאושר על ידי נתוני משרד התחבורה.`
      } else if (smAvailable && motSiriVisit) {
        verdict = 'unconfirmed'
        confidence = 'medium'
        verdictReasonHe = 'נמצא זמן הגעה מתוזמן אך לא נרשם איחור משמעותי.'
        messageType = 'warning'
        color = 'orange'
        messageHe = 'נמצאו נתוני לוח זמנים — ללא איחור משמעותי.'
      } else {
        verdict = 'insufficient_data'
        confidence = 'low'
        verdictReasonHe = 'לא נמצאו נתוני SIRI SM לתחנה ולזמן הנדרש.'
        messageType = 'warning'
        color = 'orange'
        messageHe = 'לא ניתן לאמת מנתוני SIRI בזמן זה.'
      }
    }

    // =====================================================
    // CREATE & SAVE FAULT TICKET
    // =====================================================

    let savedTicketId: string | null = null
    let faultTicket = null

    if (saveToDB || incidentId) {
      try {
        const ticketInput: FaultTicketInput = {
          incidentId,
          userId,
          incidentType: incidentType as IncidentType,
          incidentTime: reportDateTime.toISOString(),
          userGps: {
            lat: userLat ? parseFloat(userLat) : lat,
            lng: userLng ? parseFloat(userLng) : lng,
            accuracyMeters: userAccuracyMeters ? parseInt(userAccuracyMeters) : 0,
            capturedAt: userLocationCapturedAt || reportDateTime.toISOString(),
          },
          station: {
            name: stationName || '',
            code: stationCode || '',
            lat,
            lng,
          },
          busLine,
          busCompany: busCompany || '',
          motSiriResponse,
          motSiriVisit,
          strideVehiclesFound: vehicleLocations.length,
          strideVehiclesInRadius: vehiclesInRadius.length,
          strideNearestVehicle: nearestVehicle ? {
            siriSnapshotId: nearestVehicle.siri_snapshot_id ?? null,
            recordedAtTime: nearestVehicle.recorded_at_time,
            lat: nearestVehicle.lat,
            lng: nearestVehicle.lon,
            distanceFromStationMeters: nearestVehicle.distance_meters,
            velocityKmh: nearestVehicle.velocity ?? null,
            bearing: nearestVehicle.bearing ?? null,
            lineRef: nearestVehicle.siri_route__line_ref ?? null,
            operatorRef: nearestVehicle.siri_route__operator_ref ?? null,
          } : null,
          strideRawResponse: vehicleLocations.slice(0, 20),  // cap at 20 for storage
          verdict,
          confidence,
          verdictReasonHe,
        }

        faultTicket = await createFaultTicket(ticketInput)
        const saved = await saveFaultTicket(faultTicket)
        savedTicketId = saved?.id ?? null
      } catch (ticketErr) {
        console.error('[validate-siri] Fault ticket error:', ticketErr)
      }
    }

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      busFound: busFoundNearStation || vehicleLocations.length > 0,
      verified: verdict === 'confirmed',
      verdict,
      confidence,
      message: messageHe,
      messageType,
      color,

      // Official MOT SIRI SM data
      motSiri: {
        available: motSiriResponse.success,
        stopVisitsFound: motSiriResponse.stopVisits.length,
        matchedVisit: motSiriVisit ? {
          lineRef: motSiriVisit.lineRef,
          aimedArrival: motSiriVisit.aimedArrivalTime,
          expectedArrival: motSiriVisit.expectedArrivalTime,
          delayMinutes: motDelay,
          progressRate: motSiriVisit.progressRate,
          vehicleRef: motSiriVisit.vehicleRef,
        } : null,
        error: motSiriResponse.error,
        queryTimestamp: motSiriResponse.queryTimestamp,
        apiResponseMs: motSiriResponse.apiResponseMs,
        dataSource: 'Israel Ministry of Transportation SIRI SM v2.8 (Official)',
      },

      // Stride SIRI VM data
      strideVm: {
        available: !strideError,
        vehiclesFound: vehicleLocations.length,
        vehiclesInRadius: vehiclesInRadius.length,
        nearestVehicle: nearestVehicle ? {
          distance: nearestVehicle.distance_meters,
          recordedAt: nearestVehicle.recorded_at_time,
          velocity: nearestVehicle.velocity,
          bearing: nearestVehicle.bearing,
          snapshotId: nearestVehicle.siri_snapshot_id,
        } : null,
        error: strideError,
        dataSource: 'OpenBus Stride API (mirrors MOT SIRI VM feed)',
      },

      // Evidence chain summary
      evidenceChain: {
        motSiriEndpoint: 'https://moran.mot.gov.il/Channels/HTTPChannel/SmQuery/2.8',
        motSiriLegalStatus: 'OFFICIAL_GOVERNMENT_DATA',
        strideEndpoint: 'https://open-bus-stride-api.hasadna.org.il/siri_vehicle_locations/list',
        strideLegalStatus: 'MIRROR_OF_OFFICIAL_MOT_FEED',
        queryTimestamp: requestTimestamp,
        timeWindow: `±${TIME_WINDOW_MINUTES} minutes`,
        searchRadiusMeters: BUS_AT_STATION_RADIUS_METERS,
      },

      // Fault ticket reference
      faultTicket: faultTicket ? {
        ticketId: faultTicket.ticketId,
        dbId: savedTicketId,
        ticketHash: faultTicket.ticketHash,
        createdAt: faultTicket.createdAt,
      } : null,

      timestamp: requestTimestamp,
    })

  } catch (error) {
    console.error('[validate-siri] Error:', error)

    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({
        success: false,
        error: 'API timeout',
        message: 'שרתי SIRI לא הגיבו בזמן. נסו שוב.',
        timestamp: requestTimestamp,
      }, { status: 504 })
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: requestTimestamp,
    }, { status: 500 })
  }
}
