'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Bus, ArrowRight, Mail, Loader2, User, Phone, CreditCard, AlertCircle, CheckCircle } from 'lucide-react'

// פונקציית עזר לאימות ת.ז. ישראלית. הוספתי אותה כאן כדי להבטיח שהקוד יעבוד.
function validateIsraeliId(id: string): boolean {
  let strId = String(id).trim()
  if (strId.length > 9) {
    return false
  }
  if (strId.length < 9) {
    while (strId.length < 9) strId = '0' + strId
  }
  let counter = 0,
    rawVal
  for (let i = 0; i < strId.length; i++) {
    rawVal = Number(strId[i]) * ((i % 2) + 1)
    counter += rawVal > 9 ? rawVal - 9 : rawVal
  }
  return counter % 10 === 0
}

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [idNumber, setIdNumber] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [idError, setIdError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    if (mode === 'register') {
      if (idError || !fullName || !phone || !idNumber) {
        setError('נא למלא את כל שדות ההרשמה כראוי.')
        setIsLoading(false)
        return
      }
      // שמירת פרטים נוספים ב-localStorage לפני שליחת הקישור.
      // הנתונים ייאספו ויישמרו בפרופיל המשתמש לאחר שיאשר את המייל.
      const registrationData = { full_name: fullName, phone, id_number: idNumber }
      localStorage.setItem('pending_registration_data', JSON.stringify(registrationData))
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // ודא שאפשרות זו (Sign up new users) מופעלת בהגדרות Supabase Auth
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setIsLoading(false)

    if (error) {
      setError(error.message)
      if (mode === 'register') {
        localStorage.removeItem('pending_registration_data') // נקה במקרה של שגיאה
      }
    } else {
      setSuccessMessage('נשלח אליך קישור קסום למייל! יש ללחוץ עליו כדי להשלים את הפעולה.')
    }
  }

  const handleIdValidation = (id: string) => {
    const cleanId = id.replace(/\D/g, '')
    setIdNumber(cleanId)

    if (cleanId.length === 0) {
      setIdError(null)
      return
    }

    if (cleanId.length !== 9) {
      setIdError('ת.ז. חייבת להכיל 9 ספרות')
      return
    }

    if (!validateIsraeliId(cleanId)) {
      setIdError('מספר ת.ז. לא תקין')
      return
    }

    setIdError(null)
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center p-4" dir="rtl">
      {/* לוגו עליון */}
      <div className="mb-8 text-center animate-in fade-in zoom-in-95 duration-700">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-accent/10 rounded-full mb-4 border border-accent/20 shadow-[0_0_30px_rgba(217,119,6,0.2)]">
          <Bus className="w-10 h-10 text-accent" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">CashBus</h1>
        <p className="text-content-secondary mt-2">פיצוי אוטומטי על עיכובי תחבורה</p>
      </div>

      {/* כרטיס התחברות בסגנון Glassmorphism */}
      <div className="w-full max-w-md bg-surface-raised/50 backdrop-blur-xl rounded-3xl p-8 border border-surface-border shadow-2xl shadow-black/50 animate-in fade-in zoom-in-95 duration-500">
        {successMessage ? (
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">הקישור בדרך!</h2>
            <p className="text-content-secondary text-sm">{successMessage}</p>
          </div>
        ) : (
          <>
            <div className="flex border-b border-surface-border mb-6">
              <button
                onClick={() => setMode('login')}
                className={`flex-1 pb-3 text-sm font-medium transition-colors ${mode === 'login' ? 'text-accent border-b-2 border-accent' : 'text-content-secondary hover:text-white'}`}
              >
                התחברות
              </button>
              <button
                onClick={() => setMode('register')}
                className={`flex-1 pb-3 text-sm font-medium transition-colors ${mode === 'register' ? 'text-accent border-b-2 border-accent' : 'text-content-secondary hover:text-white'}`}
              >
                הרשמה
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">
                {mode === 'login' ? 'התחברות מהירה' : 'הרשמה לשירות'}
              </h2>
              <p className="text-content-tertiary text-sm">
                {mode === 'login' ? 'הכנס מייל ונשלח לך קישור כניסה מיידי' : 'מלא את הפרטים והתחל לקבל פיצויים'}
              </p>
            </div>

            <form onSubmit={handleAuthAction} className="space-y-4">
              {mode === 'register' && (
                <>
                  {/* Full Name */}
                  <div className="relative">
                    <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-content-tertiary" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="שם מלא"
                      className="w-full bg-surface-base border border-surface-border text-white rounded-xl py-4 pr-12 pl-4 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all placeholder:text-content-tertiary/50"
                      required
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="relative">
                    <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-content-tertiary" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="מספר טלפון"
                      className="w-full bg-surface-base border border-surface-border text-white rounded-xl py-4 pr-12 pl-4 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all placeholder:text-content-tertiary/50"
                      required
                    />
                  </div>
                </>
              )}

              {/* Email */}
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-content-tertiary" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-surface-base border border-surface-border text-white rounded-xl py-4 pr-12 pl-4 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all placeholder:text-content-tertiary/50"
                  required
                />
              </div>

              {mode === 'register' && (
                <>
                  {/* ID Number */}
                  <div className="relative">
                    <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-content-tertiary" />
                    <input
                      type="text"
                      value={idNumber}
                      onChange={(e) => handleIdValidation(e.target.value)}
                      placeholder="מספר תעודת זהות"
                      className={`w-full bg-surface-base border text-white rounded-xl py-4 pr-12 pl-4 outline-none focus:ring-1 transition-all placeholder:text-content-tertiary/50 ${idError ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/50' : 'border-surface-border focus:border-accent/50 focus:ring-accent/50'}`}
                      maxLength={9}
                      required
                    />
                  </div>
                  {idError && <p className="text-xs text-red-400 mt-1">{idError}</p>}
                </>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-accent hover:bg-accent-light text-white font-bold py-4 rounded-xl shadow-lg shadow-accent/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{mode === 'login' ? 'שלח קישור התחברות' : 'צור חשבון ושלח קישור'}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-surface-border text-center">
          <p className="text-xs text-content-tertiary leading-relaxed">
            {mode === 'login' ? 'אין לך חשבון? ' : 'כבר יש לך חשבון? '}
            <span
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-accent font-semibold cursor-pointer hover:underline"
            >
              {mode === 'login' ? 'הירשם כאן' : 'התחבר כאן'}
            </span>
          </p>
          <p className="text-xs text-content-tertiary leading-relaxed mt-4">
            בהרשמה או התחברות, הנך מאשר/ת את <br />
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-accent cursor-pointer hover:underline">תנאי השימוש</a> ו
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-accent cursor-pointer hover:underline">מדיניות הפרטיות</a>
          </p>
        </div>
      </div>

      {/* סטטיסטיקה תחתונה עדינה */}
      <div className="mt-12 grid grid-cols-3 gap-8 opacity-50 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="text-center">
          <div className="text-white font-bold">2,450+</div>
          <div className="text-[10px] text-content-tertiary uppercase tracking-wider">נוסעים</div>
        </div>
        <div className="text-center">
          <div className="text-white font-bold">85%</div>
          <div className="text-[10px] text-content-tertiary uppercase tracking-wider">הצלחה</div>
        </div>
        <div className="text-center">
          <div className="text-white font-bold">₪3,200</div>
          <div className="text-[10px] text-content-tertiary uppercase tracking-wider">ממוצע</div>
        </div>
      </div>
    </div>
  )
}