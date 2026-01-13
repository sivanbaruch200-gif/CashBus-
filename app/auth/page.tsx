'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signUp, signIn } from '@/lib/supabase'
import { Bus, Mail, Lock, User, Phone, AlertCircle, CheckCircle } from 'lucide-react'

export default function AuthPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (isLogin) {
        // Login flow
        await signIn(email, password)
        setSuccess('התחברת בהצלחה!')
        setTimeout(() => {
          router.push('/')
        }, 1000)
      } else {
        // Sign up flow
        if (!fullName || !phone) {
          setError('נא למלא את כל השדות')
          setLoading(false)
          return
        }

        await signUp(email, password, fullName, phone)
        setSuccess('נרשמת בהצלחה! בדוק את המייל שלך לאימות')
        setTimeout(() => {
          setIsLogin(true)
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message || 'אירעה שגיאה. נסה שוב')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-orange to-orange-600 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-white rounded-full p-4 mb-4 shadow-xl">
            <Bus className="w-12 h-12 text-primary-orange" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">CashBus</h1>
          <p className="text-white/90 text-lg">פיצוי אוטומטי על עיכובים בתחבורה</p>
        </div>

        {/* Main Card */}
        <div className="card bg-white shadow-2xl">
          {/* Explanation Section */}
          <div className="bg-orange-50 rounded-lg p-4 mb-6 border border-orange-200">
            <h3 className="font-bold text-orange-900 mb-2">איך זה עובד?</h3>
            <ul className="text-sm text-orange-800 space-y-1">
              <li>✓ דווחו על עיכובים ואי הגעות בזמן אמת</li>
              <li>✓ נאמת אוטומטית מול משרד התחבורה</li>
              <li>✓ צברו תיקים וקבלו פיצוי של עד ₪11,000</li>
              <li>✓ אנחנו נטפל בכל הבירוקרטיה</li>
            </ul>
          </div>

          {/* Toggle Login/Register */}
          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-md font-medium transition-all ${
                isLogin
                  ? 'bg-white text-primary-orange shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              התחברות
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-md font-medium transition-all ${
                !isLogin
                  ? 'bg-white text-primary-orange shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              הרשמה
            </button>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{success}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name (Register only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  שם מלא
                </label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent outline-none transition-all"
                    placeholder="הכנס שם מלא"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            {/* Phone (Register only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  מספר טלפון
                </label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent outline-none transition-all"
                    placeholder="05X-XXXXXXX"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                דואר אלקטרוני
              </label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent outline-none transition-all"
                  placeholder="example@email.com"
                  required
                  dir="ltr"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                סיסמה
              </label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  dir="ltr"
                />
              </div>
              {!isLogin && (
                <p className="text-xs text-gray-600 mt-1">לפחות 6 תווים</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>מעבד...</span>
                </>
              ) : (
                <span>{isLogin ? 'התחבר' : 'הרשם עכשיו'}</span>
              )}
            </button>
          </form>

          {/* Footer Links */}
          {isLogin && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setIsLogin(false)}
                className="text-sm text-primary-orange hover:underline"
              >
                אין לך חשבון? הרשם עכשיו
              </button>
            </div>
          )}
        </div>

        {/* Benefits Section */}
        <div className="mt-6 text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-white">
            <p className="text-sm font-medium mb-2">למה CashBus?</p>
            <div className="flex justify-center gap-6 text-xs">
              <div>
                <div className="font-bold text-lg">85%</div>
                <div>שיעור הצלחה</div>
              </div>
              <div>
                <div className="font-bold text-lg">₪3,200</div>
                <div>פיצוי ממוצע</div>
              </div>
              <div>
                <div className="font-bold text-lg">2,450</div>
                <div>לקוחות מרוצים</div>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Footer */}
        <p className="text-center text-white/70 text-xs mt-6">
          בהרשמה, אתה מאשר את{' '}
          <a href="#" className="underline hover:text-white">
            תנאי השימוש
          </a>{' '}
          ו
          <a href="#" className="underline hover:text-white">
            מדיניות הפרטיות
          </a>
        </p>
      </div>
    </div>
  )
}
