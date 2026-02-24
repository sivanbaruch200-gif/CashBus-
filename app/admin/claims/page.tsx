'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Search,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  TrendingUp,
  Building2,
  User,
  AlertCircle,
  Trash2,
} from 'lucide-react'

interface ClaimTimeline {
  id: string
  user_id: string
  incident_id: string
  status: 'pending' | 'sent' | 'negotiation' | 'paid' | 'rejected'
  claim_amount: number
  bus_company: string
  created_at: string
  customer_name: string
  customer_email: string
  bus_line?: string
  // Payment outcome
  incoming_payment_amount?: number
  cashbus_commission_amount?: number
  customer_payout_amount?: number
  // Reminder data
  initial_letter_sent_at?: string
  days_since_initial?: number
  company_responded?: boolean
  company_response_date?: string
}

interface IncidentRow {
  id: string
  user_id: string
  bus_line: string
  bus_company: string
  incident_type: 'delay' | 'no_stop' | 'no_arrival'
  incident_datetime: string
  status: string
  created_at: string
  customer_name: string
  customer_phone: string
}

const INCIDENT_TYPE_HE: Record<string, string> = {
  no_arrival: 'לא הגיע',
  no_stop: 'לא עצר',
  delay: 'איחור',
}

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

/** Horizontal 4-step timeline bar */
function ClaimTimeline({ claim }: { claim: ClaimTimeline }) {
  const sentAt = claim.initial_letter_sent_at || claim.created_at
  const days = claim.days_since_initial ?? daysSince(sentAt)

  const step1Done = ['sent', 'negotiation', 'paid', 'rejected'].includes(claim.status)
  const step2Active = step1Done && !['paid', 'rejected'].includes(claim.status)
  const step3Done = ['negotiation', 'paid', 'rejected'].includes(claim.status)
  const step4Done = ['paid', 'rejected'].includes(claim.status)
  const won = claim.status === 'paid'
  const lost = claim.status === 'rejected'

  const stepClass = (done: boolean, active: boolean) =>
    done
      ? 'text-green-500'
      : active
        ? 'text-accent'
        : 'text-content-tertiary'

  const dotClass = (done: boolean, active: boolean) =>
    `w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
      done
        ? 'bg-green-500 text-white'
        : active
          ? 'bg-accent text-white'
          : 'bg-surface-border text-content-tertiary'
    }`

  const lineClass = (done: boolean) =>
    `flex-1 h-0.5 mx-1 ${done ? 'bg-green-500' : 'bg-surface-border'}`

  return (
    <div className="mt-3">
      <div className="flex items-center gap-0">
        {/* Step 1: מייל נשלח */}
        <div className="flex flex-col items-center gap-1 w-20">
          <div className={dotClass(step1Done, false)}>
            {step1Done ? <CheckCircle className="w-4 h-4" /> : <Mail className="w-3 h-3" />}
          </div>
          <span className={`text-[10px] text-center leading-tight ${stepClass(step1Done, false)}`}>
            מייל<br />נשלח
          </span>
        </div>

        <div className={lineClass(step1Done)} />

        {/* Step 2: ימים */}
        <div className="flex flex-col items-center gap-1 w-20">
          <div className={dotClass(false, step2Active)}>
            <Clock className="w-3 h-3" />
          </div>
          <span className={`text-[10px] text-center leading-tight ${stepClass(false, step2Active)}`}>
            {step1Done ? `${days} ימים` : 'ימים'}
          </span>
        </div>

        <div className={lineClass(step3Done)} />

        {/* Step 3: תגובת חברה */}
        <div className="flex flex-col items-center gap-1 w-20">
          <div className={dotClass(step3Done, false)}>
            {step3Done ? <CheckCircle className="w-4 h-4" /> : <MessageSquare className="w-3 h-3" />}
          </div>
          <span className={`text-[10px] text-center leading-tight ${stepClass(step3Done, false)}`}>
            תגובת<br />חברה
          </span>
        </div>

        <div className={lineClass(step4Done)} />

        {/* Step 4: סיום */}
        <div className="flex flex-col items-center gap-1 w-20">
          <div className={dotClass(step4Done, false)}>
            {won ? <CheckCircle className="w-4 h-4" /> : lost ? <XCircle className="w-4 h-4 text-red-400" /> : <TrendingUp className="w-3 h-3" />}
          </div>
          <span className={`text-[10px] text-center leading-tight ${step4Done ? (won ? 'text-green-500' : 'text-red-400') : 'text-content-tertiary'}`}>
            סיום
          </span>
        </div>
      </div>

      {/* Outcome badge */}
      {won && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 bg-green-900/40 text-green-400 border border-green-700 rounded-full text-xs font-semibold">
            זוכה בפיצוי
          </span>
          {claim.incoming_payment_amount && (
            <span className="text-xs text-content-secondary">
              ₪{claim.incoming_payment_amount.toLocaleString('he-IL')} |&nbsp;
              עמלה: ₪{(claim.cashbus_commission_amount ?? claim.incoming_payment_amount * 0.2).toLocaleString('he-IL')}
            </span>
          )}
        </div>
      )}
      {lost && (
        <div className="mt-2">
          <span className="px-2 py-0.5 bg-red-900/40 text-red-400 border border-red-700 rounded-full text-xs font-semibold">
            לא זוכה בפיצוי
          </span>
        </div>
      )}
    </div>
  )
}

