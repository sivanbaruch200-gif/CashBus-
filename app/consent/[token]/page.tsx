'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  getParentalConsentByToken,
  submitParentalConsent,
  validateIsraeliId,
  ParentalConsent
} from '@/lib/supabase'
import {
  Shield,
  User,
  Phone,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  Calendar
} from 'lucide-react'

export default function ParentalConsentPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [consent, setConsent] = useState<ParentalConsent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form fields
  const [parentFullName, setParentFullName] = useState('')
  const [parentIdNumber, setParentIdNumber] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [idError, setIdError] = useState<string | null>(null)

  // Checkboxes
  const [confirmedGuardian, setConfirmedGuardian] = useState(false)
  const [confirmedTerms, setConfirmedTerms] = useState(false)
  const [confirmedFee, setConfirmedFee] = useState(false)

  useEffect(() => {
    loadConsent()
  }, [token])

  const loadConsent = async () => {
    try {
      const data = await getParentalConsentByToken(token)

      if (!data) {
        setError('לינק לא תקין או שפג תוקפו')
        setLoading(false)
        return
      }

      if (data.status === 'approved') {
        setSuccess(true)
        setConsent(data)
        setLoading(false)
        return
      }

      if (data.status === 'expired' || new Date(data.expires_at) < new Date()) {
        setError('פג תוקף הבקשה. יש לבקש הסכמה מחדש.')
        setLoading(false)
        return
      }

      setConsent(data)
      setLoading(false)
    } catch (err) {
      console.error('Error loading consent:', err)
      setError('שגיאה בטעינת הנתונים')
      setLoading(false)
    }
  }

  const validateIdNumber = (id: string) => {
    const cleanId = id.replace(/\D/g, '')
    setParentIdNumber(cleanId)

    if (cleanId.length === 0) {
      setIdError(null)
      return
    }

    if (cleanId.length < 9) {
      setIdError('מספר ת.ז. חייב להכיל 9 ספרות')
      return
    }

    if (!validateIsraeliId(cleanId)) {
      setIdError('מספר ת.ז. לא תקין')
      return
    }

    setIdError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate all fields
    if (!parentFullName || !parentIdNumber || !parentPhone) {
      setError('נא למלא את כל השדות')
      return
    }

    if (!validateIsraeliId(parentIdNumber)) {
      setError('מספר תעודת זהות לא תקין')
      return
    }

    if (!confirmedGuardian || !confirmedTerms || !confirmedFee) {
      setError('יש לאשר את כל ההצהרות')
      return
    }

    setSubmitting(true)

    try {
      const result = await submitParentalConsent(
        token,
        parentFullName,
        parentIdNumber,
        parentPhone,
        confirmedGuardian,
        confirmedTerms,
        confirmedFee
      )

      if (!result.success) {
        setError(result.error || 'שגיאה בשמירת ההסכמה')
        setSubmitting(false)
        return
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'שגיאה בשמירת ההסכמה')
    } finally {
      setSubmitting(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-overlay flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-accent animate-spin mx-auto mb-4" />
          <p className="text-content-secondary">טוען...</p>
        </div>
      </div>
    )
  }

  // Error state (invalid/expired link)
  if (error && !consent) {
    return (
      <div className="min-h-screen bg-surface-overlay py-8 px-4" dir="rtl">
        <div className="max-w-lg mx-auto bg-surface-raised rounded-lg shadow-glass p-8 text-center">
          <AlertCircle className="w-16 h-16 text-status-rejected mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-content-primary mb-4">שגיאה</h1>
          <p className="text-content-secondary mb-6">{error}</p>
          <Link href="/" className="btn-primary inline-block">
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-surface-overlay py-8 px-4" dir="rtl">
        <div className="max-w-lg mx-auto bg-surface-raised rounded-lg shadow-glass p-8 text-center">
          <CheckCircle className="w-16 h-16 text-status-approved mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-content-primary mb-4">ההסכמה נשמרה בהצלחה!</h1>
          <p className="text-content-secondary mb-2">
            תודה רבה על אישור ההסכמה עבור <strong>{consent?.minor_name}</strong>.
          </p>
          <p className="text-content-secondary mb-6">
            כעת {consent?.minor_name} יוכל/תוכל להשתמש בשירותי CashBus.
          </p>
          <div className="bg-status-approved-surface p-4 rounded-lg mb-6">
            <p className="text-sm text-status-approved">
              ההסכמה תקפה לכל השימוש באפליקציה ואינה מצריכה אישור נוסף.
            </p>
          </div>
          <Link href="/" className="btn-primary inline-block">
            לאתר CashBus
          </Link>
        </div>
      </div>
    )
  }

  // Main consent form
  return (
    <div className="min-h-screen bg-surface-overlay py-8 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-accent text-white rounded-t-lg p-6 text-center">
          <Shield className="w-12 h-12 mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-2">טופס הסכמת הורים</h1>
          <p className="text-orange-100">CashBus - שירות פיצוי אוטומטי לתחבורה ציבורית</p>
        </div>

        {/* Minor Info */}
        <div className="bg-accent-surface p-4 border-b border-accent-border">
          <h2 className="font-semibold text-accent mb-2">פרטי הקטין:</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-accent" />
              <span className="text-accent">{consent?.minor_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" />
              <span className="text-accent">
                {consent?.minor_birthdate ? new Date(consent.minor_birthdate).toLocaleDateString('he-IL') : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-surface-raised rounded-b-lg shadow-glass p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error message */}
            {error && (
              <div className="p-3 bg-status-rejected-surface border border-status-rejected/20 rounded-lg flex items-center gap-2 text-status-rejected">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Parent Full Name */}
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-2">
                שם מלא של ההורה/אפוטרופוס <span className="text-status-rejected">*</span>
              </label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-content-tertiary" />
                <input
                  type="text"
                  value={parentFullName}
                  onChange={(e) => setParentFullName(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 border border-surface-border rounded-lg focus:ring-2 focus:ring-accent/40 focus:border-accent outline-none"
                  placeholder="שם פרטי ושם משפחה"
                  required
                />
              </div>
            </div>

            {/* Parent ID Number */}
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-2">
                תעודת זהות <span className="text-status-rejected">*</span>
              </label>
              <div className="relative">
                <CreditCard className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-content-tertiary" />
                <input
                  type="text"
                  value={parentIdNumber}
                  onChange={(e) => validateIdNumber(e.target.value)}
                  className={`w-full pr-10 pl-4 py-3 border rounded-lg focus:ring-2 focus:ring-accent/40 focus:border-accent outline-none ${
                    idError ? 'border-status-rejected/20 bg-status-rejected-surface' : 'border-surface-border'
                  }`}
                  placeholder="123456789"
                  maxLength={9}
                  required
                  dir="ltr"
                />
              </div>
              {idError && (
                <p className="text-sm text-status-rejected mt-1">{idError}</p>
              )}
              {parentIdNumber.length === 9 && !idError && (
                <p className="text-sm text-status-approved mt-1 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> מספר ת.ז. תקין
                </p>
              )}
            </div>

            {/* Parent Phone */}
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-2">
                מספר טלפון <span className="text-status-rejected">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-content-tertiary" />
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 border border-surface-border rounded-lg focus:ring-2 focus:ring-accent/40 focus:border-accent outline-none"
                  placeholder="05X-XXXXXXX"
                  required
                />
              </div>
            </div>

            {/* Declarations Section */}
            <div className="bg-surface-overlay p-4 rounded-lg space-y-4">
              <h3 className="font-semibold text-content-primary flex items-center gap-2">
                <FileText className="w-5 h-5" />
                הצהרות (חובה לאשר את כולן)
              </h3>

              {/* Guardian confirmation */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedGuardian}
                  onChange={(e) => setConfirmedGuardian(e.target.checked)}
                  className="mt-1 w-5 h-5 text-accent rounded focus:ring-accent/40"
                />
                <span className="text-sm text-content-secondary">
                  אני מאשר/ת כי אני <strong>ההורה או האפוטרופוס החוקי</strong> של{' '}
                  <strong>{consent?.minor_name}</strong> ואני מוסמך/ת לתת הסכמה בשמו/ה.
                </span>
              </label>

              {/* Terms confirmation */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedTerms}
                  onChange={(e) => setConfirmedTerms(e.target.checked)}
                  className="mt-1 w-5 h-5 text-accent rounded focus:ring-accent/40"
                />
                <span className="text-sm text-content-secondary">
                  קראתי והבנתי את{' '}
                  <Link href="/terms" className="text-accent hover:underline" target="_blank">
                    תנאי השימוש
                  </Link>{' '}
                  ואת{' '}
                  <Link href="/privacy" className="text-accent hover:underline" target="_blank">
                    מדיניות הפרטיות
                  </Link>{' '}
                  ואני מסכים/ה להם בשם הקטין.
                </span>
              </label>

              {/* Fee model confirmation */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedFee}
                  onChange={(e) => setConfirmedFee(e.target.checked)}
                  className="mt-1 w-5 h-5 text-accent rounded focus:ring-accent/40"
                />
                <span className="text-sm text-content-secondary">
                  אני מבין/ה ומסכים/ה ל<strong>מודל עמלת ההצלחה</strong>: במקרה של קבלת פיצוי,{' '}
                  <strong>80% יועברו לקטין ו-20% לשירות CashBus</strong>. אין תשלום מראש.
                </span>
              </label>
            </div>

            {/* Legal notice */}
            <div className="bg-status-pending-surface p-4 rounded-lg border border-status-pending/20">
              <p className="text-xs text-status-pending">
                <strong>שים לב:</strong> חתימה על טופס זה מהווה הסכמה משפטית מחייבת.
                פרטי ההסכמה נשמרים במערכת לצורך תיעוד משפטי, כולל תאריך, שעה, כתובת IP ופרטי הזיהוי.
              </p>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting || idError !== null}
              className="w-full btn-primary disabled:bg-surface-border disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 py-4 text-lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>שומר...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>אני מאשר/ת - חתימה דיגיטלית</span>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-surface-border text-center">
            <p className="text-xs text-content-tertiary">
              תאריך חתימה: {new Date().toLocaleDateString('he-IL')} | {new Date().toLocaleTimeString('he-IL')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}