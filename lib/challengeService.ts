import { supabase } from './supabase'

// Types
export interface UserStats {
  totalPoints: number
  currentStreak: number
  longestStreak: number
  level: string
  levelLabel: string
  checkedInToday: boolean
  achievements: Achievement[]
  lastCheckinDate: string | null
}

export interface WeeklyProgress {
  days: { date: string; dayName: string; checkedIn: boolean }[]
}

export interface Achievement {
  id: string
  label: string
  description: string
  icon: string
  unlockedAt: string | null
}

// Level definitions
const LEVELS = [
  { key: 'beginner', label: 'נוסע מתחיל', minPoints: 0 },
  { key: 'active', label: 'נוסע פעיל', minPoints: 100 },
  { key: 'experienced', label: 'נוסע מנוסה', minPoints: 500 },
  { key: 'guardian', label: 'שומר דרך', minPoints: 2000 },
  { key: 'champion', label: 'אלוף הנוסעים', minPoints: 5000 },
]

// Achievement definitions
const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlockedAt'>[] = [
  { id: 'first_checkin', label: 'צעד ראשון', description: 'ביצעת צ׳ק-אין ראשון', icon: '🎯' },
  { id: 'first_incident', label: 'עין פקוחה', description: 'דיווחת על תקלה ראשונה', icon: '👁️' },
  { id: 'streak_3', label: '3 ימים ברצף', description: 'סטריק של 3 ימים', icon: '🔥' },
  { id: 'streak_7', label: 'שבוע שלם', description: 'סטריק של 7 ימים', icon: '⭐' },
  { id: 'streak_14', label: 'שבועיים חזק', description: 'סטריק של 14 ימים', icon: '💎' },
  { id: 'streak_30', label: 'חודש מלא!', description: 'סטריק של 30 ימים', icon: '🏆' },
  { id: 'points_100', label: 'מאה ראשונה', description: 'צברת 100 נקודות', icon: '💯' },
  { id: 'points_500', label: 'חמש מאות', description: 'צברת 500 נקודות', icon: '🚀' },
  { id: 'points_2000', label: 'אלפיים!', description: 'צברת 2,000 נקודות', icon: '🌟' },
  { id: 'incidents_5', label: 'חמישה דיווחים', description: 'דיווחת על 5 תקלות', icon: '📋' },
  { id: 'incidents_10', label: 'עשרה דיווחים', description: 'דיווחת על 10 תקלות', icon: '📊' },
]

function getLevel(points: number): { key: string; label: string } {
  let current = LEVELS[0]
  for (const level of LEVELS) {
    if (points >= level.minPoints) {
      current = level
    }
  }
  return current
}

function getNextLevel(points: number): { label: string; minPoints: number; progress: number } | null {
  for (let i = 0; i < LEVELS.length; i++) {
    if (points < LEVELS[i].minPoints) {
      const prev = i > 0 ? LEVELS[i - 1].minPoints : 0
      const next = LEVELS[i].minPoints
      return {
        label: LEVELS[i].label,
        minPoints: next,
        progress: ((points - prev) / (next - prev)) * 100,
      }
    }
  }
  return null // Max level reached
}

export { getNextLevel }

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

function getWeekDates(): string[] {
  const today = new Date()
  const day = today.getDay() // 0 = Sunday
  const dates: string[] = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - day + i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

const DAY_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

// Get or create user gamification stats
async function ensureUserStats(userId: string) {
  const { data, error } = await supabase
    .from('user_gamification')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    const { data: newData, error: insertError } = await supabase
      .from('user_gamification')
      .insert({ user_id: userId })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating user stats:', insertError)
      return null
    }
    return newData
  }
  return data
}

