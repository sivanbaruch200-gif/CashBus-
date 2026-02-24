'use client'

/**
 * SubscriptionGate
 *
 * Renders children if user can create a claim (free slot or active subscription).
 * Otherwise renders an upgrade prompt.
 *
 * Usage:
 *   <SubscriptionGate onBlock={() => router.push('/subscription')}>
 *     <button onClick={openClaimForm}>פתח תביעה</button>
 *   </SubscriptionGate>
 *
 * Or use the hook `useSubscriptionGate()` for programmatic access:
 *   const { canCreate, status, loading } = useSubscriptionGate()
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Lock, Zap, ChevronLeft } from 'lucide-react'
import { getSubscriptionStatus, type SubscriptionStatus, FREE_CLAIMS_LIMIT } from '@/lib/subscriptionService'

// =====================================================
// Hook
// =====================================================

export function useSubscriptionGate() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSubscriptionStatus()
      .then(setStatus)
      .finally(() => setLoading(false))
  }, [])

  return {
    canCreate: status?.canCreateClaim ?? true,
    status,
    loading,
    refresh: () => {
      setLoading(true)
      getSubscriptionStatus().then(setStatus).finally(() => setLoading(false))
    },
  }
}

// =====================================================
// Inline upgrade prompt (shown inside forms)
// =====================================================

export function SubscriptionUpgradePrompt({ freeClaimsUsed }: { freeClaimsUsed: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const session = await import('@/lib/supabase').then(m => m.getSession())
      const token = session?.access_token

      const res = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ returnUrl: '/subscription' }),
      })

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Upgrade error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-5 text-center space-y-4" dir="rtl">
      <div className="flex items-center justify-center gap-2">
        <Crown className="w-6 h-6 text-orange-500" />
        <span className="font-bold text-orange-800 text-lg">הגעת למכסת התביעות החינמיות</span>
      </div>

      <p className="text-sm text-orange-700">
        השתמשת ב-{freeClaimsUsed} מתוך {FREE_CLAIMS_LIMIT} תביעות חינמיות.
        כדי לפתוח תביעות נוספות, הצטרף למנוי CashBus Pro.
      </p>

      <div className="bg-white rounded-lg p-4 border border-orange-200 space-y-2">
        <div className="text-2xl font-bold text-orange-600">29 ₪<span className="text-sm font-normal text-gray-600"> / חודש</span></div>
        <ul className="text-sm text-gray-700 space-y-1 text-right">
          <li className="flex items-center gap-2 justify-end"><span>תביעות ללא הגבלה</span><Zap className="w-4 h-4 text-orange-500" /></li>
          <li className="flex items-center gap-2 justify-end"><span>מעקב אוטומטי 24/7</span><Zap className="w-4 h-4 text-orange-500" /></li>
          <li className="flex items-center gap-2 justify-end"><span>ביטול בכל עת</span><Zap className="w-4 h-4 text-orange-500" /></li>
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-colors disabled:opacity-60"
        >
          {loading ? 'מעביר לתשלום...' : 'הצטרף עכשיו – 29 ₪ / חודש'}
        </button>
        <button
          onClick={() => router.push('/subscription')}
          className="text-sm text-orange-600 hover:underline flex items-center justify-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          פרטים נוספים על המנוי
        </button>
      </div>
    </div>
  )
}

// =====================================================
// Gate wrapper component
// =====================================================

interface SubscriptionGateProps {
  children: React.ReactNode
  /** Called when the gate blocks (user clicks blocked CTA). Default: redirect to /subscription */
  onBlock?: () => void
  /** Show inline upgrade prompt instead of hiding children */
  showUpgradeInline?: boolean
}

export default function SubscriptionGate({ children, onBlock, showUpgradeInline }: SubscriptionGateProps) {
  const { canCreate, status, loading } = useSubscriptionGate()
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!canCreate) {
    if (showUpgradeInline) {
      return <SubscriptionUpgradePrompt freeClaimsUsed={status?.freeClaimsUsed ?? FREE_CLAIMS_LIMIT} />
    }

    // Render a locked button
    return (
      <div
        onClick={onBlock ?? (() => router.push('/subscription'))}
        className="cursor-pointer"
      >
        <div className="relative inline-block w-full">
          <div className="pointer-events-none opacity-50 select-none">
            {children}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-lg">
              <Lock className="w-4 h-4" />
              נדרש מנוי
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// =====================================================
// Free claims counter badge (for display in UI)
// =====================================================

export function FreeClaimsBadge() {
  const { status, loading } = useSubscriptionGate()

  if (loading || !status) return null
  if (status.isSubscribed) return null
  if (status.freeClaimsLeft === 0) return null

  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}
      dir="rtl"
    >
      <Zap className="w-3 h-3" />
      <span>
        {status.freeClaimsLeft} {status.freeClaimsLeft === 1 ? 'תביעה חינמית נותרה' : 'תביעות חינמיות נותרו'}
      </span>
    </div>
  )
}
