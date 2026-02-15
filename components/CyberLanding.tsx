'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bus, Shield, TrendingUp, Zap } from 'lucide-react'
import MatrixRain from './MatrixRain'

interface CyberLandingProps {
  onComplete: () => void
  isReturningUser: boolean
}

export default function CyberLanding({ onComplete, isReturningUser }: CyberLandingProps) {
  const [phase, setPhase] = useState(0)
  const [typedText, setTypedText] = useState('')
  const [counterValue, setCounterValue] = useState(0)
  const [showSkip, setShowSkip] = useState(false)

  const subtitle = 'ברוכים הבאים לעידן החדש של תחבורה ציבורית'
  const targetCounter = 2847350

  // For returning users - quick fade and redirect
  useEffect(() => {
    if (isReturningUser) {
      setPhase(5)
      const timer = setTimeout(onComplete, 1200)
      return () => clearTimeout(timer)
    }
  }, [isReturningUser, onComplete])

  // Phase progression for new users
  useEffect(() => {
    if (isReturningUser) return

    const timers: NodeJS.Timeout[] = []

    timers.push(setTimeout(() => setPhase(1), 100))
    timers.push(setTimeout(() => setPhase(2), 1000))
    timers.push(setTimeout(() => setPhase(3), 2500))
    timers.push(setTimeout(() => setPhase(4), 3800))
    timers.push(setTimeout(() => setShowSkip(true), 1500))

    return () => timers.forEach(clearTimeout)
  }, [isReturningUser])

  // Typewriter effect for subtitle
  useEffect(() => {
    if (phase < 2) return

    let index = 0
    const interval = setInterval(() => {
      if (index <= subtitle.length) {
        setTypedText(subtitle.slice(0, index))
        index++
      } else {
        clearInterval(interval)
      }
    }, 40)

    return () => clearInterval(interval)
  }, [phase])

  // Counter animation
  useEffect(() => {
    if (phase < 3) return

    const duration = 1500
    const startTime = Date.now()

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCounterValue(Math.floor(eased * targetCounter))

      if (progress >= 1) clearInterval(interval)
    }, 16)

    return () => clearInterval(interval)
  }, [phase])

  const handleSkip = useCallback(() => {
    onComplete()
  }, [onComplete])

  // Returning user - quick branded flash
  if (isReturningUser) {
    return (
      <div className="fixed inset-0 bg-surface-base flex items-center justify-center z-50">
        <div
          className="text-center"
          style={{ animation: 'scale-in 0.6s ease-out forwards' }}
        >
          <div className="inline-flex items-center justify-center bg-surface-raised rounded-full p-5 mb-4 border border-accent/30 shadow-accent-glow">
            <Bus className="w-12 h-12 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-content-primary tracking-wide">
            CashBus
          </h1>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-surface-base z-50 overflow-hidden cursor-pointer"
      onClick={handleSkip}
    >
      {/* Ambient Background */}
      {phase >= 1 && <MatrixRain opacity={phase >= 2 ? 0.4 : 0.7} />}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">

        {/* Logo */}
        {phase >= 2 && (
          <div
            className="text-center mb-8"
            style={{ animation: 'scale-in 0.8s ease-out forwards' }}
          >
            {/* Bus icon with subtle glow */}
            <div className="inline-flex items-center justify-center bg-surface-raised rounded-full p-6 mb-6 border border-accent/20 shadow-accent-glow">
              <Bus className="w-16 h-16 text-accent" />
            </div>

            {/* Clean title */}
            <h1 className="text-6xl md:text-8xl font-bold text-content-primary mb-4 tracking-wide">
              CashBus
            </h1>

            {/* Typewriter subtitle */}
            <div className="h-8 flex items-center justify-center">
              <p
                className="text-content-secondary text-lg md:text-xl font-light tracking-wide"
                style={{
                  borderLeft: '2px solid #71717A',
                  paddingLeft: '8px',
                  animation: 'blink-caret 0.75s step-end infinite',
                }}
              >
                {typedText}
              </p>
            </div>
          </div>
        )}

        {/* Money counter */}
        {phase >= 3 && (
          <div
            className="text-center mb-10"
            style={{ animation: 'fade-in-up 0.8s ease-out forwards' }}
          >
            <p className="text-content-tertiary text-sm mb-2 tracking-widest uppercase">
              סה״כ הוחזר לנוסעים
            </p>
            <div
              className="text-5xl md:text-7xl font-bold text-gold tabular-nums"
              style={{ direction: 'ltr' }}
            >
              ₪{counterValue.toLocaleString('he-IL')}
            </div>

            {/* Stats row */}
            <div
              className="flex gap-8 md:gap-16 justify-center mt-8"
              style={{ animation: 'fade-in-up 0.6s ease-out 0.3s both' }}
            >
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-content-tertiary" />
                  <span className="text-2xl font-bold text-content-primary">2,450+</span>
                </div>
                <span className="text-content-tertiary text-xs">נוסעים מרוצים</span>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-content-tertiary" />
                  <span className="text-2xl font-bold text-content-primary">85%</span>
                </div>
                <span className="text-content-tertiary text-xs">אחוז הצלחה</span>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-content-tertiary" />
                  <span className="text-2xl font-bold text-content-primary">₪3,200</span>
                </div>
                <span className="text-content-tertiary text-xs">פיצוי ממוצע</span>
              </div>
            </div>
          </div>
        )}

        {/* CTA Button */}
        {phase >= 4 && (
          <div
            className="text-center"
            style={{ animation: 'fade-in-up 0.6s ease-out forwards' }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                onComplete()
              }}
              className="px-10 py-4 bg-accent hover:bg-accent-light text-white text-xl font-bold rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 shadow-accent-glow"
            >
              התחל לקבל פיצוי
            </button>

            <p className="text-content-tertiary text-xs mt-4">
              ללא תשלום מראש • עמלת הצלחה בלבד
            </p>
          </div>
        )}
      </div>

      {/* Skip hint */}
      {showSkip && phase < 4 && (
        <div
          className="absolute bottom-8 left-0 right-0 text-center"
          style={{ animation: 'fade-in 0.5s ease-out forwards', zIndex: 20 }}
        >
          <p className="text-content-tertiary text-xs">לחץ בכל מקום לדלג</p>
        </div>
      )}

      {/* Subtle vignette */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(10,10,11,0.8) 100%)',
          zIndex: 5,
        }}
      />
    </div>
  )
}
