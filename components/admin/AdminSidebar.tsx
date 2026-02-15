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
      description: 'סקירה כללית וסטטיסטיקה',
    },
    {
      name: 'ניהול תביעות',
      href: '/admin/claims',
      icon: FileText,
      description: 'ניהול תביעות לקוחות',
    },
    {
      name: 'תור מכתבים',
      href: '/admin/letter-queue',
      icon: Mail,
      description: 'שליחת מכתבים ומעקב',
    },
    {
      name: 'תבניות מכתבים',
      href: '/admin/templates',
      icon: FileEdit,
      description: 'עריכת תבניות התראה',
    },
  ]

  return (
    <div className="flex flex-col h-full bg-surface-base border-l border-surface-border" dir="rtl">
      {/* Logo Area */}
      <div className="p-6 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20">
            <Bus className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-content-primary">CashBus Admin</h1>
            <p className="text-xs text-content-tertiary">מערכת ניהול פיצויים</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {menuItems.map((item) => {
          const active = currentPath === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`group flex flex-col p-3 rounded-xl transition-all duration-200 ${
                active 
                  ? 'bg-accent/10 border border-accent/20' 
                  : 'hover:bg-surface-overlay border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`w-5 h-5 ${active ? 'text-accent' : 'text-content-tertiary group-hover:text-content-secondary'}`} />
                <span className={`font-medium ${active ? 'text-content-primary' : 'text-content-secondary group-hover:text-content-primary'}`}>
                  {item.name}
                </span>
                {active && <div className="mr-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_#D97706]" />}
              </div>
              <p className={`text-[11px] mt-1 mr-8 ${active ? 'text-accent/70' : 'text-content-tertiary'}`}>
                {item.description}
              </p>
            </Link>
          )
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-surface-border space-y-2">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-content-secondary hover:bg-surface-overlay hover:text-content-primary transition-all text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>חזרה לממשק משתמש</span>
        </Link>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-status-rejected hover:bg-status-rejected-surface transition-all text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span>התנתק מהמערכת</span>
        </button>
      </div>
    </div>
  )
}