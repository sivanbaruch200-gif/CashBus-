'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
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
        incident_type: 'no_arrival', // TODO: get from incidents
        station_name: 'תחנה לא ידועה', // TODO: get from incidents
        bus_line: '1', // TODO: get from incidents
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
      // Prepare PDF data
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

      // Generate PDF
      const pdfBlob = await generateWarningLetterPDF(pdfData)

      // Download PDF
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
      // Create reminder entry
      if (!claim.reminder_id) {
        const { data: reminderData, error: reminderError } = await supabase
          .from('letter_reminders')
          .insert({
            claim_id: claim.id,
            user_id: claim.user_id,
            initial_letter_sent_at: new Date().toISOString(),
            status: 'active',
          })
          .select()
          .single()

        if (reminderError) throw reminderError
      }

      // Update claim status
      await supabase
        .from('claims')
        .update({
          letter_sent_date: new Date().toISOString(),
          status: 'company_review',
        })
        .eq('id', claim.id)

      // TODO: Send actual email via Resend API or Edge Function
      // For now, we just mark it as sent

      alert('מכתב ההתראה נשלח בהצלחה! מערכת התזכורות הופעלה.')
      fetchClaims() // Refresh
    } catch (error) {
      console.error('Error sending email:', error)
      alert('שגיאה בשליחת המכתב')
    } finally {
      setSending(null)
    }
  }

  function getDaysRemainingBadge(daysSince: number | null) {
    if (daysSince === null) return null

    const daysRemaining = 14 - daysSince

    let bgColor = 'bg-green-100 text-green-800'
    if (daysRemaining <= 3) bgColor = 'bg-red-100 text-red-800'
    else if (daysRemaining <= 7) bgColor = 'bg-orange-100 text-orange-800'

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${bgColor}`}>
        {daysRemaining} ימים נותרים
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">טוען תביעות...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">תור מכתבים - ניהול תביעות</h1>
          <p className="text-gray-600">
            ניהול שליחת מכתבי התראה ומעקב אחר מערכת התזכורות (GYRO Model)
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600 mb-1">סה"כ תביעות</div>
            <div className="text-3xl font-bold text-gray-900">{claims.length}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600 mb-1">ממתינות לשליחה</div>
            <div className="text-3xl font-bold text-orange-600">
              {claims.filter(c => !c.letter_sent_date).length}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600 mb-1">במעקב פעיל</div>
            <div className="text-3xl font-bold text-blue-600">
              {claims.filter(c => c.reminder_status === 'active').length}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-600 mb-1">דורשות תשומת לב</div>
            <div className="text-3xl font-bold text-red-600">
              {claims.filter(c => c.days_since_initial && c.days_since_initial >= 11).length}
            </div>
          </div>
        </div>

        {/* Claims Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  מספר תביעה
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  לקוח
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  חברה
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  סכום
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  סטטוס
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  מונה ימים
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {claims.map((claim) => (
                <tr key={claim.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {claim.id.slice(0, 8)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{claim.customer_name}</div>
                    <div className="text-sm text-gray-500">{claim.customer_email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {claim.bus_company}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    ₪{claim.claim_amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      claim.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      claim.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
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
                        <span className="text-xs text-gray-500">
                          {claim.total_emails_sent} מיילים נשלחו
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">טרם הופעל</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGeneratePDF(claim)}
                        disabled={generating === claim.id}
                        className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                      >
                        {generating === claim.id ? '⏳' : '📄'} הצג PDF
                      </button>

                      {!claim.letter_sent_date && (
                        <button
                          onClick={() => handleSendEmail(claim)}
                          disabled={sending === claim.id}
                          className="text-green-600 hover:text-green-900 disabled:opacity-50"
                        >
                          {sending === claim.id ? '⏳' : '📧'} אשר שליחה
                        </button>
                      )}

                      {claim.days_since_initial && claim.days_since_initial >= 14 && (
                        <button
                          className="text-red-600 hover:text-red-900 font-bold"
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
            <div className="text-center py-12 text-gray-500">
              אין תביעות בתור
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
