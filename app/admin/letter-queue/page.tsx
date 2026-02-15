'use client'

import { useEffect, useState } from 'react'
import { supabase, uploadPDFDocument } from '@/lib/supabase'
import { generateWarningLetterPDF, downloadPDF, generateWarningLetterFilename, type WarningLetterData } from '@/lib/pdfGenerator'

interface ClaimWithReminder {
  id: string
  user_id: string
  claim_amount: number
  bus_company: string
  created_at: string
  letter_sent_date: string | null
  status: string

  // User info
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_id: string

  // Incident info
  incident_ids: string[]
  incident_type: string
  station_name: string
  bus_line: string
  incident_date: string

  // Reminder info
  reminder_id: string | null
  days_since_initial: number | null
  reminder_status: string | null
  total_emails_sent: number | null
  last_email_sent_at: string | null
}

export default function LetterQueuePage() {
  const [claims, setClaims] = useState<ClaimWithReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)
  const [generating, setGenerating] = useState<string | null>(null)

  useEffect(() => {
    fetchClaims()
  }, [])

  async function fetchClaims() {
    setLoading(true)
    try {
      // Fetch all claims with their user details and reminder status
      const { data, error } = await supabase
        .from('claims')
        .select(`
          *,
          profiles:user_id (
            full_name,
            phone,
            email,
            id_number
          ),
          letter_reminders (
            id,
            days_since_initial,
            status,
            total_emails_sent,
            last_email_sent_at
          )
        `)
        .in('status', ['draft', 'submitted', 'company_review'])
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform data
      const transformedClaims = data.map((claim: any) => ({
        id: claim.id,
        user_id: claim.user_id,
        claim_amount: claim.claim_amount,
        bus_company: claim.bus_company,
        created_at: claim.created_at,
        letter_sent_date: claim.letter_sent_date,
        status: claim.status,

        customer_name: claim.profiles?.full_name || 'לא ידוע',
        customer_phone: claim.profiles?.phone || '',
        customer_email: claim.profiles?.email || '',
        customer_id: claim.profiles?.id_number || '000000000',

        incident_ids: claim.incident_ids || [],
        incident_type: 'no_arrival', 
        station_name: 'תחנה לא ידועה', 
        bus_line: '1', 
        incident_date: claim.created_at,

        reminder_id: claim.letter_reminders?.[0]?.id || null,
        days_since_initial: claim.letter_reminders?.[0]?.days_since_initial || null,
        reminder_status: claim.letter_reminders?.[0]?.status || null,
        total_emails_sent: claim.letter_reminders?.[0]?.total_emails_sent || 0,
        last_email_sent_at: claim.letter_reminders?.[0]?.last_email_sent_at || null,
      }))

      setClaims(transformedClaims)
    } catch (error) {
      console.error('Error fetching claims:', error)
      alert('שגיאה בטעינת התביעות')
    } finally {
      setLoading(false)
    }
  }

  async function handleGeneratePDF(claim: ClaimWithReminder) {
    setGenerating(claim.id)
    try {
      const pdfData: WarningLetterData = {
        incidentId: claim.id,
        incidentType: claim.incident_type as any,
        incidentDate: claim.incident_date,
        busLine: claim.bus_line,
        busCompany: claim.bus_company,
        stationName: claim.station_name,
        customerName: claim.customer_name,
        customerPhone: claim.customer_phone,
        customerId: claim.customer_id,
        baseCompensation: claim.claim_amount * 0.7,
        damageCompensation: claim.claim_amount * 0.3,
        totalCompensation: claim.claim_amount,
        legalBasis: 'תקנות 399א, 428ג',
      }

      const pdfBlob = await generateWarningLetterPDF(pdfData)
      const filename = generateWarningLetterFilename(claim.customer_name, claim.id)
      downloadPDF(pdfBlob, filename)
      alert('PDF הורד בהצלחה!')
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('שגיאה ביצירת PDF')
    } finally {
      setGenerating(null)
    }
  }

  async function handleSendEmail(claim: ClaimWithReminder) {
    if (!claim.customer_email) {
      alert('אין כתובת אימייל ללקוח')
      return
    }

    const confirmed = confirm(
      `האם לשלוח מכתב התראה ראשוני ל-${claim.customer_name}?\n` +
      `אימייל: ${claim.customer_email}\n` +
      `חברה: ${claim.bus_company}`
    )

    if (!confirmed) return

    setSending(claim.id)
    try {
      const pdfData: WarningLetterData = {
        incidentId: claim.id,
        incidentType: claim.incident_type as any,
        incidentDate: claim.incident_date,
        busLine: claim.bus_line,
        busCompany: claim.bus_company,
        stationName: claim.station_name,
        customerName: claim.customer_name,
        customerPhone: claim.customer_phone,
        customerId: claim.customer_id,
        baseCompensation: claim.claim_amount * 0.7,
        damageCompensation: claim.claim_amount * 0.3,
        totalCompensation: claim.claim_amount,
        legalBasis: 'תקנות 399א, 428ג',
      }

      const pdfBlob = await generateWarningLetterPDF(pdfData)
      const filename = generateWarningLetterFilename(claim.customer_name, claim.id)
      const pdfUrl = await uploadPDFDocument(pdfBlob, filename, 'legal_documents')

      const emailResponse = await fetch('/api/send-legal-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: claim.customer_email,
          subject: `מכתב התראה - תביעה מס' ${claim.id.slice(0, 8)} - CashBus`,
          body: `שלום ${claim.customer_name},\n\nמצורף מכתב התראה בנושא תביעתך נגד חברת ${claim.bus_company}.\n\nסכום התביעה: ₪${claim.claim_amount.toLocaleString()}\n\nבברכה,\nצוות CashBus`,
          pdfUrl: pdfUrl,
          claimId: claim.id,
        }),
      })

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json()
        throw new Error(errorData.error || 'Failed to send email')
      }

      if (!claim.reminder_id) {
        const { error: reminderError } = await supabase
          .from('letter_reminders')
          .insert({
            claim_id: claim.id,
            user_id: claim.user_id,
            initial_letter_sent_at: new Date().toISOString(),
            status: 'active',
          })

        if (reminderError) throw reminderError
      }

      await supabase
        .from('claims')
        .update({
          letter_sent_date: new Date().toISOString(),
          status: 'company_review',
        })
        .eq('id', claim.id)

      alert('מכתב ההתראה נשלח בהצלחה! מערכת התזכורות הופעלה.')
      fetchClaims() 
    } catch (error) {
      console.error('Error sending email:', error)
      alert(`שגיאה בשליחת המכתב: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSending(null)
    }
  }

  function getDaysRemainingBadge(daysSince: number | null) {
    if (daysSince === null) return null

    const daysRemaining = 14 - daysSince

    let badgeClass = 'bg-status-approved-surface text-status-approved'
    if (daysRemaining <= 3) badgeClass = 'bg-status-rejected-surface text-status-rejected'
    else if (daysRemaining <= 7) badgeClass = 'bg-status-pending-surface text-status-pending'

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
        {daysRemaining} ימים נותרים
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-raised p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
            <p className="mt-4 text-content-secondary">טוען תביעות...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-raised p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-content-primary mb-2">תור מכתבים - ניהול תביעות</h1>
          <p className="text-content-secondary">
            ניהול שליחת מכתבי התראה ומעקב אחר מערכת התזכורות (GYRO Model)
          </p>
        </div>

        {/* Stats Grid - Updated with card and text tokens */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <div className="text-sm text-content-tertiary mb-1">סה"כ תביעות</div>
            <div className="text-3xl font-bold text-content-primary">{claims.length}</div>
          </div>
          <div className="card">
            <div className="text-sm text-content-tertiary mb-1">ממתינות לשליחה</div>
            <div className="text-3xl font-bold text-status-pending">
              {claims.filter(c => !c.letter_sent_date).length}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-content-tertiary mb-1">במעקב פעיל</div>
            <div className="text-3xl font-bold text-status-legal">
              {claims.filter(c => c.reminder_status === 'active').length}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-content-tertiary mb-1">דורשות תשומת לב</div>
            <div className="text-3xl font-bold text-status-rejected">
              {claims.filter(c => c.days_since_initial && c.days_since_initial >= 11).length}
            </div>
          </div>
        </div>

        {/* Claims Table - Updated with card container and new tokens */}
        <div className="card overflow-hidden !p-0">
          <table className="min-w-full divide-y divide-surface-border">
            <thead className="bg-surface-overlay">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase">מספר תביעה</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase">לקוח</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase">חברה</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase">סכום</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase">סטטוס</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase">מונה ימים</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {claims.map((claim) => (
                <tr key={claim.id} className="hover:bg-surface-overlay transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-content-primary">
                    {claim.id.slice(0, 8)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-content-primary">{claim.customer_name}</div>
                    <div className="text-sm text-content-tertiary">{claim.customer_email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-content-secondary">
                    {claim.bus_company}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-content-primary">
                    ₪{claim.claim_amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      claim.status === 'draft' ? 'bg-surface-overlay text-content-secondary' :
                      claim.status === 'submitted' ? 'status-badge-legal' :
                      'status-badge-pending'
                    }`}>
                      {claim.status === 'draft' ? 'טיוטה' :
                       claim.status === 'submitted' ? 'הוגש' :
                       'בבדיקת חברה'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {claim.days_since_initial !== null ? (
                      <div className="flex flex-col gap-1">
                        {getDaysRemainingBadge(claim.days_since_initial)}
                        <span className="text-xs text-content-tertiary">
                          {claim.total_emails_sent} מיילים נשלחו
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-content-tertiary/40">טרם הופעל</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGeneratePDF(claim)}
                        disabled={generating === claim.id}
                        className="text-status-legal hover:text-opacity-80 disabled:opacity-50"
                      >
                        {generating === claim.id ? '⏳' : '📄'} הצג PDF
                      </button>

                      {!claim.letter_sent_date && (
                        <button
                          onClick={() => handleSendEmail(claim)}
                          disabled={sending === claim.id}
                          className="text-status-approved hover:text-opacity-80 disabled:opacity-50"
                        >
                          {sending === claim.id ? '⏳' : '📧'} אשר שליחה
                        </button>
                      )}

                      {claim.days_since_initial && claim.days_since_initial >= 14 && (
                        <button
                          className="text-status-rejected hover:text-opacity-80 font-bold"
                          onClick={() => alert('מנגנון כתב תביעה בפיתוח')}
                        >
                          ⚖️ כתב תביעה
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {claims.length === 0 && (
            <div className="text-center py-12 text-content-tertiary">
              אין תביעות בתור
            </div>
          )}
        </div>
      </div>
    </div>
  )
}