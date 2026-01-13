/**
 * API Route: SIRI Proxy with Static IP
 *
 * POST /api/siri-proxy
 *
 * This endpoint proxies requests to the Ministry of Transportation SIRI API
 * through a static IP address (Quotaguard) for whitelisting purposes.
 *
 * SETUP REQUIRED:
 * 1. Sign up at quotaguard.com (free tier available)
 * 2. Add QUOTAGUARD_URL to Vercel environment variables
 * 3. Send the static IP to Ministry of Transportation for whitelisting
 */

import { NextRequest, NextResponse } from 'next/server'
import { HttpsProxyAgent } from 'https-proxy-agent'

// Ministry of Transportation SIRI API endpoint
const MOT_SIRI_API = 'https://siri.motrealtime.co.il:8443/siri/sm/r'

export async function POST(request: NextRequest) {
  const requestTimestamp = new Date().toISOString()

  try {
    const body = await request.json()
    const { stopCode, lineRef, operatorRef } = body

    if (!stopCode) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: stopCode',
        timestamp: requestTimestamp
      }, { status: 400 })
    }

    // Get proxy URL from environment variable
    const proxyUrl = process.env.QUOTAGUARD_URL

    if (!proxyUrl) {
      console.error('QUOTAGUARD_URL not configured')
      return NextResponse.json({
        success: false,
        error: 'Proxy not configured',
        errorCode: 'PROXY_NOT_CONFIGURED',
        message: 'Static IP proxy is not set up. Please configure QUOTAGUARD_URL.',
        timestamp: requestTimestamp
      }, { status: 500 })
    }

    // Build SIRI request XML
    const siriRequestXml = buildSiriRequest(stopCode, lineRef, operatorRef)

    // Create proxy agent for static IP
    const proxyAgent = new HttpsProxyAgent(proxyUrl)

    // Make request through proxy
    const siriResponse = await fetch(MOT_SIRI_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml'
      },
      body: siriRequestXml,
      // @ts-ignore - Node.js fetch supports agent
      agent: proxyAgent,
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })

    if (!siriResponse.ok) {
      const errorText = await siriResponse.text()
      console.error('SIRI API error:', siriResponse.status, errorText)

      return NextResponse.json({
        success: false,
        error: 'SIRI API request failed',
        errorCode: 'SIRI_API_ERROR',
        httpStatus: siriResponse.status,
        timestamp: requestTimestamp
      }, { status: 502 })
    }

    const siriXml = await siriResponse.text()

    // Parse XML response (you may want to add xml2js for proper parsing)
    return NextResponse.json({
      success: true,
      data: siriXml,
      dataFormat: 'xml',
      timestamp: requestTimestamp,
      proxyUsed: true,
      dataSource: 'Ministry of Transportation SIRI API'
    })

  } catch (error) {
    console.error('SIRI proxy error:', error)

    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({
        success: false,
        error: 'SIRI API timeout',
        errorCode: 'SIRI_TIMEOUT',
        message: 'שרת ה-SIRI לא הגיב בזמן. נסו שוב.',
        timestamp: requestTimestamp
      }, { status: 504 })
    }

    return NextResponse.json({
      success: false,
      error: 'SIRI proxy failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: requestTimestamp
    }, { status: 500 })
  }
}

/**
 * Build SIRI StopMonitoring request XML
 */
function buildSiriRequest(
  stopCode: string,
  lineRef?: string,
  operatorRef?: string
): string {
  const timestamp = new Date().toISOString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<Siri xmlns="http://www.siri.org.uk/siri" version="2.0">
  <ServiceRequest>
    <RequestTimestamp>${timestamp}</RequestTimestamp>
    <RequestorRef>CashBus</RequestorRef>
    <StopMonitoringRequest version="2.0">
      <RequestTimestamp>${timestamp}</RequestTimestamp>
      <MonitoringRef>${stopCode}</MonitoringRef>
      ${lineRef ? `<LineRef>${lineRef}</LineRef>` : ''}
      ${operatorRef ? `<OperatorRef>${operatorRef}</OperatorRef>` : ''}
      <MaximumStopVisits>10</MaximumStopVisits>
    </StopMonitoringRequest>
  </ServiceRequest>
</Siri>`
}
