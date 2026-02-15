'use client'

import { useState, useRef, useEffect } from 'react'
import { AlertCircle, Clock, MapPin, Bus, Camera, Upload, CheckCircle, ArrowRight, Banknote, XCircle, AlertTriangle, Shield, Satellite, Database, Loader2, Users } from 'lucide-react'
import { calculateCompensation, type CompensationParams, type CompensationResult } from '@/lib/compensation'
import CompensationCalculator from './CompensationCalculator'
import { reverseGeocode, formatCoordinatesAsFallback } from '@/lib/geocodingService'
import { getCurrentUserConsentStatus } from '@/lib/supabase'

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
  receiptFile?: File // Receipt image for taxi/expense claims
  userGpsLat: number
  userGpsLng: number
  gpsAccuracy?: number
  // Evidence chain data
  stationId?: string
  stationName?: string
  stationCode?: string
  stationLat?: number // Station GPS coordinates
  stationLng?: number
  validationTimestamp?: string
  siriVerified?: boolean
  siriTimestamp?: string
  // OpenStreetMap address (when GTFS unavailable)
  osmAddress?: string
  fullAddress?: string // Complete formatted address for legal documents
  // Compensation data
  baseCompensation?: number
  damageCompensation?: number
  totalCompensation?: number
  legalBasis?: string
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

// GPS Lock configuration
const GPS_LOCK_CONFIG = {
  maxSamples: 5,           // Maximum number of GPS samples to collect
  lockTimeout: 8000,       // Total timeout for GPS lock (8 seconds)
  sampleInterval: 1000,    // Interval between samples (1 second)
  targetAccuracy: 15,      // Stop early if we get accuracy <= 15 meters
  minSamples: 3,           // Minimum samples before accepting result
}

interface GpsSample {
  lat: number
  lng: number
  accuracy: number
  timestamp: string
}

