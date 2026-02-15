'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  supabase,
  updateIncidentToClaimed,
  adminUpdateIncidentStatus,
  adminMarkIncidentPaid,
} from '@/lib/supabase'
import { calculateCompensation, getBusCompanyName } from '@/lib/compensation'
import {
  generateLegalPDF,
  downloadPDF,
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
  XCircle,
  DollarSign,
  Shield,
  Banknote,
  Gavel,
  Scale,
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
  status: 'submitted' | 'verified' | 'rejected' | 'claimed' | 'paid'
  created_at: string
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_id: string
}

export default function ClaimDetailPage() {
  const router = useRouter()
  const params = useParams()
  const incidentId = params.id as string

  const [incident, setIncident] = useState<IncidentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')

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
          profiles:user_id (
            full_name,
            phone,
            email,
            id_number
          )
        `)
        .eq('id', incidentId)
        .single()

      if (error) throw error

      const transformedData: IncidentDetail = {
        ...data,
        customer_name: data.profiles?.full_name || 'לא ידוע',
        customer_phone: data.profiles?.phone || 'לא ידוע',
        customer_email: data.profiles?.email || 'לא ידוע',
        customer_id: data.profiles?.id_number || '000000000',
      }

      setIncident(transformedData)
      setLoading(false)
    } catch (error) {
      console.error('Error loading incident details:', error)
      setLoading(false)
    }
  }

  const handleGenerateLetter = async (type: 'demand' | 'warning' | 'lawsuit') => {
    if (!incident) return
    setGeneratingPDF(type)

    try {
      const comp = calculateCompensation({
        incidentType: incident.incident_type,
        delayMinutes: 30,
        damageType: incident.damage_type as any,
        damageAmount: incident.damage_amount,
        busCompany: incident.bus_company,
      })

      const customerData = {
        incidentId: incident.id,
        customerName: incident.customer_name,
        idNumber: incident.customer_id,
        phone: incident.customer_phone,
        busCompany: getBusCompanyName(incident.bus_company),
        busLine: incident.bus_line,
        stationName: incident.station_name,
        incidentDate: new Date(incident.incident_datetime).toLocaleDateString('he-IL'),
        description: incident.damage_description || 'אי ביצוע עצירה/איחור בקו',
        baseCompensation: comp.baseCompensation,
        damageAmount: incident.damage_amount || 0,
        totalAmount: comp.totalCompensation
      }

      const pdfBlob = await generateLegalPDF(type, customerData)
      const filename = `CashBus_${type}_${incident.customer_name}.pdf`
      
      downloadPDF(pdfBlob, filename)
      
      setStatusUpdateSuccess(`מכתב ${type === 'demand' ? 'דרישה' : type === 'warning' ? 'התראה' : 'טיוטת תביעה'} הופק בהצלחה!`)
    } catch (error) {
      alert('שגיאה ביצירת ה-PDF')
    } finally {
      setGeneratingPDF(null)
    }
  }

  const handleMarkAsPaid = async () => {
    if (!incident || !paymentAmount) return
    setUpdatingStatus(true)
    try {
      await adminMarkIncidentPaid(incident.id, parseFloat(paymentAmount))
      setShowPaymentModal(false)
      setStatusUpdateSuccess('התשלום נרשם בהצלחה!')
      loadIncidentDetails()
    } catch (error) {
      alert('שגיאה ברישום התשלום')
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) return <div className="p-20 text-center text-content-tertiary">טוען נתונים...</div>
  if (!incident) return <div className="p-20 text-center text-status-rejected">תביעה לא נמצאה</div>

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto rtl" dir="rtl">
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <button onClick={() => router.push('/admin/claims')} className="flex items-center gap-2 text-content-tertiary hover:text-content-primary mb-2 transition-colors">
            <ArrowRight className="w-4 h-4" /> חזרה לרשימה
          </button>
          <h1 className="text-3xl font-bold text-content-primary">תיק תביעה: {incident.customer_name}</h1>
        </div>
        <div className="flex gap-2">
           <span className={`px-4 py-2 rounded-full text-sm font-bold ${incident.status === 'paid' ? 'status-badge-approved' : 'status-badge-pending'}`}>
             סטטוס: {incident.status}
           </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* עמודה ימנית - פעולות משפטיות */}
        <div className="md:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-content-primary">
              <Scale className="w-6 h-6 text-accent" /> שלבי הטיפול המשפטי
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {/* מכתב דרישה */}
              <button 
                onClick={() => handleGenerateLetter('demand')}
                disabled={!!generatingPDF}
                className="flex items-center justify-between p-4 border border-surface-border rounded-lg hover:bg-surface-border transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-surface-overlay p-2 rounded-full text-status-legal"><FileText /></div>
                  <div className="text-right">
                    <p className="font-bold text-content-primary">שלב א': מכתב דרישה ראשוני</p>
                    <p className="text-xs text-content-tertiary">שליחה לחברה בבקשה לפיצוי לפי תקנה 428</p>
                  </div>
                </div>
                {generatingPDF === 'demand' ? <Loader2 className="animate-spin" /> : <Download className="w-5 h-5 text-content-tertiary" />}
              </button>

              {/* מכתב התראה */}
              <button 
                onClick={() => handleGenerateLetter('warning')}
                disabled={!!generatingPDF}
                className="flex items-center justify-between p-4 border border-surface-border rounded-lg hover:bg-surface-border"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-status-pending-surface p-2 rounded-full text-status-pending"><AlertCircle /></div>
                  <div className="text-right">
                    <p className="font-bold text-content-primary">שלב ב': מכתב התראה לפני תביעה</p>
                    <p className="text-xs text-content-tertiary">נשלח לאחר 14 יום ללא מענה מחברת האוטובוסים</p>
                  </div>
                </div>
                {generatingPDF === 'warning' ? <Loader2 className="animate-spin" /> : <Download className="w-5 h-5 text-content-tertiary" />}
              </button>

              {/* טיוטת כתב תביעה */}
              <button 
                onClick={() => handleGenerateLetter('lawsuit')}
                disabled={!!generatingPDF}
                className="flex items-center justify-between p-4 border border-surface-border rounded-lg hover:bg-surface-border"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-status-rejected-surface p-2 rounded-full text-status-rejected"><Gavel /></div>
                  <div className="text-right">
                    <p className="font-bold text-content-primary">שלב ג': טיוטת כתב תביעה</p>
                    <p className="text-xs text-content-tertiary">מוכן להגשה לבית המשפט לתביעות קטנות</p>
                  </div>
                </div>
                {generatingPDF === 'lawsuit' ? <Loader2 className="animate-spin" /> : <Download className="w-5 h-5 text-content-tertiary" />}
              </button>
            </div>
          </div>

          {/* פרטי האירוע */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4 text-content-primary">פרטי האירוע</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-surface-overlay p-3 rounded">
                <p className="text-content-tertiary">חברה</p>
                <p className="font-bold text-content-primary">{getBusCompanyName(incident.bus_company)}</p>
              </div>
              <div className="bg-surface-overlay p-3 rounded">
                <p className="text-content-tertiary">קו</p>
                <p className="font-bold text-content-primary">{incident.bus_line}</p>
              </div>
              <div className="bg-surface-overlay p-3 rounded">
                <p className="text-content-tertiary">תחנה</p>
                <p className="font-bold text-content-primary">{incident.station_name}</p>
              </div>
              <div className="bg-surface-overlay p-3 rounded">
                <p className="text-content-tertiary">זמן</p>
                <p className="font-bold text-content-primary">{new Date(incident.incident_datetime).toLocaleString('he-IL')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* עמודה שמאלית - פרטי לקוח וכספים */}
        <div className="space-y-6">
          <div className="bg-surface-raised text-content-primary p-6 rounded-xl shadow-glass border border-surface-border">
            <h3 className="text-lg font-bold mb-4">סיכום פיצוי</h3>
            <div className="flex justify-between items-end mb-4">
              <span className="text-content-secondary">סכום מוערך:</span>
              <span className="text-3xl font-bold text-accent">₪{calculateCompensation({
                incidentType: incident.incident_type,
                delayMinutes: 30,
                busCompany: incident.bus_company
              }).totalCompensation}</span>
            </div>
            <button 
              onClick={() => setShowPaymentModal(true)}
              className="w-full py-3 bg-status-approved hover:bg-opacity-90 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
            >
              <Banknote className="w-5 h-5" /> סמן כהתקבל תשלום
            </button>
          </div>

          <div className="card">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-content-primary"><User className="w-4 h-4 text-accent" /> פרטי הלקוח</h3>
            <div className="space-y-2 text-sm text-content-secondary">
              <p><span className="text-content-tertiary">טלפון:</span> {incident.customer_phone}</p>
              <p><span className="text-content-tertiary">מייל:</span> {incident.customer_email}</p>
              <p><span className="text-content-tertiary">ת.ז:</span> {incident.customer_id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-surface-raised p-6 rounded-xl shadow-glass max-w-md w-full mx-4 border border-surface-border" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-content-primary">
              <Banknote className="w-6 h-6 text-status-approved" /> רישום תשלום
            </h3>
            <p className="text-content-secondary mb-4">הזן את סכום הפיצוי שהתקבל בפועל:</p>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="סכום ב-₪"
              className="input-field mb-4 text-lg"
            />
            <div className="flex gap-3">
              <button
                onClick={handleMarkAsPaid}
                disabled={updatingStatus || !paymentAmount}
                className="flex-1 py-3 bg-status-approved hover:bg-opacity-90 text-white rounded-lg font-bold disabled:opacity-50"
              >
                {updatingStatus ? <Loader2 className="animate-spin mx-auto" /> : 'אשר תשלום'}
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-6 py-3 border border-surface-border text-content-secondary rounded-lg hover:bg-surface-overlay"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}