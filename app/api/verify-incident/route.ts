/**
 * API Route: Verify Incident
 *
 * POST /api/verify-incident
 *
 * This endpoint verifies an incident by comparing user GPS with real-time bus data.
 * Called automatically when an incident is submitted or can be triggered manually.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyIncident, updateIncidentVerification, VerificationResult } from '@/lib/verificationService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      incidentId,
      userGpsLat,
      userGpsLng,
      userGpsAccuracy,
      busLine,
      busCompany,
      incidentType,
      incidentDatetime
    } = body

    // Validate required fields
    if (!incidentId || !userGpsLat || !userGpsLng || !busLine || !busCompany) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Run verification
    const result: VerificationResult = await verifyIncident({
      id: incidentId,
      user_gps_lat: parseFloat(userGpsLat),
      user_gps_lng: parseFloat(userGpsLng),
      user_gps_accuracy: userGpsAccuracy ? parseFloat(userGpsAccuracy) : undefined,
      bus_line: busLine,
      bus_company: busCompany,
      incident_type: incidentType || 'no_arrival',
      incident_datetime: incidentDatetime || new Date().toISOString()
    })

    // Update incident in database
    const updateSuccess = await updateIncidentVerification(incidentId, result)

    return NextResponse.json({
      success: true,
      verified: result.isVerified,
      verificationData: result.verificationData,
      databaseUpdated: updateSuccess
    })

  } catch (error) {
    console.error('Verification API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Verification failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint for checking verification status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const incidentId = searchParams.get('incidentId')

  if (!incidentId) {
    return NextResponse.json(
      { error: 'incidentId is required' },
      { status: 400 }
    )
  }

  try {
    // Import supabase here to avoid circular dependency
    const { supabase } = await import('@/lib/supabase')

    const { data, error } = await supabase
      .from('incidents')
      .select('verified, is_verified, verification_data, verification_timestamp, status')
      .eq('id', incidentId)
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      incidentId,
      verified: data.verified || data.is_verified,
      verificationData: data.verification_data,
      verificationTimestamp: data.verification_timestamp,
      status: data.status
    })

  } catch (error) {
    console.error('Get verification status error:', error)

    return NextResponse.json(
      { error: 'Failed to get verification status' },
      { status: 500 }
    )
  }
}
