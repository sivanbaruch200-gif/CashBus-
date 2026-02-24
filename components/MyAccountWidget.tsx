'use client'

import { PiggyBank, TrendingUp, Clock, FileText } from 'lucide-react'

interface MyAccountWidgetProps {
  receivedAmount: number
  activeClaims: number
}

export default function MyAccountWidget({ receivedAmount, activeClaims }: MyAccountWidgetProps) {
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-accent-surface p-3 rounded-full border border-accent-border">
          <PiggyBank className="w-8 h-8 text-accent" />
        </div>
        <h2 className="text-2xl font-bold text-content-primary">קופת החיסכון שלי</h2>
      </div>

      <div className="space-y-4">
        {/* Amount Received */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-content-secondary text-sm font-medium">כבר בכיס</span>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-status-approved" />
              <span className="text-xs text-status-approved">שולם</span>
            </div>
          </div>
          <div className="text-4xl font-bold tracking-tight text-gold">
            ₪{receivedAmount.toLocaleString('he-IL')}
          </div>
          {receivedAmount === 0 && (
            <p className="text-xs text-content-tertiary mt-1">
              הכסף יופיע כאן ברגע שחברת האוטובוסים תשלם
            </p>
          )}
        </div>

        <div className="border-t border-surface-border" />

        {/* Active Claims */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-content-secondary text-sm font-medium">בתהליך</span>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-content-tertiary" />
              <span className="text-xs text-content-tertiary">ממתין לטיפול</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-semibold text-content-secondary">
              {activeClaims}
            </div>
            <div className="flex items-center gap-1 text-content-tertiary">
              <FileText className="w-4 h-4" />
              <span className="text-sm">{activeClaims === 1 ? 'תיק' : 'תיקים'} פעילים</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
