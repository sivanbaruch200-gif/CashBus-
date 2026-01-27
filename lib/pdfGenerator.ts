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