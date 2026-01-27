'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/supabase'
import {
  LayoutDashboard,
  FileText,
  Workflow,
  Settings,
  LogOut,
  Bus,
  ChevronLeft,
  Mail,
  FileEdit,
} from 'lucide-react'

interface AdminSidebarProps {
  currentPath: string
  onClose?: () => void
}

export default function AdminSidebar({ currentPath, onClose }: AdminSidebarProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  const menuItems = [
    {
      name: 'לוח בקרה',
      href: '/admin',
      icon: LayoutDashboard,
      description: 'סקירה כללית ונתונים סטטיסטיים',
    },
    {
      name: 'ניהול תביעות',
      href: '/admin/claims',
      icon: FileText,
      description: 'צפייה וניהול תביעות לקוחות',
    },
    {
      name: 'תור מכתבים',
      href: '/admin/letter-queue',
      icon: Mail,
      description: 'שליחת מכתבים ומעקב תזכורות',
    },
    {
      name: 'תבניות מכתבים',
      href: '/admin/templates',
      icon: FileEdit,
      description: 'עריכת תבניות ל-3 שלבי התראה',
    },
    {
      name: 'אוטומציה וזרימות',
      href: '/admin/workflows',
      icon: Workflow,
      description: 'ניהול תהליכי עבודה אוטומטיים',
    },
    {
      name: 'הגדרות מערכת',
      href: '/admin/settings',
      icon: Settings,
      description: 'תבניות, הודעות ותצורה כללית',
    },
  ]

  const isActive = (href: string) => {
    if (href === '/admin') {
      return currentPath === '/admin'
    }
    return currentPath?.startsWith(href)
  }

  return (
    <div className="w-72 bg-gradient-to-b from-gray-900 to-gray-800 h-screen flex flex-col shadow-2xl">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary-orange p-2.5 rounded-lg shadow-lg">
            <Bus className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">CashBus</h1>
            <p className="text-xs text-gray-400">ממשק ניהול</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`
                group block rounded-xl transition-all duration-200
                ${active
                  ? 'bg-primary-orange text-white shadow-lg shadow-orange-500/30'
                  : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                }
              `}
            >
              <div className="px-4 py-3.5">
                <div className="flex items-center gap-3 mb-1">
                  <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                  <span className="font-semibold text-sm">{item.name}</span>
                  {active && (
                    <ChevronLeft className="w-4 h-4 mr-auto" />
                  )}
                </div>
                <p className={`text-xs mr-8 ${active ? 'text-orange-100' : 'text-gray-500 group-hover:text-gray-400'}`}>
                  {item.description}
                </p>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-gray-700 space-y-2">
        {/* Back to User Dashboard */}
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all duration-200 text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>חזרה לממשק משתמש</span>
        </Link>

        {/* Logout */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>התנתק מהמערכת</span>
        </button>
      </div>

      {/* Footer Info */}
      <div className="px-6 py-4 bg-gray-900/50">
        <p className="text-xs text-gray-500 text-center">
          Phase 4: Admin Interface
        </p>
        <p className="text-xs text-gray-600 text-center mt-1">
          v1.0.0 - 2026
        </p>
      </div>
    </div>
  )
}
