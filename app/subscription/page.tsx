'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Crown, CheckCircle, Zap, ArrowRight, AlertCircle, CreditCard, XCircle, Clock, Star, Flame, Gift } from 'lucide-react'
import { getSubscriptionStatus, type SubscriptionStatus, FREE_CLAIMS_LIMIT, SUBSCRIPTION_PRICE_NIS } from '@/lib/subscriptionService'
import { getUserPoints, redeemPointsForSubscription, POINTS_FOR_FREE_MONTH, type UserPoints } from '@/lib/pointsService'
import { getSession } from '@/lib/supabase'

// =====================================================
// Inner page (uses useSearchParams → must be wrapped in Suspense)
// =====================================================

function SubscriptionPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [points, setPoints] = useState<UserPoints | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  // true when user just completed checkout and we confirmed subscription is active
  const [justActivated, setJustActivated] = useState(false)

  // Handle success/cancel redirect from Stripe
  // After a successful checkout Stripe redirects here BEFORE the webhook fires,
  // so we poll until the DB status flips to 'active' (up to ~30 seconds).
  useEffect(() => {
    const result = searchParams.get('subscription')
    window.history.replaceState({}, '', '/subscription')

    if (result === 'canceled') {
      setToast({ type: 'error', message: 'התשלום בוטל. תוכל להצטרף בכל עת.' })
      return
    }

    if (result === 'success') {
      setToast({ type: 'success', message: 'התשלום התקבל! מפעיל את המנוי...' })

      // Poll until DB is updated by webhook (max 15 attempts × 2 s = 30 s)
      let attempts = 0
      const MAX_ATTEMPTS = 15
      const interval = setInterval(async () => {
        attempts++
        const freshStatus = await getSubscriptionStatus()
        if (freshStatus.isSubscribed) {
          clearInterval(interval)
          setStatus(freshStatus)
          setJustActivated(true)
          setToast({ type: 'success', message: 'המנוי הופעל בהצלחה! תהנה מתביעות ללא הגבלה.' })
        } else if (attempts >= MAX_ATTEMPTS) {
          clearInterval(interval)
          // Give the user a manual-refresh hint
          setToast({ type: 'error', message: 'המנוי ייכנס לתוקף תוך מספר דקות. רענן את הדף אם הסטטוס לא מתעדכן.' })
        }
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [searchParams])

  useEffect(() => {
    async function load() {
      const session = await getSession()
      if (!session) {
        router.push('/auth')
        return
      }
      const [s, p] = await Promise.all([getSubscriptionStatus(), getUserPoints()])
      setStatus(s)
      setPoints(p)
      setLoading(false)
    }
    load()
  }, [router])

  const handleRedeem = async () => {
    setRedeemLoading(true)
    const result = await redeemPointsForSubscription()
    if (result.success) {
      setToast({ type: 'success', message: `הנקודות נוכו! יתרה חדשה: ${result.newBalance} נקודות. צוות CashBus יפעיל את החודש החינמי תוך 24 שעות.` })
      setPoints((prev) => prev ? { ...prev, total_points: result.newBalance } : prev)
    } else {
      setToast({ type: 'error', message: result.error ?? 'שגיאה בפדיון נקודות' })
    }
    setRedeemLoading(false)
  }

  const handleSubscribeOrManage = async () => {
    setCheckoutLoading(true)
    try {
      const session = await getSession()
      const token = (session as any)?.access_token

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
      } else {
        setToast({ type: 'error', message: 'שגיאה ביצירת סשן תשלום. אנא נסה שנית.' })
      }
    } catch {
      setToast({ type: 'error', message: 'שגיאת רשת. אנא בדוק את החיבור.' })
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isSubscribed = status?.isSubscribed ?? false
  const freeLeft = status?.freeClaimsLeft ?? FREE_CLAIMS_LIMIT

  const formatDate = (iso?: string) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm font-medium text-white ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="mr-auto text-white/70 hover:text-white">✕</button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowRight className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-orange-500" />
            <h1 className="text-xl font-bold text-gray-900">המנוי שלי</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* "Back to claims" banner – shown only right after a successful upgrade */}
        {justActivated && (
          <div className="rounded-xl bg-green-500 text-white p-5 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-bold text-base">המנוי פעיל! אפשר להתחיל ליצור תביעות</p>
                <p className="text-sm text-green-100">לחץ על הכפתור כדי לחזור לתיקים שלך</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/claims')}
              className="bg-white text-green-700 font-bold text-sm px-4 py-2 rounded-lg hover:bg-green-50 transition-colors shrink-0"
            >
              לתיקים שלי ←
            </button>
          </div>
        )}

        {/* Current Status Card */}
        <div className={`rounded-xl p-6 border-2 ${
          isSubscribed
            ? 'bg-green-50 border-green-300'
            : freeLeft > 0
              ? 'bg-orange-50 border-orange-200'
              : 'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {isSubscribed ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : freeLeft > 0 ? (
                <Zap className="w-6 h-6 text-orange-500" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-500" />
              )}
              <span className="font-bold text-lg">
                {isSubscribed
                  ? 'מנוי פעיל – CashBus Pro'
                  : freeLeft > 0
                    ? 'חשבון חינמי'
                    : 'המכסה החינמית מוצתה'}
              </span>
            </div>

            {isSubscribed && (
              <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">פעיל</span>
            )}
          </div>

          {isSubscribed ? (
            <div className="space-y-2 text-sm text-green-800">
              {status?.currentPeriodEnd && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-600" />
                  <span>
                    {status.cancelAtPeriodEnd
                      ? `המנוי יסתיים ב-${formatDate(status.currentPeriodEnd)}`
                      : `חידוש הבא: ${formatDate(status.currentPeriodEnd)}`}
                  </span>
                </div>
              )}
              <p>תביעות ללא הגבלה • ביטול בכל עת</p>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <p className={freeLeft > 0 ? 'text-orange-700' : 'text-red-700'}>
                {freeLeft > 0
                  ? `נותרו לך ${freeLeft} מתוך ${FREE_CLAIMS_LIMIT} תביעות חינמיות`
                  : `השתמשת בכל ${FREE_CLAIMS_LIMIT} התביעות החינמיות שלך`}
              </p>
              {freeLeft === 0 && (
                <p className="text-red-600 font-medium">כדי לפתוח תביעות נוספות, עבור למנוי Pro</p>
              )}
            </div>
          )}
        </div>

        {/* Plan Details Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Plan header */}
          <div className="bg-gradient-to-l from-orange-500 to-orange-400 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm opacity-80 mb-1">CashBus</div>
                <div className="text-2xl font-bold">Pro</div>
              </div>
              <div className="text-left">
                <div className="text-3xl font-bold">{SUBSCRIPTION_PRICE_NIS} ₪</div>
                <div className="text-sm opacity-80">לחודש</div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="p-6 space-y-3">
            {[
              'תביעות ללא הגבלה',
              'מכתבי התראה אוטומטיים',
              'מעקב תביעות 24/7',
              'ייצוא PDF מקצועי',
              'תמיכה מועדפת',
              'ביטול בכל עת',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                <span className="text-gray-700">{feature}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="px-6 pb-6">
            <button
              onClick={handleSubscribeOrManage}
              disabled={checkoutLoading}
              className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-lg"
            >
              <CreditCard className="w-5 h-5" />
              {checkoutLoading
                ? 'מעביר לתשלום...'
                : isSubscribed
                  ? 'ניהול מנוי וחיוב'
                  : 'הצטרף עכשיו'}
            </button>
            {!isSubscribed && (
              <p className="text-center text-xs text-gray-500 mt-2">
                תשלום מאובטח דרך Stripe • ביטול בכל עת
              </p>
            )}
          </div>
        </div>

        {/* Points / Loyalty Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-l from-amber-500 to-orange-400 p-5 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-6 h-6 fill-white text-white" />
                <h2 className="font-bold text-lg">נקודות נאמנות</h2>
              </div>
              {points && points.streak_days > 1 && (
                <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
                  <Flame className="w-4 h-4 text-red-200" />
                  <span className="text-sm font-bold">רצף {points.streak_days} ימים</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Balance */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">היתרה שלך</p>
                <p className="text-4xl font-bold text-gray-900">
                  {(points?.total_points ?? 0).toLocaleString('he-IL')}
                  <span className="text-lg text-gray-400 font-normal mr-1">נקודות</span>
                </p>
              </div>
              <div className="text-left text-sm text-gray-500">
                <p>חסכת עד כה</p>
                <p className="font-bold text-gray-700">{(points?.lifetime_earned ?? 0).toLocaleString('he-IL')} נק׳</p>
              </div>
            </div>

            {/* Progress to free month */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 flex items-center gap-1">
                  <Gift className="w-4 h-4 text-orange-500" />
                  חודש חינמי
                </span>
                <span className="font-semibold text-gray-700">
                  {Math.min(points?.total_points ?? 0, POINTS_FOR_FREE_MONTH)} / {POINTS_FOR_FREE_MONTH}
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-orange-500 to-amber-400 transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(((points?.total_points ?? 0) / POINTS_FOR_FREE_MONTH) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* How to earn */}
            <div className="bg-orange-50 rounded-xl p-4 space-y-2 text-sm">
              <p className="font-semibold text-gray-800 mb-3">איך לצבור נקודות:</p>
              {[
                { label: 'כניסה יומית', points: '5', bonus: '+ עד 25 בונוס רצף' },
                { label: 'דיווח אירוע', points: '10', bonus: '' },
                { label: 'פתיחת תביעה', points: '50', bonus: '' },
              ].map(({ label, points: p, bonus }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-gray-700">{label}</span>
                  <span className="font-bold text-orange-600">
                    +{p} נק׳ {bonus && <span className="text-xs text-gray-500 font-normal">{bonus}</span>}
                  </span>
                </div>
              ))}
            </div>

            {/* Redeem button */}
            <button
              onClick={handleRedeem}
              disabled={redeemLoading || (points?.total_points ?? 0) < POINTS_FOR_FREE_MONTH}
              className="w-full py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed
                bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Gift className="w-5 h-5" />
              {redeemLoading
                ? 'מעבד...'
                : `פדה ${POINTS_FOR_FREE_MONTH} נקודות – חודש חינמי`}
            </button>
            {(points?.total_points ?? 0) < POINTS_FOR_FREE_MONTH && (
              <p className="text-center text-xs text-gray-500">
                חסרות לך עוד {POINTS_FOR_FREE_MONTH - (points?.total_points ?? 0)} נקודות
              </p>
            )}
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-bold text-gray-900 text-lg">שאלות נפוצות</h2>
          {[
            {
              q: 'מה כוללת המנוי?',
              a: 'פתיחת תביעות ללא הגבלה כנגד חברות תחבורה ציבורית, יצירה אוטומטית של מכתבי התראה ב-PDF, ומעקב אחר סטטוס כל תביעה.',
            },
            {
              q: 'האם אוכל לבטל?',
              a: 'כן, בכל עת דרך פורטל החיוב של Stripe. תוכל להמשיך להשתמש במנוי עד סוף התקופה שכבר שולמה.',
            },
            {
              q: 'מה קורה לתביעות שכבר פתחתי?',
              a: 'כל התביעות הקיימות נשמרות. הביטול משפיע רק על יכולת לפתוח תביעות חדשות לאחר סיום התקופה.',
            },
            {
              q: 'האם ה-20% עמלת הצלחה משתנה?',
              a: 'לא. עמלת ההצלחה (20%) חלה על כל הפיצויים שמתקבלים, ללא קשר לסטטוס המנוי.',
            },
          ].map(({ q, a }) => (
            <details key={q} className="group">
              <summary className="cursor-pointer font-medium text-gray-800 list-none flex items-center justify-between">
                {q}
                <span className="text-gray-400 group-open:rotate-90 transition-transform">›</span>
              </summary>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed pr-2">{a}</p>
            </details>
          ))}
        </div>

      </main>
    </div>
  )
}

// =====================================================
// Export with Suspense boundary (required for useSearchParams)
// =====================================================

export default function SubscriptionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SubscriptionPageInner />
    </Suspense>
  )
}
