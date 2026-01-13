'use client'

import { useState, useRef } from 'react'
import { AlertCircle, Clock, MapPin, Bus, Camera, Upload, CheckCircle, ArrowRight, Banknote, XCircle, AlertTriangle, Shield, Satellite, Database, Loader2 } from 'lucide-react'
import { calculateCompensation, type CompensationParams } from '@/lib/compensation'

interface PanicButtonProps {
  onPress: () => void
  onIncidentSubmit?: (data: IncidentFormData) => void
}

export interface IncidentFormData {
  busLine: string
  busCompany: string
  incidentType: 'delay' | 'no_stop' | 'no_arrival'
  delayMinutes?: number
  damageType?: 'taxi_cost' | 'lost_workday' | 'missed_exam' | 'medical_appointment' | 'other'
  damageAmount?: number
  damageDescription?: string
  photoFile?: File
  userGpsLat: number
  userGpsLng: number
  gpsAccuracy?: number
  // Evidence chain data
  stationId?: string
  stationName?: string
  stationCode?: string
  validationTimestamp?: string
  siriVerified?: boolean
  siriTimestamp?: string
}

// GPS Error types
type GpsErrorType = 'permission_denied' | 'position_unavailable' | 'timeout' | 'not_supported' | null

// Validation status types
type ValidationStatus = 'idle' | 'validating_location' | 'validating_siri' | 'success' | 'error'

// Form steps - added 'station-validation' step
type FormStep = 'button' | 'gps-verify' | 'station-validation' | 'details'

// Station validation result
interface StationValidation {
  validated: boolean
  station: {
    stopId: string
    stopCode: string
    name: string
    lat: number
    lng: number
    distance: number
  } | null
  message: string
  timestamp: string
  dataSource: string
}

// SIRI validation result
interface SiriValidation {
  success: boolean
  busFound: boolean
  verified: boolean
  message: string
  messageType: 'success' | 'warning' | 'error'
  color: string
  timestamp: string
  apiResponseTime?: string
  details?: any
}

