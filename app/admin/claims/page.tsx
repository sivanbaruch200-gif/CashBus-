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
  status: 'submitted' | 'verified' | 'rejected' | 'claimed' | 'paid' // הוספתי paid
  created_at: string
  customer_name: string
  customer_phone: string
}

interface ClaimWithUser {
  id: string
  user_id: string
  incident_id: string
  status: 'pending' | 'sent' | 'negotiation' | 'paid' | 'rejected' // השדה שהיה חסר
  claim_amount: number
  bus_company: string // השדה שהיה חסר
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
  }, [activeTab, statusFilter, companyFilter]) // הוספת הפילטרים כ-Dependencies

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

  // סינון מקומי לשדה החיפוש
  const filteredIncidents = incidents.filter(i => 
    i.customer_name.includes(searchQuery) || i.bus_line.includes(searchQuery)
  )

  const filteredClaims = claims.filter(c => 
    c.customer_name.includes(searchQuery) || c.id.includes(searchQuery)
  )

  // רשימת חברות ייחודיות לפילטר
  const companies = Array.from(new Set([...incidents.map(i => i.bus_company), ...claims.map(c => c.bus_company)]))

  return (
    <div className="p-8 max-w-7xl mx-auto rtl" dir="rtl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">ניהול תיקים</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button 
          onClick={() => setActiveTab('claims')}
          className={`pb-2 px-4 ${activeTab === 'claims' ? 'border-b-2 border-orange-500 text-orange-600 font-bold' : 'text-gray-500'}`}
        >
          תביעות פעילות
        </button>
        <button 
          onClick={() => setActiveTab('incidents')}
          className={`pb-2 px-4 ${activeTab === 'incidents' ? 'border-b-2 border-orange-500 text-orange-600 font-bold' : 'text-gray-500'}`}
        >
          דיווחים חדשים
        </button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text"
            placeholder="חיפוש לפי שם או מספר תיק..."
            className="w-full pr-10 py-2 border rounded-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <select 
          className="border rounded-lg px-3 py-2"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">כל הסטטוסים</option>
          <option value="pending">ממתין לטיפול</option>
          <option value="verified">מאומת</option>
          <option value="paid">שולם</option>
        </select>

        <select 
          className="border rounded-lg px-3 py-2"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        >
          <option value="all">כל החברות</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table Content */}
      <div className="bg-white shadow rounded-xl overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">לקוח</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">חברה/קו</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">סטטוס</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-10">טוען נתונים...</td></tr>
            ) : (
              (activeTab === 'incidents' ? filteredIncidents : filteredClaims).map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{item.customer_name}</div>
                    <div className="text-xs text-gray-500">{item.customer_phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-gray-800">{item.bus_company}</div>
                    <div className="text-xs text-gray-500">
                      {activeTab === 'incidents' ? `קו ${(item as IncidentWithUser).bus_line}` : 'תיק תביעה'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.status === 'paid' ? 'bg-green-100 text-green-700' : 
                      item.status === 'pending' || item.status === 'submitted' ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => router.push(`/admin/claims/${item.id}`)}
                      className="flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium"
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