import { createClient } from '@supabase/supabase-js'

// Supabase client configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Type definitions for our database tables
export interface Profile {
  id: string
  full_name: string
  phone: string
  id_number: string // MANDATORY - Required for legal filings
  // Zero-Touch: Address fields for small claims court
  home_address?: string
  city?: string
  postal_code?: string
  address_verified?: boolean
  total_received: number
  total_potential: number
  total_incidents: number
  total_claims: number
  approved_claims: number
  status: 'active' | 'suspended' | 'pending'
  created_at: string
  updated_at: string
  last_login?: string
}

export interface Incident {
  id: string
  user_id: string
  bus_line: string
  bus_company: string
  station_name: string
  station_gps_lat?: number
  station_gps_lng?: number
  user_gps_lat: number
  user_gps_lng: number
  user_gps_accuracy?: number // GPS accuracy in meters
  incident_type: 'delay' | 'no_stop' | 'no_arrival'
  incident_datetime: string
  damage_type?: 'taxi_cost' | 'lost_workday' | 'missed_exam' | 'medical_appointment' | 'other'
  damage_amount?: number
  damage_description?: string
  photo_urls?: string[]
  verified: boolean
  is_verified?: boolean // Set by verification logic
  verification_data?: any
  verification_timestamp?: string
  status: 'submitted' | 'verified' | 'rejected' | 'claimed'
  created_at: string
  updated_at: string
}

export interface Claim {
  id: string
  user_id: string
  incident_ids: string[]
  claim_amount: number
  claim_type: 'warning_letter' | 'formal_claim' | 'small_claims_court' | 'class_action'
  status: 'draft' | 'submitted' | 'company_review' | 'approved' | 'rejected' | 'in_court' | 'settled' | 'paid'
  letter_sent_date?: string
  company_response_date?: string
  compensation_received_date?: string
  compensation_amount?: number
  commission_amount?: number
  payment_method?: 'bank_transfer' | 'check' | 'cash'
  bus_company: string
  company_contact_email?: string
  created_at: string
  updated_at: string
  // Phase 4: Workflow fields
  current_workflow_execution_id?: string
  workflow_status?: 'not_started' | 'in_progress' | 'completed' | 'failed'
  last_workflow_action_at?: string
  admin_notes?: string
  priority?: 'urgent' | 'high' | 'normal' | 'low'
}

// =====================================================
// Phase 4: Workflow System Types
// =====================================================

export interface WorkflowStep {
  id: string
  step_type: 'data_verification' | 'pdf_generation' | 'email_send' | 'status_update' | 'approval_required' | 'compensation_calculation' | 'webhook_call'
  name: string
  description?: string
  config: Record<string, any>
  timeout_seconds?: number
  requires_admin_approval?: boolean
  can_fail_silently?: boolean
}

export interface Workflow {
  id: string
  name: string
  description?: string
  steps: WorkflowStep[]
  trigger_type: 'manual' | 'auto_on_claim' | 'auto_on_incident'
  trigger_conditions: Record<string, any>
  is_active: boolean
  is_default: boolean
  created_by?: string
  created_at: string
  updated_at: string
  last_used_at?: string
  total_executions: number
  successful_executions: number
  failed_executions: number
}

export interface WorkflowExecution {
  id: string
  workflow_id?: string
  claim_id: string
  user_id: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  current_step_index: number
  current_step_name?: string
  steps_completed: any[]
  steps_remaining: any[]
  error_message?: string
  retry_count: number
  max_retries: number
  started_at: string
  completed_at?: string
  next_retry_at?: string
  execution_context: Record<string, any>
  triggered_by?: string
  trigger_type?: string
  created_at: string
  updated_at: string
}

