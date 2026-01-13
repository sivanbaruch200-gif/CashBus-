'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, MapPin, Calendar, FileText, DollarSign, Camera, Bus, AlertCircle } from 'lucide-react'
import { getUserIncidents, getSession, type Incident } from '@/lib/supabase'
import { calculateCompensation, getBusCompanyName } from '@/lib/compensation'

export default function MyClaimsPage() {
  const router = useRouter()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuthAndLoadIncidents()
  }, [])

  const checkAuthAndLoadIncidents = async () => {
    const session = await getSession()

    if (!session) {
      router.push('/auth')
      return
    }

    // Load all user incidents (no limit)
    const userIncidents = await getUserIncidents(100)
    setIncidents(userIncidents)
    setLoading(false)
  }

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

  const getIncidentCompensation = (incident: Incident) => {
    return calculateCompensation({
      incidentType: incident.incident_type,
      delayMinutes: incident.incident_type === 'delay' ? 30 : undefined, // Default assumption
      damageType: incident.damage_type,
      damageAmount: incident.damage_amount,
      busCompany: incident.bus_company,
    })
  }

  const totalPotential = incidents.reduce((sum, incident) => {
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
                <h1 className="text-2xl font-bold text-gray-900">התיקים שלי</h1>
                <p className="text-sm text-gray-600">ארכיון דיווחים ותביעות</p>
              </div>
            </div>
            <div className="text-left">
              <div className="text-sm text-gray-600">סה"כ פוטנציאל</div>
              <div className="text-2xl font-bold text-green-600">₪{totalPotential.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Incidents List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {incidents.length} תיקים
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText className="w-4 h-4" />
                <span>לחץ לפרטים מלאים</span>
              </div>
            </div>

            {incidents.length === 0 ? (
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
                          <span className={`status-badge ${
                            incident.verified ? 'status-badge-approved' :
                            incident.status === 'rejected' ? 'status-badge-rejected' :
                            'status-badge-pending'
                          }`}>
                            {incident.verified ? 'מאומת' :
                             incident.status === 'rejected' ? 'נדחה' :
                             'ממתין'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Column - Incident Details */}
          <div className="lg:sticky lg:top-8 lg:h-fit">
            {selectedIncident ? (
              <div className="card">
                <h3 className="text-xl font-bold text-gray-900 mb-6">פרטי התיק</h3>

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

                        {/* Legal Basis */}
                        <div className="border-t border-green-300 pt-3 text-xs text-green-800">
                          <div className="font-semibold mb-1">בסיס משפטי:</div>
                          <div>{compensation.legalBasis}</div>
                          <div className="mt-2 text-green-700">{compensation.description}</div>
                        </div>
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