// Perform daily check-in
export async function performCheckin(userId: string): Promise<{ points: number; newAchievements: Achievement[] }> {
  const today = getTodayDate()

  // Check if already checked in today
  const { data: existing } = await supabase
    .from('user_checkins')
    .select('id')
    .eq('user_id', userId)
    .eq('check_date', today)
    .maybeSingle()

  if (existing) {
    return { points: 0, newAchievements: [] }
  }

  // Check for first incident of the week bonus
  const weekDates = getWeekDates()
  const { count: weekIncidents } = await supabase
    .from('incidents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', weekDates[0])
    .lte('created_at', weekDates[6] + 'T23:59:59')

  let pointsEarned = 10 // Base check-in points

  // Insert check-in
  const { error: checkinError } = await supabase
    .from('user_checkins')
    .insert({
      user_id: userId,
      check_date: today,
      points_earned: pointsEarned,
    })

  if (checkinError) {
    console.error('Error inserting checkin:', checkinError)
    return { points: 0, newAchievements: [] }
  }

  // Update gamification stats
  const stats = await ensureUserStats(userId)
  if (!stats) return { points: pointsEarned, newAchievements: [] }

  // Calculate streak
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  let newStreak = 1
  if (stats.last_checkin_date === yesterdayStr) {
    newStreak = (stats.current_streak || 0) + 1
  }

  const newTotalPoints = (stats.total_points || 0) + pointsEarned
  const newLongestStreak = Math.max(stats.longest_streak || 0, newStreak)
  const newLevel = getLevel(newTotalPoints)

  // Check for new achievements
  const currentAchievements: Achievement[] = stats.achievements || []
  const unlockedIds = new Set(currentAchievements.filter(a => a.unlockedAt).map(a => a.id))
  const newAchievements: Achievement[] = []

  const checksToPerform = [
    { id: 'first_checkin', condition: true },
    { id: 'streak_3', condition: newStreak >= 3 },
    { id: 'streak_7', condition: newStreak >= 7 },
    { id: 'streak_14', condition: newStreak >= 14 },
    { id: 'streak_30', condition: newStreak >= 30 },
    { id: 'points_100', condition: newTotalPoints >= 100 },
    { id: 'points_500', condition: newTotalPoints >= 500 },
    { id: 'points_2000', condition: newTotalPoints >= 2000 },
  ]

  for (const check of checksToPerform) {
    if (check.condition && !unlockedIds.has(check.id)) {
      const def = ACHIEVEMENT_DEFS.find(a => a.id === check.id)
      if (def) {
        const achievement = { ...def, unlockedAt: new Date().toISOString() }
        newAchievements.push(achievement)
      }
    }
  }

  // Merge achievements
  const mergedAchievements = [...currentAchievements]
  for (const na of newAchievements) {
    const existing = mergedAchievements.findIndex(a => a.id === na.id)
    if (existing >= 0) {
      mergedAchievements[existing] = na
    } else {
      mergedAchievements.push(na)
    }
  }

  await supabase
    .from('user_gamification')
    .update({
      total_points: newTotalPoints,
      current_streak: newStreak,
      longest_streak: newLongestStreak,
      level: newLevel.key,
      achievements: mergedAchievements,
      last_checkin_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return { points: pointsEarned, newAchievements }
}

// Get user stats
export async function getUserStats(userId: string): Promise<UserStats> {
  const stats = await ensureUserStats(userId)
  const today = getTodayDate()

  if (!stats) {
    return {
      totalPoints: 0,
      currentStreak: 0,
      longestStreak: 0,
      level: 'beginner',
      levelLabel: 'נוסע מתחיל',
      checkedInToday: false,
      achievements: [],
      lastCheckinDate: null,
    }
  }

  // Check if streak is still valid (didn't miss yesterday)
  let currentStreak = stats.current_streak || 0
  if (stats.last_checkin_date) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    if (stats.last_checkin_date !== today && stats.last_checkin_date !== yesterdayStr) {
      currentStreak = 0
    }
  }

  const level = getLevel(stats.total_points || 0)

  // Build full achievement list with unlock status
  const unlockedMap = new Map<string, string>()
  if (stats.achievements) {
    for (const a of stats.achievements as Achievement[]) {
      if (a.unlockedAt) {
        unlockedMap.set(a.id, a.unlockedAt)
      }
    }
  }

  const achievements: Achievement[] = ACHIEVEMENT_DEFS.map(def => ({
    ...def,
    unlockedAt: unlockedMap.get(def.id) || null,
  }))

  return {
    totalPoints: stats.total_points || 0,
    currentStreak,
    longestStreak: stats.longest_streak || 0,
    level: level.key,
    levelLabel: level.label,
    checkedInToday: stats.last_checkin_date === today,
    achievements,
    lastCheckinDate: stats.last_checkin_date,
  }
}

// Get weekly progress
export async function getWeeklyProgress(userId: string): Promise<WeeklyProgress> {
  const weekDates = getWeekDates()

  const { data: checkins } = await supabase
    .from('user_checkins')
    .select('check_date')
    .eq('user_id', userId)
    .in('check_date', weekDates)

  const checkinDates = new Set((checkins || []).map(c => c.check_date))

  return {
    days: weekDates.map((date, i) => ({
      date,
      dayName: DAY_NAMES[i],
      checkedIn: checkinDates.has(date),
    })),
  }
}
