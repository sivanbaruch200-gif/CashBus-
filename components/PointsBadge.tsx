'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Flame } from 'lucide-react'
import { getUserPoints, POINTS_FOR_FREE_MONTH, type UserPoints } from '@/lib/pointsService'

/**
 * PointsBadge - compact header widget
 * Shows current points + streak.
 * Clicking navigates to /subscription (where redemption lives).
 */
export default function PointsBadge() {
  const router = useRouter()
  const [pts, setPts] = useState<UserPoints | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUserPoints().then((p) => {
      setPts(p)
      setLoading(false)
    })
  }, [])

  if (loading || !pts) return null

  const progressPct = Math.min((pts.total_points / POINTS_FOR_FREE_MONTH) * 100, 100)

  return (
    <button
      onClick={() => router.push('/subscription')}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors"
      title={`${pts.total_points} נקודות (${progressPct.toFixed(0)}% לחודש חינמי)`}
    >
      {/* Points */}
      <div className="flex items-center gap-1">
        <Star className="w-4 h-4 text-orange-500 fill-orange-400" />
        <span className="text-sm font-bold text-orange-700">{pts.total_points.toLocaleString('he-IL')}</span>
      </div>

      {/* Streak */}
      {pts.streak_days > 1 && (
        <div className="flex items-center gap-0.5 border-r border-orange-200 pr-2 mr-0">
          <Flame className="w-4 h-4 text-red-500" />
          <span className="text-xs font-semibold text-red-600">{pts.streak_days}</span>
        </div>
      )}
    </button>
  )
}
