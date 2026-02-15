import jsPDF from 'jspdf'
import { supabase } from './supabase'

/**
 * פונקציה להחלפת תגיות בטקסט בנתונים אמיתיים
 */
function fillTemplate(template: string, data: any) {
  let filled = template;
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
    '{{initial_letter_date}}': data.initialLetterDate || ''
  };

  Object.entries(mapping).forEach(([tag, value]) => {
    filled = filled.replace(new RegExp(tag.replace(/[{}]/g, '\\$&'), 'g'), value);
  });

  return filled;
}

/**
 * מחולל PDF ראשי התומך בתבניות מה-DB
 */
export async function generateLegalPDF(templateType: string, data: any) {
  // 1. משיכת התבנית מהדטאבייס
  const { data: templateData, error } = await supabase
    .from('letter_templates')
    .select('template_content')
    .eq('template_type', templateType)
    .single();

  if (error || !templateData) {
    console.error('Error fetching template:', error);
    throw new Error('לא נמצאה תבנית מתאימה במערכת');
  }

  const finalBody = fillTemplate(templateData.template_content, data);

  // 2. יצירת ה-PDF
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  // הוספת פונטים ותמיכה בעברית (בהנחה שהגדרתם פונט שתומך בעברית ב-jsPDF)
  // הערה: אם העברית יוצאת הפוכה, נצטרך להשתמש בפונקציית היפוך
  const reverseHe = (text: string) => text.split('').reverse().join('');

  doc.setFontSize(12);
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 30;

  // כתיבת הטקסט ל-PDF (שורה אחרי שורה)
  const lines = doc.splitTextToSize(finalBody, pageWidth - margin * 2);
  lines.forEach((line: string) => {
    // ב-jsPDF רגיל ללא פלאגין RTL, נצטרך להצמיד לימין
    doc.text(line, pageWidth - margin, currentY, { align: 'right' });
    currentY += 7;
  });

  return doc.output('blob');
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Type for warning letter data
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

/**
 * Generate warning letter PDF - uses the 'demand' template
 */
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
    totalAmount: data.totalCompensation
  }

  return generateLegalPDF('demand', templateData)
}

/**
 * Generate filename for warning letter
 */
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