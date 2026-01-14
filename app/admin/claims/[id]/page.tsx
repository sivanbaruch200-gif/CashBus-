'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  supabase,
  getIncidentForPDF,
  updateIncidentToClaimed,
  uploadPDFDocument,
  createDocumentGeneration,
  updateDocumentGenerationFile,
} from '@/lib/supabase'
import { calculateCompensation, getBusCompanyName } from '@/lib/compensation'
import {
  generateWarningLetterPDF,
  generateWarningLetterFilename,
  downloadPDF,
  type WarningLetterData
} from '@/lib/pdfGenerator'
import {
  ArrowRight,
  User,
  Building2,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle,
  FileText,
  Image as ImageIcon,
  Clock,
  Download,
  Loader2,
  Send,
  Mail,
} from 'lucide-react'

interface IncidentDetail {
  id: string
  user_id: string
  bus_line: string
  bus_company: string
  station_name: string
  user_gps_lat: number
  user_gps_lng: number
  incident_type: 'delay' | 'no_stop' | 'no_arrival'
  incident_datetime: string
  damage_type?: string
  damage_amount?: number
  damage_description?: string
  photo_urls?: string[]
  verified: boolean
  status: 'submitted' | 'verified' | 'rejected' | 'claimed'
  created_at: string
  // User data
  customer_name: string
  customer_phone: string
  customer_email: string
}

