'use client'

import { useState, useEffect, useCallback } from 'react'
import { Star, Flame, X } from 'lucide-react'
import { recordDailyLogin, type DailyLoginResult } from '@/lib/pointsService'
import { getSession } from '@/lib/supabase'

/**
 * DailyLoginReward
 *
 * Mounts once per page load. Calls /api/points/daily-login.
 * If new points were earned, shows a toast for 4 seconds.
 *
 * Usage: add <DailyLoginReward /> to any authenticated page
 * (e.g., the main dashboard/claims page).
 */
export default function DailyLoginReward() {
  const [result, setResult] = useState<DailyLoginResult | null>(null)
  const [visible, setVisible] = useState(false)

  const dismiss = useCallback(() => setVisible(false), [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    async function run() {
      // Only run if authenticated
      const session = await getSession()
      if (!session) return

      const data = await recordDailyLogin()
      if (!data || data.alreadyLoggedInToday || data.pointsEarned === 0) return

      setResult(data)
      setVisible(true)

      // Auto-dismiss after 4 seconds
      timer = setTimeout(() => setVisible(false), 4000)
    }

    run()
    return () => clearTimeout(timer)
  }, [])

  if (!visible || !result) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-50 max-w-xs bg-white border border-orange-200 shadow-xl rounded-2xl px-5 py-4 flex items-start gap-3 animate-slide-up"
      dir="rtl"
    >
      {/* Icon */}
      <div className="bg-orange-100 rounded-full p-2 shrink-0">
        <Star className="w-6 h-6 text-orange-500 fill-orange-400" />
      </div>

      {/* Content */}
      <div className="flex-1">
        <p className="font-bold text-gray-900 text-sm">
          +{result.pointsEarned} נקודות!
        </p>
        <p className="text-xs text-gray-600 mt-0.5">
          {result.streakDays > 1 ? (
            <span className="flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-red-500 inline" />
              רצף {result.streakDays} ימים
              {result.streakBonus > 0 && ` (+${result.streakBonus} בונוס)`}
            </span>
          ) : (
            'כניסה יומית'
          )}
        </p>
        <p className="text-xs text-orange-600 font-medium mt-1">
          סה"כ: {result.totalPoints.toLocaleString('he-IL')} נקודות
        </p>
      </div>

      {/* Close */}
      <button
        onClick={dismiss}
        className="text-gray-400 hover:text-gray-600 shrink-0"
        aria-label="סגור"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
