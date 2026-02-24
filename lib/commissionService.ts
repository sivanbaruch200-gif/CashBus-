/**
 * Commission Service - Success Fee Model (80/20)
 *
 * Business Model:
 * - Customer pays NOTHING upfront
 * - Bus company pays compensation → CashBus bank account
 * - CashBus keeps 20%, forwards 80% to customer
 *
 * This service handles:
 * 1. Commission calculation (20% of actual compensation)
 * 2. Incoming payment recording (from bus companies)
 * 3. Payment split calculation (80/20)
 * 4. Customer payout tracking
 * 5. Settlement proof processing
 */

import { supabase } from './supabase'

// =====================================================
// Constants
// =====================================================

export const SUCCESS_FEE_PERCENTAGE = 0.20 // 20%
export const CUSTOMER_PAYOUT_PERCENTAGE = 0.80 // 80%

// =====================================================
// Types
// =====================================================

export interface PaymentRequest {
  id: string
  claim_id: string
  user_id: string
  payment_type: 'commission'
  amount: number
  currency: string
  status: 'pending' | 'sent' | 'paid' | 'failed' | 'cancelled'
  stripe_payment_intent_id?: string
  stripe_invoice_id?: string
  stripe_payment_url?: string
  requested_at: string
  sent_at?: string
  paid_at?: string
  created_at: string
  updated_at: string
}

export interface SettlementProof {
  id: string
  claim_id: string
  user_id: string
  proof_type: 'check_photo' | 'bank_transfer' | 'cash_receipt' | 'other'
  file_url: string
  file_name?: string
  file_size_bytes?: number
  claimed_amount?: number
  verified_amount?: number
  verified: boolean
  verified_by?: string
  verified_at?: string
  user_notes?: string
  admin_notes?: string
  created_at: string
  updated_at: string
}

export interface IncomingPayment {
  id: string
  claim_id: string
  amount: number
  payment_source?: string
  payment_method?: string
  reference_number?: string
  received_date: string
  recorded_by?: string
  proof_url?: string
  notes?: string
  commission_amount?: number
  customer_payout?: number
  customer_payout_status: 'pending' | 'initiated' | 'completed' | 'failed'
  customer_payout_date?: string
  customer_payout_reference?: string
  created_at: string
  updated_at: string
}

export interface PaymentSplit {
  totalAmount: number
  commissionAmount: number
  customerPayout: number
}

// =====================================================
// Commission Calculation
// =====================================================

/**
 * Calculate 20% commission on actual paid amount
 */
export function calculateCommission(actualPaidAmount: number): number {
  return Math.round(actualPaidAmount * SUCCESS_FEE_PERCENTAGE * 100) / 100
}

/**
 * Calculate full 80/20 payment split
 */
export function calculatePaymentSplit(totalAmount: number): PaymentSplit {
  const commissionAmount = Math.round(totalAmount * SUCCESS_FEE_PERCENTAGE * 100) / 100
  const customerPayout = Math.round(totalAmount * CUSTOMER_PAYOUT_PERCENTAGE * 100) / 100
  return { totalAmount, commissionAmount, customerPayout }
}

// =====================================================
// Incoming Payment Management (from bus companies)
// =====================================================

/**
 * Record an incoming payment from a bus company
 * The DB trigger auto-calculates 80/20 split
 */
export async function recordIncomingPayment(
  claimId: string,
  amount: number,
  recordedBy: string,
  options?: {
    paymentSource?: string
    paymentMethod?: string
    referenceNumber?: string
    receivedDate?: string
    proofUrl?: string
    notes?: string
  }
): Promise<IncomingPayment | null> {
  const { data, error } = await supabase
    .from('incoming_payments')
    .insert({
      claim_id: claimId,
      amount,
      payment_source: options?.paymentSource,
      payment_method: options?.paymentMethod,
      reference_number: options?.referenceNumber,
      received_date: options?.receivedDate || new Date().toISOString(),
      recorded_by: recordedBy,
      proof_url: options?.proofUrl,
      notes: options?.notes,
    })
    .select()
    .single()

  if (error) {
    console.error('Error recording incoming payment:', error)
    throw error
  }

  return data
}

/**
 * Get incoming payments for a claim
 */
export async function getClaimIncomingPayments(
  claimId: string
): Promise<IncomingPayment[]> {
  const { data, error } = await supabase
    .from('incoming_payments')
    .select('*')
    .eq('claim_id', claimId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching incoming payments:', error)
    return []
  }

  return data || []
}

// =====================================================
// Customer Payout Management
// =====================================================

/**
 * Mark customer payout as initiated
 */