export interface WorkflowStepDefinition {
  id: string
  step_type: string
  name: string
  description?: string
  icon?: string
  config_schema: Record<string, any>
  default_config: Record<string, any>
  timeout_seconds: number
  requires_admin_approval: boolean
  can_fail_silently: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ExecutionLog {
  id: string
  workflow_execution_id?: string
  claim_id?: string
  performed_by?: string
  action_type: string
  step_name?: string
  description: string
  details: Record<string, any>
  success: boolean
  error_message?: string
  ip_address?: string
  user_agent?: string
  created_at: string
}

export interface AdminSetting {
  id: string
  setting_key: string
  setting_category: 'templates' | 'notifications' | 'system' | 'automation'
  setting_value: Record<string, any>
  description?: string
  is_active: boolean
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface DocumentGeneration {
  id: string
  claim_id: string
  workflow_execution_id?: string
  document_type: 'warning_letter' | 'formal_claim' | 'court_filing'
  template_used: string
  file_path?: string
  file_url?: string
  file_size_bytes?: number
  generated_by?: string
  generation_method: 'automatic' | 'manual'
  document_data: Record<string, any>
  status: 'generated' | 'sent' | 'delivered' | 'failed'
  sent_at?: string
  delivered_at?: string
  created_at: string
  updated_at: string
}

// =====================================================
// Zero-Touch Automation Types
// =====================================================

export interface BusCompany {
  id: string
  company_name: string
  company_name_en?: string
  public_contact_email?: string
  online_form_url?: string
  requires_form_automation: boolean
  phone?: string
  fax?: string
  postal_address?: string
  report_to_ministry: boolean
  is_active: boolean
  notes?: string
  created_at: string
  updated_at: string
}

export interface LegalSubmission {
  id: string
  claim_id: string
  user_id: string
  company_id?: string
  submission_type: 'email' | 'web_form' | 'postal'
  submission_status: 'pending' | 'in_progress' | 'sent' | 'delivered' | 'failed' | 'bounced'
  // Email fields
  email_to?: string
  email_bcc?: string // Default: Pniotcrm@mot.gov.il
  email_subject?: string
  email_body?: string
  email_sent_at?: string
  email_message_id?: string
  // Web form fields
  form_url?: string
  form_data?: Record<string, any>
  form_submitted_at?: string
  form_confirmation_number?: string
  // Document attachments
  pdf_url?: string
  pdf_filename?: string
  // Automation tracking
  automation_method?: 'manual' | 'email_api' | 'web_automation' | 'api_integration'
  automation_status?: string
  automation_error_message?: string
  retry_count: number
  max_retries: number
  next_retry_at?: string
  // Delivery confirmation
  delivered_at?: string
  delivery_confirmation_data?: Record<string, any>
  // Ministry reporting
  ministry_notified: boolean
  ministry_notification_sent_at?: string
  created_at: string
  updated_at: string
}

// Helper functions for common database operations

/**
 * Get current user profile
 */
export async function getCurrentUserProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  return data
}

/**
 * Create a new incident (panic button press)
 */
export async function createIncident(incident: Omit<Incident, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'verified' | 'status'>) {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  const { data, error } = await supabase
    .from('incidents')
    .insert({
      user_id: user.id,
      ...incident,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating incident:', error)
    throw error
  }

  return data
}

/**
 * Get user's recent incidents
 */
export async function getUserIncidents(limit: number = 10): Promise<Incident[]> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('user_id', user.id)
    .order('incident_datetime', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching incidents:', error)
    return []
  }

  return data || []
}

/**
 * Get user's claims
 */
export async function getUserClaims(): Promise<Claim[]> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching claims:', error)
    return []
  }

  return data || []
}

/**
 * Update profile financial summary
 */
export async function updateProfileFinancials(userId: string, received: number, potential: number) {
  const { error } = await supabase
    .from('profiles')
    .update({
      total_received: received,
      total_potential: potential,
    })
    .eq('id', userId)

  if (error) {
    console.error('Error updating profile financials:', error)
    throw error
  }
}

/**
 * Sign up a new user
 */
export async function signUp(email: string, password: string, fullName: string, phone: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone,
      },
    },
  })

  if (error) {
    throw error
  }

  return data
}

/**
 * Sign in existing user
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }

  return data
}

/**
 * Sign out current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

/**
 * Get current session
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * Upload incident photo to Supabase Storage
 * @param file - The image file to upload
 * @param incidentId - The incident ID for file naming
 * @returns Public URL of the uploaded image
 */
export async function uploadIncidentPhoto(file: File, incidentId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  // Create unique filename
  const fileExt = file.name.split('.').pop()
  const fileName = `${user.id}/${incidentId}_${Date.now()}.${fileExt}`

  // Upload file to storage
  const { data, error } = await supabase.storage
    .from('incident-photos')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('Error uploading photo:', error)
    throw error
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('incident-photos')
    .getPublicUrl(fileName)

  return publicUrl
}

/**
 * Create incident with photo upload
 */
export async function createIncidentWithPhoto(
  incident: Omit<Incident, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'verified' | 'status'>,
  photoFile?: File
): Promise<Incident> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  // First create the incident
  const { data: newIncident, error: incidentError } = await supabase
    .from('incidents')
    .insert({
      user_id: user.id,
      ...incident,
    })
    .select()
    .single()

  if (incidentError) {
    console.error('Error creating incident:', incidentError)
    throw incidentError
  }

  // If there's a photo, upload it and update the incident
  if (photoFile && newIncident) {
    try {
      const photoUrl = await uploadIncidentPhoto(photoFile, newIncident.id)

      // Update incident with photo URL
      const { data: updatedIncident, error: updateError } = await supabase
        .from('incidents')
        .update({
          photo_urls: [photoUrl],
        })
        .eq('id', newIncident.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating incident with photo:', updateError)
        // Don't throw - incident was created successfully, photo is optional
        return newIncident
      }

      return updatedIncident
    } catch (photoError) {
      console.error('Error uploading photo:', photoError)
      // Don't throw - incident was created successfully, photo is optional
      return newIncident
    }
  }

  return newIncident
}

