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
} from 'lucide-react'

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
  status: 'submitted' | 'verified' | 'rejected' | 'claimed'
  created_at: string
  // Joined user data
  customer_name: string
  customer_phone: string
}

export default function ClaimsManagementPage() {
  const router = useRouter()
  const [incidents, setIncidents] = useState<IncidentWithUser[]>([])
  const [filteredIncidents, setFilteredIncidents] = useState<IncidentWithUser[]>([])
  const [loading, setLoading] = useState(true)

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    inProgress: 0,
    completed: 0,
  })

  useEffect(() => {
    loadIncidents()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [searchQuery, statusFilter, companyFilter, incidents])

  const loadIncidents = async () => {
    try {
      // Fetch all incidents with user profile data joined
      const { data, error } = await supabase
        .from('incidents')
        .select(`
          *,
          profiles!incidents_user_id_fkey (
            full_name,
            phone
          )
        `)
        .order('incident_datetime', { ascending: false })

      if (error) throw error

      // Transform data to include customer info
      const transformedData: IncidentWithUser[] = (data || []).map((incident: any) => ({
        ...incident,
        customer_name: incident.profiles?.full_name || 'לא ידוע',
        customer_phone: incident.profiles?.phone || 'לא ידוע',
      }))

      setIncidents(transformedData)
      calculateStats(transformedData)
      setLoading(false)
    } catch (error) {
      console.error('Error loading incidents:', error)
      setLoading(false)
    }
  }

  const calculateStats = (data: IncidentWithUser[]) => {
    setStats({
      total: data.length,
      new: data.filter(i => i.status === 'submitted').length,
      inProgress: data.filter(i => i.status === 'verified').length,
      completed: data.filter(i => i.status === 'claimed').length,
    })
  }

  const applyFilters = () => {
    let filtered = [...incidents]

    // Search filter (name, company, bus line)
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (incident) =>
          incident.customer_name.toLowerCase().includes(query) ||
          incident.bus_company.toLowerCase().includes(query) ||
          incident.bus_line.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((incident) => incident.status === statusFilter)
    }

    // Company filter
    if (companyFilter !== 'all') {
      filtered = filtered.filter((incident) => incident.bus_company === companyFilter)
    }

    setFilteredIncidents(filtered)
  }

  const getUniqueCompanies = () => {
    const companies = [...new Set(incidents.map((i) => i.bus_company))]
    return companies.sort()
  }

  const getStatusBadge = (status: string, verified: boolean) => {
    if (status === 'claimed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3.5 h-3.5" />
          נתבע
        </span>
      )
    }

    if (status === 'verified' || verified) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <CheckCircle className="w-3.5 h-3.5" />
          מאומת
        </span>
      )
    }

    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3.5 h-3.5" />
          נדחה
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <Clock className="w-3.5 h-3.5" />
        חדש
      </span>
    )
  }

  const getIncidentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      delay: 'עיכוב',
      no_stop: 'לא עצר',
      no_arrival: 'לא הגיע',
    }
    return labels[type] || type
  }

  const calculateEstimatedCompensation = (incident: IncidentWithUser) => {
    const result = calculateCompensation({
      incidentType: incident.incident_type,
      delayMinutes: 30, // Default estimate
      damageType: incident.damage_type as any,
      damageAmount: incident.damage_amount,
      busCompany: incident.bus_company,
    })
    return result.totalCompensation
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const handleRowClick = (incidentId: string) => {
    router.push(`/admin/claims/${incidentId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">טוען תביעות...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">ניהול תביעות ודיווחים</h1>
        <p className="text-gray-600">מרכז הפיקוד לניהול כל הדיווחים והתביעות של הלקוחות</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border-r-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">סה"כ דיווחים</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-r-4 border-gray-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">חדשים</p>
              <p className="text-2xl font-bold text-gray-900">{stats.new}</p>
            </div>
            <div className="bg-gray-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-r-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">בטיפול</p>
              <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-primary-orange" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-r-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">הושלמו</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש לפי שם לקוח, חברה, או קו..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent text-sm"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">
                  {statusFilter === 'all' ? 'כל הסטטוסים' :
                   statusFilter === 'submitted' ? 'חדשים' :
                   statusFilter === 'verified' ? 'מאומתים' :
                   statusFilter === 'claimed' ? 'נתבעו' :
                   'נדחו'}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {showStatusDropdown && (
              <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {['all', 'submitted', 'verified', 'claimed', 'rejected'].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status)
                      setShowStatusDropdown(false)
                    }}
                    className="w-full px-4 py-2.5 text-right hover:bg-gray-50 transition-colors text-sm first:rounded-t-lg last:rounded-b-lg"
                  >
                    {status === 'all' ? 'כל הסטטוסים' :
                     status === 'submitted' ? 'חדשים' :
                     status === 'verified' ? 'מאומתים' :
                     status === 'claimed' ? 'נתבעו' :
                     'נדחו'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Company Filter */}
          <div className="relative">
            <button
              onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
              className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">
                  {companyFilter === 'all' ? 'כל החברות' : getBusCompanyName(companyFilter)}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {showCompanyDropdown && (
              <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                <button
                  onClick={() => {
                    setCompanyFilter('all')
                    setShowCompanyDropdown(false)
                  }}
                  className="w-full px-4 py-2.5 text-right hover:bg-gray-50 transition-colors text-sm border-b border-gray-100"
                >
                  כל החברות
                </button>
                {getUniqueCompanies().map((company) => (
                  <button
                    key={company}
                    onClick={() => {
                      setCompanyFilter(company)
                      setShowCompanyDropdown(false)
                    }}
                    className="w-full px-4 py-2.5 text-right hover:bg-gray-50 transition-colors text-sm"
                  >
                    {getBusCompanyName(company)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active Filters Display */}
        {(searchQuery || statusFilter !== 'all' || companyFilter !== 'all') && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-gray-600">מסננים פעילים:</span>
            {searchQuery && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                חיפוש: "{searchQuery}"
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                סטטוס: {statusFilter === 'submitted' ? 'חדשים' : statusFilter === 'verified' ? 'מאומתים' : statusFilter === 'claimed' ? 'נתבעו' : 'נדחו'}
              </span>
            )}
            {companyFilter !== 'all' && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                חברה: {getBusCompanyName(companyFilter)}
              </span>
            )}
            <button
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
                setCompanyFilter('all')
              }}
              className="text-red-600 hover:text-red-800 font-medium"
            >
              נקה הכל
            </button>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  שם לקוח
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  חברת אוטובוס
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  קו
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  סוג אירוע
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  פיצוי משוער
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  סטטוס
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  תאריך דיווח
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-lg font-medium">לא נמצאו תוצאות</p>
                      <p className="text-sm mt-1">נסו לשנות את המסננים או החיפוש</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((incident) => (
                  <tr
                    key={incident.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(incident.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{incident.customer_name}</div>
                      <div className="text-xs text-gray-500">{incident.customer_phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{getBusCompanyName(incident.bus_company)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{incident.bus_line}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{getIncidentTypeLabel(incident.incident_type)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-green-700">
                        {formatCurrency(calculateEstimatedCompensation(incident))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(incident.status, incident.verified)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {formatDate(incident.incident_datetime)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRowClick(incident.id)
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-orange text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        נהל תביעה
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer - Results Count */}
        {filteredIncidents.length > 0 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              מציג <span className="font-semibold text-gray-900">{filteredIncidents.length}</span> מתוך{' '}
              <span className="font-semibold text-gray-900">{incidents.length}</span> דיווחים
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
