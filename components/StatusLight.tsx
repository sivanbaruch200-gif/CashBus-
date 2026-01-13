'use client'

import { useState, useEffect } from 'react'
import { Satellite, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

type VerificationStatus = 'checking' | 'verified' | 'failed' | 'idle'

interface StatusLightProps {
  status?: VerificationStatus
}

export default function StatusLight({ status = 'idle' }: StatusLightProps) {
  const [currentStatus, setCurrentStatus] = useState<VerificationStatus>(status)

  useEffect(() => {
    setCurrentStatus(status)
  }, [status])

  const getStatusConfig = () => {
    switch (currentStatus) {
      case 'checking':
        return {
          color: 'bg-yellow-400',
          borderColor: 'border-yellow-400',
          textColor: 'text-yellow-700',
          icon: Loader2,
          text: 'מאמת מיקום GPS...',
          iconClass: 'animate-spin',
          pulseClass: 'animate-pulse',
        }
      case 'verified':
        return {
          color: 'bg-green-500',
          borderColor: 'border-green-500',
          textColor: 'text-green-700',
          icon: CheckCircle2,
          text: 'מיקום מאומת ✓',
          iconClass: '',
          pulseClass: '',
        }
      case 'failed':
        return {
          color: 'bg-red-500',
          borderColor: 'border-red-500',
          textColor: 'text-red-700',
          icon: XCircle,
          text: 'אימות נכשל',
          iconClass: '',
          pulseClass: '',
        }
      default:
        return {
          color: 'bg-gray-400',
          borderColor: 'border-gray-400',
          textColor: 'text-gray-700',
          icon: Satellite,
          text: 'ממתין לאימות GPS',
          iconClass: '',
          pulseClass: '',
        }
    }
  }

  const config = getStatusConfig()
  const StatusIcon = config.icon

  return (
    <div className="flex items-center gap-4 card bg-gray-50">
      {/* Status Light Indicator */}
      <div className="relative flex items-center justify-center">
        {/* Pulse ring for active states */}
        {(currentStatus === 'checking' || currentStatus === 'verified') && (
          <div className={`absolute w-12 h-12 rounded-full ${config.color} opacity-20 ${config.pulseClass}`} />
        )}

        {/* Main light */}
        <div className={`relative w-8 h-8 rounded-full ${config.color} shadow-lg border-2 ${config.borderColor}`}>
          {/* Shine effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/40 to-transparent" />
        </div>
      </div>

      {/* Status text and icon */}
      <div className="flex items-center gap-2 flex-1">
        <StatusIcon className={`w-5 h-5 ${config.textColor} ${config.iconClass}`} />
        <span className={`font-medium ${config.textColor}`}>
          {config.text}
        </span>
      </div>

      {/* Info badge */}
      {currentStatus === 'verified' && (
        <div className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
          משרד התחבורה
        </div>
      )}
    </div>
  )
}
