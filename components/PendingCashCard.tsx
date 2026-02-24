'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Banknote, ArrowLeft, CheckCircle, Clock, AlertCircle, X } from 'lucide-react'

interface PendingPayout {
  id: string
  bus_company: string
  claim_amount: number
  incoming_payment_amount: number
  customer_payout_amount: number
  incoming_payment_date: string
}

interface WithdrawalRequest {
  id: string
  claim_id: string
  amount: number
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  requested_at: string
}

// Play a celebratory coin sound via Web Audio API
function playCoinSound() {
  try {
    const ctx = new AudioContext()
    const times = [0, 0.15, 0.28]
    times.forEach((t) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime + t)
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + t + 0.08)
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + t + 0.2)
      gain.gain.setValueAtTime(0, ctx.currentTime + t)
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.22)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.25)
    })
  } catch {
    // Audio not available — no problem
  }
}

// Simple confetti burst using DOM particles
function spawnConfetti(container: HTMLElement) {
  const colors = ['#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#f97316']
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div')
    const color = colors[Math.floor(Math.random() * colors.length)]
    const size = 6 + Math.random() * 6
    const startX = 50 + (Math.random() - 0.5) * 20 // % of container
    const angle = Math.random() * 360
    const distance = 80 + Math.random() * 120
    const duration = 800 + Math.random() * 600

    el.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      left: ${startX}%;
      top: 50%;
      pointer-events: none;
      z-index: 50;
      transform-origin: center;
      transition: none;
    `
    container.appendChild(el)

    const rad = (angle * Math.PI) / 180
    const dx = Math.cos(rad) * distance
    const dy = Math.sin(rad) * distance

    el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0) rotate(${angle * 2}deg)`,
          opacity: 0,
        },
      ],
      { duration, easing: 'ease-out', fill: 'forwards' }
    ).onfinish = () => el.remove()
  }
}

const STATUS_CONFIG = {
  pending: {
    label: 'ממתין לטיפול',
    icon: Clock,
    className: 'text-amber-400',
    bgClass: 'bg-amber-900/20 border-amber-700/30',
  },
  processing: {
    label: 'בטיפול — העברה בוצעה בקרוב',
    icon: Clock,
    className: 'text-blue-400',
    bgClass: 'bg-blue-900/20 border-blue-700/30',
  },
  completed: {
    label: 'הועבר לחשבונך ✓',
    icon: CheckCircle,
    className: 'text-green-400',
    bgClass: 'bg-green-900/20 border-green-700/30',
  },
  cancelled: {
    label: 'בוטל',
    icon: AlertCircle,
    className: 'text-red-400',
    bgClass: 'bg-red-900/20 border-red-700/30',
  },
}