// =====================================================
// Phase 4: Workflow System Helper Functions
// =====================================================

/**
 * Check if current user is an admin
 */
export async function isUserAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return false

  const { data, error } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)  // FIXED: admin_users.id is the primary key, not user_id
    .single()

  if (error) {
    console.error('Error checking admin status:', error)
    return false
  }

  return !!data
}

/**
 * Get all active workflows
 */
export async function getActiveWorkflows(): Promise<Workflow[]> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching workflows:', error)
    return []
  }

  return data || []
}

/**
 * Get workflow by ID
 */
export async function getWorkflowById(workflowId: string): Promise<Workflow | null> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', workflowId)
    .single()

  if (error) {
    console.error('Error fetching workflow:', error)
    return null
  }

  return data
}

/**
 * Create a new workflow (admin only)
 */
export async function createWorkflow(workflow: Omit<Workflow, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'total_executions' | 'successful_executions' | 'failed_executions' | 'last_used_at'>): Promise<Workflow | null> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  const { data, error } = await supabase
    .from('workflows')
    .insert({
      ...workflow,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating workflow:', error)
    throw error
  }

  return data
}

/**
 * Update workflow (admin only)
 */
export async function updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<Workflow | null> {
  const { data, error } = await supabase
    .from('workflows')
    .update(updates)
    .eq('id', workflowId)
    .select()
    .single()

  if (error) {
    console.error('Error updating workflow:', error)
    throw error
  }

  return data
}

/**
 * Get all workflow step definitions
 */
export async function getWorkflowStepDefinitions(): Promise<WorkflowStepDefinition[]> {
  const { data, error } = await supabase
    .from('workflow_step_definitions')
    .select('*')
    .eq('is_active', true)
    .order('step_type')

  if (error) {
    console.error('Error fetching step definitions:', error)
    return []
  }

  return data || []
}

/**
 * Start workflow execution for a claim
 */
export async function startWorkflowExecution(claimId: string, workflowId: string): Promise<WorkflowExecution | null> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  // Get the workflow
  const workflow = await getWorkflowById(workflowId)
  if (!workflow) {
    throw new Error('Workflow not found')
  }

  // Get the claim to get user_id
  const { data: claim } = await supabase
    .from('claims')
    .select('user_id')
    .eq('id', claimId)
    .single()

  if (!claim) {
    throw new Error('Claim not found')
  }

  // Create workflow execution
  const { data, error } = await supabase
    .from('workflow_executions')
    .insert({
      workflow_id: workflowId,
      claim_id: claimId,
      user_id: claim.user_id,
      status: 'in_progress',
      current_step_index: 0,
      current_step_name: workflow.steps[0]?.name,
      steps_remaining: workflow.steps,
      triggered_by: user.id,
      trigger_type: 'manual',
    })
    .select()
    .single()

  if (error) {
    console.error('Error starting workflow execution:', error)
    throw error
  }

  // Update claim with workflow execution reference
  await supabase
    .from('claims')
    .update({
      current_workflow_execution_id: data.id,
      workflow_status: 'in_progress',
      last_workflow_action_at: new Date().toISOString(),
    })
    .eq('id', claimId)

  // Log the action
  await logWorkflowAction(
    data.id,
    claimId,
    'workflow_started',
    `תהליך עבודה "${workflow.name}" הופעל`,
    { workflow_id: workflowId, workflow_name: workflow.name }
  )

  return data
}

/**
 * Get workflow execution by ID
 */
export async function getWorkflowExecution(executionId: string): Promise<WorkflowExecution | null> {
  const { data, error } = await supabase
    .from('workflow_executions')
    .select('*')
    .eq('id', executionId)
    .single()

  if (error) {
    console.error('Error fetching workflow execution:', error)
    return null
  }

  return data
}

/**
 * Get all executions for a claim
 */
export async function getClaimWorkflowExecutions(claimId: string): Promise<WorkflowExecution[]> {
  const { data, error } = await supabase
    .from('workflow_executions')
    .select('*')
    .eq('claim_id', claimId)
    .order('started_at', { ascending: false })

  if (error) {
    console.error('Error fetching claim executions:', error)
    return []
  }

  return data || []
}

