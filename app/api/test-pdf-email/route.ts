/**
 * TEST ENDPOINT - Send test email with Hebrew PDF
 * DELETE THIS FILE AFTER TESTING
 *
 * Usage: GET /api/test-pdf-email?email=your@email.com
 */

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import jsPDF from 'jspdf'
import fs from 'fs'
import path from 'path'

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Missing RESEND_API_KEY')
  }
  return new Resend(process.env.RESEND_API_KEY)
}

/**
 * Process text for RTL rendering in jsPDF.
 * Reverses Hebrew text while keeping numbers/Latin in correct order.
 */
function processRTL(text: string): string {
  if (!text) return ''
  const reversed = [...text].reverse().join('')
  return reversed.replace(/[a-zA-Z0-9₪$€,.\-+@\/\\]+/g, match =>
    [...match].reverse().join('')
  )
}

function generateTestPDF(fontBase64: string): Buffer {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })

  // Load Hebrew font
  doc.addFileToVFS('NotoSansHebrew-Regular.ttf', fontBase64)
  doc.addFont('NotoSansHebrew-Regular.ttf', 'NotoSansHebrew', 'normal')
  doc.setFont('NotoSansHebrew')

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let y = 20

  // Header
  doc.setFontSize(16)
  doc.text(processRTL('CashBus Legal Department'), pageWidth - margin, y, { align: 'right' })
  y += 8

  doc.setFontSize(10)
  doc.text(processRTL('17.2.2026'), pageWidth - margin, y, { align: 'right' })
  y += 5

  // Separator
  doc.setDrawColor(30, 41, 59)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 10

  // Content - same as the template
  doc.setFontSize(11)
  const lines = [
    'לכבוד',
    'אגד תחבורה בע"מ',
    'מחלקת פניות הציבור',
    '',
    'הנדון: דרישה לפיצוי בגין אי-הפעלת שירות נסיעה - קו 480',
    '',
    'אני הח"מ, ישראל ישראלי, ת.ז. 123456789, פונה אליכם בדרישה לפיצוי כספי בהתאם לתקנות התעבורה (פיצוי בגין אי-הפעלת שירות נסיעה), התשפ"ג-2023 (תיקון 428ג).',
    '',
    'פרטי האירוע:',
    '- תאריך: 15.02.2026',
    '- קו: 480',
    '- תחנה: תחנה מרכזית תל אביב',
    '- מה שקרה: האוטובוס לא הגיע',
    '',
    'בהתאם לתקנות, הנני זכאי לפיצוי בסך 1,000 ש"ח.',
    '',
    'פירוט הפיצוי:',
    '- פיצוי בסיסי: 700 ש"ח',
    '- נזק נוסף: 300 ש"ח',
    '- סה"כ: 1,000 ש"ח',
    '',
    'הנני דורש כי תשלחו לי את הפיצוי המגיע לי תוך 21 יום מקבלת מכתב זה.',
    '',
    'לתשומת לבכם: אי-מענה תוך 21 יום יחשב כהסכמה לדרישה זו.',
    '',
    'בסיס משפטי:',
    'תקנות 399א, 428ג לתקנות התעבורה',
    'תק (י-ם) 5312/07 - פיצוי 2,000 ש"ח בגין איחור רכבת',
    '',
    'בכבוד רב,',
    'ישראל ישראלי',
    'תאריך: 17.2.2026',
    'מספר אסמכתא: TEST-001',
  ]

  const contentWidth = pageWidth - margin * 2

  for (const line of lines) {
    if (line === '') {
      y += 4
      continue
    }

    const wrappedLines = doc.splitTextToSize(line, contentWidth) as string[]
    for (const wl of wrappedLines) {
      if (y > 270) {
        doc.addPage()
        doc.setFont('NotoSansHebrew')
        y = 20
      }
      doc.text(processRTL(wl), pageWidth - margin, y, { align: 'right' })
      y += 6
    }
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.3)
  doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20)
  doc.setFontSize(8)
  doc.text('Ref: TEST-001', margin, pageHeight - 15)
  doc.text('CashBus Legal | legal@cashbuses.com | www.cashbuses.com', pageWidth - margin, pageHeight - 15, { align: 'right' })

  // Get as Buffer
  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')
    if (!email) {
      return NextResponse.json({ error: 'Missing email parameter. Use ?email=your@email.com' }, { status: 400 })
    }

    // Load font from filesystem
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansHebrew-Regular.ttf')
    if (!fs.existsSync(fontPath)) {
      return NextResponse.json({ error: 'Hebrew font not found at ' + fontPath }, { status: 500 })
    }

    const fontBuffer = fs.readFileSync(fontPath)
    const fontBase64 = fontBuffer.toString('base64')

    // Generate PDF
    const pdfBuffer = generateTestPDF(fontBase64)

    // Send email
    const { data, error } = await getResend().emails.send({
      from: 'CashBus Legal <legal@cashbuses.com>',
      to: [email],
      subject: 'בדיקת PDF עברית - CashBus Legal',
      html: `<!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head><meta charset="utf-8"></head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: Arial, sans-serif; direction: rtl;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #1e293b; color: white; padding: 20px 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 22px;">CashBus Legal</h1>
              <p style="margin: 5px 0 0 0; font-size: 13px; color: #94a3b8;">בדיקת PDF עברית</p>
            </div>
            <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="font-size: 15px; line-height: 1.8; color: #1e293b;">שלום,</p>
              <p style="font-size: 15px; line-height: 1.8; color: #1e293b;">זוהי בדיקת PDF עם פונט Noto Sans Hebrew.</p>
              <p style="font-size: 15px; line-height: 1.8; color: #1e293b;">ה-PDF המצורף אמור להכיל עברית קריאה עם מספרים תקינים.</p>
              <p style="font-size: 15px; line-height: 1.8; color: #1e293b;">בברכה,<br>צוות CashBus</p>
            </div>
            <div style="background-color: #f8fafc; padding: 15px 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">CashBus | legal@cashbuses.com | www.cashbuses.com</p>
            </div>
          </div>
        </body>
        </html>`,
      attachments: [
        {
          filename: 'CashBus_Test_Warning_Letter.pdf',
          content: pdfBuffer,
        },
      ],
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      messageId: data?.id,
      sentTo: email,
      message: 'Test email with Hebrew PDF sent! Check your inbox.',
    })
  } catch (error) {
    console.error('Test PDF email error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
