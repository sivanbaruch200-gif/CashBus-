'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Banknote,
  CheckCircle,
  Clock,
  User,
  Building2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react'

interface WithdrawalRequest {
  id: string
  claim_id: string
  amount: number
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  bank_name: string
  bank_branch: string
  bank_account_number: string
  bank_account_owner_name: string
  user_notes: string | null
  admin_notes: string | null
  requested_at: string
  processed_at: string | null
  profiles: { full_name: string; phone: string; email: string } | null
  claims: { bus_company: string; claim_amount: number; incoming_payment_amount: number } | null
}

const STATUS_LABELS: Record<WithdrawalRequest['status'], { label: string; icon: any; class: string }> = {
  pending: { label: 'ממתין', icon: Clock, class: 'status-badge-pending' },
  processing: { label: 'בטיפול', icon: Clock, class: 'status-badge-legal' },
  completed: { label: 'הועבר', icon: CheckCircle, class: 'status-badge-approved' },
  cancelled: { label: 'בוטל', icon: AlertCircle, class: 'status-badge-rejected' },
}

export default function WithdrawalsPage() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState('pending,processing')
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token
    if (!token) return

    setRefreshing(true)
    try {
      const res = await fetch(`/api/admin/withdrawals?status=${statusFilter}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setRequests(data.requests || [])
    } catch (err) {
      console.error('Error loading withdrawals:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleUpdateStatus = async (id: string, status: string) => {
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token
    if (!token) return

    setUpdating(id)
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          adminNotes: adminNotes[id] || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'שגיאה בעדכון')
        return
      }

      await loadData()
      setExpandedId(null)
    } catch {
      alert('שגיאת רשת — נסה שוב')
    } finally {
      setUpdating(null)
    }
  }

  const totalPending = requests
    .filter((r) => r.status === 'pending' || r.status === 'processing')
    .reduce((sum, r) => sum + r.amount, 0)

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto rtl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
            <Banknote className="w-6 h-6 text-amber-400" />
            בקשות משיכה
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            לקוחות שביקשו לקבל את ה-80% שלהם
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-surface-overlay rounded-xl border border-surface-border text-content-secondary hover:text-content-primary transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          רענן
        </button>
      </div>

      {/* Summary */}
      {totalPending > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4 mb-6 flex items-center gap-4">
          <div className="bg-amber-500/20 p-3 rounded-xl border border-amber-500/30">
            <Banknote className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <p className="text-amber-400 font-bold text-lg">
              ₪{totalPending.toLocaleString('he-IL')} ממתינים להעברה
            </p>
            <p className="text-content-secondary text-sm">
              {requests.filter((r) => r.status === 'pending').length} בקשות ממתינות
              {requests.filter((r) => r.status === 'processing').length > 0 &&
                ` · ${requests.filter((r) => r.status === 'processing').length} בטיפול`}
            </p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { value: 'pending,processing', label: 'ממתינות' },
          { value: 'completed', label: 'הושלמו' },
          { value: 'cancelled', label: 'בוטלו' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-accent text-white'
                : 'bg-surface-overlay text-content-secondary hover:text-content-primary border border-surface-border'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Requests list */}
      {requests.length === 0 ? (
        <div className="card text-center py-16">
          <CheckCircle className="w-12 h-12 text-content-tertiary mx-auto mb-3 opacity-40" />
          <p className="text-content-secondary">אין בקשות משיכה</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const cfg = STATUS_LABELS[req.status]
            const StatusIcon = cfg.icon
            const isExpanded = expandedId === req.id
            const isUpdating = updating === req.id

            return (
              <div key={req.id} className="card">
                {/* Main row */}
                <div
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                >
                  <div className="flex items-start gap-4 flex-1">
                    {/* Amount badge */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-center min-w-[80px]">
                      <p className="text-xl font-bold text-amber-400">
                        ₪{req.amount.toLocaleString('he-IL')}
                      </p>
                      <p className="text-[10px] text-content-tertiary">80%</p>
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <div className="flex items-center gap-1.5 font-semibold text-content-primary">
                          <User className="w-4 h-4 text-content-tertiary" />
                          {req.profiles?.full_name || 'לא ידוע'}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-content-secondary">
                          <Building2 className="w-3.5 h-3.5 text-content-tertiary" />
                          {req.claims?.bus_company || '—'}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-content-tertiary flex-wrap">
                        <span>
                          {new Date(req.requested_at).toLocaleDateString('he-IL', {
                            day: 'numeric',
                            month: 'long',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="text-content-tertiary">·</span>
                        <span className="font-mono">{req.bank_name} · {req.bank_account_number}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mr-2">
                    <span className={`status-badge ${cfg.class} flex items-center gap-1`}>
                      <StatusIcon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-content-tertiary" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-content-tertiary" />
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-surface-border space-y-4">
                    {/* Bank details */}
                    <div className="bg-surface-overlay rounded-xl p-4 space-y-2">
                      <h4 className="text-sm font-semibold text-content-primary mb-3">פרטי בנק</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-content-tertiary">בנק: </span>
                          <span className="text-content-primary font-medium">{req.bank_name}</span>
                        </div>
                        <div>
                          <span className="text-content-tertiary">סניף: </span>
                          <span className="text-content-primary">{req.bank_branch || '—'}</span>
                        </div>
                        <div>
                          <span className="text-content-tertiary">מספר חשבון: </span>
                          <span className="text-content-primary font-mono font-medium">{req.bank_account_number}</span>
                        </div>
                        <div>
                          <span className="text-content-tertiary">שם בעל חשבון: </span>
                          <span className="text-content-primary">{req.bank_account_owner_name || req.profiles?.full_name}</span>
                        </div>
                      </div>

                      {req.profiles?.phone && (
                        <div className="pt-2 border-t border-surface-border text-sm">
                          <span className="text-content-tertiary">טלפון: </span>
                          <span className="text-content-primary">{req.profiles.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Admin notes */}
                    {(req.status === 'pending' || req.status === 'processing') && (
                      <div>
                        <label className="block text-sm font-medium text-content-secondary mb-1">
                          הערות (אופציונלי)
                        </label>
                        <textarea
                          value={adminNotes[req.id] || ''}
                          onChange={(e) =>
                            setAdminNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                          }
                          rows={2}
                          placeholder="הערות פנימיות..."
                          className="input-field w-full text-sm"
                        />
                      </div>
                    )}

                    {req.admin_notes && req.status !== 'pending' && (
                      <div className="text-sm text-content-secondary bg-surface-overlay rounded-lg px-3 py-2">
                        <span className="text-content-tertiary">הערות: </span>
                        {req.admin_notes}
                      </div>
                    )}

                    {/* Action buttons */}
                    {req.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'processing')}
                          disabled={isUpdating}
                          className="flex-1 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
                        >
                          {isUpdating ? 'מעדכן...' : 'סמן כ"בטיפול"'}
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'completed')}
                          disabled={isUpdating}
                          className="flex-1 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
                        >
                          {isUpdating ? 'מעדכן...' : '✓ אישור העברה'}
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'cancelled')}
                          disabled={isUpdating}
                          className="px-4 py-2 bg-red-900/20 hover:bg-red-900/30 text-red-400 border border-red-700/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
                        >
                          ביטול
                        </button>
                      </div>
                    )}

                    {req.status === 'processing' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'completed')}
                          disabled={isUpdating}
                          className="flex-1 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
                        >
                          {isUpdating ? 'מעדכן...' : '✓ אישור העברה'}
                        </button>
                      </div>
                    )}

                    {req.processed_at && (
                      <p className="text-xs text-content-tertiary">
                        עודכן: {new Date(req.processed_at).toLocaleDateString('he-IL', {
                          day: 'numeric', month: 'long', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
