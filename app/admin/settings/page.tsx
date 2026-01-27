'use client'

import { useState } from 'react'
import {
  Settings,
  Mail,
  Bell,
  Shield,
  Database,
  Palette,
  Globe,
  Save,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

interface SettingSection {
  id: string
  name: string
  icon: React.ElementType
  description: string
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general')
  const [saving, setSaving] = useState(false)

  // Settings state
  const [settings, setSettings] = useState({
    emailNotifications: true,
    autoApproval: false,
    reminderDays: 7,
    maxClaimAmount: 11000,
    systemLanguage: 'he',
    darkMode: false,
  })

  const sections: SettingSection[] = [
    { id: 'general', name: 'כללי', icon: Settings, description: 'הגדרות כלליות של המערכת' },
    { id: 'notifications', name: 'התראות', icon: Bell, description: 'ניהול התראות והודעות' },
    { id: 'email', name: 'דואר אלקטרוני', icon: Mail, description: 'הגדרות שליחת מיילים' },
    { id: 'security', name: 'אבטחה', icon: Shield, description: 'הגדרות אבטחה והרשאות' },
    { id: 'database', name: 'מסד נתונים', icon: Database, description: 'גיבוי ותחזוקה' },
    { id: 'appearance', name: 'מראה', icon: Palette, description: 'עיצוב וצבעים' },
  ]

  const handleSave = async () => {
    setSaving(true)
    // Simulate saving
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSaving(false)
    alert('ההגדרות נשמרו בהצלחה')
  }

  const renderSettingsContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">שפת המערכת</h4>
                <p className="text-sm text-gray-600">בחר את שפת הממשק</p>
              </div>
              <select
                value={settings.systemLanguage}
                onChange={(e) => setSettings({ ...settings, systemLanguage: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent"
              >
                <option value="he">עברית</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">סכום תביעה מקסימלי</h4>
                <p className="text-sm text-gray-600">הגבלת סכום תביעה אוטומטית</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.maxClaimAmount}
                  onChange={(e) => setSettings({ ...settings, maxClaimAmount: Number(e.target.value) })}
                  className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent text-left"
                />
                <span className="text-gray-600">&#8362;</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">אישור אוטומטי</h4>
                <p className="text-sm text-gray-600">אשר תביעות באופן אוטומטי בסכומים נמוכים</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, autoApproval: !settings.autoApproval })}
                className="text-primary-orange"
              >
                {settings.autoApproval ? (
                  <ToggleRight className="w-10 h-10" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        )

      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">התראות במייל</h4>
                <p className="text-sm text-gray-600">קבל התראות על תביעות חדשות</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, emailNotifications: !settings.emailNotifications })}
                className="text-primary-orange"
              >
                {settings.emailNotifications ? (
                  <ToggleRight className="w-10 h-10" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-gray-400" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">תזכורת אוטומטית</h4>
                <p className="text-sm text-gray-600">שלח תזכורת לאחר X ימים ללא תגובה</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.reminderDays}
                  onChange={(e) => setSettings({ ...settings, reminderDays: Number(e.target.value) })}
                  className="w-20 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent text-center"
                />
                <span className="text-gray-600">ימים</span>
              </div>
            </div>
          </div>
        )

      case 'email':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800">
                <strong>שירות מייל:</strong> המערכת משתמשת ב-Resend לשליחת מיילים.
                הגדרות SMTP זמינות בקונסולת Supabase.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">כתובת שולח</h4>
              <input
                type="email"
                defaultValue="noreply@cashbus.co.il"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">לשינוי כתובת השולח, עדכן ב-Resend Dashboard</p>
            </div>
          </div>
        )

      case 'security':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">
                <strong>הרשאות מנהל:</strong> נקבעות דרך טבלת profiles בשדה is_admin.
                ניהול הרשאות מתקדם יהיה זמין בגרסאות הבאות.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">מדיניות סיסמאות</h4>
              <p className="text-sm text-gray-600">מנוהל דרך Supabase Auth</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Row Level Security</h4>
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-600" />
                מופעל על כל הטבלאות
              </p>
            </div>
          </div>
        )

      case 'database':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">מסד נתונים</h4>
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <Database className="w-4 h-4 text-green-600" />
                Supabase PostgreSQL - פעיל
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">גיבויים</h4>
              <p className="text-sm text-gray-600">גיבוי אוטומטי יומי - מנוהל ע"י Supabase</p>
            </div>

            <button className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              פתח את Supabase Dashboard
            </button>
          </div>
        )

      case 'appearance':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">מצב כהה</h4>
                <p className="text-sm text-gray-600">הפעל ממשק בצבעים כהים</p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, darkMode: !settings.darkMode })}
                className="text-primary-orange"
              >
                {settings.darkMode ? (
                  <ToggleRight className="w-10 h-10" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-gray-400" />
                )}
              </button>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">צבע ראשי</h4>
              <div className="flex gap-3">
                <button className="w-10 h-10 rounded-full bg-primary-orange ring-2 ring-offset-2 ring-primary-orange" />
                <button className="w-10 h-10 rounded-full bg-blue-600 hover:ring-2 hover:ring-offset-2 hover:ring-blue-600" />
                <button className="w-10 h-10 rounded-full bg-green-600 hover:ring-2 hover:ring-offset-2 hover:ring-green-600" />
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">הגדרות מערכת</h1>
        <p className="text-gray-600">תצורה כללית, התראות ואבטחה</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
            <nav className="divide-y divide-gray-100">
              {sections.map((section) => {
                const Icon = section.icon
                const isActive = activeSection === section.id
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-right transition-colors ${
                      isActive
                        ? 'bg-orange-50 text-primary-orange border-r-4 border-primary-orange'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-primary-orange' : 'text-gray-400'}`} />
                    <span className="font-medium text-sm">{section.name}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-md border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {sections.find(s => s.id === activeSection)?.name}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {sections.find(s => s.id === activeSection)?.description}
              </p>
            </div>

            <div className="p-6">
              {renderSettingsContent()}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-primary-orange text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                <span>{saving ? 'שומר...' : 'שמור שינויים'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
