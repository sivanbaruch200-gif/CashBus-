/**
 * Compensation Calculation Logic
 * Based on Israeli public transportation regulations and court precedents
 */

export interface CompensationParams {
  incidentType: 'delay' | 'no_stop' | 'no_arrival'
  delayMinutes?: number // For delay type
  damageType?: 'taxi_cost' | 'lost_workday' | 'missed_exam' | 'medical_appointment' | 'other'
  damageAmount?: number
  busCompany: string
}

export interface CompensationResult {
  baseCompensation: number
  damageCompensation: number
  totalCompensation: number
  legalBasis: string
  description: string
}

/**
 * Calculate compensation based on incident details
 *
 * Legal basis: Israeli Regulation 428g and court precedents
 * - No arrival / No stop: 50-100 NIS base compensation
 * - Delay (20+ min): 30-80 NIS base compensation
 * - Additional damages: Actual cost (taxi, lost wages, etc.)
 */
export function calculateCompensation(params: CompensationParams): CompensationResult {
  let baseCompensation = 0
  let damageCompensation = params.damageAmount || 0
  let legalBasis = ''
  let description = ''

  // Calculate base compensation based on incident type
  switch (params.incidentType) {
    case 'no_arrival':
      baseCompensation = 80
      legalBasis = 'תקנה 428ז - אי הגעת אוטובוס לתחנה'
      description = 'פיצוי בסיס בגין אוטובוס שלא הגיע כלל לתחנה'
      break

    case 'no_stop':
      baseCompensation = 70
      legalBasis = 'תקנה 428ז - אי עצירה בתחנה'
      description = 'פיצוי בסיס בגין אוטובוס שלא עצר בתחנה למרות איתות'
      break

    case 'delay':
      // Delay compensation scales with duration
      const minutes = params.delayMinutes || 20
      if (minutes >= 60) {
        baseCompensation = 100
        description = 'פיצוי בגין עיכוב חמור (מעל שעה)'
      } else if (minutes >= 40) {
        baseCompensation = 60
        description = 'פיצוי בגין עיכוב משמעותי (40-60 דקות)'
      } else if (minutes >= 20) {
        baseCompensation = 35
        description = 'פיצוי בגין עיכוב (20-40 דקות)'
      } else {
        baseCompensation = 0
        description = 'עיכוב של פחות מ-20 דקות אינו מזכה בפיצוי'
      }
      legalBasis = 'תקנה 428ז - עיכוב משמעותי בשירות'
      break
  }

  // Add damage compensation based on type
  if (params.damageType && params.damageAmount) {
    switch (params.damageType) {
      case 'taxi_cost':
        // Taxi costs are fully compensable with receipt
        damageCompensation = params.damageAmount
        description += ' + החזר הוצאות מונית בפועל'
        break

      case 'lost_workday':
        // Lost wages - typically 300-500 NIS per day
        damageCompensation = Math.min(params.damageAmount, 500)
        description += ' + אובדן שכר יומי'
        break

      case 'missed_exam':
        // Educational damage - can be significant
        damageCompensation = Math.min(params.damageAmount, 1000)
        description += ' + נזק בגין החמצת בחינה'
        legalBasis += ' + תקנות צרכנות (הגנת הצרכן)'
        break

      case 'medical_appointment':
        // Medical appointment - moderate compensation
        damageCompensation = Math.min(params.damageAmount, 300)
        description += ' + נזק בגין החמצת תור לרופא'
        break

      case 'other':
        // Other damages - capped at reasonable amount
        damageCompensation = Math.min(params.damageAmount, 200)
        description += ' + נזק נוסף שנגרם'
        break
    }
  }

  const totalCompensation = baseCompensation + damageCompensation

  return {
    baseCompensation,
    damageCompensation,
    totalCompensation,
    legalBasis,
    description,
  }
}

/**
 * Calculate accumulated compensation for multiple incidents
 * This shows the user their total potential claim amount
 */
export function calculateAccumulatedCompensation(
  incidents: Array<{ incidentType: string; damageAmount?: number }>
): number {
  return incidents.reduce((total, incident) => {
    const result = calculateCompensation({
      incidentType: incident.incidentType as any,
      damageAmount: incident.damageAmount,
      busCompany: '',
    })
    return total + result.totalCompensation
  }, 0)
}

/**
 * Determine if user has enough incidents to file a claim
 * Minimum threshold: 3 incidents OR 200 NIS total
 */
export function canFileClaim(
  incidentCount: number,
  totalCompensation: number
): { canFile: boolean; reason: string } {
  if (totalCompensation >= 200) {
    return {
      canFile: true,
      reason: 'סכום פיצוי מספיק להגשת תביעה',
    }
  }

  if (incidentCount >= 3) {
    return {
      canFile: true,
      reason: 'מספר אירועים מספיק להגשת תביעה מצטברת',
    }
  }

  const needMore = Math.max(3 - incidentCount, 0)
  return {
    canFile: false,
    reason: needMore > 0
      ? `נדרשים עוד ${needMore} אירועים להגשת תביעה`
      : `נדרשים עוד ${200 - totalCompensation} ₪ להגשת תביעה`,
  }
}

/**
 * Get bus company Hebrew name
 */
export function getBusCompanyName(company: string): string {
  const companies: Record<string, string> = {
    egged: 'אגד',
    dan: 'דן',
    kavim: 'קווים',
    metropoline: 'מטרופולין',
    nateev_express: 'נתיב אקספרס',
    superbus: 'סופרבוס',
    egged_taavura: 'אגד תעבורה',
    afikim: 'אפיקים',
    golan: 'גולן',
    galim: 'גלים',
    tnufa: 'תנופה',
    other: 'אחר',
  }

  return companies[company.toLowerCase()] || company
}
