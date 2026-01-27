'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Workflow,
  Play,
  Pause,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Settings,
  Zap,
} from 'lucide-react'

interface WorkflowItem {
  id: string
  name: string
  description: string
  is_active: boolean
  trigger_type: string
  steps: any[]
  created_at: string
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWorkflows()
  }, [])

  const loadWorkflows = async () => {
    try {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setWorkflows(data || [])
    } catch (error) {
      console.error('Error loading workflows:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleWorkflow = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('workflows')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) throw error

      setWorkflows(workflows.map(w =>
        w.id === id ? { ...w, is_active: !currentStatus } : w
      ))
    } catch (error) {
      console.error('Error toggling workflow:', error)
    }
  }

  const getTriggerLabel = (type: string) => {
    const labels: Record<string, string> = {
      claim_created: 'יצירת תביעה',
      claim_submitted: 'הגשת תביעה',
      status_changed: 'שינוי סטטוס',
      time_based: 'מבוסס זמן',
      manual: 'ידני',
    }
    return labels[type] || type
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">טוען זרימות עבודה...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">אוטומציה וזרימות</h1>
          <p className="text-gray-600">ניהול תהליכי עבודה אוטומטיים במערכת</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-orange text-white rounded-lg hover:bg-orange-600 transition-colors">
          <Plus className="w-5 h-5" />
          <span>זרימה חדשה</span>
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <Play className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {workflows.filter(w => w.is_active).length}
              </h3>
              <p className="text-sm text-gray-600">זרימות פעילות</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="bg-gray-100 p-3 rounded-lg">
              <Pause className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {workflows.filter(w => !w.is_active).length}
              </h3>
              <p className="text-sm text-gray-600">זרימות מושהות</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{workflows.length}</h3>
              <p className="text-sm text-gray-600">סה"כ זרימות</p>
            </div>
          </div>
        </div>
      </div>

      {/* Workflows List */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">רשימת זרימות</h2>
        </div>

        {workflows.length === 0 ? (
          <div className="text-center py-16">
            <Workflow className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">אין זרימות עבודה</h3>
            <p className="text-gray-600 mb-6">צור את הזרימה הראשונה שלך כדי להתחיל באוטומציה</p>
            <button className="flex items-center gap-2 mx-auto px-4 py-2 bg-primary-orange text-white rounded-lg hover:bg-orange-600 transition-colors">
              <Plus className="w-5 h-5" />
              <span>צור זרימה חדשה</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {workflows.map((workflow) => (
              <div key={workflow.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${workflow.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Workflow className={`w-6 h-6 ${workflow.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{workflow.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{workflow.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {getTriggerLabel(workflow.trigger_type)}
                        </span>
                        <span>{workflow.steps?.length || 0} שלבים</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleWorkflow(workflow.id, workflow.is_active)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        workflow.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {workflow.is_active ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          פעיל
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Pause className="w-4 h-4" />
                          מושהה
                        </span>
                      )}
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
