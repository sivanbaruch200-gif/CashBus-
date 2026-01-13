/**
 * Commission Service - Success Fee Model
 *
 * Business Model:
 * - Opening Fee: 29 NIS (fixed, paid upfront)
 * - Success Fee: 15% of actual compensation received
 *
 * This service handles:
 * 1. Opening fee collection (before claim submission)
 * 2. Commission calculation (15% of actual payout)
 * 3. Settlement proof processing
 * 4. Payment request generation
 * 5. Stripe integration
 */

import { supabase } from './supabase'

// =====================================================
// Constants
// =====================================================

export const OPENING_FEE_AMOUNT = 29.00 // NIS
export const SUCCESS_FEE_PERCENTAGE = 0.15 // 15%

// =====================================================
// Types
// =====================================================

export interface PaymentRequest {
  id: string
  claim_id: string
  user_id: string
  payment_type: 'opening_fee' | 'commission'
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

// =====================================================
// Commission Calculation
// =====================================================

/**
 * Calculate 15% commission on actual paid amount
 */
export function calculateCommission(actualPaidAmount: number): number {
  return Math.round(actualPaidAmount * SUCCESS_FEE_PERCENTAGE * 100) / 100
}

/**
 * Calculate total revenue for a claim (opening fee + commission)
 */
export function calculateTotalRevenue(
  openingFeePaid: boolean,
  commissionAmount?: number
): number {
  const openingFee = openingFeePaid ? 0 : OPENING_FEE_AMOUNT
  const commission = commissionAmount || 0
  return openingFee + commission
}

// =====================================================
// Opening Fee Management
// =====================================================

/**
 * Create payment request for opening fee (29 NIS)
 * Called when user creates a claim
 */
export async function createOpeningFeeRequest(
  claimId: string,
  userId: string
): Promise<PaymentRequest | null> {
  const { data, error } = await supabase
    .from('payment_requests')
    .insert({
      claim_id: claimId,
      user_id: userId,
      payment_type: 'opening_fee',
      amount: OPENING_FEE_AMOUNT,
      currency: 'ILS',
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating opening fee request:', error)
    throw error
  }

  return data
}

/**
 * Mark opening fee as paid
 */
export async function markOpeningFeePaid(
  claimId: string,
  stripePaymentId: string
): Promise<void> {
  // Update claim
  const { error: claimError } = await supabase
    .from('claims')
    .update({
      opening_fee_paid: true,
      opening_fee_paid_at: new Date().toISOString(),
      opening_fee_stripe_payment_id: stripePaymentId,
    })
    .eq('id', claimId)

  if (claimError) {
    console.error('Error marking opening fee paid:', claimError)
    throw claimError
  }

  // Update payment request
  const { error: paymentError } = await supabase
    .from('payment_requests')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: stripePaymentId,
    })
    .eq('claim_id', claimId)
    .eq('payment_type', 'opening_fee')

  if (paymentError) {
    console.error('Error updating payment request:', paymentError)
    throw paymentError
  }
}

// =====================================================
// Settlement Proof Processing
// =====================================================

/**
 * Upload settlement proof (photo of check/transfer)
 * Triggers automatic commission calculation
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
    // 1. Upload file to Supabase Storage
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

    // 2. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath)

    // 3. Create settlement proof record
    // Trigger will auto-calculate commission
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
 * Updates commission to final verified amount
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

  // Trigger will auto-update commission in claims table
}

// =====================================================
// Commission Payment Requests
// =====================================================

/**
 * Create payment request for commission (15%)
 * Called after settlement proof is verified
 */
export async function createCommissionPaymentRequest(
  claimId: string,
  userId: string,
  commissionAmount: number
): Promise<PaymentRequest | null> {
  const { data, error } = await supabase
    .from('payment_requests')
    .insert({
      claim_id: claimId,
      user_id: userId,
      payment_type: 'commission',
      amount: commissionAmount,
      currency: 'ILS',
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating commission payment request:', error)
    throw error
  }

  return data
}

/**
 * Mark commission as paid
 */
export async function markCommissionPaid(
  claimId: string,
  stripePaymentId: string,
  stripeInvoiceId?: string
): Promise<void> {
  // Update claim
  const { error: claimError } = await supabase
    .from('claims')
    .update({
      commission_paid: true,
      commission_paid_at: new Date().toISOString(),
      commission_stripe_payment_id: stripePaymentId,
      commission_stripe_invoice_id: stripeInvoiceId,
    })
    .eq('id', claimId)

  if (claimError) {
    console.error('Error marking commission paid:', claimError)
    throw claimError
  }

  // Update payment request
  const { error: paymentError } = await supabase
    .from('payment_requests')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: stripePaymentId,
      stripe_invoice_id: stripeInvoiceId,
    })
    .eq('claim_id', claimId)
    .eq('payment_type', 'commission')

  if (paymentError) {
    console.error('Error updating payment request:', paymentError)
    throw paymentError
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
 * Get all pending payment requests for a user
 */
export async function getUserPendingPayments(
  userId: string
): Promise<PaymentRequest[]> {
  const { data, error } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'sent'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching pending payments:', error)
    return []
  }

  return data || []
}

/**
 * Get outstanding payments (admin view)
 */
export async function getOutstandingPayments(): Promise<any[]> {
  const { data, error } = await supabase.rpc('get_outstanding_payments')

  if (error) {
    console.error('Error fetching outstanding payments:', error)
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
 * Check if claim is ready for commission collection
 * Returns true if settlement proof uploaded and verified
 */
export async function isReadyForCommissionCollection(
  claimId: string
): Promise<boolean> {
  const proof = await getClaimSettlementProof(claimId)
  return proof !== null && proof.verified === true
}

/**
 * Get claims that need settlement proof upload
 * (Approved/settled but no proof yet)
 */
export async function getClaimsAwaitingSettlementProof(): Promise<any[]> {
  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .in('status', ['approved', 'settled', 'paid'])
    .is('settlement_proof_url', null)

  if (error) {
    console.error('Error fetching claims awaiting proof:', error)
    return []
  }

  return data || []
}

/**
 * Get claims with unverified settlement proofs
 * (Admin needs to verify)
 */
export async function getClaimsWithUnverifiedProofs(): Promise<any[]> {
  const { data: proofs, error } = await supabase
    .from('settlement_proofs')
    .select('claim_id, claims(*)')
    .eq('verified', false)

  if (error) {
    console.error('Error fetching unverified proofs:', error)
    return []
  }

  return proofs || []
}
