'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle, Circle, Flame, Award, ChevronDown, ChevronUp,
  Zap, Star
} from 'lucide-react'
import {
  getUserStats, getWeeklyProgress, performCheckin, getNextLevel,
  type UserStats, type WeeklyProgress, type Achievement
} from '@/lib/challengeService'

interface DailyChallengeProps {
  userId: string
}

export default function DailyChallenge({ userId }: DailyChallengeProps) {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [weekly, setWeekly] = useState<WeeklyProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  const [justCheckedIn, setJustCheckedIn] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([])

  useEffect(() => {
    loadData()
  }, [userId])

  async function loadData() {
    setLoading(true)
    try {
      const [statsData, weeklyData] = await Promise.all([
        getUserStats(userId),
        getWeeklyProgress(userId),
      ])
      setStats(statsData)
      setWeekly(weeklyData)
    } catch (error) {
      console.error('Error loading challenge data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckin() {
    if (checkingIn || stats?.checkedInToday) return

    setCheckingIn(true)
    try {
      const result = await performCheckin(userId)
      setPointsEarned(result.points)
      setNewAchievements(result.newAchievements)
      setJustCheckedIn(true)

      await loadData()

      setTimeout(() => {
        setJustCheckedIn(false)
        setPointsEarned(0)
        setNewAchievements([])
      }, 3000)
    } catch (error) {
      console.error('Error checking in:', error)
    } finally {
      setCheckingIn(false)
    }
  }

  function getStreakDisplay(count: number): string {
    if (count >= 30) return '🏆'
    if (count >= 14) return '💎'
    if (count >= 7) return '⭐'
    if (count >= 3) return '🔥'
    if (count >= 1) return '✨'
    return ''
  }

  const nextLevel = stats ? getNextLevel(stats.totalPoints) : null
  const unlockedCount = stats?.achievements.filter(a => a.unlockedAt).length || 0
  const totalAchievements = stats?.achievements.length || 0

  const todayIndex = new Date().getDay()

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-surface-overlay animate-pulse" />
          <div className="h-5 w-32 bg-surface-overlay rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="h-16 bg-surface-overlay rounded-xl animate-pulse" />
          <div className="h-12 bg-surface-overlay rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent-surface rounded-xl border border-accent-border">
            <Zap className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h3 className="text-content-primary font-bold text-lg">אתגר הנוסע</h3>
            <p className="text-content-tertiary text-xs">{stats?.levelLabel || 'נוסע מתחיל'}</p>
          </div>
        </div>

        {stats && stats.currentStreak > 0 && (
          <div className="flex items-center gap-1.5 bg-accent-surface border border-accent-border rounded-full px-3 py-1">
            <Flame className="w-4 h-4 text-accent" />
            <span className="text-accent-light text-sm font-bold">{stats.currentStreak}</span>
            <span className="text-content-tertiary text-xs">ימים</span>
          </div>
        )}
      </div>

      {/* Check-in button */}
      <div className="mb-5">
        {stats?.checkedInToday ? (
          <div
            className="w-full flex items-center justify-center gap-3 py-4 bg-accent-surface border border-accent-border rounded-xl"
            style={justCheckedIn ? { animation: 'fade-in-up 0.5s ease-out' } : undefined}
          >
            <CheckCircle className="w-6 h-6 text-accent" />
            <span className="text-accent-light font-semibold">עשית צ׳ק-אין היום!</span>
            {justCheckedIn && pointsEarned > 0 && (
              <span className="text-gold font-bold text-sm" style={{ animation: 'fade-in-up 0.3s ease-out' }}>
                +{pointsEarned} נק׳
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={handleCheckin}
            disabled={checkingIn}
            className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-3"
          >
            {checkingIn ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>מבצע צ׳ק-אין...</span>
              </>
            ) : (
              <>
                <Star className="w-6 h-6" />
                <span>צ׳ק-אין יומי</span>
                <span className="text-white/70 text-sm font-normal">+10 נק׳</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* New achievements notification */}
      {newAchievements.length > 0 && (
        <div className="mb-4 space-y-2" style={{ animation: 'scale-in 0.5s ease-out' }}>
          {newAchievements.map(achievement => (
            <div
              key={achievement.id}
              className="flex items-center gap-3 p-3 bg-accent-surface border border-accent-border rounded-xl"
            >
              <span className="text-2xl">{achievement.icon}</span>
              <div>
                <p className="text-gold font-bold text-sm">{achievement.label}</p>
                <p className="text-content-tertiary text-xs">{achievement.description}</p>
              </div>
              <Award className="w-5 h-5 text-gold mr-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Weekly progress */}
      {weekly && (
        <div className="mb-5">
          <p className="text-content-tertiary text-xs mb-3">ההתקדמות השבועית שלך</p>
          <div className="flex justify-between gap-1">
            {weekly.days.map((day, i) => (
              <div key={day.date} className="flex flex-col items-center gap-1.5">
                <span className={`text-xs ${i === todayIndex ? 'text-accent-light font-bold' : 'text-content-tertiary'}`}>
                  {day.dayName}
                </span>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    day.checkedIn
                      ? 'bg-accent shadow-accent-glow'
                      : i === todayIndex
                        ? 'border-2 border-accent/50 bg-accent-surface'
                        : 'border border-surface-border bg-transparent'
                  }`}
                >
                  {day.checkedIn ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : (
                    <Circle className={`w-4 h-4 ${i === todayIndex ? 'text-accent/50' : 'text-surface-border'}`} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Points and level progress */}
      {stats && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-content-tertiary text-xs">
              {stats.levelLabel} • {stats.totalPoints.toLocaleString('he-IL')} נק׳
            </span>
            {nextLevel && (
              <span className="text-content-tertiary text-xs">
                הבא: {nextLevel.label}
              </span>
            )}
          </div>
          {nextLevel && (
            <div className="h-2 bg-surface-overlay rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-light transition-all duration-1000"
                style={{ width: `${nextLevel.progress}%` }}
              />
            </div>
          )}
          {!nextLevel && (
            <div className="h-2 bg-surface-overlay rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-dim w-full" />
            </div>
          )}
        </div>
      )}

      {/* Streak info */}
      {stats && stats.currentStreak > 0 && (
        <div className="text-center mb-4 py-2 bg-surface-overlay rounded-lg">
          <span className="text-content-tertiary text-xs">
            {getStreakDisplay(stats.currentStreak)} {stats.currentStreak} ימים ברצף
            {stats.longestStreak > stats.currentStreak && (
              <span> • שיא: {stats.longestStreak}</span>
            )}
          </span>
        </div>
      )}

      {/* Achievements section */}
      <div className="border-t border-surface-border pt-3">
        <button
          onClick={() => setShowAchievements(!showAchievements)}
          className="w-full flex items-center justify-between text-content-tertiary hover:text-content-primary transition-colors"
        >
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-gold" />
            <span className="text-sm font-medium">הישגים ({unlockedCount}/{totalAchievements})</span>
          </div>
          {showAchievements ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAchievements && stats && (
          <div className="mt-3 grid grid-cols-2 gap-2" style={{ animation: 'fade-in-up 0.3s ease-out' }}>
            {stats.achievements.map(achievement => (
              <div
                key={achievement.id}
                className={`flex items-center gap-2 p-2.5 rounded-lg ${
                  achievement.unlockedAt
                    ? 'bg-surface-overlay'
                    : 'bg-surface-overlay/30 opacity-40'
                }`}
              >
                <span className="text-lg">{achievement.icon}</span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold truncate ${
                    achievement.unlockedAt ? 'text-content-primary' : 'text-content-tertiary'
                  }`}>
                    {achievement.label}
                  </p>
                  <p className="text-content-tertiary text-[10px] truncate">{achievement.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
