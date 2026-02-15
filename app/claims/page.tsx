'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, MapPin, Calendar, FileText, DollarSign, Camera, Bus, AlertCircle, CheckCircle, Clock, Send, Scale, Shield, User, Filter, Building2, Banknote, TrendingUp } from 'lucide-react'
import { supabase, getUserIncidents, getUserClaims, isUserAdmin, getAllIncidentsForAdmin, getAdminStatistics, type Incident, type Claim } from '@/lib/supabase'
import { calculateCompensation, getBusCompanyName } from '@/lib/compensation'

// List of bus companies for filtering
const BUS_COMPANIES = [
  { value: '', label: 'כל החברות' },
  { value: 'egged', label: 'אגד' },
  { value: 'dan', label: 'דן' },
  { value: 'kavim', label: 'קווים' },
  { value: 'metropoline', label: 'מטרופולין' },
  { value: 'nateev_express', label: 'נתיב אקספרס' },
  { value: 'superbus', label: 'סופרבוס' },
  { value: 'egged_taavura', label: 'אגד תעבורה' },
  { value: 'afikim', label: 'אפיקים' },
  { value: 'other', label: 'אחר' },
]

// Damage types for filtering
const DAMAGE_TYPES = [
  { value: '', label: 'כל סוגי הנזק' },
  { value: 'taxi_cost', label: 'הוצאות מונית' },
  { value: 'lost_workday', label: 'אובדן יום עבודה' },
  { value: 'missed_exam', label: 'החמצת בחינה' },
  { value: 'medical_appointment', label: 'החמצת תור לרופא' },
  { value: 'other', label: 'נזק אחר' },
  { value: 'none', label: 'ללא נזק נוסף' },
]

// Status filter options
const STATUS_FILTERS = [
  { value: '', label: 'כל הסטטוסים' },
  { value: 'submitted', label: 'ממתין לאימות' },
  { value: 'verified', label: 'מאומת' },
  { value: 'rejected', label: 'נדחה' },
  { value: 'claimed', label: 'נתבע/שולם' },
]

// Extended Incident type with profile data for admin view
interface IncidentWithProfile extends Incident {
  profiles?: {
    full_name: string
    phone: string
    email?: string
  }
}

