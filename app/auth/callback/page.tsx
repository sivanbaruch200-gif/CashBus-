'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if there are hash params (magic link tokens)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          // Exchange the tokens from the URL hash
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) {
            console.error('Error setting session:', error)
            setError('שגיאה באימות. נסה שוב.')
            setTimeout(() => router.push('/auth'), 3000)
            return
          }
          router.push('/dashboard')
          return
        }

        // Check for query params (some OTP flows use these)
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.error('Error exchanging code:', error)
            setError('שגיאה באימות. נסה שוב.')
            setTimeout(() => router.push('/auth'), 3000)
            return
          }
          router.push('/dashboard')
          return
        }

        // Fallback: check if session already exists (detectSessionInUrl may have handled it)
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          router.push('/dashboard')
          return
        }

        // Listen for auth state change as last resort
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN') {
            router.push('/dashboard')
          }
        })

        // Final fallback - redirect to auth after timeout
        const timeout = setTimeout(() => {
          setError('לא התקבל אימות. מנסה שוב...')
          setTimeout(() => router.push('/auth'), 2000)
        }, 8000)

        return () => {
          subscription.unsubscribe()
          clearTimeout(timeout)
        }
      } catch (err) {
        console.error('Callback error:', err)
        setError('שגיאה באימות. מחזיר לדף ההתחברות...')
        setTimeout(() => router.push('/auth'), 3000)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto mb-4" />
        <p className="text-content-secondary">
          {error || 'מאמת את החשבון שלך...'}
        </p>
      </div>
    </div>
  )
}
