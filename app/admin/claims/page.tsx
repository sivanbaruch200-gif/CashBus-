'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calculateCompensation, getBusCompanyName } from '@/lib/compensation'
import {
  Search,
  Filter,
  ChevronDown,
  ExternalLink,
  Eye,
  Calendar,
  Building2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Send,
  Scale,
  FileText,
} from 'lucide-react'

// עדכון ה-Interfaces כדי להעלים את השגיאות
interface IncidentWithUser {
  id: string
  user_id: string
  bus_line: string
  bus_company: string
  incident_type: 'delay' | 'no_stop' | 'no_arrival'
  incident_datetime: string
  damage_type?: string
  damage_amount?: number
  verified: boolean
  status: 'submitted' | 'verified' | 'rejected' | 'claimed' | 'paid' 
  created_at: string
  customer_name: string
  customer_phone: string
}

interface ClaimWithUser {
  id: string
  user_id: string
  incident_id: string
  status: 'pending' | 'sent' | 'negotiation' | 'paid' | 'rejected' 
  claim_amount: number
  bus_company: string 
  created_at: string
  customer_name: string
  customer_phone: string
  customer_email: string
  incident_count?: number
  total_amount?: number 
}

export default function ClaimsManagementPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'claims' | 'incidents'>('claims')
  const [incidents, setIncidents] = useState<IncidentWithUser[]>([])
  const [claims, setClaims] = useState<ClaimWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')

  useEffect(() => {
    loadData()
  }, [activeTab, statusFilter, companyFilter])

  async function loadData() {
    setLoading(true)
    try {
      if (activeTab === 'incidents') {
        let query = supabase
          .from('incidents')
          .select(`
            *,
            profiles:user_id (full_name, phone)
          `)
        
        if (statusFilter !== 'all') query = query.eq('status', statusFilter)
        if (companyFilter !== 'all') query = query.eq('bus_company', companyFilter)

        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) throw error
        
        const formatted = data.map((item: any) => ({
          ...item,
          customer_name: item.profiles?.full_name || 'לא ידוע',
          customer_phone: item.profiles?.phone || '',
        }))
        setIncidents(formatted)
      } else {
        let query = supabase
          .from('claims')
          .select(`
            *,
            profiles:user_id (full_name, phone, email)
          `)

        if (statusFilter !== 'all') query = query.eq('status', statusFilter)
        if (companyFilter !== 'all') query = query.eq('bus_company', companyFilter)

        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) throw error

        const formatted = data.map((item: any) => ({
          ...item,
          customer_name: item.profiles?.full_name || 'לא ידוע',
          customer_phone: item.profiles?.phone || '',
          customer_email: item.profiles?.email || '',
        }))
        setClaims(formatted)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredIncidents = incidents.filter(i => 
    i.customer_name.includes(searchQuery) || i.bus_line.includes(searchQuery)
  )

  const filteredClaims = claims.filter(c => 
    c.customer_name.includes(searchQuery) || c.id.includes(searchQuery)
  )

  const companies = Array.from(new Set([...incidents.map(i => i.bus_company), ...claims.map(c => c.bus_company)]))

  return (
    <div className="p-8 max-w-7xl mx-auto rtl" dir="rtl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-content-primary">ניהול תיקים</h1>
      </div>

      {/* Tabs - Updated with accent colors */}
      <div className="flex gap-4 mb-6 border-b border-surface-border">
        <button 
          onClick={() => setActiveTab('claims')}
          className={`pb-2 px-4 transition-colors ${activeTab === 'claims' ? 'border-b-2 border-accent text-accent font-bold' : 'text-content-tertiary hover:text-content-secondary'}`}
        >
          תביעות פעילות
        </button>
        <button 
          onClick={() => setActiveTab('incidents')}
          className={`pb-2 px-4 transition-colors ${activeTab === 'incidents' ? 'border-b-2 border-accent text-accent font-bold' : 'text-content-tertiary hover:text-content-secondary'}`}
        >
          דיווחים חדשים
        </button>
      </div>

      {/* Filters Bar - Updated with input-field and surface colors */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary w-4 h-4" />
          <input 
            type="text"
            placeholder="חיפוש לפי שם או מספר תיק..."
            className="input-field pr-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <select 
          className="input-field"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">כל הסטטוסים</option>
          <option value="pending">ממתין לטיפול</option>
          <option value="verified">מאומת</option>
          <option value="paid">שולם</option>
        </select>

        <select 
          className="input-field"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        >
          <option value="all">כל החברות</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table Content - Updated to card and new tokens */}
      <div className="card overflow-hidden !p-0">
        <table className="w-full text-right">
          <thead className="bg-surface-overlay border-b border-surface-border">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-content-secondary">לקוח</th>
              <th className="px-6 py-4 text-sm font-semibold text-content-secondary">חברה/קו</th>
              <th className="px-6 py-4 text-sm font-semibold text-content-secondary">סטטוס</th>
              <th className="px-6 py-4 text-sm font-semibold text-content-secondary">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-10 text-content-tertiary">טוען נתונים...</td></tr>
            ) : (activeTab === 'incidents' ? filteredIncidents : filteredClaims).length === 0 ? (
              <tr><td colSpan={4} className="text-center py-10 text-content-tertiary">לא נמצאו תוצאות</td></tr>
            ) : (
              (activeTab === 'incidents' ? filteredIncidents : filteredClaims).map((item) => (
                <tr key={item.id} className="border-b border-surface-border hover:bg-surface-overlay transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-content-primary">{item.customer_name}</div>
                    <div className="text-xs text-content-tertiary">{item.customer_phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-content-secondary">{item.bus_company}</div>
                    <div className="text-xs text-content-tertiary">
                      {activeTab === 'incidents' ? `קו ${(item as IncidentWithUser).bus_line}` : 'תיק תביעה'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.status === 'paid' ? 'status-badge-approved' : 
                      item.status === 'pending' || item.status === 'submitted' ? 'status-badge-pending' : 
                      'status-badge-legal'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => router.push(`/admin/claims/${item.id}`)}
                      className="flex items-center gap-1 text-accent hover:text-accent-light font-medium transition-colors"
                    >
                      <Eye className="w-4 h-4" /> ניהול
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}