export default function PanicButton({ onPress, onIncidentSubmit }: PanicButtonProps) {
  const [step, setStep] = useState<FormStep>('button')
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy: number; timestamp: string } | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [gpsError, setGpsError] = useState<GpsErrorType>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // GPS Lock state
  const [gpsSamples, setGpsSamples] = useState<GpsSample[]>([])
  const [gpsLockProgress, setGpsLockProgress] = useState(0)
  const watchIdRef = useRef<number | null>(null)
  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  // Minor consent status
  const [consentStatus, setConsentStatus] = useState<{
    isMinor: boolean
    hasConsent: boolean
    pendingConsent: boolean
    loading: boolean
  }>({
    isMinor: false,
    hasConsent: false,
    pendingConsent: false,
    loading: true,
  })
  const [showMinorBlockModal, setShowMinorBlockModal] = useState(false)

  // Check consent status on mount
  useEffect(() => {
    checkConsentStatus()
  }, [])

  const checkConsentStatus = async () => {
    try {
      const status = await getCurrentUserConsentStatus()
      setConsentStatus({
        isMinor: status.isMinor,
        hasConsent: status.hasConsent,
        pendingConsent: !!status.pendingConsent,
        loading: false,
      })
    } catch (err) {
      console.error('Error checking consent status:', err)
      setConsentStatus(prev => ({ ...prev, loading: false }))
    }
  }

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

  // Clean up GPS watchers and timeouts
  const cleanupGpsLock = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current)
      lockTimeoutRef.current = null
    }
  }

  // Select the best GPS sample (lowest accuracy = most precise)
  const selectBestSample = (samples: GpsSample[]): GpsSample | null => {
    if (samples.length === 0) return null
    return samples.reduce((best, current) =>
      current.accuracy < best.accuracy ? current : best
    )
  }

  // Finalize GPS lock with best sample
  const finalizeGpsLock = (samples: GpsSample[]) => {
    cleanupGpsLock()

    const bestSample = selectBestSample(samples)
    if (!bestSample) {
      setGpsError('position_unavailable')
      setIsLocating(false)
      return
    }

    setGpsLocation({
      lat: bestSample.lat,
      lng: bestSample.lng,
      accuracy: bestSample.accuracy,
      timestamp: bestSample.timestamp
    })

    setFormData(prev => ({
      ...prev,
      userGpsLat: bestSample.lat,
      userGpsLng: bestSample.lng,
      gpsAccuracy: bestSample.accuracy,
    }))

    setIsLocating(false)
    setGpsError(null)
    setGpsLockProgress(100)

    // After GPS acquired, move to station validation
    setTimeout(() => {
      setStep('station-validation')
      validateLocation(bestSample.lat, bestSample.lng, bestSample.accuracy, bestSample.timestamp)
    }, 500)
  }

  // Step 1: Panic button press - Start GPS Lock with multiple samples
  const handlePanicPress = async () => {
    // Check if minor without consent
    if (consentStatus.isMinor && !consentStatus.hasConsent) {
      setShowMinorBlockModal(true)
      return
    }

    setIsLocating(true)
    setGpsError(null)
    setValidationError(null)
    setStationValidation(null)
    setSiriValidation(null)
    setGpsSamples([])
    setGpsLockProgress(0)
    setStep('gps-verify')
    onPress()

    if (!navigator.geolocation) {
      setGpsError('not_supported')
      setIsLocating(false)
      return
    }

    // Collect GPS samples array locally (state updates are async)
    let collectedSamples: GpsSample[] = []

    // Set overall timeout for GPS lock
    lockTimeoutRef.current = setTimeout(() => {
      if (collectedSamples.length >= GPS_LOCK_CONFIG.minSamples) {
        finalizeGpsLock(collectedSamples)
      } else if (collectedSamples.length > 0) {
        finalizeGpsLock(collectedSamples)
      } else {
        cleanupGpsLock()
        setGpsError('timeout')
        setIsLocating(false)
      }
    }, GPS_LOCK_CONFIG.lockTimeout)

    // Start watching position for multiple samples
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        const timestamp = new Date().toISOString()

        const newSample: GpsSample = {
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp
        }

        collectedSamples = [...collectedSamples, newSample]
        setGpsSamples(collectedSamples)
        setGpsLockProgress(Math.round((collectedSamples.length / GPS_LOCK_CONFIG.maxSamples) * 100))

        // Check if we achieved target accuracy with minimum samples
        if (accuracy <= GPS_LOCK_CONFIG.targetAccuracy && collectedSamples.length >= GPS_LOCK_CONFIG.minSamples) {
          finalizeGpsLock(collectedSamples)
          return
        }

        // Check if we have collected maximum samples
        if (collectedSamples.length >= GPS_LOCK_CONFIG.maxSamples) {
          finalizeGpsLock(collectedSamples)
          return
        }
      },
      (error) => {
        console.error('[GPS Lock] Error:', error.code, error.message)
        cleanupGpsLock()
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
        timeout: GPS_LOCK_CONFIG.lockTimeout,
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

      // GTFS validation failed - fall back to OpenStreetMap
      if (!result.success || !result.validated) {
        console.warn('GTFS validation failed, using OpenStreetMap fallback')

        // Get address from OpenStreetMap
        const geocodeResult = await reverseGeocode(lat, lng)
        // Use fullAddress for legal docs, fallback to address for display
        const displayAddress = geocodeResult.success && geocodeResult.address
          ? geocodeResult.address
          : formatCoordinatesAsFallback(lat, lng)
        const legalAddress = geocodeResult.success && geocodeResult.fullAddress
          ? geocodeResult.fullAddress
          : displayAddress

        // Create pseudo-station validation with OSM address
        setStationValidation({
          validated: true, // Mark as validated via OSM
          station: null, // No GTFS station
          message: `מיקום אומת: ${displayAddress}`,
          timestamp: new Date().toISOString(),
          dataSource: 'OpenStreetMap'
        })

        // Update form data with OSM addresses (both display and legal)
        setFormData(prev => ({
          ...prev,
          osmAddress: displayAddress,
          fullAddress: legalAddress,
          validationTimestamp: new Date().toISOString()
        }))

        setValidationStatus('success')
        return
      }

      // GTFS validation succeeded
      setStationValidation({
        validated: result.validated,
        station: result.station,
        message: result.message,
        timestamp: result.timestamp,
        dataSource: result.dataSource
      })

      // Station found - update form data
      setFormData(prev => ({
        ...prev,
        stationId: result.station.stopId,
        stationName: result.station.name,
        stationCode: result.station.stopCode,
        stationLat: result.station.lat,
        stationLng: result.station.lng,
        validationTimestamp: result.timestamp
      }))

      setValidationStatus('success')

    } catch (error) {
      console.error('Location validation error:', error)

      // Network error - fall back to OpenStreetMap
      try {
        const geocodeResult = await reverseGeocode(lat, lng)
        const displayAddress = geocodeResult.success && geocodeResult.address
          ? geocodeResult.address
          : formatCoordinatesAsFallback(lat, lng)
        const legalAddress = geocodeResult.success && geocodeResult.fullAddress
          ? geocodeResult.fullAddress
          : displayAddress

        setStationValidation({
          validated: true,
          station: null,
          message: `מיקום אומת: ${displayAddress}`,
          timestamp: new Date().toISOString(),
          dataSource: 'OpenStreetMap (Fallback)'
        })

        setFormData(prev => ({
          ...prev,
          osmAddress: displayAddress,
          fullAddress: legalAddress,
          validationTimestamp: new Date().toISOString()
        }))

        setValidationStatus('success')
      } catch (osmError) {
        console.error('OSM fallback also failed:', osmError)
        setValidationError('שגיאה באימות המיקום. נסה שוב.')
        setValidationStatus('error')
      }
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
    cleanupGpsLock()
    setGpsError(null)
    setGpsSamples([])
    setGpsLockProgress(0)
    handlePanicPress()
  }

  // Cancel and go back to button
  const handleGpsCancel = () => {
    cleanupGpsLock()
    setStep('button')
    setGpsError(null)
    setIsLocating(false)
    setValidationStatus('idle')
    setStationValidation(null)
    setSiriValidation(null)
    setValidationError(null)
    setGpsSamples([])
    setGpsLockProgress(0)
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
    if (!formData.busLine || !formData.busCompany || !gpsLocation) {
      alert('נא למלא את כל השדות הנדרשים')
      return
    }

    // Require either GTFS station or OSM address
    if (!stationValidation?.validated || (!stationValidation.station && !formData.osmAddress)) {
      alert('נא לאמת את המיקום לפני שליחת הדיווח')
      return
    }

    // Calculate final compensation
    const compensationResult = calculateCompensation({
      incidentType: formData.incidentType!,
      delayMinutes: formData.delayMinutes,
      damageType: formData.damageType,
      damageAmount: formData.damageAmount,
      busCompany: formData.busCompany!,
    })

    const completeData: IncidentFormData = {
      busLine: formData.busLine!,
      busCompany: formData.busCompany!,
      incidentType: formData.incidentType!,
      delayMinutes: formData.delayMinutes,
      damageType: formData.damageType,
      damageAmount: formData.damageAmount,
      damageDescription: formData.damageDescription,
      photoFile: formData.photoFile,
      receiptFile: formData.receiptFile,
      userGpsLat: gpsLocation.lat,
      userGpsLng: gpsLocation.lng,
      gpsAccuracy: gpsLocation.accuracy,
      stationId: formData.stationId,
      stationName: formData.stationName,
      stationCode: formData.stationCode,
      stationLat: formData.stationLat,
      stationLng: formData.stationLng,
      validationTimestamp: formData.validationTimestamp,
      siriVerified: formData.siriVerified,
      siriTimestamp: formData.siriTimestamp,
      // OSM address for fallback location
      osmAddress: formData.osmAddress,
      fullAddress: formData.fullAddress, // Complete address for legal documents
      // Add compensation data
      baseCompensation: compensationResult.baseCompensation,
      damageCompensation: compensationResult.damageCompensation,
      totalCompensation: compensationResult.totalCompensation,
      legalBasis: compensationResult.legalBasis,
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
    cleanupGpsLock()
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
    setGpsSamples([])
    setGpsLockProgress(0)
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
          <p className="text-content-secondary text-sm max-w-xs">
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
          <div className="w-32 h-32 bg-status-rejected-surface rounded-full flex items-center justify-center mb-6">
            {gpsError === 'permission_denied' ? (
              <XCircle className="w-16 h-16 text-status-rejected" />
            ) : (
              <AlertTriangle className="w-16 h-16 text-amber-500" />
            )}
          </div>

          <h3 className="text-xl font-bold text-content-primary mb-3 text-center">
            {gpsError === 'permission_denied' ? 'הרשאת מיקום נדחתה' : 'שגיאה באיתור מיקום'}
          </h3>

          <p className="text-sm text-content-secondary text-center mb-6 px-4">
            {getGpsErrorMessage(gpsError)}
          </p>

          {gpsError === 'permission_denied' && (
            <div className="bg-accent-surface border border-accent-border rounded-lg p-4 mb-6 text-sm text-content-secondary text-right">
              <p className="font-medium text-content-primary mb-2">כיצד לאפשר מיקום:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Chrome: לחצו על סמל המנעול &rarr; הרשאות &rarr; מיקום &rarr; אפשר</li>
                <li>Safari: הגדרות &rarr; פרטיות &rarr; שירותי מיקום</li>
                <li>Firefox: לחצו על סמל המגן &rarr; הרשאות &rarr; מיקום</li>
              </ul>
            </div>
          )}

          <div className="flex gap-3 w-full">
            <button onClick={handleGpsCancel} className="btn-secondary flex-1 py-3 px-4">
              ביטול
            </button>
            <button onClick={handleRetryGps} className="btn-primary flex-1 py-3 px-4">
              נסה שוב
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center py-8 max-w-sm mx-auto">
        {/* GPS Lock Progress Circle */}
        <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 relative ${gpsLocation ? 'bg-status-approved-surface' : 'bg-accent-surface'}`}>
          {gpsLocation ? (
            <CheckCircle className="w-16 h-16 text-status-approved" />
          ) : (
            <>
              <Satellite className="w-16 h-16 text-accent animate-pulse" />
              {/* Progress ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  fill="none"
                  stroke="#27272A"
                  strokeWidth="4"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 58}`}
                  strokeDashoffset={`${2 * Math.PI * 58 * (1 - gpsLockProgress / 100)}`}
                  className="transition-all duration-300"
                />
              </svg>
            </>
          )}
        </div>

        <h3 className="text-xl font-bold text-content-primary mb-2">
          {isLocating ? 'נועל GPS לדיוק מקסימלי...' : 'מיקום נקלט!'}
        </h3>

        {/* GPS Lock Progress Info */}
        {isLocating && gpsSamples.length > 0 && (
          <div className="w-full space-y-3 mb-4">
            <div className="bg-accent-surface rounded-lg p-4 border border-accent-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-content-primary">איסוף דגימות GPS</span>
                <span className="text-sm font-mono text-accent-light">{gpsSamples.length}/{GPS_LOCK_CONFIG.maxSamples}</span>
              </div>
              <div className="w-full bg-surface-border rounded-full h-2 mb-3">
                <div
                  className="bg-accent h-2 rounded-full transition-all duration-300"
                  style={{ width: `${gpsLockProgress}%` }}
                />
              </div>
              {/* Sample accuracy list */}
              <div className="flex flex-wrap gap-1">
                {gpsSamples.map((sample, i) => (
                  <span
                    key={i}
                    className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                      sample.accuracy <= 10 ? 'bg-status-approved-surface text-status-approved' :
                      sample.accuracy <= 30 ? 'bg-status-pending-surface text-status-pending' :
                      'bg-status-rejected-surface text-status-rejected'
                    }`}
                  >
                    {Math.round(sample.accuracy)}m
                  </span>
                ))}
              </div>
              {gpsSamples.length > 0 && (
                <p className="text-xs text-content-secondary mt-2">
                  הדגימה הטובה ביותר עד כה: <span className="font-bold">{Math.round(Math.min(...gpsSamples.map(s => s.accuracy)))} מטר</span>
                </p>
              )}
            </div>
            <p className="text-xs text-content-tertiary text-center">
              ממתין לדיוק של {GPS_LOCK_CONFIG.targetAccuracy} מטר או פחות...
            </p>
          </div>
        )}

        {gpsLocation && (
          <div className="space-y-3 mb-4 w-full">
            {/* GPS Data Display */}
            <div className="bg-status-approved-surface rounded-lg p-4 border border-status-approved/20">
              <div className="flex items-center gap-2 mb-3">
                <Satellite className="w-4 h-4 text-status-approved" />
                <span className="text-sm font-medium text-content-primary">נעילת GPS הושלמה!</span>
                <CheckCircle className="w-4 h-4 text-status-approved mr-auto" />
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-content-secondary">דיוק סופי:</span>
                  <span className={`font-mono font-bold ${gpsLocation.accuracy <= 10 ? 'text-status-approved' : gpsLocation.accuracy <= 30 ? 'text-status-pending' : 'text-status-rejected'}`}>
                    {Math.round(gpsLocation.accuracy)} מטר
                    {gpsLocation.accuracy <= 10 ? ' (מעולה)' : gpsLocation.accuracy <= 30 ? ' (טוב)' : ' (סביר)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-secondary">דגימות שנאספו:</span>
                  <span className="font-mono text-content-primary">{gpsSamples.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-secondary">חותמת זמן:</span>
                  <span className="font-mono text-content-primary">{formatTimestamp(gpsLocation.timestamp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-secondary">קואורדינטות:</span>
                  <span className="font-mono text-content-primary text-[10px]">
                    {gpsLocation.lat.toFixed(6)}, {gpsLocation.lng.toFixed(6)}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-content-tertiary text-center">
              מעבר לאימות תחנה...
            </p>
          </div>
        )}

        {isLocating && gpsSamples.length === 0 && (
          <div className="mt-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
        <h3 className="text-xl font-bold text-content-primary mb-6">אימות מיקום דיגיטלי</h3>

        {/* GPS Data Card */}
        {gpsLocation && (
          <div className="w-full bg-accent-surface border border-accent-border rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Satellite className="w-5 h-5 text-accent" />
              <span className="font-medium text-content-primary">נתוני GPS</span>
              <CheckCircle className="w-4 h-4 text-status-approved mr-auto" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-content-secondary">דיוק:</span>
                <span className="font-mono font-bold text-content-primary mr-2">{Math.round(gpsLocation.accuracy)}m</span>
              </div>
              <div>
                <span className="text-content-secondary">זמן:</span>
                <span className="font-mono text-content-primary mr-2">{formatTimestamp(gpsLocation.timestamp)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Station Validation Card */}
        <div className={`w-full rounded-lg p-4 mb-4 border ${
          validationStatus === 'validating_location' ? 'bg-status-pending-surface border-status-pending/20' :
          stationValidation?.validated ? 'bg-status-approved-surface border-status-approved/20' :
          validationStatus === 'error' ? 'bg-status-rejected-surface border-status-rejected/20' :
          'bg-surface-overlay border-surface-border'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-5 h-5 text-content-secondary" />
            <span className="font-medium text-content-primary">אימות תחנה (GTFS)</span>
            {validationStatus === 'validating_location' && <Loader2 className="w-4 h-4 animate-spin text-status-pending mr-auto" />}
            {stationValidation?.validated && <CheckCircle className="w-4 h-4 text-status-approved mr-auto" />}
            {validationStatus === 'error' && <XCircle className="w-4 h-4 text-status-rejected mr-auto" />}
          </div>

          {validationStatus === 'validating_location' && (
            <p className="text-sm text-status-pending">מאמת מיקום מול מאגר התחנות של משרד התחבורה...</p>
          )}

          {stationValidation?.validated && (
            <div className="space-y-2">
              {stationValidation.station ? (
                <>
                  <p className="text-status-approved font-medium">
                    מיקום אומת: תחנת {stationValidation.station.name}
                  </p>
                  <div className="text-xs text-content-secondary space-y-1">
                    <div>קוד תחנה: <span className="font-mono">{stationValidation.station.stopCode}</span></div>
                    <div>מרחק: <span className="font-mono">{stationValidation.station.distance}m</span></div>
                    <div>מקור: <span className="font-mono">GTFS - משרד התחבורה</span></div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-status-approved font-medium">
                    {stationValidation.message}
                  </p>
                  <div className="text-xs text-content-secondary space-y-1">
                    <div>מקור: <span className="font-mono">{stationValidation.dataSource}</span></div>
                    <div className="text-status-pending mt-1">
                      נתוני GTFS לא זמינים - משתמשים במיקום מילולי
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {validationStatus === 'error' && (
            <div className="space-y-2">
              <p className="text-status-rejected font-medium">{validationError}</p>
              {stationValidation?.station && (
                <p className="text-xs text-content-secondary">
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
            className="btn-secondary flex-1 py-3 px-4"
          >
            ביטול
          </button>
          {stationValidation?.validated && (
            <button
              onClick={handleProceedToForm}
              className="btn-primary flex-1 py-3 px-4 flex items-center justify-center gap-2"
            >
              <span>המשך לדיווח</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          {validationStatus === 'error' && (
            <button
              onClick={handleRetryGps}
              className="btn-primary flex-1 py-3 px-4"
            >
              נסה שוב
            </button>
          )}
        </div>

        {/* Evidence Chain Notice */}
        <div className="mt-6 flex items-start gap-2 text-xs text-content-tertiary bg-surface-overlay rounded-lg p-3">
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
      <div className="card p-6">
        {/* Header with Station Info */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-content-primary">פרטי האירוע</h3>
          <div className="flex items-center gap-2 text-status-approved text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>מיקום מאומת</span>
          </div>
        </div>

        {/* Station Badge */}
        {stationValidation?.validated && (
          <div className="bg-status-approved-surface border border-status-approved/20 rounded-lg p-3 mb-6">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-status-approved" />
              {stationValidation.station ? (
                <>
                  <span className="font-medium text-content-primary">תחנת {stationValidation.station.name}</span>
                  <span className="text-xs text-content-secondary mr-auto">({stationValidation.station.distance}m)</span>
                </>
              ) : (
                <>
                  <span className="font-medium text-content-primary">{formData.osmAddress || 'מיקום מאומת'}</span>
                  <span className="text-xs text-status-pending mr-auto">(OSM)</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-5">
          {/* Bus Line */}
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">
              מספר קו <span className="text-status-rejected">*</span>
            </label>
            <div className="relative">
              <Bus className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-tertiary" />
              <input
                type="text"
                value={formData.busLine || ''}
                onChange={(e) => handleInputChange('busLine', e.target.value)}
                placeholder="לדוגמה: 12, 480, 405"
                className="input-field pr-10"
              />
            </div>
          </div>

          {/* Bus Company */}
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">
              חברת האוטובוסים <span className="text-status-rejected">*</span>
            </label>
            <select
              value={formData.busCompany || ''}
              onChange={(e) => handleInputChange('busCompany', e.target.value)}
              className="input-field cursor-pointer"
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
              siriValidation.color === 'green' ? 'bg-status-approved-surface border-status-approved/20' :
              siriValidation.color === 'orange' ? 'bg-accent-surface border-accent-border' :
              'bg-surface-overlay border-surface-border'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Bus className={`w-5 h-5 ${siriValidation.color === 'green' ? 'text-status-approved' : siriValidation.color === 'orange' ? 'text-accent' : 'text-content-secondary'}`} />
                <span className="font-medium text-content-primary">
                  אימות SIRI בזמן אמת
                </span>
                {validationStatus === 'validating_siri' && <Loader2 className="w-4 h-4 animate-spin mr-auto" />}
              </div>
              <p className={`text-sm ${siriValidation.color === 'green' ? 'text-status-approved' : siriValidation.color === 'orange' ? 'text-accent-light' : 'text-content-secondary'}`}>
                {siriValidation.message}
              </p>
              {siriValidation.apiResponseTime && (
                <p className="text-xs text-content-tertiary mt-1">
                  זמן תגובת API: {siriValidation.apiResponseTime}
                </p>
              )}
            </div>
          )}

          {/* Incident Type */}
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">
              סוג התקלה <span className="text-status-rejected">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['no_arrival', 'no_stop', 'delay'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleInputChange('incidentType', type)}
                  className={`py-3 px-4 rounded-lg border-2 transition-all ${
                    formData.incidentType === type
                      ? 'border-accent bg-accent-surface text-accent font-semibold'
                      : 'border-surface-border hover:border-surface-border-light text-content-secondary'
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
              <label className="block text-sm font-medium text-content-secondary mb-2">זמן עיכוב (בדקות)</label>
              <input
                type="number"
                value={formData.delayMinutes || ''}
                onChange={(e) => handleInputChange('delayMinutes', parseInt(e.target.value) || 0)}
                placeholder="20"
                min="0"
                className="input-field"
              />
            </div>
          )}

          {/* Damage Type */}
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">נזק נוסף שנגרם (אופציונלי)</label>
            <select
              value={formData.damageType || ''}
              onChange={(e) => handleInputChange('damageType', e.target.value || undefined)}
              className="input-field"
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
              <label className="block text-sm font-medium text-content-secondary mb-2">סכום הנזק (₪)</label>
              <input
                type="number"
                value={formData.damageAmount || ''}
                onChange={(e) => handleInputChange('damageAmount', parseFloat(e.target.value) || 0)}
                placeholder="0"
                min="0"
                className="input-field"
              />
            </div>
          )}

          {/* Receipt Upload - Show when damage type is selected (especially for taxi_cost) */}
          {formData.damageType && (
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-2">
                העלאת קבלה {formData.damageType === 'taxi_cost' ? '(חובה למונית)' : '(אופציונלי)'}
              </label>
              <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                formData.receiptFile
                  ? 'border-status-approved/30 bg-status-approved-surface'
                  : 'border-surface-border hover:border-accent'
              }`}>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setFormData(prev => ({ ...prev, receiptFile: file }))
                    }
                  }}
                  className="hidden"
                  id="receipt-upload"
                />
                {formData.receiptFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-status-approved" />
                      <span className="text-sm text-status-approved font-medium truncate max-w-[200px]">
                        {formData.receiptFile.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, receiptFile: undefined }))}
                      className="text-sm text-status-rejected hover:text-status-rejected/80"
                    >
                      הסר
                    </button>
                  </div>
                ) : (
                  <label htmlFor="receipt-upload" className="cursor-pointer block">
                    <Upload className="w-8 h-8 mx-auto text-content-tertiary mb-2" />
                    <p className="text-sm text-content-secondary">העלה קבלה (תמונה או PDF)</p>
                    <p className="text-xs text-content-tertiary mt-1">עד 10MB</p>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">העלאת תמונה (אופציונלי)</label>
            <div className="border-2 border-dashed border-surface-border rounded-lg p-6 text-center hover:border-accent transition-colors cursor-pointer">
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                  <button type="button" onClick={() => { setPhotoPreview(null); setFormData(prev => ({ ...prev, photoFile: undefined })) }} className="mt-3 text-sm text-status-rejected hover:text-status-rejected/80">
                    הסר תמונה
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full">
                  <Camera className="w-12 h-12 mx-auto text-content-tertiary mb-3" />
                  <p className="text-sm text-content-secondary">צלם או העלה תמונה</p>
                </button>
              )}
            </div>
          </div>

          {/* Compensation Display */}
          {compensation > 0 && (
            <div className="bg-surface-overlay border border-accent-border rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Banknote className="w-8 h-8 text-accent" />
                  <div>
                    <p className="text-sm text-content-primary font-medium">פיצוי משוער</p>
                    <p className="text-xs text-content-secondary">על פי תקנה 428ז</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-gold">₪{compensation}</p>
              </div>
            </div>
          )}

          {/* Evidence Chain Summary */}
          <div className="bg-surface-overlay rounded-lg p-4 border border-surface-border">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-content-secondary" />
              <span className="font-medium text-content-primary">שרשרת ראיות דיגיטלית</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-content-secondary">
              <div>GPS: <span className="text-content-primary">{gpsLocation ? `${Math.round(gpsLocation.accuracy)}m דיוק` : '-'}</span></div>
              <div>זמן GPS: <span className="text-content-primary">{gpsLocation ? formatTimestamp(gpsLocation.timestamp) : '-'}</span></div>
              <div>תחנה: <span className="text-content-primary">{stationValidation?.station?.name || '-'}</span></div>
              <div>SIRI: <span className={siriValidation?.verified ? 'text-status-approved' : 'text-accent'}>{siriValidation ? (siriValidation.verified ? 'מאומת' : 'אזהרה') : 'טרם נבדק'}</span></div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-8">
          <button type="button" onClick={handleCancel} className="btn-secondary flex-1 py-3 px-6">
            ביטול
          </button>
          <button type="button" onClick={handleSubmit} className="btn-primary flex-1 py-3 px-6 flex items-center justify-center gap-2">
            <span>שלח דיווח</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Minor Consent Block Modal */}
      {showMinorBlockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full p-6" dir="rtl">
            <div className="text-center">
              <div className="w-16 h-16 bg-status-pending-surface rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-status-pending" />
              </div>
              <h3 className="text-xl font-bold text-content-primary mb-2">נדרשת הסכמת הורים</h3>
              <p className="text-content-secondary mb-4">
                {consentStatus.pendingConsent
                  ? 'נשלחה בקשת הסכמה להורה שלך. עד שההורה יאשר, לא ניתן לדווח על אירועים.'
                  : 'כדי לדווח על אירועים, צריך קודם לקבל הסכמת הורים. יש להירשם מחדש ולהזין את פרטי ההורה.'}
              </p>

              {consentStatus.pendingConsent && (
                <div className="bg-accent-surface border border-accent-border p-3 rounded-lg mb-4">
                  <p className="text-sm text-content-secondary">
                    בקשת הסכמה ממתינה לאישור. נא לבקש מההורה לבדוק את הדוא&quot;ל.
                  </p>
                </div>
              )}

              <button
                onClick={() => setShowMinorBlockModal(false)}
                className="btn-primary w-full py-3 px-6"
              >
                הבנתי
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
