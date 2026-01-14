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
    <div className="card bg-gradient-to-br from-primary-orange to-orange-600 text-white">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-white/20 p-3 rounded-full">
          <PiggyBank className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold">קופת החיסכון שלי</h2>
      </div>

      <div className="space-y-4">
        {/* Amount Received - "Already in pocket" */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/90 text-sm font-medium">כבר בכיס 💰</span>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-green-300" />
              <span className="text-xs text-green-300">שולם</span>
            </div>
          </div>
          <div className="text-4xl font-bold tracking-tight">
            ₪{receivedAmount.toLocaleString('he-IL')}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-400 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${receivedPercentage}%` }}
            />
          </div>
        </div>

        {/* Potential Amount - "In process" */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/90 text-sm font-medium">בתהליך ⏳</span>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-orange-200" />
              <span className="text-xs text-orange-200">ממתין</span>
            </div>
          </div>
          <div className="text-3xl font-semibold text-orange-100">
            ₪{potentialAmount.toLocaleString('he-IL')}
          </div>
        </div>

        {/* Total Summary */}
        <div className="pt-4 border-t border-white/20">
          <div className="flex items-center justify-between">
            <span className="text-white/90 text-sm">סה״כ פוטנציאל</span>
            <span className="text-xl font-bold">
              ₪{totalAmount.toLocaleString('he-IL')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
