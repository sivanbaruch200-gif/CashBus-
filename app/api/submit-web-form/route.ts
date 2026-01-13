/**
 * API Route: Web Form Automation
 *
 * Automates form submission to bus company websites (like Egged)
 * Uses Puppeteer for browser automation
 * Sends notification to Ministry via separate email
 */

import { NextRequest, NextResponse } from 'next/server'
import { MINISTRY_EMAIL } from '@/lib/legalSubmissions'

// TODO: Install Puppeteer: npm install puppeteer
// import puppeteer from 'puppeteer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      fullName,
      idNumber,
      phone,
      address,
      city,
      postalCode,
      companyName,
      formUrl,
      pdfUrl,
      submissionId,
      notifyMinistry,
    } = body

    // Validate required fields
    if (!fullName || !idNumber || !phone || !formUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: fullName, idNumber, phone, formUrl' },
        { status: 400 }
      )
    }

    // TODO: Implement actual Puppeteer automation
    /*
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()

    try {
      // Navigate to form
      await page.goto(formUrl, { waitUntil: 'networkidle2' })

      // Fill form fields (selectors are company-specific)
      // Example for Egged form:
      await page.type('#name', fullName)
      await page.type('#id', idNumber)
      await page.type('#phone', phone)
      await page.type('#address', `${address}, ${city}`)

      // Upload PDF if supported
      const fileInput = await page.$('input[type="file"]')
      if (fileInput && pdfUrl) {
        // Download PDF locally first
        const pdfResponse = await fetch(pdfUrl)
        const pdfBuffer = await pdfResponse.arrayBuffer()
        const tempPath = `/tmp/legal-${submissionId}.pdf`
        await fs.writeFile(tempPath, Buffer.from(pdfBuffer))
        await fileInput.uploadFile(tempPath)
      }

      // Submit form
      await page.click('button[type="submit"]')

      // Wait for confirmation
      await page.waitForNavigation({ waitUntil: 'networkidle2' })

      // Extract confirmation number
      const confirmationNumber = await page.evaluate(() => {
        const el = document.querySelector('.confirmation-number')
        return el?.textContent || 'N/A'
      })

      // Take screenshot as proof
      const screenshot = await page.screenshot({ encoding: 'base64' })

      await browser.close()

      // Notify Ministry via email
      if (notifyMinistry) {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-legal-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: MINISTRY_EMAIL,
            subject: `דיווח אוטומטי: טופס תלונה ל${companyName}`,
            body: `
              נשלח טופס תלונה אוטומטי:
              שם: ${fullName}
              ת.ז: ${idNumber}
              חברה: ${companyName}
              מספר אישור: ${confirmationNumber}
            `,
            pdfUrl,
            submissionId,
          }),
        })
      }

      return NextResponse.json({
        success: true,
        confirmationNumber,
        screenshot,
        ministryNotified: notifyMinistry,
      })
    } finally {
      await browser.close()
    }
    */

    // TEMPORARY: Mock response for development
    console.log('🤖 MOCK WEB FORM SUBMISSION')
    console.log('Company:', companyName)
    console.log('Form URL:', formUrl)
    console.log('User:', fullName, idNumber)
    console.log('Ministry Notification:', notifyMinistry ? 'YES' : 'NO')

    // Simulate Ministry notification
    if (notifyMinistry) {
      console.log('📧 Sending notification to Ministry:', MINISTRY_EMAIL)
    }

    return NextResponse.json({
      success: true,
      confirmationNumber: `MOCK-${Date.now()}`,
      screenshot: 'base64_screenshot_data_here',
      ministryNotified: notifyMinistry,
      mock: true,
      note: 'Install Puppeteer to enable real form automation: npm install puppeteer',
    })
  } catch (error) {
    console.error('Error in web form automation:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Form submission failed',
      },
      { status: 500 }
    )
  }
}

/**
 * Configuration for API route
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
