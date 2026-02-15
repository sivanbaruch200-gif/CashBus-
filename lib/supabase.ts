import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// מניעת כפילויות (Singleton)
let supabaseInstance: SupabaseClient | null = null;

export const supabase = (() => {
  if (supabaseInstance) return supabaseInstance;
  
  supabaseInstance = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
  return supabaseInstance;
})();

// --- פונקציות עזר שחסרות לדפים שלך ---

export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession()
  return session
}

export const isUserAdmin = async (userId?: string) => {
  let uid = userId
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.warn('[isUserAdmin] No authenticated user found')
      return false
    }
    uid = user.id
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', uid)
    .single()

  if (error) {
    console.error('[isUserAdmin] Error querying profiles:', error.message, error.code)
    return false
  }

  const result = data?.role === 'admin' || data?.role === 'super_admin'
  return result
}

export const createIncidentWithPhoto = async (
  formData: any,
  photoFile?: File | null,
  receiptFile?: File | null
) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  // Upload photo if provided
  if (photoFile) {
    const photoPath = `incidents/${user.id}/${Date.now()}_photo_${photoFile.name}`
    const { error: photoErr } = await supabase.storage
      .from('documents')
      .upload(photoPath, photoFile, { upsert: true })
    if (!photoErr) {
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(photoPath)
      formData.photo_urls = [urlData.publicUrl]
    }
  }

  // Upload receipt if provided
  if (receiptFile) {
    const receiptPath = `incidents/${user.id}/${Date.now()}_receipt_${receiptFile.name}`
    const { error: receiptErr } = await supabase.storage
      .from('documents')
      .upload(receiptPath, receiptFile, { upsert: true })
    if (!receiptErr) {
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(receiptPath)
      formData.receipt_urls = [urlData.publicUrl]
    }
  }

  const { data, error } = await supabase
    .from('incidents')
    .insert([{ ...formData, user_id: user.id }])
    .select()
    .single()

  if (error) throw error
  return data
}

export const signOut = () => supabase.auth.signOut()

// --- יתר הקוד המקורי שלך (פרופילים, הסכמת הורים וכו') ---

export interface Profile {
  id: string
  full_name: string
  phone: string
  id_number: string
  birthdate?: string
  status: 'active' | 'suspended' | 'pending'
  role?: string
  home_address?: string
  city?: string
  postal_code?: string
  total_incidents?: number
  total_claims?: number
  total_received?: number
  total_potential?: number
}

export async function getCurrentUserProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return data
}

