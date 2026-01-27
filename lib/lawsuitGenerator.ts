import jsPDF from 'jspdf'
import { getBusCompanyName } from './compensation'

/**
 * Lawsuit Document Generator - כתב תביעה מוכן לנט-המשפט
 * Day 14 of GYRO Model
 */

export interface LawsuitData {
  // Claim details
  claimId: string
  claimAmount: number
  busCompany: string

  // Customer details
  customerName: string
  customerId: string // ת.ז
  customerPhone: string
  customerAddress: string
  customerCity: string
  customerPostalCode: string

  // Incident details
  incidentType: 'delay' | 'no_stop' | 'no_arrival'
  incidentDate: string
  busLine: string
  stationName: string

  // Damage breakdown
  baseCompensation: number // פיצוי בסיס + עגמת נפש
  damageCompensation: number // הוצאות בפועל (קבלות)
  legalFees: number // הוצאות משפט (calculated)
  totalAmount: number // סה"כ כולל הוצאות משפט

  // Evidence
  gpsAccuracy?: number
  siriVerified?: boolean
  receipts?: string[] // URLs

  // Legal timeline
  initialLetterDate: string
  totalRemindersSent: number
  companyResponded: boolean
}

/**
 * Generate a lawsuit filing document (כתב תביעה)
 * Ready for Net-Hamishpat system
 */
