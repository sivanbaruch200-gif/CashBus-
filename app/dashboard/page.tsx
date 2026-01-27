'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, getUserIncidents, getUserClaims, getCurrentUserProfile, createIncidentWithPhoto, signOut, isUserAdmin, type Profile } from '@/lib/supabase'
import PanicButton, { type IncidentFormData } from '@/components/PanicButton'
import { ArrowRight, FileText, TrendingUp, AlertCircle, PiggyBank, Clock, Award, LogOut, Shield, Settings } from 'lucide-react'
import { calculateCompensation } from '@/lib/compensation'

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  // DEBUG: Temporary debug state - remove after fixing
  const [debugInfo, setDebugInfo] = useState<{
    userId?: string
    userEmail?: string
    adminCheckResult?: boolean
    adminCheckError?: string
    supabaseUrl?: string
  }>({})

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  const checkAuthAndLoadData = async () => {
    const session = await getSession()

    if (!session) {
      router.push('/auth')
      return
    }

    // DEBUG: Capture user info
    setDebugInfo(prev => ({
      ...prev,
      userId: session.user?.id,
      userEmail: session.user?.email,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET'
    }))

    // Load user profile
    const userProfile = await getCurrentUserProfile()
    setProfile(userProfile)

    // Check admin status - with detailed logging
    console.log('[Dashboard] About to check admin status...')
    try {
      const adminStatus = await isUserAdmin()
      console.log('[Dashboard] Admin status result:', adminStatus)
      setIsAdmin(adminStatus)
      // DEBUG: Capture result
      setDebugInfo(prev => ({ ...prev, adminCheckResult: adminStatus }))
    } catch (err) {
      console.error('[Dashboard] Error checking admin:', err)
      setIsAdmin(false)
      // DEBUG: Capture error
      setDebugInfo(prev => ({ ...prev, adminCheckError: String(err) }))
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

      // Create incident with compensation data and receipt
      // Ensure GPS coordinates are valid numbers (not undefined/NaN)
      // Use user GPS as fallback when station GPS is not available (OSM fallback)
      const stationLat = (typeof data.stationLat === 'number' && !isNaN(data.stationLat))
        ? data.stationLat
        : data.userGpsLat
      const stationLng = (typeof data.stationLng === 'number' && !isNaN(data.stationLng))
        ? data.stationLng
        : data.userGpsLng

      // Prepare incident data - convert undefined to null for database
      const incidentData = {
        bus_line: data.busLine,
        bus_company: data.busCompany,
        // Use GTFS station name if available, otherwise OSM address
        station_name: data.stationName || data.osmAddress || 'לא ידוע',
        // Use station coordinates from GTFS validation, fallback to user GPS for OSM locations
        // IMPORTANT: Use null instead of undefined for nullable fields
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
        // OSM address for legal documents (when GTFS unavailable)
        osm_address: data.fullAddress || data.osmAddress || null,
        // Compensation data
        base_compensation: data.baseCompensation ?? null,
        damage_compensation: data.damageCompensation ?? null,
        total_compensation: data.totalCompensation ?? null,
        legal_basis: data.legalBasis ?? null,
        photo_urls: [], // Will be updated if photo exists
        receipt_urls: [], // Will be updated if receipt exists
      }

      console.log('Submitting incident data:', incidentData)

      const incident = await createIncidentWithPhoto(
        incidentData,
        data.photoFile,
        data.receiptFile
      )

      console.log('Incident created with compensation:', incident)

      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        // Reload profile to get updated stats
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
    console.log('Panic button pressed - GPS acquisition started')
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  // Debug: Log isAdmin state before render
  console.log('[Dashboard RENDER] isAdmin state:', isAdmin, '| loading:', loading)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">טוען נתונים...</p>
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
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">שלום, {profile?.full_name || 'משתמש'}</h1>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                    <Shield className="w-3.5 h-3.5" />
                    מנהל
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">דווח על תקלות בזמן אמת וצבור פיצויים</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Admin Panel Button */}
              {isAdmin && (
                <button
                  onClick={() => router.push('/admin')}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  <span className="text-sm font-medium">ממשק ניהול</span>
                </button>
              )}
              <button
                onClick={() => router.push('/claims')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <FileText className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">התיקים שלי</span>
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                title="התנתק מהמערכת"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">התנתק</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* DEBUG PANEL - Remove after fixing admin issue */}
      <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-3">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-bold text-yellow-800 mb-2">🔧 DEBUG INFO (הסר אחרי תיקון):</p>
          <div className="text-xs text-yellow-700 space-y-1">
            <p>User ID: <code className="bg-yellow-200 px-1 rounded">{debugInfo.userId || 'לא נמצא'}</code></p>
            <p>Email: <code className="bg-yellow-200 px-1 rounded">{debugInfo.userEmail || 'לא נמצא'}</code></p>
            <p>Supabase URL: <code className="bg-yellow-200 px-1 rounded">{debugInfo.supabaseUrl || 'NOT SET'}</code></p>
            <p>Admin Check Result: <code className={`px-1 rounded ${debugInfo.adminCheckResult ? 'bg-green-200' : 'bg-red-200'}`}>
              {debugInfo.adminCheckResult === undefined ? 'בבדיקה...' : debugInfo.adminCheckResult ? 'TRUE ✓' : 'FALSE ✗'}
            </code></p>
            {debugInfo.adminCheckError && (
              <p className="text-red-600">Error: <code className="bg-red-200 px-1 rounded">{debugInfo.adminCheckError}</code></p>
            )}
            <p>isAdmin State: <code className={`px-1 rounded ${isAdmin ? 'bg-green-200' : 'bg-red-200'}`}>{isAdmin ? 'TRUE' : 'FALSE'}</code></p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Panic Button */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">דיווח מהיר</h2>
              <p className="text-sm text-gray-600 mb-8 text-center">
                לחץ על הכפתור כאשר האוטובוס לא מגיע או לא עוצר
              </p>

              {showSuccess && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                  <Award className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">הדיווח נשמר בהצלחה!</p>
                    <p className="text-sm text-green-700">התיק התווסף לארכיון שלך</p>
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
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
                    <Clock className="w-5 h-5 animate-spin" />
                    <span className="font-medium">שומר את הדיווח...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-600">דיווחים</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{profile?.total_incidents || 0}</p>
              </div>

              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className="text-sm text-gray-600">תביעות</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{profile?.total_claims || 0}</p>
              </div>
            </div>
          </div>

          {/* Right Column - Savings Piggy Bank */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-xl p-8 text-white sticky top-8">
              <div className="text-center mb-6">
                <PiggyBank className="w-16 h-16 mx-auto mb-4 opacity-90" strokeWidth={1.5} />
                <h3 className="text-lg font-bold mb-2">קופת החיסכון שלך</h3>
                <p className="text-sm opacity-90">פיצויים שהתקבלו</p>
              </div>

              {/* Total Received - Now the main amount */}
              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-6 mb-4">
                <p className="text-sm opacity-90 mb-2 text-center">סה"כ התקבל</p>
                <p className="text-4xl font-bold text-center">
                  ₪{(profile?.total_received || 0).toLocaleString()}
                </p>
              </div>

              {/* Potential - Now the smaller amount */}
              <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm opacity-90">פוטנציאל נוסף</span>
                  <span className="font-bold">₪{(profile?.total_potential || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-3 text-sm opacity-90">
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>כל דיווח מתועד מהווה ראיה משפטית תקפה</p>
                </div>
                <div className="flex items-start gap-2">
                  <Award className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>צבירת מספר אירועים מגדילה את סכום הפיצוי</p>
                </div>
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>נוכל להפיק מכתב התראה כאשר יהיו מספיק תיקים</p>
                </div>
              </div>

              <button
                onClick={() => router.push('/claims')}
                className="w-full mt-6 py-3 px-4 bg-white text-green-600 font-bold rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <span>צפה בכל התיקים</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="mt-12 bg-white rounded-xl shadow-md border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">איך זה עובד?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
                <span className="text-2xl font-bold text-primary-orange">1</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">דווח בזמן אמת</h3>
              <p className="text-sm text-gray-600">
                לחץ על כפתור הדיווח כאשר האוטובוס לא מגיע או לא עוצר. המערכת תתעד את המיקום והזמן אוטומטית.
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">אימות אוטומטי</h3>
              <p className="text-sm text-gray-600">
                המערכת תאמת את הדיווח מול נתוני משרד התחבורה ומערכת SIRI בזמן אמת.
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <span className="text-2xl font-bold text-green-600">3</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">צבור ותבע</h3>
              <p className="text-sm text-gray-600">
                כאשר תצבור מספיק אירועים, נוכל להפיק מכתב התראה ולהגיש תביעה לפיצוי.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
