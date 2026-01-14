'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/supabase'
import { Bus } from 'lucide-react'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    async function checkAuthAndRedirect() {
      try {
        const session = await getSession()

        if (session) {
          // User is logged in - go to dashboard
          router.push('/claims')
        } else {
          // User is not logged in - go to auth
          router.push('/auth')
        }
      } catch (error) {
        console.error('Error checking auth:', error)
        // On error, default to auth page
        router.push('/auth')
      }
    }

    checkAuthAndRedirect()
  }, [router])

  // Loading state while checking authentication
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center bg-primary-orange rounded-full p-6 mb-4 shadow-xl">
          <Bus className="w-16 h-16 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">CashBus</h1>
        <p className="text-gray-600 mb-8">פיצוי אוטומטי על עיכובים בתחבורה</p>
        <div className="w-16 h-16 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  )
}