/**
 * Log a workflow action (creates audit trail)
 */
export async function logWorkflowAction(
  executionId: string,
  claimId: string,
  actionType: string,
  description: string,
  details: Record<string, any> = {},
  success: boolean = true,
  errorMessage?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('execution_logs')
    .insert({
      workflow_execution_id: executionId,
      claim_id: claimId,
      action_type: actionType,
      description,
      details,
      success,
      error_message: errorMessage,
      performed_by: user?.id,
    })

  if (error) {
    console.error('Error logging workflow action:', error)
  }
}

/**
 * Get execution logs for a claim
 */
export async function getClaimExecutionLogs(claimId: string, limit: number = 50): Promise<ExecutionLog[]> {
  const { data, error } = await supabase
    .from('execution_logs')
    .select('*')
    .eq('claim_id', claimId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching execution logs:', error)
    return []
  }

  return data || []
}

/**
 * Get admin settings by key
 */
export async function getAdminSetting(settingKey: string): Promise<AdminSetting | null> {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('*')
    .eq('setting_key', settingKey)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching admin setting:', error)
    return null
  }

  return data
}

/**
 * Update admin setting (admin only)
 */
export async function updateAdminSetting(settingKey: string, settingValue: Record<string, any>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  const { error } = await supabase
    .from('admin_settings')
    .update({
      setting_value: settingValue,
      updated_by: user.id,
    })
    .eq('setting_key', settingKey)

  if (error) {
    console.error('Error updating admin setting:', error)
    throw error
  }
}

/**
 * Get all claims for admin dashboard
 */
export async function getAllClaimsForAdmin(filters?: {
  status?: string
  bus_company?: string
  priority?: string
  limit?: number
}): Promise<Claim[]> {
  let query = supabase
    .from('claims')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.bus_company) {
    query = query.eq('bus_company', filters.bus_company)
  }

  if (filters?.priority) {
    query = query.eq('priority', filters.priority)
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching claims for admin:', error)
    return []
  }

  return data || []
}

/**
 * Create a document generation record
 */
export async function createDocumentGeneration(
  claimId: string,
  documentType: 'warning_letter' | 'formal_claim' | 'court_filing',
  templateUsed: string,
  documentData: Record<string, any>,
  workflowExecutionId?: string
): Promise<DocumentGeneration | null> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  const { data, error } = await supabase
    .from('document_generations')
    .insert({
      claim_id: claimId,
      workflow_execution_id: workflowExecutionId,
      document_type: documentType,
      template_used: templateUsed,
      document_data: documentData,
      generated_by: user.id,
      generation_method: workflowExecutionId ? 'automatic' : 'manual',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating document generation:', error)
    throw error
  }

  return data
}

/**
 * Upload PDF document to Supabase Storage
 */
export async function uploadPDFDocument(
  pdfBlob: Blob,
  filename: string,
  folder: 'legal_documents' | 'court_filings' | 'settlements' = 'legal_documents'
): Promise<string> {
  const filePath = `${folder}/${filename}`

  const { error } = await supabase.storage
    .from('documents')
    .upload(filePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (error) {
    console.error('Error uploading PDF:', error)
    throw error
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath)

  return publicUrl
}

/**
 * Update document generation with file info
 */
export async function updateDocumentGenerationFile(
  documentId: string,
  filePath: string,
  fileUrl: string,
  fileSizeBytes: number
): Promise<void> {
  const { error } = await supabase
    .from('document_generations')
    .update({
      file_path: filePath,
      file_url: fileUrl,
      file_size_bytes: fileSizeBytes,
      status: 'generated',
    })
    .eq('id', documentId)

  if (error) {
    console.error('Error updating document generation:', error)
    throw error
  }
}

/**
 * Get incident with user profile for PDF generation
 */
export async function getIncidentForPDF(incidentId: string): Promise<any> {
  const { data, error } = await supabase
    .from('incidents')
    .select(`
      *,
      profiles!incidents_user_id_fkey (
        full_name,
        phone,
        id_number
      )
    `)
    .eq('id', incidentId)
    .single()

  if (error) {
    console.error('Error fetching incident for PDF:', error)
    throw error
  }

  return data
}

/**
 * Update incident status to 'claimed' after generating letter
 */
export async function updateIncidentToClaimed(incidentId: string): Promise<void> {
  const { error } = await supabase
    .from('incidents')
    .update({
      status: 'claimed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', incidentId)

  if (error) {
    console.error('Error updating incident status:', error)
    throw error
  }
}
