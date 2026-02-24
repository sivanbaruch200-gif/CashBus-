import jsPDF from 'jspdf'
import { getBusCompanyName } from './compensation'

/**
 * Lawsuit Document Generator - כתב תביעה מוכן לנט-המשפט
 * Day 21 of reminder cycle
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
    `תביעה זו מוגשת נגד הנתבעת בגין נזקים שנגרמו לתובע עקב הפרת חוזה הובלה`,
    `והפרת חובה חקוקה, בניגוד לתקנות התעבורה ולתנאי הרישיון שניתן לנתבעת`,
    `להפעלת קווי תחבורה ציבורית.`,
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
    factsText = `1. ביום ${incidentDate}, קו ${data.busLine} של הנתבעת לא הגיע לתחנת "${data.stationName}".`
  } else if (data.incidentType === 'no_stop') {
    factsText = `1. ביום ${incidentDate}, אוטובוס של הנתבעת (קו ${data.busLine}) חלף על פני תחנת "${data.stationName}" מבלי לעצור, למרות שהתובע המתין בתחנה ואיתת לאוטובוס.`
  }

  const facts = [
    factsText,
    '',
    '2. האירוע תועד בזמן אמת באמצעות מערכת CashBus Legal-Tech:',
    `   • אימות מיקום GPS בדיוק של ${data.gpsAccuracy || '8-15'} מטרים`,
    data.siriVerified ? '   • אימות נתוני SIRI ממשרד התחבורה - האוטובוס לא נמצא במערכת' : '',
    `   • תיעוד צילומי של ${data.receipts?.length || 0} קבלות הוצאות`,
    '',
    `3. ביום ${new Date(data.initialLetterDate).toLocaleDateString('he-IL')}, נשלח לנתבעת מכתב התראה רשמי.`,
    '',
    `4. במהלך 21 ימים, נשלחו לנתבעת ${data.totalRemindersSent} מכתבי תזכורת.`,
    '',
    data.companyResponded
      ? '5. הנתבעת השיבה אך סירבה לשלם או לא הציעה פתרון סביר.'
      : '5. הנתבעת לא השיבה למכתבים ולא שילמה את הפיצוי הנדרש.',
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
    '5. הפרת חוזה הובלה - הנתבעת התחייבה להוביל את התובע ולא קיימה את התחייבותה.'
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

  currentY = addRTLText('ד. הנזקים', currentY, 13, 'bold')
  currentY += 2

  const damageTexts = [
    'כתוצאה מהפרת חוזה ההובלה על ידי הנתבעת, נגרמו לתובע הנזקים הבאים:',
    '',
    '1. הפרת חוזה הובלה ועוגמת נפש - רכישת כרטיס נסיעה מהווה חוזה מחייב',
    '   בין הנוסע למפעיל. אי-קיום התחייבות ההובלה מהווה הפרה יסודית של חוזה זה,',
    '   המזכה בפיצוי כספי בגין הנזקים שנגרמו.',
    '',
    '2. הוצאות ישירות - הוצאות נסיעה חלופיות, עלויות הגעה בדרכים חלופיות,',
    '   והוצאות נלוות שנגרמו כתוצאה ישירה מאי-הפעלת השירות כמתוכנן.',
    '',
    '3. אובדן זמן - הפסד זמן יקר ערך בשל ההמתנה לשווא, מציאת חלופת',
    '   נסיעה, והגעה באיחור ליעד.',
    '',
    '4. עוגמת נפש - מטרד, תסכול, אי-נוחות וטרחה שנגרמו לתובע כתוצאה',
    '   מכשל שירותי חוזר ונשנה של הנתבעת.',
    '',
    '(הסכום המדויק ייקבע על ידי התובע בעת הגשת התביעה בפועל)',
  ]

  damageTexts.forEach(text => {
    if (text === '') {
      currentY += 3
    } else {
      currentY = addRTLText(text, currentY, 10)
    }
  })
  currentY += 8

  // ============================================
  // SECTION 5: RELIEF
  // ============================================

  currentY = addRTLText('ה. הסעד המבוקש', currentY, 13, 'bold')
  currentY += 2

  const reliefTexts = [
    '1. לחייב את הנתבעת לשלם לתובע פיצוי כספי הולם בגין מלוא נזקיו',
    '   כמפורט בסעיף ד\' לעיל.',
    '',
    '2. לחייב את הנתבעת בהוצאות המשפט, לרבות אגרת בית משפט.',
    '',
    '3. לחייב את הנתבעת בפיצוי בגין עוגמת נפש.',
    '',
    '4. לחייב את הנתבעת בהפרשי הצמדה וריבית כחוק מיום האירוע ועד למועד',
    '   התשלום המלא בפועל.',
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
