'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getSession, getCurrentUserProfile, createIncidentWithPhoto, signOut, isUserAdmin, type Profile } from '@/lib/supabase'
import PanicButton, { type IncidentFormData } from '@/components/PanicButton'
import DailyChallenge from '@/components/DailyChallenge'
import MyAccountWidget from '@/components/MyAccountWidget'
import { ArrowRight, FileText, AlertCircle, Clock, Award, LogOut, Shield, Settings } from 'lucide-react'
import { calculateCompensation } from '@/lib/compensation'

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  const checkAuthAndLoadData = async () => {
    const session = await getSession()

    if (!session) {
      router.push('/auth')
      return
    }

    // After auth, check if there's pending registration data to complete the profile
    const pendingDataJSON = localStorage.getItem('pending_registration_data')
    if (pendingDataJSON) {
      try {
        const pendingData = JSON.parse(pendingDataJSON)
        const { error } = await supabase
          .from('profiles')
          .update(pendingData)
          .eq('id', session.user.id)

        if (error) throw error

        localStorage.removeItem('pending_registration_data')
      } catch (err) {
        console.error('[Dashboard] Error processing pending registration data:', err)
        localStorage.removeItem('pending_registration_data')
      }
    }

    setUserId(session.user?.id || null)

    // Load user profile
    const userProfile = await getCurrentUserProfile()
    setProfile(userProfile)

    // Check admin status
    try {
      const adminStatus = await isUserAdmin()
      setIsAdmin(adminStatus)
    } catch (err) {
      setIsAdmin(false)
    }

    setLoading(false)
  }

  const handleIncidentSubmit = async (data: IncidentFormData) => {
    setSubmitting(true)

    try {
      const session = await getSession()
      if (!session) {
        router.push('/auth')
        return
      }

      const stationLat = (typeof data.stationLat === 'number' && !isNaN(data.stationLat))
        ? data.stationLat
        : data.userGpsLat
      const stationLng = (typeof data.stationLng === 'number' && !isNaN(data.stationLng))
        ? data.stationLng
        : data.userGpsLng

      const incidentData = {
        bus_line: data.busLine,
        bus_company: data.busCompany,
        station_name: data.stationName || data.osmAddress || 'לא ידוע',
        station_gps_lat: stationLat ?? null,
        station_gps_lng: stationLng ?? null,
        user_gps_lat: data.userGpsLat,
        user_gps_lng: data.userGpsLng,
        user_gps_accuracy: data.gpsAccuracy ?? null,
        incident_type: data.incidentType,
        incident_datetime: new Date().toISOString(),
        delay_minutes: data.delayMinutes ?? null,
        damage_type: data.damageType ?? null,
        damage_amount: data.damageAmount ?? null,
        damage_description: data.damageDescription ?? null,
        osm_address: data.fullAddress || data.osmAddress || null,
        base_compensation: data.baseCompensation ?? null,
        damage_compensation: data.damageCompensation ?? null,
        total_compensation: data.totalCompensation ?? null,
        legal_basis: data.legalBasis ?? null,
        photo_urls: [],
        receipt_urls: [],
      }

      const incident = await createIncidentWithPhoto(
        incidentData,
        data.photoFile,
        data.receiptFile
      )

      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        checkAuthAndLoadData()
      }, 3000)

    } catch (error) {
      console.error('Error creating incident:', error)
      alert('אירעה שגיאה בשמירת הדיווח. אנא נסו שוב.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePanicPress = () => {
    // GPS acquisition started
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-content-secondary">טוען נתונים...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="bg-surface-raised border-b border-surface-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-content-primary">שלום, {profile?.full_name || 'משתמש'}</h1>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-status-legal-surface text-status-legal text-xs font-semibold rounded-full border border-status-legal/20">
                    <Shield className="w-3.5 h-3.5" />
                    מנהל
                  </span>
                )}
              </div>
              <p className="text-sm text-content-secondary">דווח על תקלות בזמן אמת וצבור פיצויים</p>
            </div>
            <div className="flex items-center gap-3">
              {isAdmin && (
                <button
                  onClick={() => router.push('/admin')}
                  className="flex items-center gap-2 px-4 py-2 bg-status-legal-surface hover:bg-status-legal/20 text-status-legal rounded-xl transition-colors border border-status-legal/20"
                >
                  <Settings className="w-5 h-5" />
                  <span className="text-sm font-medium">ממשק ניהול</span>
                </button>
              )}
              <button
                onClick={() => router.push('/claims')}
                className="flex items-center gap-2 px-4 py-2 bg-surface-overlay hover:bg-surface-border rounded-xl transition-colors border border-surface-border"
              >
                <FileText className="w-5 h-5 text-content-secondary" />
                <span className="text-sm font-medium text-content-secondary">התיקים שלי</span>
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 bg-status-rejected-surface hover:bg-status-rejected/20 text-status-rejected rounded-xl transition-colors border border-status-rejected/20"
                title="התנתק מהמערכת"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">התנתק</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2">
            {userId && (
              <div className="mb-6">
                <DailyChallenge userId={userId} />
              </div>
            )}

            <div className="card">
              <h2 className="text-xl font-bold text-content-primary mb-2 text-center">דיווח מהיר</h2>
              <p className="text-sm text-content-secondary mb-8 text-center">
                לחץ על הכפתור כאשר האוטובוס לא מגיע או לא עוצר
              </p>

              {showSuccess && (
                <div className="mb-6 p-4 bg-status-approved-surface border border-status-approved/20 rounded-xl flex items-center gap-3">
                  <Award className="w-6 h-6 text-status-approved" />
                  <div>
                    <p className="font-medium text-status-approved">הדיווח נשמר בהצלחה!</p>
                    <p className="text-sm text-content-secondary">התיק התווסף לארכיון שלך</p>
                  </div>
                </div>
              )}

              <div className={submitting ? 'opacity-50 pointer-events-none' : ''}>
                <PanicButton
                  onPress={handlePanicPress}
                  onIncidentSubmit={handleIncidentSubmit}
                />
              </div>

              {submitting && (
                <div className="mt-6 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-overlay text-accent rounded-xl border border-surface-border">
                    <Clock className="w-5 h-5 animate-spin" />
                    <span className="font-medium">שומר את הדיווח...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="card-interactive">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-status-legal-surface p-2 rounded-xl border border-status-legal/20">
                    <FileText className="w-5 h-5 text-status-legal" />
                  </div>
                  <span className="text-sm text-content-secondary">דיווחים</span>
                </div>
                <p className="text-2xl font-bold text-content-primary">{profile?.total_incidents || 0}</p>
              </div>

              <div className="card-interactive">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-accent-surface p-2 rounded-xl border border-accent-border">
                    <AlertCircle className="w-5 h-5 text-accent" />
                  </div>
                  <span className="text-sm text-content-secondary">תביעות</span>
                </div>
                <p className="text-2xl font-bold text-content-primary">{profile?.total_claims || 0}</p>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-4">
              <MyAccountWidget
                receivedAmount={profile?.total_received || 0}
                potentialAmount={profile?.total_potential || 0}
              />
              <button
                onClick={() => router.push('/claims')}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <span>צפה בכל התיקים</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-12 card">
          <h2 className="text-2xl font-bold text-content-primary mb-6 text-center">איך זה עובד?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-surface rounded-full mb-4 border border-accent-border">
                <span className="text-2xl font-bold text-accent">1</span>
              </div>
              <h3 className="font-bold text-content-primary mb-2">דווח בזמן אמת</h3>
              <p className="text-sm text-content-secondary">
                לחץ על כפתור הדיווח כאשר האוטובוס לא מגיע או לא עוצר. המערכת תתעד את המיקום והזמן אוטומטית.
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-status-legal-surface rounded-full mb-4 border border-status-legal/20">
                <span className="text-2xl font-bold text-status-legal">2</span>
              </div>
              <h3 className="font-bold text-content-primary mb-2">אימות אוטומטי</h3>
              <p className="text-sm text-content-secondary">
                המערכת תאמת את הדיווח מול נתוני משרד התחבורה ומערכת SIRI בזמן אמת.
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-status-approved-surface rounded-full mb-4 border border-status-approved/20">
                <span className="text-2xl font-bold text-status-approved">3</span>
              </div>
              <h3 className="font-bold text-content-primary mb-2">צבור ותבע</h3>
              <p className="text-sm text-content-secondary">
                כאשר תצבור מספיק אירועים, נוכל להפיק מכתב התראה ולהגיש תביעה לפיצוי.
              </p>
            </div>
          </div>
        </div>
      </main>


    </div>
  )
}
