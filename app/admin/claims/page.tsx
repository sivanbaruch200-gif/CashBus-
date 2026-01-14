'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Claim } from '@/lib/supabase'
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

interface ClaimWithUser extends Claim {
  customer_name: string
  customer_phone: string
  customer_email: string
  incident_count?: number
  total_amount?: number  // Alias for claim_amount for display
}

export default function ClaimsManagementPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'claims' | 'incidents'>('claims')
  const [incidents, setIncidents] = useState<IncidentWithUser[]>([])
  const [claims, setClaims] = useState<ClaimWithUser[]>([])
  const [filteredIncidents, setFilteredIncidents] = useState<IncidentWithUser[]>([])
  const [filteredClaims, setFilteredClaims] = useState<ClaimWithUser[]>([])
  const [loading, setLoading] = useState(true)

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    totalClaims: 0,
    submittedClaims: 0,
    inProgressClaims: 0,
    paidClaims: 0,
    totalIncidents: 0,
    verifiedIncidents: 0,
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [searchQuery, statusFilter, companyFilter, incidents, claims, activeTab])

  const loadData = async () => {
    try {
      // Load incidents
      const { data: incidentsData, error: incidentsError } = await supabase
        .from('incidents')
        .select(`
          *,
          profiles!incidents_user_id_fkey (
            full_name,
            phone
          )
        `)
        .order('incident_datetime', { ascending: false })

      if (incidentsError) throw incidentsError

      const transformedIncidents: IncidentWithUser[] = (incidentsData || []).map((incident: any) => ({
        ...incident,
        customer_name: incident.profiles?.full_name || 'לא ידוע',
        customer_phone: incident.profiles?.phone || 'לא ידוע',
      }))

      // Load claims
      const { data: claimsData, error: claimsError } = await supabase
        .from('claims')
        .select(`
          *,
          profiles!claims_user_id_fkey (
            full_name,
            phone,
            id_number
          )
        `)
        .order('created_at', { ascending: false })

      if (claimsError) throw claimsError

      const transformedClaims: ClaimWithUser[] = (claimsData || []).map((claim: any) => ({
        ...claim,
        customer_name: claim.profiles?.full_name || 'לא ידוע',
        customer_phone: claim.profiles?.phone || 'לא ידוע',
        customer_email: claim.profiles?.id_number || '', // Temporary - should use real email
      }))

      setIncidents(transformedIncidents)
      setClaims(transformedClaims)
      calculateStats(transformedIncidents, transformedClaims)
      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  const calculateStats = (incidentsData: IncidentWithUser[], claimsData: ClaimWithUser[]) => {
    setStats({
      totalClaims: claimsData.length,
      submittedClaims: claimsData.filter(c => c.status === 'submitted').length,
      inProgressClaims: claimsData.filter(c => ['company_review', 'approved', 'in_court'].includes(c.status)).length,
      paidClaims: claimsData.filter(c => c.status === 'paid').length,
      totalIncidents: incidentsData.length,
      verifiedIncidents: incidentsData.filter(i => i.verified || i.status === 'verified').length,
    })
  }

  const applyFilters = () => {
    if (activeTab === 'incidents') {
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
    } else {
      // Filter claims
      let filtered = [...claims]

      // Search filter (name, company)
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        filtered = filtered.filter(
          (claim) =>
            claim.customer_name.toLowerCase().includes(query) ||
            claim.bus_company.toLowerCase().includes(query)
        )
      }

      // Status filter
      if (statusFilter !== 'all') {
        filtered = filtered.filter((claim) => claim.status === statusFilter)
      }

      // Company filter
      if (companyFilter !== 'all') {
        filtered = filtered.filter((claim) => claim.bus_company === companyFilter)
      }

      setFilteredClaims(filtered)
    }
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

  const getClaimStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
      submitted: { label: 'הוגשה', color: 'bg-yellow-100 text-yellow-800', icon: FileText },
      company_review: { label: 'בבדיקת חברה', color: 'bg-blue-100 text-blue-800', icon: Clock },
      approved: { label: 'אושרה', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { label: 'נדחתה', color: 'bg-red-100 text-red-800', icon: XCircle },
      in_court: { label: 'בבית משפט', color: 'bg-purple-100 text-purple-800', icon: Scale },
      paid: { label: 'שולמה', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    }

    const config = statusConfig[status] || statusConfig.submitted
    const Icon = config.icon

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border-r-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">סך תביעות</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalClaims}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Scale className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-r-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">חדשות</p>
              <p className="text-2xl font-bold text-gray-900">{stats.submittedClaims}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-r-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">בטיפול</p>
              <p className="text-2xl font-bold text-gray-900">{stats.inProgressClaims}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-primary-orange" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-r-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">שולמו</p>
              <p className="text-2xl font-bold text-gray-900">{stats.paidClaims}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-r-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">סך אירועים</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalIncidents}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Action Buttons */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center justify-between border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('claims')}
              className={`px-6 py-4 text-sm font-semibold transition-colors relative ${
                activeTab === 'claims'
                  ? 'text-primary-orange border-b-2 border-primary-orange'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4" />
                תביעות ({stats.totalClaims})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('incidents')}
              className={`px-6 py-4 text-sm font-semibold transition-colors relative ${
                activeTab === 'incidents'
                  ? 'text-primary-orange border-b-2 border-primary-orange'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                אירועים ({stats.totalIncidents})
              </div>
            </button>
          </div>

          <div className="px-6 py-3">
            <button
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-orange text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
              onClick={() => {
                alert('פונקציונליות שליחת התראות תהיה זמינה בקרוב')
              }}
            >
              <Send className="w-4 h-4" />
              שלח התראה המונית
            </button>
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
                  {activeTab === 'incidents' ? 'קו' : 'כמות אירועים'}
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {activeTab === 'incidents' ? 'סוג אירוע' : 'סכום תביעה'}
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {activeTab === 'incidents' ? 'פיצוי משוער' : 'פיצוי משוער'}
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  סטטוס
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {activeTab === 'incidents' ? 'תאריך דיווח' : 'תאריך הגשה'}
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeTab === 'incidents' ? (
                // Incidents View
                filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p className="text-lg font-medium">לא נמצאו אירועים</p>
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
                          נהל
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                // Claims View
                filteredClaims.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <Scale className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p className="text-lg font-medium">לא נמצאו תביעות</p>
                        <p className="text-sm mt-1">נסו לשנות את המסננים או החיפוש</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredClaims.map((claim) => (
                    <tr
                      key={claim.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/claims/${claim.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{claim.customer_name}</div>
                        <div className="text-xs text-gray-500">{claim.customer_phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{getBusCompanyName(claim.bus_company)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{claim.incident_count || 1}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-blue-700">
                          {formatCurrency(claim.total_amount || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-green-700">
                          {formatCurrency(claim.compensation_amount || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getClaimStatusBadge(claim.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {formatDate(claim.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/admin/claims/${claim.id}`)
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-orange text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          נהל
                        </button>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer - Results Count */}
        {((activeTab === 'incidents' && filteredIncidents.length > 0) ||
          (activeTab === 'claims' && filteredClaims.length > 0)) && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              מציג{' '}
              <span className="font-semibold text-gray-900">
                {activeTab === 'incidents' ? filteredIncidents.length : filteredClaims.length}
              </span>{' '}
              מתוך{' '}
              <span className="font-semibold text-gray-900">
                {activeTab === 'incidents' ? incidents.length : claims.length}
              </span>{' '}
              {activeTab === 'incidents' ? 'אירועים' : 'תביעות'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