export default function MyClaimsPage() {
  const router = useRouter()
  const [incidents, setIncidents] = useState<IncidentWithProfile[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [selectedIncident, setSelectedIncident] = useState<IncidentWithProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // Admin filter states
  const [filterCompany, setFilterCompany] = useState('')
  const [filterDamageType, setFilterDamageType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Admin statistics
  const [adminStats, setAdminStats] = useState<{
    totalUsers: number
    totalIncidents: number
    totalPotentialCompensation: number
    totalPaidCompensation: number
    totalCommission: number
  } | null>(null)

  useEffect(() => {
    // Use onAuthStateChange to properly wait for auth initialization
    // This fixes the race condition where isUserAdmin runs before session is loaded
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (!session) {
          router.push('/auth')
          return
        }
        await loadData()
      } else if (event === 'SIGNED_OUT') {
        router.push('/auth')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  const loadData = async () => {
    // Check if user is admin - session is guaranteed to be loaded here
    const adminStatus = await isUserAdmin()
    setIsAdmin(adminStatus)

    // Load incidents - admins see all, regular users see only their own
    let userIncidents: IncidentWithProfile[]
    if (adminStatus) {
      userIncidents = await getAllIncidentsForAdmin(100)

      // Load admin statistics
      const stats = await getAdminStatistics()
      setAdminStats(stats)
    } else {
      userIncidents = await getUserIncidents(100)
    }

    const userClaims = await getUserClaims()

    setIncidents(userIncidents)
    setClaims(userClaims)
    setLoading(false)
  }

  // Filter incidents based on admin filters
  const filteredIncidents = incidents.filter(incident => {
    // Filter by company
    if (filterCompany && incident.bus_company !== filterCompany) {
      return false
    }

    // Filter by damage type
    if (filterDamageType) {
      if (filterDamageType === 'none') {
        if (incident.damage_type) return false
      } else {
        if (incident.damage_type !== filterDamageType) return false
      }
    }

    // Filter by status
    if (filterStatus) {
      if (filterStatus === 'verified' && !incident.verified) return false
      if (filterStatus === 'rejected' && incident.status !== 'rejected') return false
      if (filterStatus === 'claimed' && incident.status !== 'claimed') return false
      if (filterStatus === 'submitted' && (incident.verified || incident.status === 'rejected' || incident.status === 'claimed')) return false
    }

    return true
  })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getIncidentTypeLabel = (type: string) => {
    switch (type) {
      case 'delay': return 'עיכוב'
      case 'no_stop': return 'לא עצר'
      case 'no_arrival': return 'לא הגיע'
      default: return type
    }
  }

  const getDamageTypeLabel = (type?: string) => {
    if (!type) return null
    switch (type) {
      case 'taxi_cost': return 'הוצאות מונית'
      case 'lost_workday': return 'אובדן יום עבודה'
      case 'missed_exam': return 'החמצת בחינה'
      case 'medical_appointment': return 'החמצת תור לרופא'
      case 'other': return 'נזק אחר'
      default: return type
    }
  }

  const getStatusBadge = (status: Claim['status']) => {
    const statusConfig: Record<Claim['status'], { icon: any; label: string; bgColor: string; textColor: string; emoji: string }> = {
      'draft': { icon: FileText, label: 'טיוטה', bgColor: 'bg-gray-100', textColor: 'text-gray-700', emoji: '📝' },
      'submitted': { icon: Send, label: 'נשלח מכתב', bgColor: 'bg-orange-100', textColor: 'text-orange-700', emoji: '📨' },
      'company_review': { icon: Clock, label: 'בבדיקת החברה', bgColor: 'bg-blue-100', textColor: 'text-blue-700', emoji: '⏳' },
      'approved': { icon: CheckCircle, label: 'מאושר', bgColor: 'bg-purple-100', textColor: 'text-purple-700', emoji: '✅' },
      'rejected': { icon: AlertCircle, label: 'נדחה', bgColor: 'bg-red-100', textColor: 'text-red-700', emoji: '❌' },
      'in_court': { icon: Scale, label: 'בתהליך משפטי', bgColor: 'bg-purple-100', textColor: 'text-purple-700', emoji: '⚖️' },
      'settled': { icon: CheckCircle, label: 'הוסדר', bgColor: 'bg-green-100', textColor: 'text-green-700', emoji: '🤝' },
      'paid': { icon: CheckCircle, label: 'שולם', bgColor: 'bg-green-100', textColor: 'text-green-700', emoji: '💰' },
    }

    return statusConfig[status] || statusConfig['draft']
  }

  const getIncidentCompensation = (incident: Incident) => {
    return calculateCompensation({
      incidentType: incident.incident_type,
      delayMinutes: incident.incident_type === 'delay' ? 30 : undefined, // Default assumption
      damageType: incident.damage_type ?? undefined,
      damageAmount: incident.damage_amount ?? undefined,
      busCompany: incident.bus_company,
    })
  }

  // Use filtered incidents for display
  const displayIncidents = isAdmin ? filteredIncidents : incidents

  const totalPotential = displayIncidents.reduce((sum, incident) => {
    const compensation = getIncidentCompensation(incident)
    return sum + compensation.totalCompensation
  }, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">טוען תיקים...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowRight className="w-6 h-6 text-gray-600" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {isAdmin ? 'כל הדיווחים' : 'התיקים שלי'}
                  </h1>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                      <Shield className="w-3 h-3" />
                      מנהל
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {isAdmin ? 'תצוגת מנהל - כל הדיווחים מכל המשתמשים' : 'ארכיון דיווחים ותביעות'}
                </p>
              </div>
            </div>
            <div className="text-left">
              <div className="text-sm text-gray-600">סה"כ פוטנציאל</div>
              <div className="text-2xl font-bold text-green-600">₪{totalPotential.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Admin Statistics and Filters */}
      {isAdmin && adminStats && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-purple-200" />
                  <span className="text-xs text-purple-200">לקוחות</span>
                </div>
                <div className="text-2xl font-bold">{adminStats.totalUsers}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-purple-200" />
                  <span className="text-xs text-purple-200">דיווחים</span>
                </div>
                <div className="text-2xl font-bold">{adminStats.totalIncidents}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-purple-200" />
                  <span className="text-xs text-purple-200">פוטנציאל</span>
                </div>
                <div className="text-2xl font-bold">₪{adminStats.totalPotentialCompensation.toLocaleString()}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-300" />
                  <span className="text-xs text-purple-200">שולם</span>
                </div>
                <div className="text-2xl font-bold text-green-300">₪{adminStats.totalPaidCompensation.toLocaleString()}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border-2 border-yellow-400/50">
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className="w-4 h-4 text-yellow-300" />
                  <span className="text-xs text-yellow-200">עמלה (20%)</span>
                </div>
                <div className="text-2xl font-bold text-yellow-300">₪{adminStats.totalCommission.toLocaleString()}</div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-purple-200" />
                <span className="text-sm text-purple-200">סינון:</span>
              </div>

              {/* Company Filter */}
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-white/50 focus:border-transparent"
              >
                {BUS_COMPANIES.map(company => (
                  <option key={company.value} value={company.value} className="text-gray-900">
                    {company.label}
                  </option>
                ))}
              </select>

              {/* Damage Type Filter */}
              <select
                value={filterDamageType}
                onChange={(e) => setFilterDamageType(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-white/50 focus:border-transparent"
              >
                {DAMAGE_TYPES.map(damage => (
                  <option key={damage.value} value={damage.value} className="text-gray-900">
                    {damage.label}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-white/50 focus:border-transparent"
              >
                {STATUS_FILTERS.map(status => (
                  <option key={status.value} value={status.value} className="text-gray-900">
                    {status.label}
                  </option>
                ))}
              </select>

              {/* Active Filters Count */}
              {(filterCompany || filterDamageType || filterStatus) && (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full font-medium">
                    {displayIncidents.length} תוצאות
                  </span>
                  <button
                    onClick={() => {
                      setFilterCompany('')
                      setFilterDamageType('')
                      setFilterStatus('')
                    }}
                    className="text-xs text-purple-200 hover:text-white underline"
                  >
                    נקה סינון
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Claims & Incidents List */}
          <div className="space-y-6">
            {/* Claims Section */}
            {claims.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  תביעות ({claims.length})
                </h2>
                <div className="space-y-3">
                  {claims.map((claim) => {
                    const statusBadge = getStatusBadge(claim.status)
                    const StatusIcon = statusBadge.icon

                    return (
                      <div
                        key={claim.id}
                        className="card cursor-pointer transition-all hover:shadow-lg"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            {/* Company Badge */}
                            <div className="bg-blue-600 text-white w-14 h-14 rounded-lg flex items-center justify-center font-bold text-lg shrink-0">
                              <Scale className="w-7 h-7" />
                            </div>

                            {/* Claim Details */}
                            <div className="flex-1">
                              <div className="font-bold text-gray-900 mb-1">
                                {getBusCompanyName(claim.bus_company)}
                              </div>
                              <div className="text-sm text-gray-600 mb-2">
                                {claim.incident_ids.length} אירועים • {claim.claim_type === 'warning_letter' ? 'מכתב התראה' : 'תביעה פורמלית'}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Calendar className="w-3 h-3" />
                                {formatDate(claim.created_at)}
                              </div>
                            </div>
                          </div>

                          {/* Claim Amount and Status */}
                          <div className="text-left space-y-2">
                            <div className="text-xs text-gray-600">סכום תביעה</div>
                            <div className="text-lg font-bold text-green-600">
                              ₪{claim.claim_amount.toLocaleString()}
                            </div>
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${statusBadge.bgColor} ${statusBadge.textColor}`}>
                              <StatusIcon className="w-4 h-4" />
                              <span>{statusBadge.emoji} {statusBadge.label}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Individual Incidents Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  אירועים בודדים ({incidents.length})
                </h2>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="w-4 h-4" />
                  <span>לחץ לפרטים</span>
                </div>
              </div>

              {incidents.length === 0 && claims.length === 0 ? (
                <div className="card text-center py-12">
                  <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">אין תיקים עדיין</h3>
                  <p className="text-gray-600 mb-4">התחל לדווח על תקלות כדי לבנות תיק משפטי</p>
                  <button
                    onClick={() => router.push('/')}
                    className="btn-primary"
                  >
                    חזרה לדף הראשי
                  </button>
                </div>
              ) : incidents.length === 0 ? (
                <div className="card text-center py-8 bg-gray-50">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-gray-600">כל האירועים מקובצים לתביעות</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incidents.map((incident) => {
                    const compensation = getIncidentCompensation(incident)
                    const isSelected = selectedIncident?.id === incident.id

                    return (
                      <div
                        key={incident.id}
                        onClick={() => setSelectedIncident(incident)}
                        className={`card cursor-pointer transition-all hover:shadow-lg ${
                          isSelected ? 'ring-2 ring-primary-orange bg-orange-50' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            {/* Bus Line Badge */}
                            <div className="bg-primary-orange text-white w-14 h-14 rounded-lg flex items-center justify-center font-bold text-lg shrink-0">
                              {incident.bus_line !== 'לא ידוע' ? incident.bus_line : '?'}
                            </div>

                            {/* Incident Details */}
                            <div className="flex-1">
                              {/* Show customer name for admins */}
                              {isAdmin && incident.profiles && (
                                <div className="flex items-center gap-1 text-xs text-purple-600 mb-1">
                                  <User className="w-3 h-3" />
                                  <span>{incident.profiles.full_name}</span>
                                </div>
                              )}
                              <div className="font-bold text-gray-900 mb-1">
                                {getBusCompanyName(incident.bus_company)}
                              </div>
                              <div className="text-sm text-gray-600 mb-2">
                                {getIncidentTypeLabel(incident.incident_type)}
                                {incident.damage_type && (
                                  <> • {getDamageTypeLabel(incident.damage_type)}</>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Calendar className="w-3 h-3" />
                                {formatDate(incident.incident_datetime)}
                              </div>
                            </div>
                          </div>

                          {/* Compensation Amount */}
                          <div className="text-left">
                            <div className="text-xs text-gray-600 mb-1">פיצוי משוער</div>
                            <div className="text-lg font-bold text-green-600">
                              ₪{compensation.totalCompensation}
                            </div>
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                              incident.verified ? 'bg-blue-100 text-blue-700' :
                              incident.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {incident.verified ? '🔵 מאומת' :
                               incident.status === 'rejected' ? '❌ נדחה' :
                               '⏺️ ממתין'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Incident Details */}
          <div className="lg:sticky lg:top-8 lg:h-fit">
            {selectedIncident ? (
              <div className="card">
                <h3 className="text-xl font-bold text-gray-900 mb-6">פרטי התיק</h3>

                {/* Customer Info - Admin only */}
                {isAdmin && selectedIncident.profiles && (
                  <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-5 h-5 text-purple-600" />
                      <h4 className="font-semibold text-purple-900">פרטי הלקוח</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-purple-700">שם:</span>
                        <span className="font-medium text-purple-900">{selectedIncident.profiles.full_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-purple-700">טלפון:</span>
                        <span className="font-medium text-purple-900">{selectedIncident.profiles.phone}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Map */}
                <div className="mb-6">
                  <div className="aspect-video bg-gray-200 rounded-lg relative overflow-hidden">
                    <iframe
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${selectedIncident.user_gps_lat},${selectedIncident.user_gps_lng}&zoom=16`}
                    />
                    <div className="absolute top-3 right-3 bg-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary-orange" />
                      <span className="text-sm font-medium">מיקום האירוע</span>
                    </div>
                  </div>
                </div>

                {/* Photo */}
                {selectedIncident.photo_urls && selectedIncident.photo_urls.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Camera className="w-5 h-5 text-gray-700" />
                      <h4 className="font-semibold text-gray-900">תמונה מהמקום</h4>
                    </div>
                    <div className="rounded-lg overflow-hidden">
                      <img
                        src={selectedIncident.photo_urls[0]}
                        alt="תמונת ראיה"
                        className="w-full h-64 object-cover"
                      />
                    </div>
                  </div>
                )}

                {/* Compensation Breakdown */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-gray-900">פירוט הפיצוי</h4>
                  </div>

                  {(() => {
                    const compensation = getIncidentCompensation(selectedIncident)
                    return (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                        {/* Base Compensation */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-green-900">פיצוי בסיס</span>
                          <span className="font-semibold text-green-700">
                            ₪{compensation.baseCompensation}
                          </span>
                        </div>

                        {/* Damage Compensation */}
                        {compensation.damageCompensation > 0 && (
                          <>
                            <div className="border-t border-green-300 pt-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-green-900">פיצוי נזק</span>
                                <span className="font-semibold text-green-700">
                                  ₪{compensation.damageCompensation}
                                </span>
                              </div>
                              {selectedIncident.damage_type && (
                                <div className="text-xs text-green-700 mt-1">
                                  {getDamageTypeLabel(selectedIncident.damage_type)}
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        {/* Total */}
                        <div className="border-t border-green-300 pt-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-green-900">סה"כ</span>
                            <span className="text-2xl font-bold text-green-600">
                              ₪{compensation.totalCompensation}
                            </span>
                          </div>
                        </div>

                        {/* Legal Basis - Only visible for admins */}
                        {isAdmin && (
                          <div className="border-t border-green-300 pt-3 text-xs text-green-800">
                            <div className="font-semibold mb-1">בסיס משפטי:</div>
                            <div>{compensation.legalBasis}</div>
                            <div className="mt-2 text-green-700">{compensation.description}</div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* Incident Metadata */}
                <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-gray-600">חברת אוטובוס</span>
                    <span className="font-medium text-gray-900">
                      {getBusCompanyName(selectedIncident.bus_company)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-gray-600">קו</span>
                    <span className="font-medium text-gray-900">{selectedIncident.bus_line}</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-gray-600">סוג אירוע</span>
                    <span className="font-medium text-gray-900">
                      {getIncidentTypeLabel(selectedIncident.incident_type)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-gray-600">תאריך</span>
                    <span className="font-medium text-gray-900">
                      {formatDate(selectedIncident.incident_datetime)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-gray-600">סטטוס</span>
                    <span className={`status-badge ${
                      selectedIncident.verified ? 'status-badge-approved' :
                      selectedIncident.status === 'rejected' ? 'status-badge-rejected' :
                      'status-badge-pending'
                    }`}>
                      {selectedIncident.verified ? 'מאומת' :
                       selectedIncident.status === 'rejected' ? 'נדחה' :
                       'ממתין לאימות'}
                    </span>
                  </div>
                  {selectedIncident.damage_description && (
                    <div className="flex flex-col gap-1 pt-3 border-t border-gray-200">
                      <span className="text-sm text-gray-600">תיאור הנזק</span>
                      <span className="text-sm text-gray-900">
                        {selectedIncident.damage_description}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <button className="w-full btn-primary mt-6">
                  צור מכתב התראה
                </button>
              </div>
            ) : (
              <div className="card text-center py-12">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">בחר תיק לצפייה</h3>
                <p className="text-gray-600">לחץ על אחד התיקים מהרשימה כדי לראות פרטים מלאים</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