export async function initiateCustomerPayout(
  paymentId: string,
  reference?: string
): Promise<void> {
  const { error } = await supabase
    .from('incoming_payments')
    .update({
      customer_payout_status: 'initiated',
      customer_payout_reference: reference,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId)

  if (error) {
    console.error('Error initiating customer payout:', error)
    throw error
  }
}

/**
 * Complete customer payout (80% transferred to customer)
 */
export async function completeCustomerPayout(
  paymentId: string,
  claimId: string,
  reference: string
): Promise<void> {
  // Update incoming_payments record
  const { error: paymentError } = await supabase
    .from('incoming_payments')
    .update({
      customer_payout_status: 'completed',
      customer_payout_date: new Date().toISOString(),
      customer_payout_reference: reference,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId)

  if (paymentError) {
    console.error('Error completing customer payout:', paymentError)
    throw paymentError
  }

  // Update claim
  const { error: claimError } = await supabase
    .from('claims')
    .update({
      customer_payout_completed: true,
      customer_payout_date: new Date().toISOString(),
      customer_payout_reference: reference,
      commission_paid: true,
      commission_paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', claimId)

  if (claimError) {
    console.error('Error updating claim payout status:', claimError)
    throw claimError
  }
}

// =====================================================
// Settlement Proof Processing
// =====================================================

/**
 * Upload settlement proof (photo of check/transfer)
 */
export async function uploadSettlementProof(
  claimId: string,
  userId: string,
  file: File,
  claimedAmount: number,
  proofType: SettlementProof['proof_type'],
  userNotes?: string
): Promise<SettlementProof | null> {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${claimId}_settlement_${Date.now()}.${fileExt}`
    const filePath = `settlement-proofs/${userId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    const { data, error } = await supabase
      .from('settlement_proofs')
      .insert({
        claim_id: claimId,
        user_id: userId,
        proof_type: proofType,
        file_url: publicUrl,
        file_name: fileName,
        file_size_bytes: file.size,
        claimed_amount: claimedAmount,
        user_notes: userNotes,
      })
      .select()
      .single()

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error uploading settlement proof:', error)
    throw error
  }
}

/**
 * Admin verifies settlement proof
 */
export async function verifySettlementProof(
  proofId: string,
  verifiedAmount: number,
  adminId: string,
  adminNotes?: string
): Promise<void> {
  const { error } = await supabase
    .from('settlement_proofs')
    .update({
      verified: true,
      verified_amount: verifiedAmount,
      verified_by: adminId,
      verified_at: new Date().toISOString(),
      admin_notes: adminNotes,
    })
    .eq('id', proofId)

  if (error) {
    console.error('Error verifying settlement proof:', error)
    throw error
  }
}

// =====================================================
// Query Functions
// =====================================================

/**
 * Get all payment requests for a claim
 */
export async function getClaimPaymentRequests(
  claimId: string
): Promise<PaymentRequest[]> {
  const { data, error } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('claim_id', claimId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching payment requests:', error)
    return []
  }

  return data || []
}

/**
 * Get settlement proof for a claim
 */
export async function getClaimSettlementProof(
  claimId: string
): Promise<SettlementProof | null> {
  const { data, error } = await supabase
    .from('settlement_proofs')
    .select('*')
    .eq('claim_id', claimId)
    .single()

  if (error) {
    console.error('Error fetching settlement proof:', error)
    return null
  }

  return data
}

/**
 * Get all pending customer payouts (admin view)
 */
export async function getPendingPayouts(): Promise<IncomingPayment[]> {
  const { data, error } = await supabase
    .from('incoming_payments')
    .select('*, claims(user_id, profiles(full_name, email, bank_name, bank_branch, bank_account_number))')
    .in('customer_payout_status', ['pending', 'initiated'])
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching pending payouts:', error)
    return []
  }

  return data || []
}

/**
 * Get total revenue for a claim
 */
export async function getClaimRevenue(claimId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_claim_total_revenue', {
    claim_id_input: claimId,
  })

  if (error) {
    console.error('Error fetching claim revenue:', error)
    return 0
  }

  return data || 0
}

// =====================================================
// Collection Workflow Helpers
// =====================================================

/**
 * Check if claim has received payment from bus company
 */
export async function hasIncomingPayment(
  claimId: string
): Promise<boolean> {
  const payments = await getClaimIncomingPayments(claimId)
  return payments.length > 0
}

/**
 * Get claims awaiting incoming payment (sent but no payment received yet)
 */
export async function getClaimsAwaitingPayment(): Promise<any[]> {
  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .in('status', ['submitted', 'company_review'])
    .is('incoming_payment_amount', null)

  if (error) {
    console.error('Error fetching claims awaiting payment:', error)
    return []
  }

  return data || []
}

/**
 * Get claims with pending customer payouts
 */
export async function getClaimsPendingPayout(): Promise<any[]> {
  const { data, error } = await supabase
    .from('claims')
    .select('*, profiles(full_name, email, bank_name, bank_branch, bank_account_number)')
    .eq('customer_payout_completed', false)
    .not('incoming_payment_amount', 'is', null)

  if (error) {
    console.error('Error fetching claims pending payout:', error)
    return []
  }

  return data || []
}
