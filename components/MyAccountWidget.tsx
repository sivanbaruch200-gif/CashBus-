'use client'

import { PiggyBank, TrendingUp, Clock } from 'lucide-react'

interface MyAccountWidgetProps {
  receivedAmount: number
  potentialAmount: number
}

export default function MyAccountWidget({ receivedAmount, potentialAmount }: MyAccountWidgetProps) {
  const totalAmount = receivedAmount + potentialAmount
  const receivedPercentage = totalAmount > 0 ? (receivedAmount / totalAmount) * 100 : 0

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
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="h-3 bg-surface-overlay rounded-full overflow-hidden">
            <div
              className="h-full bg-status-approved transition-all duration-500 ease-out rounded-full"
              style={{ width: `${receivedPercentage}%` }}
            />
          </div>
        </div>

        {/* Potential Amount */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-content-secondary text-sm font-medium">בתהליך</span>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-content-tertiary" />
              <span className="text-xs text-content-tertiary">ממתין</span>
            </div>
          </div>
          <div className="text-3xl font-semibold text-content-secondary">
            ₪{potentialAmount.toLocaleString('he-IL')}
          </div>
        </div>

        {/* Total Summary */}
        <div className="pt-4 border-t border-surface-border">
          <div className="flex items-center justify-between">
            <span className="text-content-secondary text-sm">סה״כ פוטנציאל</span>
            <span className="text-xl font-bold text-content-primary">
              ₪{totalAmount.toLocaleString('he-IL')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
