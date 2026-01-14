import jsPDF from 'jspdf'
import { calculateCompensation, getBusCompanyName } from './compensation'

/**
 * PDF Generator for Legal Warning Letters
 * Generates RTL Hebrew legal documents with proper formatting
 */

export interface WarningLetterData {
  // Incident details
  incidentId: string
  incidentType: 'delay' | 'no_stop' | 'no_arrival'
  incidentDate: string
  busLine: string
  busCompany: string
  stationName: string

  // Customer details
  customerName: string
  customerPhone: string
  customerAddress?: string
  customerId?: string

  // Damage details (optional)
  damageType?: string
  damageAmount?: number
  damageDescription?: string

  // Calculated compensation
  baseCompensation: number
  damageCompensation: number
  totalCompensation: number
  legalBasis: string
}

/**
 * Generate a legal warning letter PDF
 * Returns the PDF blob for upload or download
 */
export async function generateWarningLetterPDF(data: WarningLetterData): Promise<Blob> {
  // Create PDF in A4 format
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)

  let currentY = margin

  // Helper function to add RTL text (right-aligned)
  const addRTLText = (text: string, y: number, size: number = 12, style: 'normal' | 'bold' = 'normal', align: 'right' | 'center' = 'right') => {
    doc.setFontSize(size)
    if (style === 'bold') {
      doc.setFont('helvetica', 'bold')
    } else {
      doc.setFont('helvetica', 'normal')
    }

    const textWidth = doc.getTextWidth(text)
    const x = align === 'center' ? pageWidth / 2 : pageWidth - margin

    doc.text(text, x, y, { align })
    return y + (size * 0.5) // Return next Y position
  }

  // Helper function to add a divider line
  const addDivider = (y: number) => {
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    return y + 5
  }

  // ============================================
  // HEADER SECTION
  // ============================================

  // Logo area (placeholder - you can add actual logo later)
  doc.setFillColor(255, 140, 0) // Orange
  doc.rect(margin, currentY, 40, 15, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('CashBus', margin + 20, currentY + 10, { align: 'center' })

  // Company details (top right)
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Legal-Tech | CashBus Platform', pageWidth - margin, currentY + 5, { align: 'right' })
  doc.text('info@cashbus.co.il', pageWidth - margin, currentY + 9, { align: 'right' })
  doc.text('Tel: 03-1234567', pageWidth - margin, currentY + 13, { align: 'right' })

  currentY += 25
  currentY = addDivider(currentY)
  currentY += 5

  // ============================================
  // DOCUMENT TITLE
  // ============================================

  doc.setTextColor(0, 0, 0)
  currentY = addRTLText('מכתב התראה והודעה על הזדמנות אחרונה', currentY, 18, 'bold', 'center')
  currentY = addRTLText('לפי תקנה 428ג לתקנות השירותים הציבוריים (אוטובוסים), התשס"ט-2009', currentY, 10, 'normal', 'center')
  currentY = addRTLText('מודל ההתשה - צבירת אירועים רבים', currentY, 9, 'normal', 'center')
  currentY += 10

  // Date
  const today = new Date().toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  currentY = addRTLText(`תאריך: ${today}`, currentY, 10)
  currentY += 8

  // ============================================
  // ADDRESSEE SECTION
  // ============================================

  currentY = addRTLText('אל:', currentY, 12, 'bold')
  currentY += 2
  currentY = addRTLText(`חברת ${getBusCompanyName(data.busCompany)} בע"מ`, currentY, 11)
  currentY = addRTLText('מחלקת שירות לקוחות ותביעות', currentY, 11)
  currentY += 10

  currentY = addRTLText(`הנדון: תביעה לפיצוי בגין הפרת חוזה הובלה - תקנה 428ג (מודל ההתשה)`, currentY, 11, 'bold')
  currentY += 10

  // ============================================
  // SENDER DETAILS
  // ============================================

  currentY = addRTLText('פרטי הנוסע/ת:', currentY, 11, 'bold')
  currentY += 2
  currentY = addRTLText(`שם: ${data.customerName}`, currentY, 10)
  if (data.customerId) {
    currentY = addRTLText(`ת.ז.: ${data.customerId}`, currentY, 10)
  }
  currentY = addRTLText(`טלפון: ${data.customerPhone}`, currentY, 10)
  if (data.customerAddress) {
    currentY = addRTLText(`כתובת: ${data.customerAddress}`, currentY, 10)
  }
  currentY += 10

  // ============================================
  // INCIDENT DESCRIPTION
  // ============================================

  currentY = addRTLText('תיאור האירוע:', currentY, 11, 'bold')
  currentY += 2

  const incidentTypeText =
    data.incidentType === 'no_arrival' ? 'אוטובוס לא הגיע לתחנה' :
    data.incidentType === 'no_stop' ? 'אוטובוס לא עצר בתחנה למרות איתות' :
    'עיכוב משמעותי בהגעת האוטובוס'

  const incidentDate = new Date(data.incidentDate).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const incidentText = `ביום ${incidentDate}, בתחנת "${data.stationName}", `
  const incidentText2 = `התרחש אירוע של ${incidentTypeText} בקו ${data.busLine}.`

  currentY = addRTLText(incidentText, currentY, 10)
  currentY = addRTLText(incidentText2, currentY, 10)
  currentY += 5

  currentY = addRTLText('האירוע תועד ואומת באמצעות:', currentY, 10)
  currentY += 2
  currentY = addRTLText('• מערכת GPS של הנוסע/ת', currentY, 9)
  currentY = addRTLText('• נתוני SIRI בזמן אמת ממשרד התחבורה', currentY, 9)
  currentY = addRTLText('• תיעוד צילומי של המקרה', currentY, 9)
  currentY += 8

  // Damage details if applicable
  if (data.damageType && data.damageAmount) {
    currentY = addRTLText('נזקים נוספים שנגרמו:', currentY, 11, 'bold')
    currentY += 2

    const damageTypeHebrew =
      data.damageType === 'taxi_cost' ? 'הוצאות מונית' :
      data.damageType === 'lost_workday' ? 'אובדן יום עבודה' :
      data.damageType === 'missed_exam' ? 'החמצת בחינה' :
      data.damageType === 'medical_appointment' ? 'החמצת תור לרופא' :
      'נזק אחר'

    currentY = addRTLText(`סוג נזק: ${damageTypeHebrew}`, currentY, 10)
    currentY = addRTLText(`סכום: ${data.damageAmount} ₪`, currentY, 10)

    if (data.damageDescription) {
      currentY = addRTLText(`פירוט: ${data.damageDescription}`, currentY, 10)
    }
    currentY += 8
  }

  // ============================================
  // LEGAL BASIS - GYRO ATTRITION MODEL
  // ============================================

  currentY = addRTLText('הבסיס המשפטי לתביעה - מודל ההתשה:', currentY, 11, 'bold')
  currentY += 2

  const gyroTexts = [
    'תקנה 428ג קובעת כי חברת האוטובוסים מחויבת לספק שירות אמין ועקבי.',
    'צבירת אירועים רבים (עיכובים, אי-הגעות, אי-עצירות) מהווה הפרה מהותית',
    'של חוזה ההובלה ופוגעת באמון הציבורי במערכת התחבורה הציבורית.',
    '',
    'בניגוד לתביעה על אירוע בודד, מודל ההתשה מאפשר לנוסעים להגיש',
    'תביעה כוללת בגין מצטבר של אירועים שנתפסו כ"טיפה שהגדישה את הסאה".',
    '',
    'בסיס משפטי נוסף:',
    '• חוק הגנת הצרכן, התשמ"א-1981 - הגנה מפני שירות לקוי חוזר',
    '• תקנה 428ג - חובת אמינות ועקביות בשירות',
    '• פסיקות בית המשפט בנושא "התשה צרכנית" - ע"א 8745/14'
  ]

  gyroTexts.forEach(text => {
    if (text === '') {
      currentY += 2
    } else {
      currentY = addRTLText(text, currentY, 9)
    }
  })
  currentY += 8

  // ============================================
  // COMPENSATION CALCULATION
  // ============================================

  // Add box for compensation
  doc.setFillColor(255, 248, 240) // Light orange background
  doc.setDrawColor(255, 140, 0)
  doc.setLineWidth(1)
  doc.rect(margin, currentY, contentWidth, 42, 'FD')

  currentY += 7
  currentY = addRTLText('סכום הפיצוי המבוקש (מודל ההתשה):', currentY, 12, 'bold')
  currentY += 5

  currentY = addRTLText(`פיצוי בסיס (תקנה 428ג - מצטבר): ${data.baseCompensation} ₪`, currentY, 10)
  currentY = addRTLText('(מבוסס על צבירת אירועים רבים לאורך זמן)', currentY, 8)
  currentY += 2

  if (data.damageCompensation > 0) {
    currentY = addRTLText(`פיצוי בגין נזקים נוספים: ${data.damageCompensation} ₪`, currentY, 10)
    currentY += 2
    doc.setDrawColor(255, 140, 0)
    doc.setLineWidth(0.5)
    doc.line(pageWidth - margin - 80, currentY, pageWidth - margin - 10, currentY)
    currentY += 2
  }

  currentY += 2
  currentY = addRTLText(`סה"כ לתשלום: ${data.totalCompensation} ₪`, currentY, 14, 'bold')
  currentY += 10

  // ============================================
  // DEMAND FOR PAYMENT
  // ============================================

  currentY = addRTLText('דרישה לתשלום:', currentY, 11, 'bold')
  currentY += 2

  const demandTexts = [
    `אנו דורשים בזאת מחברתכם לשלם את סכום הפיצוי של ${data.totalCompensation} ₪`,
    'תוך 7 ימי עסקים ממועד קבלת מכתב זה.',
    '',
    'התשלום יבוצע באמצעות העברה בנקאית לחשבון הבנק של הנוסע/ת,',
    'או במזומן במשרדי החברה, לפי בחירת הנוסע/ת.'
  ]

  demandTexts.forEach(text => {
    if (text === '') {
      currentY += 3
    } else {
      currentY = addRTLText(text, currentY, 10)
    }
  })
  currentY += 10

  // ============================================
  // WARNING / NOTICE
  // ============================================

  // Warning box
  doc.setFillColor(255, 240, 240) // Light red background
  doc.setDrawColor(220, 53, 69)
  doc.setLineWidth(1)
  doc.rect(margin, currentY, contentWidth, 30, 'FD')

  currentY += 7
  doc.setTextColor(180, 40, 50)
  currentY = addRTLText('⚠ הודעה חשובה:', currentY, 11, 'bold')
  currentY += 2
  doc.setTextColor(0, 0, 0)

  const warningTexts = [
    'במידה ולא יתקבל תשלום או תגובה מטעמכם תוך המועד הנ"ל,',
    'נאלץ להגיש נגדכם תביעה משפטית בבית המשפט לתביעות קטנות,',
    'ללא כל הודעה נוספת. בהליך משפטי, החברה תחויב גם בהוצאות משפט.'
  ]

  warningTexts.forEach(text => {
    currentY = addRTLText(text, currentY, 9)
  })
  currentY += 12

  // ============================================
  // FOOTER
  // ============================================

  currentY = addRTLText('בכבוד רב,', currentY, 10)
  currentY += 10
  currentY = addRTLText(data.customerName, currentY, 11, 'bold')
  currentY += 3
  currentY = addRTLText('באמצעות פלטפורמת CashBus', currentY, 9)
  currentY += 15

  // Document reference
  doc.setTextColor(150, 150, 150)
  doc.setFontSize(8)
  doc.text(`מספר אסמכתא: ${data.incidentId.slice(0, 12)}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
  doc.text('מסמך זה הופק באופן אוטומטי על ידי מערכת CashBus', margin, pageHeight - 10)

  // Convert to blob
  const pdfBlob = doc.output('blob')
  return pdfBlob
}

/**
 * Download PDF to user's device
 */
export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate filename for warning letter
 */
export function generateWarningLetterFilename(customerName: string, incidentId: string): string {
  const date = new Date().toISOString().split('T')[0]
  const sanitizedName = customerName.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_')
  return `warning_letter_${sanitizedName}_${date}_${incidentId.slice(0, 8)}.pdf`
}
