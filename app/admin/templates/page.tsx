'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  FileText,
  AlertTriangle,
  Scale,
  Save,
  Loader2,
  CheckCircle,
  RefreshCw,
  Info,
  Copy,
  Eye,
} from 'lucide-react'

interface LetterTemplate {
  id: string
  template_type: 'initial_warning' | 'reminder_14_days' | 'lawsuit_draft'
  template_name: string
  template_content: string
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
}

const TEMPLATE_TYPES = {
  initial_warning: {
    label: "שלב א': מכתב דרישה ראשוני",
    description: 'מכתב דרישה ראשוני לפי תקנה 428ג - נשלח מיד לאחר הדיווח',
    icon: FileText,
    color: 'blue',
  },
  reminder_14_days: {
    label: "שלב ב': התראה לפני תביעה",
    description: 'מכתב התראה לפני הגשת תביעה - נשלח 14 יום לאחר המכתב הראשוני',
    icon: AlertTriangle,
    color: 'orange',
  },
  lawsuit_draft: {
    label: "שלב ג': טיוטת כתב תביעה",
    description: 'טיוטת כתב תביעה לבית המשפט לתביעות קטנות',
    icon: Scale,
    color: 'red',
  },
}

const AVAILABLE_TAGS = [
  { tag: '{{full_name}}', description: 'שם מלא של הלקוח' },
  { tag: '{{id_number}}', description: 'תעודת זהות' },
  { tag: '{{phone}}', description: 'מספר טלפון' },
  { tag: '{{address}}', description: 'כתובת מגורים' },
  { tag: '{{company_name}}', description: 'שם חברת האוטובוסים' },
  { tag: '{{bus_line}}', description: 'מספר קו' },
  { tag: '{{station_name}}', description: 'שם התחנה' },
  { tag: '{{incident_date}}', description: 'תאריך האירוע' },
  { tag: '{{incident_description}}', description: 'תיאור האירוע' },
  { tag: '{{scheduled_time}}', description: 'שעה מתוכננת' },
  { tag: '{{actual_time}}', description: 'שעה בפועל' },
  { tag: '{{base_compensation}}', description: 'פיצוי בסיס' },
  { tag: '{{damage_compensation}}', description: 'פיצוי נזקים' },
  { tag: '{{total_compensation}}', description: 'סה"כ פיצוי' },
  { tag: '{{claim_id}}', description: 'מספר אסמכתא' },
  { tag: '{{initial_letter_date}}', description: 'תאריך מכתב ראשוני' },
  { tag: '{{today_date}}', description: 'תאריך היום' },
  { tag: '{{court_city}}', description: 'עיר בית המשפט' },
]

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<LetterTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'initial_warning' | 'reminder_14_days' | 'lawsuit_draft'>('initial_warning')
  const [editedContent, setEditedContent] = useState<Record<string, string>>({})
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('letter_templates')
        .select('*')
        .eq('is_active', true)
        .order('template_type')

      if (error) throw error

      setTemplates(data || [])

      // Initialize edited content with current templates
      const contentMap: Record<string, string> = {}
      data?.forEach((t) => {
        contentMap[t.template_type] = t.template_content
      })
      setEditedContent(contentMap)

      setLoading(false)
    } catch (error) {
      console.error('Error loading templates:', error)
      setLoading(false)
    }
  }

  const handleSave = async (templateType: string) => {
    setSaving(templateType)
    setSaveSuccess(null)

    try {
      const template = templates.find((t) => t.template_type === templateType)

      if (template) {
        // Update existing template
        const { error } = await supabase
          .from('letter_templates')
          .update({
            template_content: editedContent[templateType],
            version: template.version + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', template.id)

        if (error) throw error
      } else {
        // Create new template
        const { error } = await supabase
          .from('letter_templates')
          .insert({
            template_type: templateType,
            template_name: TEMPLATE_TYPES[templateType as keyof typeof TEMPLATE_TYPES].label,
            template_content: editedContent[templateType],
            is_active: true,
          })

        if (error) throw error
      }

      setSaveSuccess(templateType)
      await loadTemplates()

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(null), 3000)
    } catch (error) {
      console.error('Error saving template:', error)
      alert('שגיאה בשמירת התבנית')
    } finally {
      setSaving(null)
    }
  }

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag)
  }

  const getPreviewContent = (content: string) => {
    // Replace tags with sample data for preview
    const sampleData: Record<string, string> = {
      '{{full_name}}': 'ישראל ישראלי',
      '{{id_number}}': '123456789',
      '{{phone}}': '050-1234567',
      '{{address}}': 'רחוב הרצל 1, תל אביב',
      '{{company_name}}': 'דן בע"מ',
      '{{bus_line}}': '5',
      '{{station_name}}': 'תחנה מרכזית',
      '{{incident_date}}': '15 בינואר 2026',
      '{{incident_description}}': 'לא הגיע לתחנה',
      '{{scheduled_time}}': '08:30',
      '{{actual_time}}': '09:15',
      '{{base_compensation}}': '200',
      '{{damage_compensation}}': '150',
      '{{total_compensation}}': '350',
      '{{claim_id}}': 'CLM-12345678',
      '{{initial_letter_date}}': '1 בינואר 2026',
      '{{today_date}}': new Date().toLocaleDateString('he-IL'),
      '{{court_city}}': 'תל אביב',
    }

    let preview = content
    Object.entries(sampleData).forEach(([tag, value]) => {
      preview = preview.replace(new RegExp(tag.replace(/[{}]/g, '\\$&'), 'g'), value)
    })
    return preview
  }

  const currentTemplate = templates.find((t) => t.template_type === activeTab)
  const currentConfig = TEMPLATE_TYPES[activeTab]
  const Icon = currentConfig.icon

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">טוען תבניות...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">ניהול תבניות מכתבים</h1>
        <p className="text-gray-600">
          עריכת תבניות המכתבים המשפטיים - השתמש ב-Template Tags להזרקת נתונים אוטומטית
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200">
          {Object.entries(TEMPLATE_TYPES).map(([type, config]) => {
            const TabIcon = config.icon
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type as typeof activeTab)}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors relative ${
                  activeTab === type
                    ? 'text-primary-orange border-b-2 border-primary-orange bg-orange-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <TabIcon className="w-4 h-4" />
                  <span className="hidden md:inline">{config.label}</span>
                  <span className="md:hidden">
                    {type === 'initial_warning' ? 'א' : type === 'reminder_14_days' ? 'ב' : 'ג'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-3 space-y-6">
          {/* Template Info */}
          <div className={`bg-${currentConfig.color}-50 border border-${currentConfig.color}-200 rounded-lg p-4`}>
            <div className="flex items-start gap-3">
              <Icon className={`w-6 h-6 text-${currentConfig.color}-600 mt-0.5`} />
              <div>
                <h2 className="font-bold text-gray-900">{currentConfig.label}</h2>
                <p className="text-sm text-gray-600 mt-1">{currentConfig.description}</p>
                {currentTemplate && (
                  <p className="text-xs text-gray-500 mt-2">
                    גרסה {currentTemplate.version} | עודכן לאחרונה: {new Date(currentTemplate.updated_at).toLocaleDateString('he-IL')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Editor */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">עורך תבנית</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    showPreview
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  {showPreview ? 'הסתר תצוגה מקדימה' : 'תצוגה מקדימה'}
                </button>
                <button
                  onClick={() => handleSave(activeTab)}
                  disabled={saving === activeTab}
                  className="px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 flex items-center gap-1.5"
                >
                  {saving === activeTab ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      שומר...
                    </>
                  ) : saveSuccess === activeTab ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      נשמר!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      שמור שינויים
                    </>
                  )}
                </button>
              </div>
            </div>

            {showPreview ? (
              <div className="p-4">
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    תצוגה מקדימה (עם נתוני דוגמה)
                  </h4>
                  <div className="bg-white rounded border border-gray-300 p-6 whitespace-pre-wrap font-mono text-sm text-gray-800 max-h-[500px] overflow-y-auto" dir="rtl">
                    {getPreviewContent(editedContent[activeTab] || '')}
                  </div>
                </div>
              </div>
            ) : (
              <textarea
                value={editedContent[activeTab] || ''}
                onChange={(e) => setEditedContent({ ...editedContent, [activeTab]: e.target.value })}
                className="w-full h-[500px] p-4 font-mono text-sm border-0 focus:ring-0 resize-none"
                dir="rtl"
                placeholder="הזן את תוכן התבנית כאן..."
              />
            )}
          </div>
        </div>

        {/* Sidebar - Available Tags */}
        <div className="space-y-6">
          {/* Tags Reference */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" />
                תגיות זמינות
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                לחץ להעתקה
              </p>
            </div>
            <div className="p-3 max-h-[400px] overflow-y-auto">
              <div className="space-y-2">
                {AVAILABLE_TAGS.map((item) => (
                  <button
                    key={item.tag}
                    onClick={() => handleCopyTag(item.tag)}
                    className="w-full text-right px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <code className="text-xs font-mono text-blue-600">{item.tag}</code>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">פעולות מהירות</h3>
            <div className="space-y-2">
              <button
                onClick={loadTemplates}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                רענן תבניות
              </button>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">טיפים</h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>- השתמש בתגיות לשילוב אוטומטי של נתונים</li>
              <li>- שמור שינויים לפני מעבר לתבנית אחרת</li>
              <li>- בדוק בתצוגה מקדימה לפני שמירה</li>
              <li>- תבניות משפיעות על כל המכתבים החדשים</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}