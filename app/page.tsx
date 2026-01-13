'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MyAccountWidget from '@/components/MyAccountWidget'
import PanicButton, { type IncidentFormData } from '@/components/PanicButton'
import StatusLight from '@/components/StatusLight'
import { Bus, FileText, TrendingUp, Menu, LogOut } from 'lucide-react'
import { getCurrentUserProfile, getUserIncidents, createIncidentWithPhoto, signOut, getSession } from '@/lib/supabase'
import type { Profile, Incident } from '@/lib/supabase'
import { calculateCompensation } from '@/lib/compensation'

export default function Dashboard() {
  const router = useRouter()
  const [verificationStatus, setVerificationStatus] = useState<'checking' | 'verified' | 'failed' | 'idle'>('idle')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  // Check authentication and load data
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const session = await getSession()

    if (!session) {
      router.push('/auth')
      return
    }

    // Load user profile and incidents
    const userProfile = await getCurrentUserProfile()

    // Load all incidents to calculate real potential compensation
    const userIncidents = await getUserIncidents(5)
    const allIncidents = await getUserIncidents(1000) // Get all incidents for calculation

    // Calculate actual total potential from all incidents
    const actualPotential = allIncidents.reduce((total, incident) => {
      const compensation = calculateCompensation({
        incidentType: incident.incident_type,
        delayMinutes: incident.incident_type === 'delay' ? 30 : undefined,
        damageType: incident.damage_type,
        damageAmount: incident.damage_amount,
        busCompany: incident.bus_company,
      })
      return total + compensation.totalCompensation
    }, 0)

    // Update profile with calculated potential
    if (userProfile) {
      setProfile({
        ...userProfile,
        total_potential: actualPotential,
        total_incidents: allIncidents.length,
      })
    }

    setIncidents(userIncidents)
    setLoading(false)
  }

  const handlePanicPress = async () => {
    // Just set verification status to checking
    // The PanicButton component now handles GPS internally
    setVerificationStatus('checking')
  }

  const handleIncidentSubmit = async (data: IncidentFormData) => {
    setVerificationStatus('checking')

    try {
      // Calculate compensation for this incident
      const compensationResult = calculateCompensation({
        incidentType: data.incidentType,
        delayMinutes: data.delayMinutes,
        damageType: data.damageType,
        damageAmount: data.damageAmount,
        busCompany: data.busCompany,
      })

      // Create incident in database with photo upload
      const newIncident = await createIncidentWithPhoto(
        {
          bus_line: data.busLine,
          bus_company: data.busCompany,
          station_name: 'תחנה נוכחית', // Will be geocoded in future phase
          user_gps_lat: data.userGpsLat,
          user_gps_lng: data.userGpsLng,
          incident_type: data.incidentType,
          incident_datetime: new Date().toISOString(),
          damage_type: data.damageType,
          damage_amount: data.damageAmount,
          damage_description: data.damageDescription,
        },
        data.photoFile
      )

      // Simulate verification with Ministry of Transportation
      // In future: Call real API here
      setTimeout(async () => {
        setVerificationStatus('verified')

        // Update profile with new potential compensation
        if (profile) {
          const newPotential = (profile.total_potential || 0) + compensationResult.totalCompensation
          setProfile({
            ...profile,
            total_potential: newPotential,
            total_incidents: (profile.total_incidents || 0) + 1,
          })
        }

        // Refresh incidents list
        const updatedIncidents = await getUserIncidents(5)
        setIncidents(updatedIncidents)

        // Reset after showing success
        setTimeout(() => {
          setVerificationStatus('idle')
        }, 3000)
      }, 2000)

    } catch (error) {
      console.error('Error submitting incident:', error)
      setVerificationStatus('failed')
      setTimeout(() => setVerificationStatus('idle'), 3000)
      alert('שגיאה בשמירת הדיווח. אנא נסו שוב.')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `לפני ${diffMins} דקות`
    if (diffHours < 24) return `לפני ${diffHours} שעות`
    return `לפני ${diffDays} ימים`
  }

  const getIncidentTypeLabel = (type: string) => {
    switch (type) {
      case 'delay': return 'עיכוב'
      case 'no_stop': return 'לא עצר'
      case 'no_arrival': return 'לא הגיע'
      default: return type
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">טוען...</p>
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
              <div className="bg-primary-orange p-2 rounded-lg">
                <Bus className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">CashBus</h1>
                <p className="text-sm text-gray-600">שלום, {profile?.full_name || 'משתמש'}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm">יציאה</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Right Column - My Account Widget */}
          <div className="lg:col-span-1">
            <MyAccountWidget
              receivedAmount={profile?.total_received || 0}
              potentialAmount={profile?.total_potential || 0}
            />

            {/* Quick Stats */}
            <div className="mt-6 space-y-3">
              <div className="card bg-blue-50 border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">אירועים מתועדים</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">
                    {profile?.total_incidents || 0}
                  </span>
                </div>
              </div>

              <div className="card bg-green-50 border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-900">תביעות מאושרות</span>
                  </div>
                  <span className="text-2xl font-bold text-green-600">
                    {profile?.approved_claims || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Column - Panic Button */}
          <div className="lg:col-span-2">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
                דיווח מהיר על תקלה
              </h2>

              {/* Status Light */}
              <div className="mb-8">
                <StatusLight status={verificationStatus} />
              </div>

              {/* Panic Button */}
              <div className="flex justify-center py-8">
                <PanicButton
                  onPress={handlePanicPress}
                  onIncidentSubmit={handleIncidentSubmit}
                />
              </div>

              {/* Info Section */}
              <div className="mt-8 bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="font-semibold text-orange-900 mb-2">איך זה עובד?</h3>
                <ol className="text-sm text-orange-800 space-y-2 list-decimal list-inside">
                  <li>לחצו על הכפתור כשהאוטובוס לא מגיע או לא עוצר</li>
                  <li>המערכת תתעד את המיקום והזמן שלכם</li>
                  <li>נאמת אוטומטית מול נתוני משרד התחבורה</li>
                  <li>תקבלו הודעה על זכאות לפיצוי</li>
                </ol>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="card mt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">פעילות אחרונה</h3>

              {incidents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>אין דיווחים עדיין</p>
                  <p className="text-sm mt-2">לחצו על כפתור הדיווח כשאתם חווים תקלה</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incidents.map((incident) => (
                    <div
                      key={incident.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-primary-orange text-white w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm">
                          {incident.bus_line !== 'לא ידוע' ? incident.bus_line : '?'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {incident.bus_company}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatRelativeTime(incident.incident_datetime)}
                          </div>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-sm text-gray-700 mb-1">
                          {getIncidentTypeLabel(incident.incident_type)}
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
                  ))}
                </div>
              )}

              <button
                onClick={() => router.push('/claims')}
                className="w-full mt-4 btn-secondary text-sm py-2"
              >
                הצג את כל הדיווחים
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600">
            <p>© 2026 CashBus - כל הזכויות שמורות</p>
            <p className="mt-1">פלטפורמה לניהול תביעות פיצויים בתחבורה ציבורית</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