export function isMinor(birthdate?: string): boolean {
  if (!birthdate) return false
  const birth = new Date(birthdate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age < 18
}

export async function checkParentalConsent(userId: string): Promise<any> {
  const { data } = await supabase
    .from('parental_consents')
    .select('*')
    .eq('minor_user_id', userId)
    .eq('status', 'approved')
    .single()
  return { hasConsent: !!data, consent: data }
}

export async function getCurrentUserConsentStatus(): Promise<any> {
  const profile = await getCurrentUserProfile()
  if (!profile || !isMinor(profile.birthdate)) return { isMinor: false, hasConsent: false }
  const consentStatus = await checkParentalConsent(profile.id)
  return { isMinor: true, ...consentStatus }
}

export function validateIsraeliId(idNumber: string): boolean {
  const cleanId = idNumber.replace(/\D/g, '')
  const paddedId = cleanId.padStart(9, '0')
  if (paddedId.length !== 9) return false
  let total = 0
  for (let i = 0; i < 9; i++) {
    let num = parseInt(paddedId.charAt(i)) * ((i % 2) + 1)
    total += num > 9 ? num - 9 : num
  }
  return total % 10 === 0
}

// --- Types ---

export interface BusCompany {
  id: string
  company_name: string
  company_name_en: string
  public_contact_email?: string
  online_form_url?: string
  requires_form_automation?: boolean
  phone?: string
  postal_address?: string
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LegalSubmission {
  id: string
  claim_id: string
  user_id: string
  company_id?: string
  submission_type: 'email' | 'web_form' | 'manual'
  submission_status: 'pending' | 'in_progress' | 'sent' | 'delivered' | 'failed' | 'retrying'
  pdf_url: string
  pdf_filename: string
  email_bcc?: string
  ministry_notified: boolean
  retry_count: number
  max_retries: number
  sent_at?: string
  delivered_at?: string
  error_message?: string
  automation_status?: string
  automation_method?: string
  automation_error_message?: string
  email_message_id?: string
  email_tracking_status?: string
  email_to?: string
  email_sent_at?: string
  email_subject?: string
  email_body?: string
  form_url?: string
  form_submitted_at?: string
  form_confirmation_number?: string
  form_data?: any
  delivery_confirmation_data?: any
  web_form_response?: any
  ministry_notification_sent_at?: string
  created_at: string
  updated_at: string
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
  user_gps_accuracy?: number
  incident_type: 'delay' | 'no_stop' | 'no_arrival'
  incident_datetime: string
  damage_type?: 'taxi_cost' | 'lost_workday' | 'missed_exam' | 'medical_appointment' | 'other' | null
  damage_amount?: number
  damage_description?: string
  photo_urls?: string[]
  verified: boolean
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
  bus_company: string
  company_contact_email?: string
  final_settlement_amount?: number
  actual_paid_amount?: number
  opening_fee_amount?: number
  opening_fee_paid?: boolean
  opening_fee_paid_at?: string
  system_commission_due?: number
  commission_paid?: boolean
  commission_paid_at?: string
  settlement_proof_url?: string
  settlement_date?: string
  current_workflow_execution_id?: string
  workflow_status?: 'not_started' | 'in_progress' | 'completed' | 'failed'
  last_workflow_action_at?: string
  admin_notes?: string
  priority?: 'urgent' | 'high' | 'normal' | 'low'
  created_at: string
  updated_at: string
}

export interface ParentalConsent {
  id: string
  minor_user_id: string
  minor_name: string
  minor_birthdate: string
  parent_name?: string
  parent_email?: string
  parent_full_name?: string
  parent_id_number?: string
  parent_phone?: string
  consent_token: string
  status: 'pending' | 'approved' | 'expired' | 'rejected'
  consent_given_at?: string
  consent_ip_address?: string
  consent_user_agent?: string
  confirmed_legal_guardian?: boolean
  confirmed_terms_of_service?: boolean
  confirmed_fee_model?: boolean
  expires_at: string
  created_at: string
  updated_at: string
}

// --- Incident Management ---

export async function updateIncidentToClaimed(incidentId: string): Promise<void> {
  const { error } = await supabase
    .from('incidents')
    .update({ status: 'claimed', updated_at: new Date().toISOString() })
    .eq('id', incidentId)
  if (error) throw error
}

export async function adminUpdateIncidentStatus(incidentId: string, newStatus: string): Promise<void> {
  const updateData: any = { status: newStatus, updated_at: new Date().toISOString() }
  if (newStatus === 'verified') {
    updateData.verified = true
    updateData.verification_timestamp = new Date().toISOString()
  }
  if (newStatus === 'rejected') {
    updateData.verified = false
  }
  const { error } = await supabase
    .from('incidents')
    .update(updateData)
    .eq('id', incidentId)
  if (error) throw error
}

export async function adminMarkIncidentPaid(incidentId: string, paymentAmount: number): Promise<void> {
  const { error } = await supabase
    .from('incidents')
    .update({
      status: 'claimed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', incidentId)
  if (error) throw error

  // Also update the related claim if exists
  const { data: claims } = await supabase
    .from('claims')
    .select('id')
    .contains('incident_ids', [incidentId])
    .limit(1)

  if (claims && claims.length > 0) {
    await supabase
      .from('claims')
      .update({
        actual_paid_amount: paymentAmount,
        status: 'paid',
        compensation_received_date: new Date().toISOString(),
        system_commission_due: paymentAmount * 0.2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claims[0].id)
  }
}

// --- PDF Upload ---

export async function uploadPDFDocument(pdfBlob: Blob, filename: string, folder: string): Promise<string> {
  const filePath = `${folder}/${filename}`
  const { error } = await supabase.storage
    .from('documents')
    .upload(filePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    })
  if (error) throw error

  const { data } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath)

  return data.publicUrl
}

// --- User Data ---

export async function getUserIncidents(limit: number = 100): Promise<Incident[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function getUserClaims(): Promise<Claim[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// --- Admin Functions ---

export async function getAllIncidentsForAdmin(limit: number = 100): Promise<(Incident & { profiles?: { full_name: string; phone: string; email?: string } })[]> {
  const { data, error } = await supabase
    .from('incidents')
    .select('*, profiles(full_name, phone, email)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function getAdminStatistics(): Promise<{
  totalUsers: number
  totalIncidents: number
  totalPotentialCompensation: number
  totalPaidCompensation: number
  totalCommission: number
}> {
  const [usersRes, incidentsRes, claimsRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('incidents').select('id', { count: 'exact', head: true }),
    supabase.from('claims').select('claim_amount, actual_paid_amount, system_commission_due'),
  ])

  const totalUsers = usersRes.count || 0
  const totalIncidents = incidentsRes.count || 0

  let totalPotentialCompensation = 0
  let totalPaidCompensation = 0
  let totalCommission = 0

  if (claimsRes.data) {
    for (const claim of claimsRes.data) {
      totalPotentialCompensation += claim.claim_amount || 0
      totalPaidCompensation += claim.actual_paid_amount || 0
      totalCommission += claim.system_commission_due || 0
    }
  }

  return { totalUsers, totalIncidents, totalPotentialCompensation, totalPaidCompensation, totalCommission }
}

// --- Parental Consent ---

export async function getParentalConsentByToken(token: string): Promise<ParentalConsent | null> {
  const { data, error } = await supabase
    .from('parental_consents')
    .select('*')
    .eq('consent_token', token)
    .single()

  if (error || !data) return null
  return data
}

export async function submitParentalConsent(
  token: string,
  parentFullName: string,
  parentIdNumber: string,
  parentPhone: string,
  confirmedGuardian: boolean,
  confirmedTerms: boolean,
  confirmedFee: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const consent = await getParentalConsentByToken(token)
    if (!consent) return { success: false, error: 'טוקן לא תקין' }
    if (consent.status === 'approved') return { success: false, error: 'הסכמה כבר אושרה' }
    if (consent.status === 'expired' || new Date(consent.expires_at) < new Date()) {
      return { success: false, error: 'פג תוקף הבקשה' }
    }

    const { error } = await supabase
      .from('parental_consents')
      .update({
        parent_full_name: parentFullName,
        parent_id_number: parentIdNumber,
        parent_phone: parentPhone,
        confirmed_legal_guardian: confirmedGuardian,
        confirmed_terms_of_service: confirmedTerms,
        confirmed_fee_model: confirmedFee,
        consent_given_at: new Date().toISOString(),
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('consent_token', token)

    if (error) throw error
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'שגיאה בשמירת ההסכמה' }
  }
}