'use client'

import { useState, useEffect, useMemo } from 'react'
import { CheckCircle, Share2, ChevronLeft } from 'lucide-react'

interface SuccessMomentProps {
  compensationAmount?: number
  onDismiss: () => void
  onViewCase: () => void
}

export default function SuccessMoment({
  compensationAmount = 800,
  onDismiss,
  onViewCase,
}: SuccessMomentProps) {
  const [entered, setEntered] = useState(false)
  const [counter, setCounter] = useState(0)

  // Generate particles once (stable between renders)
  const particles = useMemo(() =>
    Array.from({ length: 45 }, (_, i) => ({
      id: i,
      x: 3 + Math.random() * 94,
      delay: Math.random() * 2.2,
      color: ['#FF8C00', '#FFD700', '#FF6B35', '#FFF8E7', '#FFA500'][i % 5],
      size: 5 + Math.random() * 9,
      dur: 2.4 + Math.random() * 1.8,
    })), [])

  useEffect(() => {
    // Entrance
    const t = setTimeout(() => setEntered(true), 40)

    // Animated counter: 0 → target over ~2s
    const target = compensationAmount
    const duration = 2000
    const start = performance.now()
    let raf: number

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 4)
      setCounter(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      clearTimeout(t)
      cancelAnimationFrame(raf)
    }
  }, [compensationAmount])

  const handleShare = () => {
    const text = `שלחתי מכתב משפטי לחברת האוטובוסים דרך CashBus 🚌💪\nהאוטובוס לא הגיע — והם עושים בשבילי את העבודה!\nפיצוי מוערך: ₪${compensationAmount}+\n\nwww.cashbuses.com`
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'קיבלתי פיצוי! 💰', text }).catch(() => {})
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() =>
        alert('הטקסט הועתק! הדבק בוואטסאפ, אינסטגרם או טיקטוק 🚀')
      )
    }
  }

  return (
    <>
      <style>{`
        @keyframes cb-rise {
          0%   { transform: translateY(0) rotate(0deg);   opacity: 1; }
          70%  { opacity: 0.9; }
          100% { transform: translateY(-92vh) rotate(600deg); opacity: 0; }
        }
        @keyframes cb-glow {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%       { opacity: 0.65; transform: scale(1.06); }
        }
        @keyframes cb-fade-up {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cb-pop {
          0%   { transform: scale(0.55); opacity: 0; }
          72%  { transform: scale(1.07); }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes cb-badge {
          0%   { opacity: 0; transform: scale(0.8) translateY(-8px); }
          100% { opacity: 1; transform: scale(1)   translateY(0); }
        }
        .cb-entered .cb-hero   { animation: cb-fade-up 0.7s 0.1s ease-out both; }
        .cb-entered .cb-amount { animation: cb-pop    0.6s 0.3s ease-out both; }
        .cb-entered .cb-msg    { animation: cb-fade-up 0.7s 0.45s ease-out both; }
        .cb-entered .cb-steps  { animation: cb-fade-up 0.7s 0.6s  ease-out both; }
        .cb-entered .cb-actions{ animation: cb-fade-up 0.7s 0.75s ease-out both; }
        .cb-entered .cb-badge  { animation: cb-badge  0.5s 0s    ease-out both; }
      `}</style>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden ${entered ? 'cb-entered' : ''}`}
        style={{
          background: '#030303',
          transition: 'opacity 0.55s ease',
          opacity: entered ? 1 : 0,
        }}
        dir="rtl"
      >
        {/* Ambient radial glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '55%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '700px', height: '420px',
            background: 'radial-gradient(ellipse, rgba(255,140,0,0.14) 0%, transparent 68%)',
            animation: 'cb-glow 3.5s ease-in-out infinite',
          }}
        />

        {/* Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map(p => (
            <div
              key={p.id}
              className="absolute bottom-0"
              style={{
                left: `${p.x}%`,
                width: p.size,
                height: p.size * 1.4,
                background: p.color,
                borderRadius: '2px',
                animation: `cb-rise ${p.dur}s ${p.delay}s ease-out forwards`,
                opacity: 0,
              }}
            />
          ))}
        </div>

        {/* Central content */}
        <div className="relative z-10 w-full max-w-xs mx-6 text-center">

          {/* Status badge */}
          <div className="cb-badge inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
            style={{ background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.22)', opacity: 0 }}>
            <CheckCircle className="w-3.5 h-3.5" style={{ color: '#FF8C00' }} />
            <span className="text-xs font-semibold tracking-wide" style={{ color: '#FF8C00' }}>
              מכתב משפטי נשלח ✓
            </span>
          </div>

          {/* Hero headline */}
          <div className="cb-hero" style={{ opacity: 0 }}>
            <h1
              className="font-black leading-none mb-2"
              style={{ fontSize: 'clamp(2.6rem, 10vw, 3.4rem)', color: '#FFFFFF', letterSpacing: '-0.025em' }}
            >
              הפיצוי שלך
            </h1>
            <h1
              className="font-black leading-none mb-8"
              style={{
                fontSize: 'clamp(2.6rem, 10vw, 3.4rem)',
                background: 'linear-gradient(135deg, #FF8C00 20%, #FFD700 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.025em',
              }}
            >
              בדרך אליך
            </h1>
          </div>

          {/* Compensation counter */}
          <div className="cb-amount mb-2" style={{ opacity: 0 }}>
            <span
              className="font-black leading-none"
              style={{
                fontSize: 'clamp(4rem, 18vw, 5.5rem)',
                color: '#FFD700',
                textShadow: '0 0 80px rgba(255,215,0,0.28)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.04em',
              }}
            >
              ₪{counter.toLocaleString('he-IL')}
            </span>
          </div>
          <p className="text-xs mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
            פוטנציאל פיצוי מינימלי מוערך
          </p>

          {/* Message */}
          <div className="cb-msg mb-8 space-y-2" style={{ opacity: 0 }}>
            <p className="text-base font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
              אנחנו עושים בשבילך את העבודה הכבדה
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
              הראיות תועדו. החברה קיבלה מכתב.<br />
              תנוח — ונחזור אליך עם תשובה.
            </p>
          </div>

          {/* Progress steps */}
          <div className="cb-steps flex items-center justify-center gap-3 mb-10 text-xs" style={{ opacity: 0 }}>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#4ade80' }} />
              <span style={{ color: '#4ade80' }}>תועד</span>
            </div>
            <div className="h-px w-5" style={{ background: 'rgba(255,255,255,0.12)' }} />
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#FF8C00' }} />
              <span style={{ color: '#FF8C00' }}>נשלח</span>
            </div>
            <div className="h-px w-5" style={{ background: 'rgba(255,255,255,0.12)' }} />
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
              <span style={{ color: 'rgba(255,255,255,0.28)' }}>פיצוי</span>
            </div>
          </div>

          {/* Actions */}
          <div className="cb-actions space-y-3" style={{ opacity: 0 }}>
            {/* Share — primary CTA */}
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-black text-base transition-transform active:scale-95 hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #FF8C00 0%, #FFD700 100%)' }}
            >
              <Share2 className="w-5 h-5" />
              שתף — ותעזור לאחרים
            </button>

            <button
              onClick={onViewCase}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-medium text-sm transition-all hover:brightness-125 active:scale-95"
              style={{
                border: '1px solid rgba(255,255,255,0.13)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.75)',
              }}
            >
              <ChevronLeft className="w-4 h-4" />
              צפה בתיק שלך
            </button>

            <button
              onClick={onDismiss}
              className="w-full py-2 text-sm transition-colors hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            >
              חזור לדשבורד
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
