'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  supabase,
  updateIncidentToClaimed,
  adminUpdateIncidentStatus,
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
  ArrowDownUp,
  CreditCard,
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

interface ClaimPaymentInfo {
  incoming_payment_amount?: number
  incoming_payment_date?: string
  customer_payout_amount?: number
  customer_payout_completed?: boolean
  customer_payout_date?: string
  customer_payout_reference?: string
  cashbus_commission_amount?: number
}

interface IncomingPayment {
  id: string
  amount: number
  commission_amount: number
  customer_payout: number
  customer_payout_status: string
  customer_payout_reference?: string
  reference_number?: string
  received_date: string
  notes?: string
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

  // Payment flow state
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentStep, setPaymentStep] = useState<'record' | 'split' | 'payout'>('record')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentSource, setPaymentSource] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [payoutReference, setPayoutReference] = useState('')
  const [claimPayment, setClaimPayment] = useState<ClaimPaymentInfo | null>(null)
  const [incomingPayment, setIncomingPayment] = useState<IncomingPayment | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    if (incidentId) {
      loadIncidentDetails()
      loadCurrentUser()
    }
  }, [incidentId])

  const loadCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      setCurrentUserId(session.user.id)
      setAccessToken(session.access_token)
    }
  }

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

      // Load claim payment info if exists
      await loadClaimPaymentInfo(data.id)

      setLoading(false)
    } catch (error) {
      console.error('Error loading incident details:', error)
      setLoading(false)
    }
  }

  const loadClaimPaymentInfo = async (incidentId: string) => {
    try {
      // Find claim for this incident
      const { data: claims } = await supabase
        .from('claims')
        .select('id, incoming_payment_amount, incoming_payment_date, customer_payout_amount, customer_payout_completed, customer_payout_date, customer_payout_reference, cashbus_commission_amount')
        .contains('incident_ids', [incidentId])
        .limit(1)

      if (claims && claims.length > 0) {
        setClaimPayment(claims[0])

        // Load incoming payment details
        if (claims[0].incoming_payment_amount) {
          const { data: payments } = await supabase
            .from('incoming_payments')
            .select('*')
            .eq('claim_id', claims[0].id)
            .order('created_at', { ascending: false })
            .limit(1)

          if (payments && payments.length > 0) {
            setIncomingPayment(payments[0])
          }
        }
      }
    } catch (error) {
      console.error('Error loading payment info:', error)
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

  const handleRecordPayment = async () => {
    if (!incident || !paymentAmount || !currentUserId || !accessToken) return
    setUpdatingStatus(true)

    try {
      const response = await fetch('/api/admin/record-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          claimId: incident.id,
          amount: parseFloat(paymentAmount),
          paymentSource: paymentSource || undefined,
          referenceNumber: paymentReference || undefined,
          notes: paymentNotes || undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        // If claim doesn't exist, record directly on incident
        if (result.error === 'Claim not found') {
          // Try to find claim by incident
          const { data: claims } = await supabase
            .from('claims')
            .select('id')
            .contains('incident_ids', [incident.id])
            .limit(1)

          if (!claims || claims.length === 0) {
            alert('לא נמצאה תביעה עבור אירוע זה. יש ליצור תביעה קודם.')
            return
          }

          // Retry with the actual claim ID
          const retryResponse = await fetch('/api/admin/record-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              claimId: claims[0].id,
              amount: parseFloat(paymentAmount),
              paymentSource: paymentSource || undefined,
              referenceNumber: paymentReference || undefined,
              notes: paymentNotes || undefined,
            }),
          })

          const retryResult = await retryResponse.json()
          if (!retryResponse.ok) {
            throw new Error(retryResult.error || 'שגיאה ברישום התשלום')
          }
        } else {
          throw new Error(result.error || 'שגיאה ברישום התשלום')
        }
      }

      setPaymentStep('split')
      setStatusUpdateSuccess('התשלום נרשם בהצלחה!')
      await loadIncidentDetails()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'שגיאה ברישום התשלום')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleConfirmPayout = async () => {
    if (!incomingPayment || !payoutReference || !currentUserId || !accessToken) return
    setUpdatingStatus(true)

    try {
      // Find claim ID
      const { data: claims } = await supabase
        .from('claims')
        .select('id')
        .contains('incident_ids', [incidentId])
        .limit(1)

      if (!claims || claims.length === 0) {
        throw new Error('Claim not found')
      }

      const response = await fetch('/api/admin/confirm-payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          claimId: claims[0].id,
          paymentId: incomingPayment.id,
          reference: payoutReference,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'שגיאה באישור ההעברה')
      }

      setShowPaymentModal(false)
      setStatusUpdateSuccess('ההעברה ללקוח אושרה בהצלחה!')
      await loadIncidentDetails()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'שגיאה באישור ההעברה')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const openPaymentModal = () => {
    if (claimPayment?.incoming_payment_amount && !claimPayment?.customer_payout_completed) {
      setPaymentStep('payout')
    } else if (claimPayment?.customer_payout_completed) {
      return // Everything done
    } else {
      setPaymentStep('record')
    }
    setShowPaymentModal(true)
  }

  if (loading) return <div className="p-20 text-center text-content-tertiary">טוען נתונים...</div>
  if (!incident) return <div className="p-20 text-center text-status-rejected">תביעה לא נמצאה</div>

  const amount = parseFloat(paymentAmount) || 0
  const commissionPreview = Math.round(amount * 0.20 * 100) / 100
  const payoutPreview = Math.round(amount * 0.80 * 100) / 100

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

      {/* Status Update Success */}
      {statusUpdateSuccess && (
        <div className="mb-6 bg-status-approved-surface border border-status-approved/20 text-status-approved p-4 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span>{statusUpdateSuccess}</span>
          <button onClick={() => setStatusUpdateSuccess(null)} className="mr-auto text-content-tertiary hover:text-content-primary">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

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

          {/* Payment Status Card */}
          {claimPayment?.incoming_payment_amount && (
            <div className="card border-2 border-status-approved/30">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-content-primary">
                <ArrowDownUp className="w-6 h-6 text-status-approved" /> מצב תשלום (80/20)
              </h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-surface-overlay p-4 rounded-lg text-center">
                  <p className="text-xs text-content-tertiary mb-1">התקבל מהחברה</p>
                  <p className="text-xl font-bold text-content-primary">₪{claimPayment.incoming_payment_amount?.toLocaleString('he-IL')}</p>
                </div>
                <div className="bg-surface-overlay p-4 rounded-lg text-center">
                  <p className="text-xs text-content-tertiary mb-1">עמלת CashBus (20%)</p>
                  <p className="text-xl font-bold text-accent">₪{claimPayment.cashbus_commission_amount?.toLocaleString('he-IL')}</p>
                </div>
                <div className="bg-surface-overlay p-4 rounded-lg text-center">
                  <p className="text-xs text-content-tertiary mb-1">ללקוח (80%)</p>
                  <p className="text-xl font-bold text-status-approved">₪{claimPayment.customer_payout_amount?.toLocaleString('he-IL')}</p>
                </div>
              </div>

              {/* Payout status */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-surface-overlay">
                {claimPayment.customer_payout_completed ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-status-approved" />
                    <span className="text-status-approved font-semibold">הועבר ללקוח</span>
                    {claimPayment.customer_payout_reference && (
                      <span className="text-content-tertiary text-sm mr-2">| אסמכתא: {claimPayment.customer_payout_reference}</span>
                    )}
                    {claimPayment.customer_payout_date && (
                      <span className="text-content-tertiary text-sm mr-2">| {new Date(claimPayment.customer_payout_date).toLocaleDateString('he-IL')}</span>
                    )}
                  </>
                ) : (
                  <>
                    <Clock className="w-5 h-5 text-status-pending" />
                    <span className="text-status-pending font-semibold">ממתין להעברה ללקוח</span>
                    <button
                      onClick={() => { setPaymentStep('payout'); setShowPaymentModal(true) }}
                      className="mr-auto px-4 py-1.5 bg-status-approved text-white rounded-lg text-sm font-semibold hover:bg-opacity-90"
                    >
                      אשר העברה
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
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

            {claimPayment?.incoming_payment_amount ? (
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-content-tertiary">התקבל בפועל:</span>
                  <span className="font-bold text-status-approved">₪{claimPayment.incoming_payment_amount?.toLocaleString('he-IL')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-tertiary">עמלה (20%):</span>
                  <span className="font-bold text-accent">₪{claimPayment.cashbus_commission_amount?.toLocaleString('he-IL')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-tertiary">ללקוח (80%):</span>
                  <span className="font-bold">₪{claimPayment.customer_payout_amount?.toLocaleString('he-IL')}</span>
                </div>
              </div>
            ) : (
              <button
                onClick={openPaymentModal}
                className="w-full py-3 bg-status-approved hover:bg-opacity-90 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
              >
                <Banknote className="w-5 h-5" /> רשום תשלום שהתקבל
              </button>
            )}

            {claimPayment?.incoming_payment_amount && !claimPayment?.customer_payout_completed && (
              <button
                onClick={() => { setPaymentStep('payout'); setShowPaymentModal(true) }}
                className="w-full py-3 bg-accent hover:bg-accent-light text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" /> אשר העברה ללקוח
              </button>
            )}
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
          <div className="bg-surface-raised p-6 rounded-xl shadow-glass max-w-lg w-full mx-4 border border-surface-border" onClick={e => e.stopPropagation()}>

            {/* Step 1: Record Incoming Payment */}
            {paymentStep === 'record' && (
              <>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-content-primary">
                  <Banknote className="w-6 h-6 text-status-approved" /> רישום תשלום נכנס
                </h3>
                <p className="text-content-secondary mb-4 text-sm">תשלום שהתקבל מחברת האוטובוסים לחשבון CashBus</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">סכום שהתקבל (₪) *</label>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="סכום ב-₪"
                      className="input-field text-lg"
                    />
                  </div>

                  {amount > 0 && (
                    <div className="bg-surface-overlay p-4 rounded-lg border border-surface-border">
                      <p className="text-sm font-semibold text-content-primary mb-2">חלוקה 80/20:</p>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-content-tertiary">עמלת CashBus (20%):</span>
                        <span className="font-bold text-accent">₪{commissionPreview.toLocaleString('he-IL')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-content-tertiary">לתשלום ללקוח (80%):</span>
                        <span className="font-bold text-status-approved">₪{payoutPreview.toLocaleString('he-IL')}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold mb-1">מקור התשלום</label>
                    <input
                      type="text"
                      value={paymentSource}
                      onChange={(e) => setPaymentSource(e.target.value)}
                      placeholder="שם החברה / מקור"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">מספר אסמכתא</label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="מספר העברה / אסמכתא"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">הערות</label>
                    <textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="הערות נוספות..."
                      className="input-field"
                      rows={2}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleRecordPayment}
                    disabled={updatingStatus || !paymentAmount}
                    className="flex-1 py-3 bg-status-approved hover:bg-opacity-90 text-white rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updatingStatus ? <Loader2 className="animate-spin w-5 h-5" /> : <><Banknote className="w-5 h-5" /> רשום תשלום</>}
                  </button>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="px-6 py-3 border border-surface-border text-content-secondary rounded-lg hover:bg-surface-overlay"
                  >
                    ביטול
                  </button>
                </div>
              </>
            )}

            {/* Step 2: Show Split (after recording) */}
            {paymentStep === 'split' && incomingPayment && (
              <>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-content-primary">
                  <CheckCircle className="w-6 h-6 text-status-approved" /> תשלום נרשם בהצלחה!
                </h3>

                <div className="bg-surface-overlay p-4 rounded-lg my-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-content-tertiary">סכום שהתקבל:</span>
                    <span className="font-bold text-lg">₪{incomingPayment.amount?.toLocaleString('he-IL')}</span>
                  </div>
                  <hr className="border-surface-border" />
                  <div className="flex justify-between">
                    <span className="text-content-tertiary">עמלת CashBus (20%):</span>
                    <span className="font-bold text-accent">₪{incomingPayment.commission_amount?.toLocaleString('he-IL')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-content-tertiary">לתשלום ללקוח (80%):</span>
                    <span className="font-bold text-status-approved text-lg">₪{incomingPayment.customer_payout?.toLocaleString('he-IL')}</span>
                  </div>
                </div>

                <p className="text-content-secondary text-sm mb-4">
                  יש להעביר ₪{incomingPayment.customer_payout?.toLocaleString('he-IL')} לחשבון הבנק של הלקוח ולאשר.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setPaymentStep('payout')}
                    className="flex-1 py-3 bg-accent hover:bg-accent-light text-white rounded-lg font-bold flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-5 h-5" /> אשר העברה ללקוח
                  </button>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="px-6 py-3 border border-surface-border text-content-secondary rounded-lg hover:bg-surface-overlay"
                  >
                    מאוחר יותר
                  </button>
                </div>
              </>
            )}

            {/* Step 3: Confirm Payout via Bit */}
            {paymentStep === 'payout' && (
              <>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-content-primary">
                  <CreditCard className="w-6 h-6 text-accent" /> העברה ב-Bit ללקוח
                </h3>

                {/* Bit payment details */}
                <div className="bg-surface-overlay rounded-xl p-4 mb-4 space-y-3 border border-surface-border">
                  <div className="flex justify-between items-center">
                    <span className="text-content-tertiary text-sm">סכום להעברה</span>
                    <span className="text-2xl font-bold text-status-approved">
                      ₪{(claimPayment?.customer_payout_amount ?? (incomingPayment ? Math.round(incomingPayment.amount * 0.8) : 0)).toLocaleString('he-IL')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-content-tertiary text-sm">טלפון הלקוח (Bit)</span>
                    <span className="font-bold text-content-primary text-lg tracking-wider">{incident?.customer_phone}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-content-tertiary text-sm">שם</span>
                    <span className="text-content-secondary">{incident?.customer_name}</span>
                  </div>
                </div>

                {/* Open Bit button */}
                <a
                  href={`bit://send?phone=${incident?.customer_phone?.replace(/\D/g, '')}&amount=${claimPayment?.customer_payout_amount ?? (incomingPayment ? Math.round(incomingPayment.amount * 0.8) : 0)}&description=${encodeURIComponent('פיצוי CashBus')}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-white mb-4"
                  style={{ background: 'linear-gradient(135deg, #1a3faa, #2563eb)' }}
                >
                  <span className="text-xl">💙</span> פתח Bit ושלח
                </a>

                <p className="text-xs text-content-tertiary text-center mb-4">
                  לאחר שליחת הביט, הכנס את מספר הפעולה שמופיע באישור
                </p>

                <div>
                  <label className="block text-sm font-semibold mb-1">מספר פעולת Bit *</label>
                  <input
                    type="text"
                    value={payoutReference}
                    onChange={(e) => setPayoutReference(e.target.value)}
                    placeholder="מספר הפעולה מאישור הביט"
                    className="input-field"
                  />
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleConfirmPayout}
                    disabled={updatingStatus || !payoutReference}
                    className="flex-1 py-3 bg-status-approved hover:bg-opacity-90 text-white rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updatingStatus ? <Loader2 className="animate-spin w-5 h-5" /> : <><CheckCircle className="w-5 h-5" /> אשר העברה</>}
                  </button>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="px-6 py-3 border border-surface-border text-content-secondary rounded-lg hover:bg-surface-overlay"
                  >
                    ביטול
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
