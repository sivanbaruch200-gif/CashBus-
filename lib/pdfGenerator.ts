import jsPDF from 'jspdf'
import { supabase } from './supabase'

// ============================================
// Font Management
// ============================================

let hebrewFontBase64: string | null = null

/**
 * Load Noto Sans Hebrew font and register with jsPDF
 * Font is served from public/fonts/NotoSansHebrew-Regular.ttf
 */
async function loadHebrewFont(doc: jsPDF): Promise<boolean> {
  try {
    if (!hebrewFontBase64) {
      const response = await fetch('/fonts/NotoSansHebrew-Regular.ttf')
      if (!response.ok) {
        console.error('Failed to fetch Hebrew font:', response.status)
        return false
      }
      const buffer = await response.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      hebrewFontBase64 = btoa(binary)
    }

    doc.addFileToVFS('NotoSansHebrew-Regular.ttf', hebrewFontBase64)
    doc.addFont('NotoSansHebrew-Regular.ttf', 'NotoSansHebrew', 'normal')
    doc.setFont('NotoSansHebrew')
    return true
  } catch (err) {
    console.error('Error loading Hebrew font:', err)
    return false
  }
}

// ============================================
// RTL Text Processing
// ============================================

/**
 * Process text for RTL rendering in jsPDF.
 * jsPDF renders characters left-to-right, so Hebrew text must be reversed.
 * Numbers and Latin characters are re-reversed to preserve their LTR order.
 */
function processRTL(text: string): string {
  if (!text) return ''

  // Reverse entire string for RTL base direction
  const reversed = [...text].reverse().join('')

  // Re-reverse LTR sequences (numbers, Latin letters, formatting chars)
  return reversed.replace(/[a-zA-Z0-9₪$€,.\-+@\/\\]+/g, match =>
    [...match].reverse().join('')
  )
}

// ============================================
// Template Processing
// ============================================

function fillTemplate(template: string, data: any): string {
  let filled = template
  const mapping: Record<string, string> = {
    '{{full_name}}': data.customerName || '',
    '{{id_number}}': data.idNumber || '',
    '{{phone}}': data.phone || '',
    '{{address}}': data.address || '',
    '{{company_name}}': data.busCompany || '',
    '{{bus_line}}': data.busLine || '',
    '{{station_name}}': data.stationName || '',
    '{{incident_date}}': data.incidentDate || '',
    '{{incident_description}}': data.description || '',
    '{{scheduled_time}}': data.scheduledTime || '',
    '{{actual_time}}': data.actualTime || '',
    '{{base_compensation}}': data.baseCompensation?.toString() || '0',
    '{{damage_compensation}}': data.damageAmount?.toString() || '0',
    '{{total_compensation}}': data.totalAmount?.toString() || '0',
    '{{claim_id}}': data.incidentId?.slice(0, 8) || '',
    '{{today_date}}': new Date().toLocaleDateString('he-IL'),
    '{{court_city}}': data.courtCity || 'תל אביב',
    '{{initial_letter_date}}': data.initialLetterDate || '',
  }

  Object.entries(mapping).forEach(([tag, value]) => {
    filled = filled.replace(new RegExp(tag.replace(/[{}]/g, '\\$&'), 'g'), value)
  })

  return filled
}

// ============================================
// PDF Generation - Main Function
// ============================================