export default function PanicButton({ onPress, onIncidentSubmit }: PanicButtonProps) {
  const [step, setStep] = useState<FormStep>('button')
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy: number; timestamp: string } | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [gpsError, setGpsError] = useState<GpsErrorType>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Validation states
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle')
  const [stationValidation, setStationValidation] = useState<StationValidation | null>(null)
  const [siriValidation, setSiriValidation] = useState<SiriValidation | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Form data
  const [formData, setFormData] = useState<Partial<IncidentFormData>>({
    incidentType: 'no_arrival',
  })

  const [compensation, setCompensation] = useState<number>(0)

  // Get GPS error message in Hebrew
  const getGpsErrorMessage = (errorType: GpsErrorType): string => {
    switch (errorType) {
      case 'permission_denied':
        return 'הרשאת המיקום נדחתה. אנא אפשרו גישה למיקום בהגדרות הדפדפן ונסו שוב.'
      case 'position_unavailable':
        return 'לא ניתן לקבל את המיקום הנוכחי. אנא ודאו שה-GPS מופעל במכשיר.'
      case 'timeout':
        return 'חיפוש המיקום נמשך יותר מדי זמן. אנא נסו שוב באזור עם קליטה טובה יותר.'
      case 'not_supported':
        return 'הדפדפן שלכם אינו תומך בשירותי מיקום. אנא נסו דפדפן אחר.'
      default:
        return 'אירעה שגיאה בלתי צפויה. אנא נסו שוב.'
    }
  }

  // Step 1: Panic button press - Get GPS location
  const handlePanicPress = async () => {
    setIsLocating(true)
    setGpsError(null)
    setValidationError(null)
    setStationValidation(null)
    setSiriValidation(null)
    setStep('gps-verify')
    onPress()

    if (!navigator.geolocation) {
      setGpsError('not_supported')
      setIsLocating(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        const timestamp = new Date().toISOString()

        setGpsLocation({
          lat: latitude,
          lng: longitude,
          accuracy: accuracy,
          timestamp: timestamp
        })

        setFormData(prev => ({
          ...prev,
          userGpsLat: latitude,
          userGpsLng: longitude,
          gpsAccuracy: accuracy,
        }))

        setIsLocating(false)
        setGpsError(null)

        // After GPS acquired, move to station validation
        setTimeout(() => {
          setStep('station-validation')
          validateLocation(latitude, longitude, accuracy, timestamp)
        }, 1000)
      },
      (error) => {
        console.error('GPS error:', error.code, error.message)
        setIsLocating(false)

        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('permission_denied')
            break
          case error.POSITION_UNAVAILABLE:
            setGpsError('position_unavailable')
            break
          case error.TIMEOUT:
            setGpsError('timeout')
            break
          default:
            setGpsError('position_unavailable')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  // Validate location against GTFS stops
  const validateLocation = async (lat: number, lng: number, accuracy: number, _timestamp: string) => {
    setValidationStatus('validating_location')

    try {
      const response = await fetch('/api/validate-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, accuracy })
      })

      const result = await response.json()

      if (!result.success) {
        // API error or GTFS data not loaded
        if (result.errorCode === 'GTFS_EMPTY') {
          setValidationError('טבלת התחנות ריקה. יש להריץ את סקריפט טעינת הנתונים.')
          setValidationStatus('error')
          return
        }
        setValidationError(result.error || 'שגיאה בבדיקת המיקום')
        setValidationStatus('error')
        return
      }

      setStationValidation({
        validated: result.validated,
        station: result.station,
        message: result.message,
        timestamp: result.timestamp,
        dataSource: result.dataSource
      })

      if (!result.validated) {
        // No station nearby - cannot proceed
        setValidationStatus('error')
        setValidationError(result.message)
        return
      }

      // Station found - update form data
      setFormData(prev => ({
        ...prev,
        stationId: result.station.stopId,
        stationName: result.station.name,
        stationCode: result.station.stopCode,
        validationTimestamp: result.timestamp
      }))

      setValidationStatus('success')

    } catch (error) {
      console.error('Location validation error:', error)
      setValidationError('שגיאה בתקשורת עם השרת')
      setValidationStatus('error')
    }
  }

  // Validate with SIRI when bus line and company are selected
  const validateSiri = async (busLine: string, busCompany: string) => {
    if (!stationValidation?.station || !gpsLocation) return

    setValidationStatus('validating_siri')

    try {
      const response = await fetch('/api/validate-siri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationLat: stationValidation.station.lat,
          stationLng: stationValidation.station.lng,
          stationName: stationValidation.station.name,
          stationCode: stationValidation.station.stopCode,
          busLine,
          busCompany,
          reportTime: gpsLocation.timestamp
        })
      })

      const result = await response.json()

      setSiriValidation({
        success: result.success,
        busFound: result.busFound,
        verified: result.verified,
        message: result.message,
        messageType: result.messageType || 'success',
        color: result.color || 'gray',
        timestamp: result.timestamp,
        apiResponseTime: result.evidenceChain?.apiResponseTime,
        details: result.details
      })

      // Update form data with SIRI verification
      setFormData(prev => ({
        ...prev,
        siriVerified: result.verified,
        siriTimestamp: result.timestamp
      }))

      setValidationStatus('success')

    } catch (error) {
      console.error('SIRI validation error:', error)
      // Don't block form - SIRI is supplementary
      setSiriValidation({
        success: false,
        busFound: false,
        verified: false,
        message: 'לא ניתן להתחבר לשרת SIRI',
        messageType: 'warning',
        color: 'gray',
        timestamp: new Date().toISOString()
      })
      setValidationStatus('success')
    }
  }

  // Retry GPS acquisition
  const handleRetryGps = () => {
    setGpsError(null)
    handlePanicPress()
  }

  // Cancel and go back to button
  const handleGpsCancel = () => {
    setStep('button')
    setGpsError(null)
    setIsLocating(false)
    setValidationStatus('idle')
    setStationValidation(null)
    setSiriValidation(null)
    setValidationError(null)
  }

  // Proceed to form after validation
  const handleProceedToForm = () => {
    if (stationValidation?.validated) {
      setStep('details')
    }
  }

  // Handle form input changes
  const handleInputChange = (field: keyof IncidentFormData, value: any) => {
    const newFormData = { ...formData, [field]: value }
    setFormData(newFormData)

    // Trigger SIRI validation when bus line and company are both set
    if (field === 'busLine' || field === 'busCompany') {
      const busLine = field === 'busLine' ? value : newFormData.busLine
      const busCompany = field === 'busCompany' ? value : newFormData.busCompany

      if (busLine && busCompany && stationValidation?.validated) {
        validateSiri(busLine, busCompany)
      }
    }

    // Recalculate compensation
    if (newFormData.incidentType && newFormData.busCompany) {
      const result = calculateCompensation({
        incidentType: newFormData.incidentType,
        delayMinutes: newFormData.delayMinutes,
        damageType: newFormData.damageType,
        damageAmount: newFormData.damageAmount,
        busCompany: newFormData.busCompany,
      } as CompensationParams)
      setCompensation(result.totalCompensation)
    }
  }

  // Handle photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData(prev => ({ ...prev, photoFile: file }))
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Submit form
  const handleSubmit = () => {
    if (!formData.busLine || !formData.busCompany || !gpsLocation || !stationValidation?.validated) {
      alert('נא למלא את כל השדות הנדרשים')
      return
    }

    const completeData: IncidentFormData = {
      busLine: formData.busLine!,
      busCompany: formData.busCompany!,
      incidentType: formData.incidentType!,
      delayMinutes: formData.delayMinutes,
      damageType: formData.damageType,
      damageAmount: formData.damageAmount,
      damageDescription: formData.damageDescription,
      photoFile: formData.photoFile,
      userGpsLat: gpsLocation.lat,
      userGpsLng: gpsLocation.lng,
      gpsAccuracy: gpsLocation.accuracy,
      stationId: formData.stationId,
      stationName: formData.stationName,
      stationCode: formData.stationCode,
      validationTimestamp: formData.validationTimestamp,
      siriVerified: formData.siriVerified,
      siriTimestamp: formData.siriTimestamp,
    }

    onIncidentSubmit?.(completeData)

    // Reset form
    setStep('button')
    setFormData({ incidentType: 'no_arrival' })
    setGpsLocation(null)
    setGpsError(null)
    setPhotoPreview(null)
    setCompensation(0)
    setValidationStatus('idle')
    setStationValidation(null)
    setSiriValidation(null)
    setValidationError(null)
  }

  // Reset and go back
  const handleCancel = () => {
    setStep('button')
    setFormData({ incidentType: 'no_arrival' })
    setGpsLocation(null)
    setGpsError(null)
    setPhotoPreview(null)
    setCompensation(0)
    setValidationStatus('idle')
    setStationValidation(null)
    setSiriValidation(null)
    setValidationError(null)
  }

  // Format timestamp for display
  const formatTimestamp = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  // ==========================================
  // RENDER: Step 1 - Panic Button
  // ==========================================
  if (step === 'button') {
    return (
      <div className="flex flex-col items-center">
        <button
          onClick={handlePanicPress}
          className="
            relative group
            w-64 h-64 rounded-full
            bg-gradient-to-br from-red-500 to-red-600
            shadow-2xl
            transition-all duration-300
            hover:scale-105 hover:shadow-3xl active:scale-95
          "
        >
          <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20" />
          <div className="relative flex flex-col items-center justify-center h-full text-white">
            <AlertCircle className="w-20 h-20 mb-4" strokeWidth={2.5} />
            <span className="text-2xl font-bold text-center leading-tight px-6">
              האוטובוס לא הגיע / לא עצר
            </span>
          </div>
          <div className="absolute inset-0 rounded-full bg-red-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300" />
        </button>

        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm max-w-xs">
            לחצו על הכפתור כאשר האוטובוס לא מגיע או לא עוצר בתחנה
          </p>
        </div>
      </div>
    )
  }

  // ==========================================
  // RENDER: Step 2 - GPS Verification
  // ==========================================
  if (step === 'gps-verify') {
    if (gpsError) {
      return (
        <div className="flex flex-col items-center py-8 max-w-sm mx-auto">
          <div className="w-32 h-32 bg-red-100 rounded-full flex items-center justify-center mb-6">
            {gpsError === 'permission_denied' ? (
              <XCircle className="w-16 h-16 text-red-500" />
            ) : (
              <AlertTriangle className="w-16 h-16 text-amber-500" />
            )}
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-3 text-center">
            {gpsError === 'permission_denied' ? 'הרשאת מיקום נדחתה' : 'שגיאה באיתור מיקום'}
          </h3>

          <p className="text-sm text-gray-600 text-center mb-6 px-4">
            {getGpsErrorMessage(gpsError)}
          </p>

          {gpsError === 'permission_denied' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800 text-right">
              <p className="font-medium mb-2">כיצד לאפשר מיקום:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Chrome: לחצו על סמל המנעול → הרשאות → מיקום → אפשר</li>
                <li>Safari: הגדרות → פרטיות → שירותי מיקום</li>
                <li>Firefox: לחצו על סמל המגן → הרשאות → מיקום</li>
              </ul>
            </div>
          )}

          <div className="flex gap-3 w-full">
            <button onClick={handleGpsCancel} className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors">
              ביטול
            </button>
            <button onClick={handleRetryGps} className="flex-1 py-3 px-4 bg-primary-orange hover:bg-orange-600 text-white font-medium rounded-lg transition-colors">
              נסה שוב
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center py-8">
        <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 ${gpsLocation ? 'bg-green-100' : 'bg-primary-orange bg-opacity-10'}`}>
          {gpsLocation ? (
            <CheckCircle className="w-16 h-16 text-green-600" />
          ) : (
            <Satellite className="w-16 h-16 text-primary-orange animate-pulse" />
          )}
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {isLocating ? 'מאתר את המיקום שלך...' : 'מיקום נקלט!'}
        </h3>

        {gpsLocation && (
          <div className="space-y-3 mb-4 w-full max-w-xs">
            {/* GPS Data Display - Transparent */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Satellite className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">נתוני GPS גולמיים</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">דיוק (Accuracy):</span>
                  <span className={`font-mono font-bold ${gpsLocation.accuracy <= 10 ? 'text-green-600' : gpsLocation.accuracy <= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                    {Math.round(gpsLocation.accuracy)} מטר
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">חותמת זמן:</span>
                  <span className="font-mono text-gray-800">{formatTimestamp(gpsLocation.timestamp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">קואורדינטות:</span>
                  <span className="font-mono text-gray-800 text-[10px]">
                    {gpsLocation.lat.toFixed(6)}, {gpsLocation.lng.toFixed(6)}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 text-center">
              מעבר לאימות תחנה...
            </p>
          </div>
        )}

        {isLocating && (
          <div className="mt-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-primary-orange rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-primary-orange rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-primary-orange rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    )
  }

  // ==========================================
  // RENDER: Step 3 - Station Validation
  // ==========================================
  if (step === 'station-validation') {
    return (
      <div className="flex flex-col items-center py-6 max-w-md mx-auto">
        <h3 className="text-xl font-bold text-gray-900 mb-6">אימות מיקום דיגיטלי</h3>

        {/* GPS Data Card */}
        {gpsLocation && (
          <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Satellite className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900">נתוני GPS</span>
              <CheckCircle className="w-4 h-4 text-green-500 mr-auto" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-blue-700">דיוק:</span>
                <span className="font-mono font-bold text-blue-900 mr-2">{Math.round(gpsLocation.accuracy)}m</span>
              </div>
              <div>
                <span className="text-blue-700">זמן:</span>
                <span className="font-mono text-blue-900 mr-2">{formatTimestamp(gpsLocation.timestamp)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Station Validation Card */}
        <div className={`w-full rounded-lg p-4 mb-4 border ${
          validationStatus === 'validating_location' ? 'bg-yellow-50 border-yellow-200' :
          stationValidation?.validated ? 'bg-green-50 border-green-200' :
          validationStatus === 'error' ? 'bg-red-50 border-red-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">אימות תחנה (GTFS)</span>
            {validationStatus === 'validating_location' && <Loader2 className="w-4 h-4 animate-spin text-yellow-600 mr-auto" />}
            {stationValidation?.validated && <CheckCircle className="w-4 h-4 text-green-500 mr-auto" />}
            {validationStatus === 'error' && <XCircle className="w-4 h-4 text-red-500 mr-auto" />}
          </div>

          {validationStatus === 'validating_location' && (
            <p className="text-sm text-yellow-800">מאמת מיקום מול מאגר התחנות של משרד התחבורה...</p>
          )}

          {stationValidation?.validated && stationValidation.station && (
            <div className="space-y-2">
              <p className="text-green-800 font-medium">
                מיקום אומת: תחנת {stationValidation.station.name}
              </p>
              <div className="text-xs text-green-700 space-y-1">
                <div>קוד תחנה: <span className="font-mono">{stationValidation.station.stopCode}</span></div>
                <div>מרחק: <span className="font-mono">{stationValidation.station.distance}m</span></div>
                <div>מקור: <span className="font-mono">GTFS - משרד התחבורה</span></div>
              </div>
            </div>
          )}

          {validationStatus === 'error' && (
            <div className="space-y-2">
              <p className="text-red-800 font-medium">{validationError}</p>
              {stationValidation?.station && (
                <p className="text-xs text-red-700">
                  התחנה הקרובה ביותר: {stationValidation.station.name} ({stationValidation.station.distance}m)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 w-full mt-4">
          <button
            onClick={handleGpsCancel}
            className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
          >
            ביטול
          </button>
          {stationValidation?.validated && (
            <button
              onClick={handleProceedToForm}
              className="flex-1 py-3 px-4 bg-primary-orange hover:bg-orange-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>המשך לדיווח</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          {validationStatus === 'error' && (
            <button
              onClick={handleRetryGps}
              className="flex-1 py-3 px-4 bg-primary-orange hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
            >
              נסה שוב
            </button>
          )}
        </div>

        {/* Evidence Chain Notice */}
        <div className="mt-6 flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            הנתונים מבוססים אך ורק על מידע גולמי מה-GPS ומאגר התחנות הרשמי של משרד התחבורה.
            אין שימוש בניחושים או נתונים מוערכים.
          </p>
        </div>
      </div>
    )
  }

  // ==========================================
  // RENDER: Step 4 - Details Form
  // ==========================================
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Header with Station Info */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">פרטי האירוע</h3>
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>מיקום מאומת</span>
          </div>
        </div>

        {/* Station Badge */}
        {stationValidation?.station && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-800">תחנת {stationValidation.station.name}</span>
              <span className="text-xs text-green-600 mr-auto">({stationValidation.station.distance}m)</span>
            </div>
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-5">
          {/* Bus Line */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              מספר קו <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Bus className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.busLine || ''}
                onChange={(e) => handleInputChange('busLine', e.target.value)}
                placeholder="לדוגמה: 12, 480, 405"
                className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent text-right"
              />
            </div>
          </div>

          {/* Bus Company */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              חברת האוטובוסים <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.busCompany || ''}
              onChange={(e) => handleInputChange('busCompany', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-primary-orange transition-all text-right appearance-none bg-white cursor-pointer hover:border-gray-400"
            >
              <option value="" disabled>בחר חברת אוטובוסים</option>
              <option value="egged">אגד</option>
              <option value="dan">דן</option>
              <option value="kavim">קווים</option>
              <option value="metropoline">מטרופולין</option>
              <option value="nateev_express">נתיב אקספרס</option>
              <option value="superbus">סופרבוס</option>
              <option value="egged_taavura">אגד תעבורה</option>
              <option value="afikim">אפיקים</option>
              <option value="golan">גולן</option>
              <option value="galim">גלים</option>
              <option value="tnufa">תנופה</option>
              <option value="other">אחר</option>
            </select>
          </div>

          {/* SIRI Validation Result */}
          {siriValidation && (
            <div className={`rounded-lg p-4 border ${
              siriValidation.color === 'green' ? 'bg-green-50 border-green-200' :
              siriValidation.color === 'orange' ? 'bg-orange-50 border-orange-200' :
              'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Bus className={`w-5 h-5 ${siriValidation.color === 'green' ? 'text-green-600' : siriValidation.color === 'orange' ? 'text-orange-600' : 'text-gray-600'}`} />
                <span className={`font-medium ${siriValidation.color === 'green' ? 'text-green-800' : siriValidation.color === 'orange' ? 'text-orange-800' : 'text-gray-800'}`}>
                  אימות SIRI בזמן אמת
                </span>
                {validationStatus === 'validating_siri' && <Loader2 className="w-4 h-4 animate-spin mr-auto" />}
              </div>
              <p className={`text-sm ${siriValidation.color === 'green' ? 'text-green-700' : siriValidation.color === 'orange' ? 'text-orange-700' : 'text-gray-700'}`}>
                {siriValidation.message}
              </p>
              {siriValidation.apiResponseTime && (
                <p className="text-xs text-gray-500 mt-1">
                  זמן תגובת API: {siriValidation.apiResponseTime}
                </p>
              )}
            </div>
          )}

          {/* Incident Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              סוג התקלה <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['no_arrival', 'no_stop', 'delay'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleInputChange('incidentType', type)}
                  className={`py-3 px-4 rounded-lg border-2 transition-all ${
                    formData.incidentType === type
                      ? 'border-primary-orange bg-orange-50 text-primary-orange font-semibold'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {type === 'no_arrival' ? 'לא הגיע' : type === 'no_stop' ? 'לא עצר' : 'עיכוב'}
                </button>
              ))}
            </div>
          </div>

          {/* Delay Minutes */}
          {formData.incidentType === 'delay' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">זמן עיכוב (בדקות)</label>
              <input
                type="number"
                value={formData.delayMinutes || ''}
                onChange={(e) => handleInputChange('delayMinutes', parseInt(e.target.value) || 0)}
                placeholder="20"
                min="0"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent text-right"
              />
            </div>
          )}

          {/* Damage Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">נזק נוסף שנגרם (אופציונלי)</label>
            <select
              value={formData.damageType || ''}
              onChange={(e) => handleInputChange('damageType', e.target.value || undefined)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent text-right"
            >
              <option value="">ללא נזק נוסף</option>
              <option value="taxi_cost">הוצאות מונית</option>
              <option value="lost_workday">אובדן יום עבודה</option>
              <option value="missed_exam">החמצת בחינה</option>
              <option value="medical_appointment">החמצת תור לרופא</option>
              <option value="other">אחר</option>
            </select>
          </div>

          {/* Damage Amount */}
          {formData.damageType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">סכום הנזק (₪)</label>
              <input
                type="number"
                value={formData.damageAmount || ''}
                onChange={(e) => handleInputChange('damageAmount', parseFloat(e.target.value) || 0)}
                placeholder="0"
                min="0"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent text-right"
              />
            </div>
          )}

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">העלאת תמונה (אופציונלי)</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-orange transition-colors cursor-pointer">
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                  <button type="button" onClick={() => { setPhotoPreview(null); setFormData(prev => ({ ...prev, photoFile: undefined })) }} className="mt-3 text-sm text-red-600 hover:text-red-700">
                    הסר תמונה
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full">
                  <Camera className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-sm text-gray-600">צלם או העלה תמונה</p>
                </button>
              )}
            </div>
          </div>

          {/* Compensation Display */}
          {compensation > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Banknote className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-sm text-green-800 font-medium">פיצוי משוער</p>
                    <p className="text-xs text-green-700">על פי תקנה 428ז</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-green-700">₪{compensation}</p>
              </div>
            </div>
          )}

          {/* Evidence Chain Summary */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-800">שרשרת ראיות דיגיטלית</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>GPS: <span className="text-gray-800">{gpsLocation ? `${Math.round(gpsLocation.accuracy)}m דיוק` : '-'}</span></div>
              <div>זמן GPS: <span className="text-gray-800">{gpsLocation ? formatTimestamp(gpsLocation.timestamp) : '-'}</span></div>
              <div>תחנה: <span className="text-gray-800">{stationValidation?.station?.name || '-'}</span></div>
              <div>SIRI: <span className={siriValidation?.verified ? 'text-green-600' : 'text-orange-600'}>{siriValidation ? (siriValidation.verified ? 'מאומת' : 'אזהרה') : 'טרם נבדק'}</span></div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-8">
          <button type="button" onClick={handleCancel} className="flex-1 py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors">
            ביטול
          </button>
          <button type="button" onClick={handleSubmit} className="flex-1 py-3 px-6 bg-primary-orange hover:bg-orange-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
            <span>שלח דיווח</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