export default function ClaimDetailPage() {
  const router = useRouter()
  const params = useParams()
  const incidentId = params.id as string

  const [incident, setIncident] = useState<IncidentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [pdfGenerated, setPdfGenerated] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  useEffect(() => {
    if (incidentId) {
      loadIncidentDetails()
    }
  }, [incidentId])

  const loadIncidentDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select(`
          *,
          profiles!incidents_user_id_fkey (
            full_name,
            phone,
            email
          )
        `)
        .eq('id', incidentId)
        .single()

      if (error) throw error

      // Get user email from auth.users
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      const transformedData: IncidentDetail = {
        ...data,
        customer_name: data.profiles?.full_name || 'לא ידוע',
        customer_phone: data.profiles?.phone || 'לא ידוע',
        customer_email: user?.email || 'לא ידוע',
      }

      setIncident(transformedData)
      setLoading(false)
    } catch (error) {
      console.error('Error loading incident details:', error)
      setLoading(false)
    }
  }

  const calculateEstimatedCompensation = () => {
    if (!incident) return 0
    const result = calculateCompensation({
      incidentType: incident.incident_type,
      delayMinutes: 30,
      damageType: incident.damage_type as any,
      damageAmount: incident.damage_amount,
      busCompany: incident.bus_company,
    })
    return result.totalCompensation
  }

  const getIncidentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      delay: 'עיכוב',
      no_stop: 'לא עצר בתחנה',
      no_arrival: 'לא הגיע כלל',
    }
    return labels[type] || type
  }

  const getDamageTypeLabel = (type?: string) => {
    if (!type) return 'אין'
    const labels: Record<string, string> = {
      taxi_cost: 'הוצאות מונית',
      lost_workday: 'אובדן יום עבודה',
      missed_exam: 'החמצת בחינה',
      medical_appointment: 'החמצת תור לרופא',
      other: 'אחר',
    }
    return labels[type] || type
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const handleSendWarningEmail = async () => {
    if (!incident || !pdfUrl) {
      alert('נא ליצור מכתב התראה תחילה לפני השליחה במייל')
      return
    }

    setSendingEmail(true)
    setEmailError(null)

    try {
      // Get bus company email from database
      const { data: companyData } = await supabase
        .from('bus_companies')
        .select('public_contact_email')
        .eq('company_name', incident.bus_company)
        .single()

      const companyEmail = companyData?.public_contact_email

      if (!companyEmail) {
        throw new Error('לא נמצא כתובת מייל לחברת האוטובוסים')
      }

      // Send email via API
      const response = await fetch('/api/send-legal-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: companyEmail,
          bcc: 'Pniotcrm@mot.gov.il', // Ministry email
          subject: `דרישה לפיצוי - ${incident.customer_name} - תקנה 428ג`,
          body: `
לכבוד
${getBusCompanyName(incident.bus_company)}

הנדון: דרישה לפיצוי בגין הפרת חוזה הובלה - תקנה 428ג

שלום רב,

אני, ${incident.customer_name}, ת.ז. XXX, פונה/ת אליכם בדרישה לפיצוי בגין אירוע מתועד של הפרת התחייבויות שירות בקו ${incident.bus_line}.

האירוע המתועד: ${getIncidentTypeLabel(incident.incident_type)}
תאריך האירוע: ${formatDateTime(incident.incident_datetime)}
תחנה: ${incident.station_name}

בהתאם לתקנה 428ג לתקנות השירותים הציבוריים (אוטובוסים), חברת ההסעה נושאת באחריות להעניק פיצוי לנוסעים עבור הפרות כאלה.

סכום הפיצוי הנדרש: ${formatCurrency(calculateEstimatedCompensation())}

מצ"ב מכתב התראה מפורט עם כל הפרטים המשפטיים, תיעוד GPS, ותמונות.

אבקש את תשומת לבכם לטיפול בנושא זה בהקדם האפשרי. במידה ולא יתקבל מענה תוך 14 יום, נאלץ/אאלצה לפנות לבית המשפט לתביעות קטנות.

בברכה,
${incident.customer_name}
טלפון: ${incident.customer_phone}

---
מסמך זה נוצר באמצעות מערכת CashBus - פלטפורמת זכויות נוסעים
העתק לידיעה: משרד התחבורה (Pniotcrm@mot.gov.il)
          `.trim(),
          pdfUrl,
          submissionId: incident.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'שליחת המייל נכשלה')
      }

      const result = await response.json()

      setEmailSent(true)
      setSendingEmail(false)
      alert(`המכתב נשלח בהצלחה!\n\nנשלח ל: ${companyEmail}\nהעתק לידיעה: משרד התחבורה\nמזהה הודעה: ${result.messageId}`)
    } catch (error) {
      console.error('Error sending email:', error)
      setEmailError(error instanceof Error ? error.message : 'שגיאה בשליחת המייל')
      setSendingEmail(false)
    }
  }

  const handleGenerateWarningLetter = async () => {
    if (!incident) return

    setGeneratingPDF(true)
    setPdfError(null)

    try {
      // Calculate compensation
      const compensationResult = calculateCompensation({
        incidentType: incident.incident_type,
        delayMinutes: 30,
        damageType: incident.damage_type as any,
        damageAmount: incident.damage_amount,
        busCompany: incident.bus_company,
      })

      // Prepare data for PDF
      const pdfData: WarningLetterData = {
        incidentId: incident.id,
        incidentType: incident.incident_type,
        incidentDate: incident.incident_datetime,
        busLine: incident.bus_line,
        busCompany: incident.bus_company,
        stationName: incident.station_name,
        customerName: incident.customer_name,
        customerPhone: incident.customer_phone,
        damageType: incident.damage_type,
        damageAmount: incident.damage_amount,
        damageDescription: incident.damage_description,
        baseCompensation: compensationResult.baseCompensation,
        damageCompensation: compensationResult.damageCompensation,
        totalCompensation: compensationResult.totalCompensation,
        legalBasis: compensationResult.legalBasis,
      }

      // Generate PDF
      const pdfBlob = await generateWarningLetterPDF(pdfData)
      const filename = generateWarningLetterFilename(incident.customer_name, incident.id)

      // Create document generation record in database
      const docGeneration = await createDocumentGeneration(
        incident.id,
        'warning_letter',
        'default_warning_letter_template',
        pdfData
      )

      if (!docGeneration) {
        throw new Error('Failed to create document generation record')
      }

      // Upload to Supabase Storage
      const publicUrl = await uploadPDFDocument(pdfBlob, filename, 'legal_documents')

      // Update document generation with file info
      await updateDocumentGenerationFile(
        docGeneration.id,
        `legal_documents/${filename}`,
        publicUrl,
        pdfBlob.size
      )

      // Update incident status to 'claimed'
      await updateIncidentToClaimed(incident.id)

      // Also download to user's device
      downloadPDF(pdfBlob, filename)

      // Update local state
      setIncident({ ...incident, status: 'claimed' })
      setPdfUrl(publicUrl)
      setPdfGenerated(true)
      setGeneratingPDF(false)

      alert('מכתב ההתראה נוצר בהצלחה! הקובץ הורד למחשב שלך וגם נשמר במערכת.')
    } catch (error) {
      console.error('Error generating PDF:', error)
      setPdfError('שגיאה ביצירת מכתב ההתראה. אנא נסה שוב.')
      setGeneratingPDF(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">טוען פרטי תביעה...</p>
        </div>
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="p-6 lg:p-8">
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">תביעה לא נמצאה</h2>
          <p className="text-gray-600 mb-6">לא הצלחנו למצוא את התביעה המבוקשת</p>
          <button
            onClick={() => router.push('/admin/claims')}
            className="btn-primary"
          >
            חזרה לרשימת התביעות
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin/claims')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
          <span>חזרה לרשימת התביעות</span>
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">פרטי דיווח #{incident.id.slice(0, 8)}</h1>
            <p className="text-gray-600">ניהול ומעקב אחר דיווח לקוח</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleGenerateWarningLetter}
              disabled={generatingPDF || incident.status === 'claimed'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generatingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>מייצר מכתב...</span>
                </>
              ) : incident.status === 'claimed' ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>מכתב נוצר</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>יצא מכתב התראה</span>
                </>
              )}
            </button>

            {pdfUrl && (
              <>
                <button
                  onClick={handleSendWarningEmail}
                  disabled={sendingEmail || emailSent}
                  className="px-4 py-2 bg-primary-orange text-white rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>שולח מייל...</span>
                    </>
                  ) : emailSent ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>נשלח!</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>שלח למייל החברה</span>
                    </>
                  )}
                </button>

                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>הורד מכתב</span>
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Success/Error Notifications */}
      {pdfGenerated && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 mb-1">מכתב התראה נוצר בהצלחה!</h3>
              <p className="text-sm text-green-800 mb-2">
                המכתב המשפטי נשלח אוטומטית למחשב שלך ונשמר במערכת.
              </p>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-900 underline"
                >
                  <Download className="w-4 h-4" />
                  צפה או הורד שוב את המכתב
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {pdfError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-1">שגיאה ביצירת מכתב</h3>
              <p className="text-sm text-red-800">{pdfError}</p>
            </div>
            <button
              onClick={() => setPdfError(null)}
              className="text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {emailSent && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">המייל נשלח בהצלחה!</h3>
              <p className="text-sm text-blue-800">
                מכתב ההתראה נשלח לחברת האוטובוסים + העתק למשרד התחבורה (Pniotcrm@mot.gov.il)
              </p>
            </div>
          </div>
        </div>
      )}

      {emailError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-1">שגיאה בשליחת המייל</h3>
              <p className="text-sm text-red-800">{emailError}</p>
            </div>
            <button
              onClick={() => setEmailError(null)}
              className="text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Right Column - Customer Info */}
        <div className="space-y-6">
          {/* Customer Details */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary-orange" />
              פרטי לקוח
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">שם מלא</p>
                <p className="text-sm font-medium text-gray-900">{incident.customer_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">טלפון</p>
                <p className="text-sm font-medium text-gray-900">{incident.customer_phone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">אימייל</p>
                <p className="text-sm font-medium text-gray-900">{incident.customer_email}</p>
              </div>
            </div>
          </div>

          {/* Compensation */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-md border border-green-200 p-6">
            <h2 className="text-lg font-bold text-green-900 mb-2">פיצוי משוער</h2>
            <p className="text-4xl font-bold text-green-700 mb-2">
              {formatCurrency(calculateEstimatedCompensation())}
            </p>
            <p className="text-xs text-green-700">לפי תקנה 428ז</p>
          </div>

          {/* Status */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">סטטוס נוכחי</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">סטטוס</span>
                {incident.status === 'claimed' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3.5 h-3.5" />
                    נתבע
                  </span>
                ) : incident.verified ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <CheckCircle className="w-3.5 h-3.5" />
                    מאומת
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    <Clock className="w-3.5 h-3.5" />
                    ממתין לאימות
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">אימות GPS</span>
                {incident.verified ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <Clock className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Left Column - Incident Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Incident Information */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-orange" />
              פרטי האירוע
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">חברת אוטובוס</p>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <p className="text-sm font-medium text-gray-900">{getBusCompanyName(incident.bus_company)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">מספר קו</p>
                <p className="text-sm font-medium text-gray-900">{incident.bus_line}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">סוג אירוע</p>
                <p className="text-sm font-medium text-gray-900">{getIncidentTypeLabel(incident.incident_type)}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">תאריך ושעה</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <p className="text-sm font-medium text-gray-900">{formatDateTime(incident.incident_datetime)}</p>
                </div>
              </div>

              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-1">תחנה</p>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <p className="text-sm font-medium text-gray-900">{incident.station_name}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">קואורדינטות</p>
                <p className="text-xs font-mono text-gray-600">
                  {incident.user_gps_lat.toFixed(6)}, {incident.user_gps_lng.toFixed(6)}
                </p>
              </div>
            </div>
          </div>

          {/* Damage Information */}
          {incident.damage_type && (
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">פרטי נזק נוסף</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">סוג נזק</p>
                  <p className="text-sm font-medium text-gray-900">{getDamageTypeLabel(incident.damage_type)}</p>
                </div>

                {incident.damage_amount && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">סכום נזק</p>
                    <p className="text-sm font-semibold text-red-700">{formatCurrency(incident.damage_amount)}</p>
                  </div>
                )}

                {incident.damage_description && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">תיאור הנזק</p>
                    <p className="text-sm text-gray-900">{incident.damage_description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Photos */}
          {incident.photo_urls && incident.photo_urls.length > 0 && (
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary-orange" />
                תמונות מהאירוע
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {incident.photo_urls.map((url, index) => (
                  <div key={index} className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={url}
                      alt={`תמונה ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">פעולות זמינות</h2>
            <div className="grid grid-cols-2 gap-3">
              <button className="px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
                שלח מייל ללקוח
              </button>
              <button className="px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
                עדכן סטטוס
              </button>
              <button className="px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
                הוסף הערה
              </button>
              <button className="px-4 py-3 bg-red-50 border border-red-300 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium text-red-700">
                דחה תביעה
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
