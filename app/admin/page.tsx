'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Users,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  DollarSign,
  Activity,
} from 'lucide-react'

interface DashboardStats {
  totalClaims: number
  pendingClaims: number
  approvedClaims: number
  rejectedClaims: number
  totalUsers: number
  activeWorkflows: number
  totalCompensation: number
  averageClaimAmount: number
}

interface RecentActivity {
  id: string
  action_type: string
  description: string
  created_at: string
  performed_by_name: string | null
  claim_id: string | null
  claim_amount: number | null
  success: boolean
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClaims: 0,
    pendingClaims: 0,
    approvedClaims: 0,
    rejectedClaims: 0,
    totalUsers: 0,
    activeWorkflows: 0,
    totalCompensation: 0,
    averageClaimAmount: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      // Load claims statistics
      const { data: claims, error: claimsError } = await supabase
        .from('claims')
        .select('status, claim_amount, compensation_amount')

      if (claimsError) throw claimsError

      // Calculate stats from claims
      const totalClaims = claims?.length || 0
      const pendingClaims = claims?.filter(c => c.status === 'submitted' || c.status === 'company_review').length || 0
      const approvedClaims = claims?.filter(c => c.status === 'approved' || c.status === 'paid').length || 0
      const rejectedClaims = claims?.filter(c => c.status === 'rejected').length || 0
      const totalCompensation = claims?.reduce((sum, c) => sum + (c.compensation_amount || 0), 0) || 0
      const averageClaimAmount = totalClaims > 0
        ? claims.reduce((sum, c) => sum + c.claim_amount, 0) / totalClaims
        : 0

      // Load users count
      const { count: usersCount, error: usersError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      if (usersError) throw usersError

      // Load active workflows count
      const { count: workflowsCount, error: workflowsError } = await supabase
        .from('workflows')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      if (workflowsError) throw workflowsError

      // Load recent activity from the view
      const { data: activityData, error: activityError } = await supabase
        .from('recent_admin_activity')
        .select('*')
        .limit(10)

      if (activityError) throw activityError

      setStats({
        totalClaims,
        pendingClaims,
        approvedClaims,
        rejectedClaims,
        totalUsers: usersCount || 0,
        activeWorkflows: workflowsCount || 0,
        totalCompensation,
        averageClaimAmount,
      })

      setRecentActivity(activityData || [])
      setLoading(false)

    } catch (error) {
      console.error('Error loading dashboard data:', error)
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'כרגע'
    if (diffMins < 60) return `לפני ${diffMins} דקות`
    if (diffHours < 24) return `לפני ${diffHours} שעות`
    return `לפני ${diffDays} ימים`
  }

  const getActionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      workflow_started: 'תהליך החל',
      step_completed: 'שלב הושלם',
      step_failed: 'שלב נכשל',
      status_changed: 'סטטוס השתנה',
      approval_granted: 'אושר',
      claim_created: 'תביעה נוצרה',
      claim_updated: 'תביעה עודכנה',
    }
    return labels[type] || type
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">טוען נתונים...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">לוח בקרה ראשי</h1>
        <p className="text-gray-600">סקירה כללית של מערכת CashBus - תביעות, לקוחות, ואוטומציה</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Claims */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">סה"כ</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalClaims}</h3>
          <p className="text-sm text-gray-600">תביעות במערכת</p>
        </div>

        {/* Pending Claims */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="text-xs text-gray-500">ממתינות</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.pendingClaims}</h3>
          <p className="text-sm text-gray-600">תביעות בטיפול</p>
        </div>

        {/* Approved Claims */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs text-gray-500">מאושרות</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.approvedClaims}</h3>
          <p className="text-sm text-gray-600">תביעות שאושרו</p>
        </div>

        {/* Total Users */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-xs text-gray-500">משתמשים</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.totalUsers}</h3>
          <p className="text-sm text-gray-600">לקוחות רשומים</p>
        </div>

        {/* Total Compensation */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-orange-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-primary-orange" />
            </div>
            <span className="text-xs text-gray-500">פיצויים</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(stats.totalCompensation)}</h3>
          <p className="text-sm text-gray-600">סה"כ פיצויים ששולמו</p>
        </div>

        {/* Average Claim */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-teal-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-teal-600" />
            </div>
            <span className="text-xs text-gray-500">ממוצע</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(stats.averageClaimAmount)}</h3>
          <p className="text-sm text-gray-600">סכום תביעה ממוצע</p>
        </div>

        {/* Active Workflows */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-indigo-100 p-3 rounded-lg">
              <Activity className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-xs text-gray-500">אוטומציה</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.activeWorkflows}</h3>
          <p className="text-sm text-gray-600">זרימות פעילות</p>
        </div>

        {/* Rejected Claims */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-xs text-gray-500">נדחו</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{stats.rejectedClaims}</h3>
          <p className="text-sm text-gray-600">תביעות שנדחו</p>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">פעילות אחרונה</h2>
          <p className="text-sm text-gray-600 mt-1">100 הפעולות האחרונות במערכת</p>
        </div>

        <div className="p-6">
          {recentActivity.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>אין פעילות להצגה</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full mt-2 ${activity.success ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 text-sm">
                        {getActionTypeLabel(activity.action_type)}
                      </span>
                      {activity.claim_amount && (
                        <span className="text-xs text-gray-600">
                          ({formatCurrency(activity.claim_amount)})
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mb-1">{activity.description}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {activity.performed_by_name && (
                        <span>ע"י {activity.performed_by_name}</span>
                      )}
                      <span>{formatRelativeTime(activity.created_at)}</span>
                      {activity.claim_id && (
                        <span className="text-gray-400">#{activity.claim_id.slice(0, 8)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