export default function ClaimsManagementPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'claims' | 'incidents'>('claims')
  const [claims, setClaims] = useState<ClaimTimeline[]>([])
  const [incidents, setIncidents] = useState<IncidentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')

  // Delete state
  const [deleteModal, setDeleteModal] = useState<{
    incidentId: string
    busLine: string
    busCompany: string
    linkedClaims?: { id: string; status: string; amount: number }[]
  } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [activeTab, statusFilter, companyFilter])

  async function loadData() {
    setLoading(true)
    try {
      if (activeTab === 'claims') {
        let query = supabase
          .from('claims')
          .select(`
            *,
            profiles:user_id (full_name, email),
            incidents:incident_id (bus_line),
            letter_reminders (initial_letter_sent_at, days_since_initial, company_responded, company_response_date)
          `)

        if (statusFilter !== 'all') query = query.eq('status', statusFilter)
        if (companyFilter !== 'all') query = query.eq('bus_company', companyFilter)

        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) throw error

        const formatted: ClaimTimeline[] = (data || []).map((item: any) => {
          const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
          const incident = Array.isArray(item.incidents) ? item.incidents[0] : item.incidents
          const reminder = Array.isArray(item.letter_reminders) ? item.letter_reminders[0] : item.letter_reminders

          return {
            id: item.id,
            user_id: item.user_id,
            incident_id: item.incident_id,
            status: item.status,
            claim_amount: item.claim_amount,
            bus_company: item.bus_company,
            created_at: item.created_at,
            customer_name: profile?.full_name || 'לא ידוע',
            customer_email: profile?.email || '',
            bus_line: incident?.bus_line,
            incoming_payment_amount: item.incoming_payment_amount,
            cashbus_commission_amount: item.cashbus_commission_amount,
            customer_payout_amount: item.customer_payout_amount,
            initial_letter_sent_at: reminder?.initial_letter_sent_at,
            days_since_initial: reminder?.days_since_initial,
            company_responded: reminder?.company_responded,
            company_response_date: reminder?.company_response_date,
          }
        })
        setClaims(formatted)
      } else {
        let query = supabase
          .from('incidents')
          .select('*, profiles:user_id (full_name, phone)')

        if (statusFilter !== 'all') query = query.eq('status', statusFilter)
        if (companyFilter !== 'all') query = query.eq('bus_company', companyFilter)

        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) throw error

        const formatted: IncidentRow[] = (data || []).map((item: any) => ({
          ...item,
          customer_name: item.profiles?.full_name || 'לא ידוע',
          customer_phone: item.profiles?.phone || '',
        }))
        setIncidents(formatted)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initiate delete — check for linked claims first
  const initiateDelete = async (incident: IncidentRow, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteError(null)

    const res = await fetch(`/api/admin/incidents/${incident.id}`, { method: 'DELETE' })
    const data = await res.json()

    if (res.status === 409 && data.error === 'LINKED_CLAIMS') {
      setDeleteModal({
        incidentId: incident.id,
        busLine: incident.bus_line,
        busCompany: incident.bus_company,
        linkedClaims: data.linkedClaims,
      })
    } else if (res.ok) {
      // No linked claims — deleted immediately
      loadData()
    } else {
      setDeleteError(data.error || 'שגיאה במחיקה')
    }
  }

  // Confirm force-delete (with linked claims)
  const confirmForceDelete = async () => {
    if (!deleteModal) return
    setDeleteLoading(true)
    setDeleteError(null)

    const res = await fetch(`/api/admin/incidents/${deleteModal.incidentId}?force=true`, { method: 'DELETE' })
    const data = await res.json()

    setDeleteLoading(false)
    if (res.ok) {
      setDeleteModal(null)
      loadData()
    } else {
      setDeleteError(data.error || 'שגיאה במחיקה')
    }
  }

  const allCompanies = Array.from(
    new Set([...claims.map((c) => c.bus_company), ...incidents.map((i) => i.bus_company)])
  ).filter(Boolean)

  const filteredClaims = claims.filter(
    (c) =>
      c.customer_name.includes(searchQuery) ||
      c.id.includes(searchQuery) ||
      c.bus_company.includes(searchQuery)
  )

  const filteredIncidents = incidents.filter(
    (i) =>
      i.customer_name.includes(searchQuery) ||
      i.bus_line.includes(searchQuery) ||
      i.bus_company.includes(searchQuery)
  )

  return (
    <div className="p-8 max-w-5xl mx-auto rtl" dir="rtl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-content-primary">ניהול תיקים</h1>
        <span className="text-sm text-content-tertiary">
          {activeTab === 'claims' ? `${filteredClaims.length} תביעות` : `${filteredIncidents.length} דיווחים`}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-surface-border">
        <button
          onClick={() => setActiveTab('claims')}
          className={`pb-2 px-4 transition-colors ${activeTab === 'claims' ? 'border-b-2 border-accent text-accent font-bold' : 'text-content-tertiary hover:text-content-secondary'}`}
        >
          תביעות פעילות
        </button>
        <button
          onClick={() => setActiveTab('incidents')}
          className={`pb-2 px-4 transition-colors ${activeTab === 'incidents' ? 'border-b-2 border-accent text-accent font-bold' : 'text-content-tertiary hover:text-content-secondary'}`}
        >
          דיווחים חדשים
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary w-4 h-4" />
          <input
            type="text"
            placeholder="חיפוש..."
            className="input-field pr-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="input-field"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">כל הסטטוסים</option>
          {activeTab === 'claims' ? (
            <>
              <option value="pending">ממתין</option>
              <option value="sent">נשלח</option>
              <option value="negotiation">משא ומתן</option>
              <option value="paid">שולם</option>
              <option value="rejected">נדחה</option>
            </>
          ) : (
            <>
              <option value="submitted">הוגש</option>
              <option value="verified">מאומת</option>
              <option value="claimed">בטיפול</option>
            </>
          )}
        </select>
        <select
          className="input-field"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        >
          <option value="all">כל החברות</option>
          {allCompanies.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-content-tertiary">טוען נתונים...</div>
      ) : activeTab === 'claims' ? (
        /* === CLAIMS VIEW === */
        filteredClaims.length === 0 ? (
          <div className="text-center py-16 text-content-tertiary">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>לא נמצאו תביעות</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClaims.map((claim) => (
              <div
                key={claim.id}
                className="card cursor-pointer hover:border-accent/50 transition-colors"
                onClick={() => router.push(`/admin/claims/${claim.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: customer + company info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 text-content-primary font-semibold">
                        <User className="w-4 h-4 text-content-tertiary flex-shrink-0" />
                        {claim.customer_name}
                      </div>
                      <div className="flex items-center gap-1.5 text-content-secondary text-sm">
                        <Building2 className="w-3.5 h-3.5 text-content-tertiary flex-shrink-0" />
                        {claim.bus_company}
                        {claim.bus_line && <span className="text-content-tertiary">קו {claim.bus_line}</span>}
                      </div>
                      <span className="text-xs text-content-tertiary">
                        #{claim.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>

                    {/* Timeline */}
                    <ClaimTimeline claim={claim} />
                  </div>

                  {/* Right: claim amount */}
                  <div className="text-left flex-shrink-0">
                    <div className="text-lg font-bold text-accent">
                      ₪{(claim.claim_amount || 0).toLocaleString('he-IL')}
                    </div>
                    <div className="text-xs text-content-tertiary">
                      {new Date(claim.created_at).toLocaleDateString('he-IL')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* === INCIDENTS VIEW === */
        filteredIncidents.length === 0 ? (
          <div className="text-center py-16 text-content-tertiary">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>לא נמצאו דיווחים</p>
          </div>
        ) : (
          <div className="card overflow-hidden !p-0">
            <table className="w-full text-right">
              <thead className="bg-surface-overlay border-b border-surface-border">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-content-secondary">לקוח</th>
                  <th className="px-6 py-3 text-xs font-semibold text-content-secondary">חברה / קו</th>
                  <th className="px-6 py-3 text-xs font-semibold text-content-secondary">סוג</th>
                  <th className="px-6 py-3 text-xs font-semibold text-content-secondary">תאריך</th>
                  <th className="px-6 py-3 text-xs font-semibold text-content-secondary">סטטוס</th>
                  <th className="px-6 py-3 text-xs font-semibold text-content-secondary"></th>
                </tr>
              </thead>
              <tbody>
                {filteredIncidents.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-surface-border hover:bg-surface-overlay transition-colors cursor-pointer"
                    onClick={() => router.push(`/admin/claims/${item.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-content-primary">{item.customer_name}</div>
                      <div className="text-xs text-content-tertiary">{item.customer_phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-content-secondary">{item.bus_company}</div>
                      <div className="text-xs text-content-tertiary">קו {item.bus_line}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-content-secondary">
                      {INCIDENT_TYPE_HE[item.incident_type] || item.incident_type}
                    </td>
                    <td className="px-6 py-4 text-sm text-content-tertiary">
                      {new Date(item.incident_datetime).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'claimed' ? 'status-badge-approved' :
                        item.status === 'verified' ? 'status-badge-legal' :
                        'status-badge-pending'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={(e) => initiateDelete(item, e)}
                        title="מחק דיווח"
                        className="p-1.5 rounded-lg text-content-tertiary hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setDeleteModal(null)}>
          <div className="card max-w-md w-full p-6" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-content-primary">מחיקת דיווח</h3>
                <p className="text-sm text-content-secondary">קו {deleteModal.busLine} — {deleteModal.busCompany}</p>
              </div>
            </div>

            {deleteModal.linkedClaims && deleteModal.linkedClaims.length > 0 ? (
              <>
                <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-4 mb-4">
                  <p className="text-sm text-amber-300 font-medium mb-2">
                    ⚠️ לדיווח זה קשורות {deleteModal.linkedClaims.length} תביעות פעילות:
                  </p>
                  <ul className="space-y-1">
                    {deleteModal.linkedClaims.map(c => (
                      <li key={c.id} className="text-xs text-content-secondary flex justify-between">
                        <span>#{c.id.slice(0, 8).toUpperCase()} — {c.status}</span>
                        <span className="text-accent font-mono">₪{(c.amount || 0).toLocaleString('he-IL')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-sm text-content-secondary mb-4">
                  מחיקה תסיר גם את התביעות הקשורות. פעולה זו בלתי הפיכה.
                </p>
              </>
            ) : (
              <p className="text-sm text-content-secondary mb-4">
                האם למחוק דיווח זה לצמיתות? פעולה זו בלתי הפיכה.
              </p>
            )}

            {deleteError && (
              <p className="text-sm text-red-400 mb-3">{deleteError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="btn-secondary flex-1 py-2.5"
                disabled={deleteLoading}
              >
                ביטול
              </button>
              <button
                onClick={confirmForceDelete}
                disabled={deleteLoading}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {deleteLoading ? 'מוחק...' : 'מחק לצמיתות'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
