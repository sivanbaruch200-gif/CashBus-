'use client'

/**
 * User Profile Settings Page
 *
 * Collects MANDATORY fields for Zero-Touch legal automation:
 * - ID Number (ת.ז) - Required for small claims
 * - Full Home Address - Required for court filings
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUserProfile, supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'
import { User, MapPin, Shield, CheckCircle, AlertCircle } from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [homeAddress, setHomeAddress] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      const data = await getCurrentUserProfile()
      if (data) {
        setProfile(data)
        setFullName(data.full_name)
        setPhone(data.phone)
        setIdNumber(data.id_number || '')
        setHomeAddress(data.home_address || '')
        setCity(data.city || '')
        setPostalCode(data.postal_code || '')
      }
    } catch (err) {
      console.error('Error loading profile:', err)
      setError('שגיאה בטעינת הפרופיל')
    } finally {
      setLoading(false)
    }
  }

  function validateIdNumber(id: string): boolean {
    // Basic Israeli ID validation (9 digits)
    const cleaned = id.replace(/\D/g, '')
    return cleaned.length === 9
  }

  async function handleSave() {
    setError(null)
    setSuccess(false)

    // Validation
    if (!fullName.trim()) {
      setError('שם מלא הוא שדה חובה')
      return
    }

    if (!phone.trim()) {
      setError('טלפון הוא שדה חובה')
      return
    }

    if (!idNumber.trim()) {
      setError('מספר תעודת זהות הוא שדה חובה לצורך הגשת תביעות')
      return
    }

    if (!validateIdNumber(idNumber)) {
      setError('מספר תעודת זהות לא תקין (9 ספרות)')
      return
    }

    if (!homeAddress.trim()) {
      setError('כתובת מגורים מלאה נדרשת לצורך הגשת תביעות משפטיות')
      return
    }

    if (!city.trim()) {
      setError('עיר היא שדה חובה')
      return
    }

    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('משתמש לא מחובר')
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          id_number: idNumber.trim(),
          home_address: homeAddress.trim(),
          city: city.trim(),
          postal_code: postalCode.trim(),
          address_verified: true, // Mark as verified when user provides it
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (err) {
      console.error('Error saving profile:', err)
      setError('שגיאה בשמירת הפרופיל')
    } finally {
      setSaving(false)
    }
  }

  const isProfileComplete = idNumber && homeAddress && city

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">טוען...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-orange-100 p-3 rounded-full">
              <User className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">הגדרות פרופיל</h1>
              <p className="text-gray-600 text-sm">מידע נדרש להגשת תביעות אוטומטיות</p>
            </div>
          </div>

          {/* Profile Completeness Status */}
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            isProfileComplete ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
          }`}>
            {isProfileComplete ? (
              <>
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-semibold">הפרופיל שלך מלא ומוכן להגשת תביעות אוטומטיות</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-semibold">נא להשלים את כל השדות כדי לאפשר אוטומציה מלאה</span>
              </>
            )}
          </div>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg mb-6 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>הפרופיל עודכן בהצלחה! מעביר לעמוד הראשי...</span>
          </div>
        )}

        {/* Personal Information Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-orange-600" />
            מידע אישי
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">
                שם מלא <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="יוסי כהן"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                מספר תעודת זהות <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                maxLength={9}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="123456789"
              />
              <p className="text-xs text-gray-500 mt-1">
                <Shield className="w-3 h-3 inline mr-1" />
                מספר ת.ז נדרש לצורך הגשת תביעות משפטיות בלבד
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                טלפון <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="050-1234567"
              />
            </div>
          </div>
        </div>

        {/* Address Information Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orange-600" />
            כתובת מגורים
          </h2>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
            <p className="text-sm text-blue-800">
              <strong>למה זה חשוב?</strong> כתובת מגורים מלאה נדרשת לצורך הגשת תביעות בבית המשפט לתביעות קטנות.
              ללא כתובת, לא נוכל לשלוח את המסמכים המשפטיים בשמך.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">
                כתובת מלאה (רחוב ומספר בית) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={homeAddress}
                onChange={(e) => setHomeAddress(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="רחוב הרצל 123, דירה 4"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  עיר <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="תל אביב"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  מיקוד
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="6789012"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Zero-Touch Automation Info */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-6 mb-6">
          <h3 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            אוטומציה ללא מגע (Zero-Touch)
          </h3>
          <p className="text-orange-800 text-sm mb-2">
            ברגע שתשלים את המידע, המערכת תטפל בכל התהליך המשפטי בשבילך:
          </p>
          <ul className="text-orange-800 text-sm space-y-1 mr-4">
            <li>✅ יצירת מכתב אזהרה מקצועי עם AI</li>
            <li>✅ שליחה אוטומטית לחברת ההסעות (אימייל או טופס)</li>
            <li>✅ דיווח אוטומטי למשרד התחבורה</li>
            <li>✅ מעקב אחר סטטוס התביעה</li>
            <li>✅ הכל בלי שתצטרך לעשות דבר!</li>
          </ul>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-colors shadow-lg"
        >
          {saving ? 'שומר...' : 'שמור ועדכן פרופיל'}
        </button>

        {/* Privacy Note */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <Shield className="w-4 h-4 inline ml-1" />
          המידע שלך מוצפן ומאובטח. נשתמש בו רק לצורך הגשת תביעות בשמך.
        </div>
      </div>
    </div>
  )
}