export default function PendingCashCard() {
  const router = useRouter()
  const [pendingPayouts, setPendingPayouts] = useState<PendingPayout[]>([])
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState<string | null>(null) // claimId being requested
  const [celebratingId, setCelebratingId] = useState<string | null>(null)
  const [showNoBankDialog, setShowNoBankDialog] = useState(false)
  const [confettiRef, setConfettiRef] = useState<HTMLDivElement | null>(null)

  const loadData = useCallback(async () => {
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token
    if (!token) return

    try {
      const res = await fetch('/api/withdrawals', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setPendingPayouts(data.pendingPayouts || [])
      setWithdrawalRequests(data.withdrawalRequests || [])
    } catch {
      // silently fail — dashboard still loads
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRequest = async (claimId: string, container: HTMLDivElement | null) => {
    setRequesting(claimId)

    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token
    if (!token) { setRequesting(null); return }

    try {
      const res = await fetch('/api/withdrawals/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ claimId }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'no_bank_details') {
          setShowNoBankDialog(true)
        } else {
          alert(data.error || 'שגיאה בשליחת הבקשה')
        }
        return
      }

      // Celebrate!
      playCoinSound()
      if (container) spawnConfetti(container)
      setCelebratingId(claimId)

      setTimeout(() => {
        setCelebratingId(null)
        loadData()
      }, 2000)
    } catch {
      alert('שגיאת רשת — נסה שוב')
    } finally {
      setRequesting(null)
    }
  }

  // Don't render anything if no pending payouts
  if (loading || (pendingPayouts.length === 0 && withdrawalRequests.length === 0)) {
    return null
  }

  return (
    <>
      {/* No bank details dialog */}
      {showNoBankDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-surface-border rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-900/30 p-2 rounded-xl border border-amber-700/30">
                  <Banknote className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="font-bold text-content-primary">פרטי בנק חסרים</h3>
              </div>
              <button
                onClick={() => setShowNoBankDialog(false)}
                className="text-content-tertiary hover:text-content-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-content-secondary mb-6">
              כדי לקבל את הכסף, עליך להוסיף פרטי חשבון בנק לפרופיל שלך.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowNoBankDialog(false); router.push('/profile') }}
                className="flex-1 btn-primary text-sm"
              >
                עדכן פרטי בנק
              </button>
              <button
                onClick={() => setShowNoBankDialog(false)}
                className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending payouts — money waiting */}
      {pendingPayouts.map((payout) => {
        const existing = withdrawalRequests.find((r) => r.claim_id === payout.id)
        const amount = payout.customer_payout_amount ?? Math.round(payout.incoming_payment_amount * 0.8)
        const isCelebrating = celebratingId === payout.id
        const isRequesting = requesting === payout.id

        return (
          <div
            key={payout.id}
            ref={(el) => { if (el) setConfettiRef(el) }}
            className={`relative overflow-hidden rounded-2xl border-2 p-5 transition-all duration-300 ${
              isCelebrating
                ? 'border-green-500 bg-green-900/20 scale-105'
                : 'border-amber-500/50 bg-gradient-to-br from-amber-950/40 to-orange-950/30'
            }`}
          >
            {/* Shimmer/glow animation */}
            {!existing && !isCelebrating && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/5 to-transparent animate-shimmer pointer-events-none" />
            )}

            {isCelebrating ? (
              <div className="text-center py-2">
                <div className="text-4xl mb-2">🎉</div>
                <p className="text-green-400 font-bold text-lg">הבקשה נשלחה!</p>
                <p className="text-content-secondary text-sm">CashBus יעביר את הכסף בקרוב</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="bg-amber-500/20 p-2.5 rounded-xl border border-amber-500/30">
                        <Banknote className="w-6 h-6 text-amber-400" />
                      </div>
                      {/* Pulse dot */}
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-surface-base animate-pulse" />
                    </div>
                    <div>
                      <p className="text-xs text-amber-400 font-semibold uppercase tracking-wide">💰 קופה ממתינה</p>
                      <p className="text-content-secondary text-xs">{payout.bus_company}</p>
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div className="mb-4">
                  <div className="text-4xl font-bold text-content-primary">
                    ₪{amount.toLocaleString('he-IL')}
                  </div>
                  <p className="text-sm text-content-secondary mt-1">
                    שלך (80%) מתוך ₪{payout.incoming_payment_amount.toLocaleString('he-IL')} שהתקבלו
                  </p>
                </div>

                {/* Status or CTA */}
                {existing ? (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${STATUS_CONFIG[existing.status].bgClass}`}>
                    {(() => {
                      const cfg = STATUS_CONFIG[existing.status]
                      const Icon = cfg.icon
                      return (
                        <>
                          <Icon className={`w-4 h-4 ${cfg.className}`} />
                          <span className={cfg.className}>{cfg.label}</span>
                        </>
                      )
                    })()}
                  </div>
                ) : (
                  <button
                    onClick={() => handleRequest(payout.id, confettiRef)}
                    disabled={isRequesting}
                    className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold py-3 px-6 rounded-xl transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
                  >
                    {isRequesting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                        <span>שולח בקשה...</span>
                      </>
                    ) : (
                      <>
                        <span>שלח לי את הכסף</span>
                        <ArrowLeft className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        )
      })}

      {/* Completed withdrawal requests (historical) */}
      {withdrawalRequests
        .filter((r) => r.status === 'completed' && !pendingPayouts.find((p) => p.id === r.claim_id))
        .slice(0, 2)
        .map((req) => (
          <div
            key={req.id}
            className="rounded-xl border border-green-700/30 bg-green-900/10 px-4 py-3 flex items-center gap-3"
          >
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-400">
                ₪{req.amount.toLocaleString('he-IL')} הועבר לחשבונך
              </p>
              <p className="text-xs text-content-tertiary">
                {new Date(req.processed_at || req.requested_at).toLocaleDateString('he-IL')}
              </p>
            </div>
          </div>
        ))}
    </>
  )
}