export async function generateLegalPDF(templateType: string, data: any): Promise<Blob> {
  // 1. Fetch template from DB
  const { data: templateData, error } = await supabase
    .from('letter_templates')
    .select('template_content')
    .eq('template_type', templateType)
    .single()

  if (error || !templateData) {
    console.error('Error fetching template:', error)
    throw new Error('לא נמצאה תבנית מתאימה במערכת')
  }

  const finalBody = fillTemplate(templateData.template_content, data)

  // 2. Create PDF
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })

  // 3. Load Hebrew font
  const fontLoaded = await loadHebrewFont(doc)
  if (!fontLoaded) {
    throw new Error('שגיאה בטעינת פונט עברי - לא ניתן ליצור PDF')
  }

  const pageWidth = doc.internal.pageSize.getWidth()   // 210mm
  const pageHeight = doc.internal.pageSize.getHeight()  // 297mm
  const margin = 20
  const contentWidth = pageWidth - margin * 2            // 170mm
  const maxY = pageHeight - 25                           // Space for footer

  let currentY = 20

  // --- Header ---
  doc.setFontSize(16)
  doc.text(processRTL('CashBus Legal Department'), pageWidth - margin, currentY, { align: 'right' })
  currentY += 8

  doc.setFontSize(10)
  doc.text(processRTL(new Date().toLocaleDateString('he-IL')), pageWidth - margin, currentY, { align: 'right' })
  currentY += 5

  // Separator line
  doc.setDrawColor(30, 41, 59)
  doc.setLineWidth(0.5)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 10

  // --- Content ---
  doc.setFontSize(11)
  const paragraphs = finalBody.split('\n')

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      currentY += 4
      continue
    }

    // Word-wrap long lines using jsPDF measurement
    const wrappedLines = doc.splitTextToSize(paragraph, contentWidth) as string[]

    for (const line of wrappedLines) {
      // Page overflow check
      if (currentY > maxY) {
        doc.addPage()
        doc.setFont('NotoSansHebrew')
        currentY = 20
      }

      doc.text(processRTL(line), pageWidth - margin, currentY, { align: 'right' })
      currentY += 6
    }
  }

  // --- Add footers to all pages ---
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('NotoSansHebrew')

    // Footer separator
    doc.setDrawColor(148, 163, 184)
    doc.setLineWidth(0.3)
    doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20)

    // Reference ID
    doc.setFontSize(8)
    const refText = data.incidentId ? `Ref: ${data.incidentId.slice(0, 8)}` : ''
    doc.text(refText, margin, pageHeight - 15)

    // Branding
    doc.text('CashBus Legal | legal@cashbuses.com | www.cashbuses.com', pageWidth - margin, pageHeight - 15, { align: 'right' })

    // Page number
    if (totalPages > 1) {
      doc.text(`${i} / ${totalPages}`, pageWidth / 2, pageHeight - 15, { align: 'center' })
    }
  }

  return doc.output('blob') as unknown as Blob
}

// ============================================
// Public API
// ============================================

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

export interface WarningLetterData {
  incidentId: string
  incidentType: 'delay' | 'no_stop' | 'no_arrival'
  incidentDate: string
  busLine: string
  busCompany: string
  stationName: string
  customerName: string
  customerPhone: string
  customerId: string
  baseCompensation: number
  damageCompensation: number
  totalCompensation: number
  legalBasis: string
}

export async function generateWarningLetterPDF(data: WarningLetterData): Promise<Blob> {
  const templateData = {
    incidentId: data.incidentId,
    customerName: data.customerName,
    idNumber: data.customerId,
    phone: data.customerPhone,
    busCompany: data.busCompany,
    busLine: data.busLine,
    stationName: data.stationName,
    incidentDate: new Date(data.incidentDate).toLocaleDateString('he-IL'),
    description: getIncidentTypeText(data.incidentType),
    baseCompensation: data.baseCompensation,
    damageAmount: data.damageCompensation,
    totalAmount: data.totalCompensation,
  }

  return await generateLegalPDF('initial_warning', templateData)
}

export function generateWarningLetterFilename(customerName: string, claimId: string): string {
  const date = new Date().toISOString().split('T')[0]
  const safeName = customerName.replace(/[^א-תa-zA-Z0-9]/g, '_')
  return `CashBus_Warning_${safeName}_${claimId.slice(0, 8)}_${date}.pdf`
}

function getIncidentTypeText(type: 'delay' | 'no_stop' | 'no_arrival'): string {
  switch (type) {
    case 'delay': return 'איחור בקו'
    case 'no_stop': return 'האוטובוס לא עצר בתחנה'
    case 'no_arrival': return 'האוטובוס לא הגיע'
    default: return 'תקלה בשירות'
  }
}
