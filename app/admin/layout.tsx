'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getSession, isUserAdmin } from '@/lib/supabase'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { Menu, X, Loader2 } from 'lucide-react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    checkAdminAuth()
  }, [])

  const checkAdminAuth = async () => {
    // בדיקת אימות
    const session = await getSession()

    if (!session) {
      router.push('/auth')
      return
    }

    // בדיקת הרשאות מנהל
    const adminStatus = await isUserAdmin(session.user.id)

    if (!adminStatus) {
      alert('גישה נדחתה - אין לך הרשאות מנהל')
      router.push('/')
      return
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-accent animate-spin mx-auto mb-4" />
          <p className="text-content-secondary animate-pulse">מאמת הרשאות מנהל...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-base flex" dir="rtl">
      {/* Mobile sidebar backdrop - מעבר לכהה שקוף */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - נשאר קבוע בצד ימין */}
      <div
        className={`
          fixed lg:static inset-y-0 right-0 z-50
          transform ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          transition-transform duration-300 ease-in-out
          bg-surface-raised border-l border-surface-border
        `}
      >
        <AdminSidebar currentPath={pathname} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar (Mobile Menu Button) - מותאם ל-Dark Mode */}
        <div className="lg:hidden bg-surface-raised border-b border-surface-border px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-surface-overlay transition-colors text-content-primary"
          >
            {sidebarOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
          <h1 className="text-lg font-bold text-accent">CashBus Admin</h1>
        </div>

        {/* משטח התוכן המרכזי */}
        <main className="flex-1 overflow-y-auto bg-surface-base custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  )
}