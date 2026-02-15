'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/supabase'
import CyberLanding from '@/components/CyberLanding'

export default function Home() {
  const router = useRouter()
  const [authTarget, setAuthTarget] = useState<string | null>(null)
  const [isReturningUser, setIsReturningUser] = useState(false)
  const [showLanding, setShowLanding] = useState(true)

  // Check auth in parallel with animation
  useEffect(() => {
    // Check if returning user
    const hasSeenIntro = localStorage.getItem('cashbus_intro_seen')
    if (hasSeenIntro) {
      setIsReturningUser(true)
    }

    async function checkAuth() {
      try {
        const session = await getSession()
        setAuthTarget(session ? '/dashboard' : '/auth')
      } catch (error) {
        console.error('Error checking auth:', error)
        setAuthTarget('/auth')
      }
    }

    checkAuth()
  }, [])

  const handleLandingComplete = useCallback(() => {
    // Mark as seen for next visit
    localStorage.setItem('cashbus_intro_seen', 'true')
    setShowLanding(false)

    // If auth check is done, redirect immediately
    if (authTarget) {
      router.push(authTarget)
    }
  }, [authTarget, router])

  // If landing is done but auth wasn't ready yet, redirect when it is
  useEffect(() => {
    if (!showLanding && authTarget) {
      router.push(authTarget)
    }
  }, [showLanding, authTarget, router])

  if (!showLanding) {
    // Waiting for auth check to complete
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <CyberLanding
      onComplete={handleLandingComplete}
      isReturningUser={isReturningUser}
    />
  )
}
