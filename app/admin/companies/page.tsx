'use client'

/**
 * Admin Page: Bus Companies Management
 */

import { useState, useEffect } from 'react'
import { getAllBusCompanies } from '@/lib/legalSubmissions'
import type { BusCompany } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<BusCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<BusCompany>>({})

  useEffect(() => {
    loadCompanies()
  }, [])

  async function loadCompanies() {
    setLoading(true)
    const data = await getAllBusCompanies()
    setCompanies(data)
    setLoading(false)
  }

  async function handleSave(company: BusCompany) {
    try {
      const { error } = await supabase
        .from('bus_companies')
        .update({
          company_name: formData.company_name || company.company_name,
          company_name_en: formData.company_name_en || company.company_name_en,
          public_contact_email: formData.public_contact_email || company.public_contact_email,
          online_form_url: formData.online_form_url || company.online_form_url,
          requires_form_automation: formData.requires_form_automation ?? company.requires_form_automation,
          phone: formData.phone || company.phone,
          postal_address: formData.postal_address || company.postal_address,
          notes: formData.notes || company.notes,
        })
        .eq('id', company.id)

      if (error) throw error

      alert('החברה עודכנה בהצלחה')
      setEditingId(null)
      setFormData({})
      loadCompanies()
    } catch (error) {
      console.error('Error updating company:', error)
      alert('שגיאה בעדכון החברה')
    }
  }

  async function handleAddNew() {
    try {
      const { error } = await supabase
        .from('bus_companies')
        .insert({
          company_name: formData.company_name || 'חברה חדשה',
          company_name_en: formData.company_name_en,
          public_contact_email: formData.public_contact_email,
          online_form_url: formData.online_form_url,
          requires_form_automation: formData.requires_form_automation || false,
          is_active: true,
        })

      if (error) throw error

      alert('החברה נוספה בהצלחה')
      setFormData({})
      loadCompanies()
    } catch (error) {
      console.error('Error adding company:', error)
      alert('שגיאה בהוספת החברה')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-raised">
        <div className="text-xl text-content-secondary">טוען...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen bg-surface-raised" dir="rtl">
      <h1 className="text-3xl font-bold mb-8 text-content-primary">ניהול חברות הסעות</h1>

      {/* Stats - Updated with card and text tokens */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="text-content-tertiary text-sm">סך הכל חברות</div>
          <div className="text-3xl font-bold text-accent">{companies.length}</div>
        </div>
        <div className="card">
          <div className="text-content-tertiary text-sm">חברות עם אימייל</div>
          <div className="text-3xl font-bold text-status-approved">
            {companies.filter(c => c.public_contact_email).length}
          </div>
        </div>
        <div className="card">
          <div className="text-content-tertiary text-sm">דורשות אוטומציה</div>
          <div className="text-3xl font-bold text-status-legal">
            {companies.filter(c => c.requires_form_automation).length}
          </div>
        </div>
      </div>

      {/* Add New Company - Updated with card and input-field */}
      <div className="card mb-8">
        <h2 className="text-xl font-bold mb-4 text-content-primary">הוסף חברה חדשה</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="שם החברה (עברית)"
            value={formData.company_name || ''}
            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            className="input-field"
          />
          <input
            type="text"
            placeholder="שם החברה (אנגלית)"
            value={formData.company_name_en || ''}
            onChange={(e) => setFormData({ ...formData, company_name_en: e.target.value })}
            className="input-field"
          />
          <input
            type="email"
            placeholder="אימייל ליצירת קשר"
            value={formData.public_contact_email || ''}
            onChange={(e) => setFormData({ ...formData, public_contact_email: e.target.value })}
            className="input-field"
          />
          <input
            type="url"
            placeholder="קישור לטופס אונליין"
            value={formData.online_form_url || ''}
            onChange={(e) => setFormData({ ...formData, online_form_url: e.target.value })}
            className="input-field"
          />
          <label className="flex items-center gap-2 text-content-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={formData.requires_form_automation || false}
              onChange={(e) => setFormData({ ...formData, requires_form_automation: e.target.checked })}
              className="accent-accent"
            />
            <span>דורש אוטומציה של טפסים</span>
          </label>
        </div>
        <button
          onClick={handleAddNew}
          className="mt-4 btn-primary"
        >
          הוסף חברה
        </button>
      </div>

      {/* Companies List - Updated to table with card styles */}
      <div className="card overflow-hidden !p-0">
        <table className="w-full">
          <thead className="bg-surface-overlay border-b border-surface-border">
            <tr>
              <th className="px-6 py-3 text-right text-sm font-semibold text-content-secondary">שם החברה</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-content-secondary">אימייל</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-content-secondary">טופס אונליין</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-content-secondary">שיטת שליחה</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-content-secondary">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id} className="border-b border-surface-border hover:bg-surface-overlay transition-colors">
                <td className="px-6 py-4">
                  <div className="font-semibold text-content-primary">{company.company_name}</div>
                  <div className="text-sm text-content-tertiary">{company.company_name_en}</div>
                </td>
                <td className="px-6 py-4 text-content-secondary">
                  {editingId === company.id ? (
                    <input
                      type="email"
                      value={formData.public_contact_email || company.public_contact_email || ''}
                      onChange={(e) => setFormData({ ...formData, public_contact_email: e.target.value })}
                      className="input-field py-1"
                    />
                  ) : (
                    <span className="text-sm">{company.public_contact_email || '-'}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingId === company.id ? (
                    <input
                      type="url"
                      value={formData.online_form_url || company.online_form_url || ''}
                      onChange={(e) => setFormData({ ...formData, online_form_url: e.target.value })}
                      className="input-field py-1"
                    />
                  ) : (
                    <span className="text-sm truncate max-w-xs block text-content-secondary">
                      {company.online_form_url ? (
                        <a href={company.online_form_url} target="_blank" rel="noopener" className="text-accent hover:underline">
                          פתח טופס
                        </a>
                      ) : '-'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingId === company.id ? (
                    <label className="flex items-center gap-2 text-content-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.requires_form_automation ?? company.requires_form_automation}
                        onChange={(e) => setFormData({ ...formData, requires_form_automation: e.target.checked })}
                        className="accent-accent"
                      />
                      <span className="text-sm">אוטומציה</span>
                    </label>
                  ) : (
                    <span className={`px-2 py-1 text-xs rounded font-medium ${
                      company.requires_form_automation
                        ? 'status-badge-legal'
                        : company.public_contact_email
                        ? 'status-badge-approved'
                        : 'bg-surface-overlay text-content-tertiary'
                    }`}>
                      {company.requires_form_automation ? 'טופס (אוטומטי)' : company.public_contact_email ? 'אימייל' : 'ידני'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingId === company.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(company)}
                        className="text-status-approved hover:text-opacity-80 text-sm font-semibold"
                      >
                        שמור
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null)
                          setFormData({})
                        }}
                        className="text-content-tertiary hover:text-content-secondary text-sm"
                      >
                        ביטול
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(company.id)
                        setFormData(company)
                      }}
                      className="text-accent hover:text-accent-light text-sm font-semibold"
                    >
                      ערוך
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ministry Notification Info - Updated with status surface tokens */}
      <div className="mt-8 bg-surface-overlay border border-status-legal/20 rounded-lg p-6">
        <h3 className="font-bold text-status-legal mb-2">📧 דיווח למשרד התחבורה</h3>
        <p className="text-content-secondary text-sm">
          כל פנייה שנשלחת לחברות ההסעות מועתקת אוטומטית (BCC) למשרד התחבורה בכתובת:
          <strong className="mr-2 text-content-primary">Pniotcrm@mot.gov.il</strong>
        </p>
        <p className="text-content-tertiary text-sm mt-2">
          זהו דרישה חוקית וחובה בכל שליחה - המערכת מוודאת זאת אוטומטית.
        </p>
      </div>
    </div>
  )
}