export async function generateLawsuitPDF(data: LawsuitData): Promise<Blob> {
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

  // Helper function to add RTL text
  const addRTLText = (text: string, y: number, size: number = 12, style: 'normal' | 'bold' = 'normal', align: 'right' | 'center' = 'right') => {
    doc.setFontSize(size)
    if (style === 'bold') {
      doc.setFont('helvetica', 'bold')
    } else {
      doc.setFont('helvetica', 'normal')
    }

    const x = align === 'center' ? pageWidth / 2 : pageWidth - margin
    doc.text(text, x, y, { align })
    return y + (size * 0.5)
  }

  const addDivider = (y: number) => {
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    return y + 5
  }

  // ============================================
  // HEADER - בית המשפט
  // ============================================

  doc.setTextColor(0, 0, 0)
  currentY = addRTLText('בבית המשפט לתביעות קטנות', currentY, 16, 'bold', 'center')
  currentY = addRTLText(`ב${data.customerCity || 'תל אביב-יפו'}`, currentY, 14, 'normal', 'center')
  currentY += 10
  currentY = addDivider(currentY)
  currentY += 5

  // ============================================
  // PARTIES
  // ============================================

  currentY = addRTLText('התובע:', currentY, 12, 'bold')
  currentY += 2
  currentY = addRTLText(data.customerName, currentY, 11)
  currentY = addRTLText(`ת.ז: ${data.customerId}`, currentY, 10)
  currentY = addRTLText(`כתובת: ${data.customerAddress}, ${data.customerCity}`, currentY, 10)
  currentY = addRTLText(`טלפון: ${data.customerPhone}`, currentY, 10)
  currentY += 8

  currentY = addRTLText('הנתבע:', currentY, 12, 'bold')
  currentY += 2
  currentY = addRTLText(`${getBusCompanyName(data.busCompany)} בע"מ`, currentY, 11)
  currentY = addRTLText('חברת תחבורה ציבורית', currentY, 10)
  currentY += 10

  // ============================================
  // DOCUMENT TITLE
  // ============================================

  // Title box
  doc.setFillColor(255, 248, 240)
  doc.setDrawColor(255, 140, 0)
  doc.setLineWidth(1)
  doc.rect(margin, currentY, contentWidth, 20, 'FD')

  currentY += 7
  currentY = addRTLText('כתב תביעה', currentY, 18, 'bold', 'center')
  currentY = addRTLText('לפי חוק תובענות קטנות, התשל"ו-1976', currentY, 10, 'normal', 'center')
  currentY += 8

  // ============================================
  // SECTION 1: INTRODUCTION
  // ============================================

  currentY = addRTLText('א. הקדמה', currentY, 13, 'bold')
  currentY += 2

  const introTexts = [
    `תביעה זו מוגשת נגד הנתבע בגין הפרת חובה חקוקה והפרת חוזה הובלה,`,
    `בהתאם לתקנות התעבורה ולפי חוק הגנת הצרכן, התשמ"א-1981.`,
    '',
    `סכום התביעה: ${data.totalAmount.toLocaleString()} ₪`,
  ]

  introTexts.forEach(text => {
    if (text === '') {
      currentY += 3
    } else {
      currentY = addRTLText(text, currentY, 10)
    }
  })
  currentY += 8

  // ============================================
  // SECTION 2: FACTS
  // ============================================

  currentY = addRTLText('ב. העובדות', currentY, 13, 'bold')
  currentY += 2

  const incidentDate = new Date(data.incidentDate).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  let factsText = ''
  if (data.incidentType === 'no_arrival' || data.incidentType === 'delay') {
    factsText = `1. ביום ${incidentDate}, קו ${data.busLine} של הנתבע לא הגיע לתחנת "${data.stationName}".`
  } else if (data.incidentType === 'no_stop') {
    factsText = `1. ביום ${incidentDate}, אוטובוס של הנתבע (קו ${data.busLine}) חלף על פני תחנת "${data.stationName}" מבלי לעצור, למרות שהתובע המתין בתחנה ואיתת לאוטובוס.`
  }

  const facts = [
    factsText,
    '',
    '2. האירוע תועד בזמן אמת באמצעות מערכת CashBus Legal-Tech:',
    `   • אימות מיקום GPS בדיוק של ${data.gpsAccuracy || '8-15'} מטרים`,
    data.siriVerified ? '   • אימות נתוני SIRI ממשרד התחבורה - האוטובוס לא נמצא במערכת' : '',
    `   • תיעוד צילומי של ${data.receipts?.length || 0} קבלות הוצאות`,
    '',
    `3. ביום ${new Date(data.initialLetterDate).toLocaleDateString('he-IL')}, נשלח לנתבע מכתב התראה רשמי.`,
    '',
    `4. במהלך 14 ימים, נשלחו לנתבע ${data.totalRemindersSent} מכתבי תזכורת (מודל ההתשה).`,
    '',
    data.companyResponded
      ? '5. הנתבע השיב אך סירב לשלם או לא הציע פתרון סביר.'
      : '5. הנתבע לא השיב למכתבים ולא שילם את הפיצוי הנדרש.',
  ].filter(Boolean)

  facts.forEach(text => {
    if (text === '') {
      currentY += 3
    } else {
      currentY = addRTLText(text, currentY, 9)
    }
  })
  currentY += 8

  // ============================================
  // SECTION 3: LEGAL BASIS
  // ============================================

  currentY = addRTLText('ג. הבסיס המשפטי', currentY, 13, 'bold')
  currentY += 2

  let legalBasisTexts: string[] = []

  if (data.incidentType === 'no_arrival' || data.incidentType === 'delay') {
    legalBasisTexts = [
      '1. תקנה 399(א) לתקנות התעבורה - חובת בעל הרישיון להפעיל שירות תקין וסדיר.',
      '',
      '2. תקנה 400(א) לתקנות התעבורה - חובת עמידה בלוחות הזמנים.',
      '',
      '3. על פי פסיקת בתי המשפט (ת"ק 32995-02-14), על חברת התחבורה לצפות שינויים',
      '   ולהיערך להם מראש. אין באיחור נהג או חוסר בכוח אדם כדי להוות הגנה חוקית.',
    ]
  } else if (data.incidentType === 'no_stop') {
    legalBasisTexts = [
      '1. תקנה 428(ג) לתקנות התעבורה - חובת עצירה בכל תחנה המפורטת ברישיון הקו.',
      '',
      '2. תקנה 385א לתקנות התעבורה - חובת המפעיל לספק שירות אמין.',
      '',
      '3. תקנה 430 לתקנות התעבורה - חובת העצירה בתחנות המיועדות.',
    ]
  }

  legalBasisTexts.push(
    '',
    '4. חוק הגנת הצרכן, התשמ"א-1981 - הגנה מפני שירות לקוי חוזר.',
    '',
    '5. הפרת חוזה הובלה - הנתבע התחייב להוביל את התובע ולא קיים את התחייבותו.'
  )

  legalBasisTexts.forEach(text => {
    if (text === '') {
      currentY += 2
    } else {
      currentY = addRTLText(text, currentY, 9)
    }
  })
  currentY += 8

  // ============================================
  // SECTION 4: DAMAGES
  // ============================================

  currentY = addRTLText('ד. פירוט הנזקים והפיצוי המבוקש', currentY, 13, 'bold')
  currentY += 2

  // Damages box
  doc.setFillColor(255, 248, 240)
  doc.setDrawColor(255, 140, 0)
  doc.setLineWidth(1)
  doc.rect(margin, currentY, contentWidth, 45, 'FD')

  currentY += 7
  currentY = addRTLText('1. הוצאות ישירות (קבלות):', currentY, 11, 'bold')
  currentY = addRTLText(`   נסיעה חלופית במונית + הוצאות נלוות: ${data.damageCompensation.toLocaleString()} ₪`, currentY, 10)
  currentY += 5

  currentY = addRTLText('2. פיצוי בסיס + עגמת נפש:', currentY, 11, 'bold')
  currentY = addRTLText(`   הפסד זמן (100 ש"ח/שעה) + עגמת נפש: ${data.baseCompensation.toLocaleString()} ₪`, currentY, 10)
  currentY += 5

  currentY = addRTLText('3. הוצאות משפט:', currentY, 11, 'bold')
  currentY = addRTLText(`   אגרות בית משפט + שכ"ט עו"ד: ${data.legalFees.toLocaleString()} ₪`, currentY, 10)
  currentY += 5

  doc.setDrawColor(255, 140, 0)
  doc.setLineWidth(0.5)
  doc.line(pageWidth - margin - 80, currentY, pageWidth - margin - 10, currentY)
  currentY += 3

  currentY = addRTLText(`סה"כ תביעה: ${data.totalAmount.toLocaleString()} ₪`, currentY, 14, 'bold')
  currentY += 10

  // ============================================
  // SECTION 5: RELIEF
  // ============================================

  currentY = addRTLText('ה. הסעד המבוקש', currentY, 13, 'bold')
  currentY += 2

  const reliefTexts = [
    `1. לחייב את הנתבע לשלם לתובע סך של ${data.totalAmount.toLocaleString()} ₪.`,
    '',
    '2. לחייב את הנתבע בהוצאות המשפט ובשכר טרחת עורך דין.',
    '',
    '3. לחייב את הנתבע בהפרשי הצמדה וריבית כחוק מיום הגשת התביעה ועד התשלום המלא בפועל.',
  ]

  reliefTexts.forEach(text => {
    if (text === '') {
      currentY += 3
    } else {
      currentY = addRTLText(text, currentY, 10)
    }
  })
  currentY += 10

  // ============================================
  // SECTION 6: EVIDENCE
  // ============================================

  currentY = addRTLText('ו. ראיות', currentY, 13, 'bold')
  currentY += 2

  const evidenceTexts = [
    '1. תיעוד GPS ממערכת CashBus (כולל חותמת זמן ומיקום מדויק)',
    data.siriVerified ? '2. נתוני SIRI ממשרד התחבורה (אימות דיגיטלי)' : '',
    `3. ${data.receipts?.length || 0} קבלות הוצאות (צילומים דיגיטליים)`,
    `4. ${data.totalRemindersSent} מכתבי התראה שנשלחו לנתבע`,
    '5. תיעוד צילומי של האירוע',
  ].filter(Boolean)

  evidenceTexts.forEach(text => {
    currentY = addRTLText(text, currentY, 9)
  })
  currentY += 10

  // ============================================
  // SIGNATURE
  // ============================================

  const today = new Date().toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  currentY = addRTLText(`תאריך: ${today}`, currentY, 10)
  currentY += 8
  currentY = addRTLText('_________________', currentY, 10)
  currentY = addRTLText('חתימת התובע', currentY, 9)
  currentY += 15

  // ============================================
  // FOOTER
  // ============================================

  doc.setTextColor(150, 150, 150)
  doc.setFontSize(8)
  doc.text(`מספר תביעה: ${data.claimId.slice(0, 12)}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
  doc.text('מסמך זה הופק באופן אוטומטי על ידי מערכת CashBus | מוכן להגשה בנט-המשפט', margin, pageHeight - 10)

  const pdfBlob = doc.output('blob')
  return pdfBlob
}

/**
 * Generate filename for lawsuit document
 */
export function generateLawsuitFilename(customerName: string, claimId: string): string {
  const date = new Date().toISOString().split('T')[0]
  const sanitizedName = customerName.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_')
  return `lawsuit_${sanitizedName}_${date}_${claimId.slice(0, 8)}.pdf`
}
