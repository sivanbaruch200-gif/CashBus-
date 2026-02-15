'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Settings,
  Mail,
  Bell,
  Shield,
  Database,
  Palette,
  Save,
  ToggleLeft,
  ToggleRight,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'

interface SettingSection {
  id: string
  name: string
  icon: React.ElementType
  description: string
}

interface AppSettings {
  admin_email: string
  email_notifications: boolean
  auto_approval: boolean
  reminder_days: number
  max_claim_amount: number
  system_language: string
}

const DEFAULT_SETTINGS: AppSettings = {
  admin_email: 'cash.bus200@gmail.com',
  email_notifications: true,
  auto_approval: false,
  reminder_days: 7,
  max_claim_amount: 11000,
  system_language: 'he',
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  // Load settings from DB on mount
  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        const dbSettings = await res.json()
        setSettings({
          admin_email: dbSettings.admin_email ?? DEFAULT_SETTINGS.admin_email,
          email_notifications: dbSettings.email_notifications ?? DEFAULT_SETTINGS.email_notifications,
          auto_approval: dbSettings.auto_approval ?? DEFAULT_SETTINGS.auto_approval,
          reminder_days: dbSettings.reminder_days ?? DEFAULT_SETTINGS.reminder_days,
          max_claim_amount: dbSettings.max_claim_amount ?? DEFAULT_SETTINGS.max_claim_amount,
          system_language: dbSettings.system_language ?? DEFAULT_SETTINGS.system_language,
        })
      }
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveStatus('idle')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(settings),
      })

      if (!res.ok) throw new Error('Failed to save')
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setSaving(false)
    }
  }

  const sections: SettingSection[] = [
    { id: 'general', name: 'כללי', icon: Settings, description: 'הגדרות כלליות של המערכת' },
    { id: 'notifications', name: 'התראות', icon: Bell, description: 'ניהול התראות והודעות' },
    { id: 'email', name: 'דואר אלקטרוני', icon: Mail, description: 'הגדרות שליחת מיילים' },
    { id: 'security', name: 'אבטחה', icon: Shield, description: 'הגדרות אבטחה והרשאות' },
    { id: 'database', name: 'מסד נתונים', icon: Database, description: 'גיבוי ותחזוקה' },
    { id: 'appearance', name: 'מראה', icon: Palette, description: 'עיצוב וצבעים' },
  ]

  const renderSettingsContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
          <span className="mr-2 text-content-secondary">טוען הגדרות...</span>
        </div>
      )
    }

    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-surface-overlay rounded-lg">
              <div>
                <h4 className="font-medium text-content-primary">שפת המערכת</h4>
                <p className="text-sm text-content-secondary">בחר את שפת הממשק</p>
              </div>
              <select
                value={settings.system_language}
                onChange={(e) => setSettings({ ...settings, system_language: e.target.value })}
                className="px-4 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-accent/40 focus:border-accent"
              >
                <option value="he">עברית</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4 bg-surface-overlay rounded-lg">
              <div>
                <h4 className="font-medium text-content-primary">סכום תביעה מקסימלי</h4>
                <p className="text-sm text-content-secondary">הגבלת סכום תביעה אוטומטית</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.max_claim_amount}
                  onChange={(e) => setSettings({ ...settings, max_claim_amount: Number(e.target.value) })}
                  className="w-32 px-4 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-accent/40 focus:border-accent text-left"
                />
                <span className="text-content-secondary">&#8362;</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-surface-overlay rounded-lg">
              <div>
                <h4 className="font-medium text-content-primary">אישור אוטומטי</h4>
                <p className="text-sm text-content-secondary">אשר תביעות באופן אוטומטי בסכומים נמוכים</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, auto_approval: !settings.auto_approval })}
                className="text-accent"
              >
                {settings.auto_approval ? (
                  <ToggleRight className="w-10 h-10" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-content-tertiary" />
                )}
              </button>
            </div>
          </div>
        )

      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-surface-overlay rounded-lg">
              <div>
                <h4 className="font-medium text-content-primary">התראות במייל</h4>
                <p className="text-sm text-content-secondary">קבל התראות על תביעות חדשות</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, email_notifications: !settings.email_notifications })}
                className="text-accent"
              >
                {settings.email_notifications ? (
                  <ToggleRight className="w-10 h-10" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-content-tertiary" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-surface-overlay rounded-lg">
              <div>
                <h4 className="font-medium text-content-primary">תזכורת אוטומטית</h4>
                <p className="text-sm text-content-secondary">שלח תזכורת לאחר X ימים ללא תגובה</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.reminder_days}
                  onChange={(e) => setSettings({ ...settings, reminder_days: Number(e.target.value) })}
                  className="w-20 px-4 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-accent/40 focus:border-accent text-center"
                />
                <span className="text-content-secondary">ימים</span>
              </div>
            </div>
          </div>
        )

      case 'email':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-surface-overlay border border-surface-border rounded-lg">
              <p className="text-status-legal">
                <strong>שירות מייל:</strong> המערכת משתמשת ב-Resend לשליחת מיילים.
                הגדרות SMTP זמינות בקונסולת Supabase.
              </p>
            </div>

            <div className="p-4 bg-surface-overlay rounded-lg">
              <h4 className="font-medium text-content-primary mb-2">כתובת מייל אדמין</h4>
              <input
                type="email"
                value={settings.admin_email}
                onChange={(e) => setSettings({ ...settings, admin_email: e.target.value })}
                className="w-full px-4 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-accent/40 focus:border-accent text-left"
                dir="ltr"
                placeholder="cash.bus200@gmail.com"
              />
              <p className="text-xs text-content-tertiary mt-1">כתובת זו מקבלת התראות על אסמכתאות חדשות ועדכוני תביעות</p>
            </div>

            <div className="p-4 bg-surface-overlay rounded-lg">
              <h4 className="font-medium text-content-primary mb-2">כתובת שולח</h4>
              <input
                type="email"
                defaultValue="noreply@cashbuses.com"
                className="w-full px-4 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-accent/40 focus:border-accent text-left"
                dir="ltr"
                disabled
              />
              <p className="text-xs text-content-tertiary mt-1">לשינוי כתובת השולח, עדכן ב-Resend Dashboard</p>
            </div>
          </div>
        )

      case 'security':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-status-pending-surface border border-status-pending/20 rounded-lg">
              <p className="text-status-pending">
                <strong>הרשאות מנהל:</strong> נקבעות דרך טבלת profiles בשדה is_admin.
                ניהול הרשאות מתקדם יהיה זמין בגרסאות הבאות.
              </p>
            </div>

            <div className="p-4 bg-surface-overlay rounded-lg">
              <h4 className="font-medium text-content-primary mb-2">מדיניות סיסמאות</h4>
              <p className="text-sm text-content-secondary">מנוהל דרך Supabase Auth</p>
            </div>

            <div className="p-4 bg-surface-overlay rounded-lg">
              <h4 className="font-medium text-content-primary mb-2">Row Level Security</h4>
              <p className="text-sm text-content-secondary flex items-center gap-2">
                <Shield className="w-4 h-4 text-status-approved" />
                מופעל על כל הטבלאות
              </p>
            </div>
          </div>
        )

      case 'database':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-surface-overlay rounded-lg">
              <h4 className="font-medium text-content-primary mb-2">מסד נתונים</h4>
              <p className="text-sm text-content-secondary flex items-center gap-2">
                <Database className="w-4 h-4 text-status-approved" />
                Supabase PostgreSQL - פעיל
              </p>
            </div>

            <div className="p-4 bg-surface-overlay rounded-lg">
              <h4 className="font-medium text-content-primary mb-2">גיבויים</h4>
              <p className="text-sm text-content-secondary">גיבוי אוטומטי יומי - מנוהל ע"י Supabase</p>
            </div>

            <button className="w-full px-4 py-3 bg-surface-overlay text-content-secondary rounded-lg hover:bg-surface-border transition-colors">
              פתח את Supabase Dashboard
            </button>
          </div>
        )

      case 'appearance':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-surface-overlay rounded-lg">
              <h4 className="font-medium text-content-primary mb-3">צבע ראשי</h4>
              <div className="flex gap-3">
                <button className="w-10 h-10 rounded-full bg-accent ring-2 ring-offset-2 ring-accent" />
                <button className="w-10 h-10 rounded-full bg-blue-600 hover:ring-2 hover:ring-offset-2 hover:ring-blue-600" />
                <button className="w-10 h-10 rounded-full bg-status-approved hover:ring-2 hover:ring-offset-2 hover:ring-status-approved" />
                <button className="w-10 h-10 rounded-full bg-purple-600 hover:ring-2 hover:ring-offset-2 hover:ring-purple-600" />
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-content-primary mb-2">הגדרות מערכת</h1>
        <p className="text-content-secondary">תצורה כללית, התראות ואבטחה</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-surface-raised rounded-xl shadow-md border border-surface-border overflow-hidden">
            <nav className="divide-y divide-surface-border">
              {sections.map((section) => {
                const Icon = section.icon
                const isActive = activeSection === section.id
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-right transition-colors ${
                      isActive
                        ? 'bg-accent-surface text-accent border-r-4 border-accent'
                        : 'text-content-secondary hover:bg-surface-overlay'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-accent' : 'text-content-tertiary'}`} />
                    <span className="font-medium text-sm">{section.name}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-surface-raised rounded-xl shadow-md border border-surface-border">
            <div className="px-6 py-4 border-b border-surface-border">
              <h2 className="text-xl font-bold text-content-primary">
                {sections.find(s => s.id === activeSection)?.name}
              </h2>
              <p className="text-sm text-content-secondary mt-1">
                {sections.find(s => s.id === activeSection)?.description}
              </p>
            </div>

            <div className="p-6">
              {renderSettingsContent()}
            </div>

            <div className="px-6 py-4 border-t border-surface-border bg-surface-overlay flex items-center gap-4">
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="flex items-center gap-2 px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-light transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                <span>{saving ? 'שומר...' : 'שמור שינויים'}</span>
              </button>

              {saveStatus === 'success' && (
                <span className="flex items-center gap-1 text-status-approved text-sm">
                  <CheckCircle className="w-4 h-4" />
                  ההגדרות נשמרו בהצלחה
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1 text-status-rejected text-sm">
                  <AlertCircle className="w-4 h-4" />
                  שגיאה בשמירת ההגדרות
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
