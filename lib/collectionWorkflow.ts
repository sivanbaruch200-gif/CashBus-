/**
 * Collection Workflow - Automated Commission Collection
 *
 * This workflow is triggered when a claim status becomes 'approved' or 'settled'
 *
 * Flow:
 * 1. Claim approved/settled → Send email to user requesting settlement proof
 * 2. User uploads proof → System calculates 15% commission
 * 3. Admin verifies proof → System generates Stripe invoice
 * 4. User pays commission → Mark as paid, complete workflow
 */

import { supabase } from './supabase'
import {
  calculateCommission,
  createCommissionPaymentRequest,
  getClaimSettlementProof,
  isReadyForCommissionCollection,
} from './commissionService'

// =====================================================
// Workflow Triggers
// =====================================================

/**
 * Trigger collection workflow when claim is approved
 * Called from claim status update
 */
export async function triggerCollectionWorkflow(claimId: string): Promise<void> {
  try {
    // 1. Get claim details
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('*, profiles(*)')
      .eq('id', claimId)
      .single()

    if (claimError || !claim) {
      throw new Error('Claim not found')
    }

    // 2. Check if already has settlement proof
    const hasProof = await getClaimSettlementProof(claimId)
    if (hasProof) {
      console.log('Claim already has settlement proof, skipping email')
      return
    }

    // 3. Send email requesting settlement proof
    await sendSettlementProofRequestEmail(claim)

    // 4. Log workflow action
    await logWorkflowAction(
      claimId,
      'settlement_proof_requested',
      'נשלח אימייל למשתמש לבקשת אסמכתא לתשלום'
    )
  } catch (error) {
    console.error('Error triggering collection workflow:', error)
    throw error
  }
}

/**
 * Handle settlement proof upload
 * Triggered after user uploads proof
 */
export async function handleSettlementProofUploaded(
  claimId: string,
  proofId: string
): Promise<void> {
  try {
    // 1. Get settlement proof
    const { data: proof, error } = await supabase
      .from('settlement_proofs')
      .select('*')
      .eq('id', proofId)
      .single()

    if (error || !proof) {
      throw new Error('Settlement proof not found')
    }

    // 2. Notify admin for verification
    await sendAdminVerificationRequest(claimId, proof)

    // 3. Log action
    await logWorkflowAction(
      claimId,
      'settlement_proof_uploaded',
      `משתמש העלה אסמכתא: ${proof.claimed_amount} ש"ח`
    )

    // 4. Send confirmation to user
    await sendUserConfirmationEmail(claimId, proof.claimed_amount)
  } catch (error) {
    console.error('Error handling settlement proof upload:', error)
    throw error
  }
}

/**
 * Handle admin verification of settlement proof
 * Triggers commission payment request
 */
export async function handleSettlementProofVerified(
  claimId: string,
  verifiedAmount: number
): Promise<void> {
  try {
    // 1. Calculate commission (15%)
    const commissionAmount = calculateCommission(verifiedAmount)

    // 2. Get claim and user details
    const { data: claim, error } = await supabase
      .from('claims')
      .select('user_id')
      .eq('id', claimId)
      .single()

    if (error || !claim) {
      throw new Error('Claim not found')
    }

    // 3. Create payment request for commission
    const paymentRequest = await createCommissionPaymentRequest(
      claimId,
      claim.user_id,
      commissionAmount
    )

    if (!paymentRequest) {
      throw new Error('Failed to create payment request')
    }

    // 4. Generate Stripe invoice
    const stripeInvoiceUrl = await generateStripeInvoice(
      claim.user_id,
      claimId,
      commissionAmount
    )

    // 5. Update payment request with Stripe URL
    await supabase
      .from('payment_requests')
      .update({
        stripe_payment_url: stripeInvoiceUrl,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', paymentRequest.id)

    // 6. Send invoice email to user
    await sendCommissionInvoiceEmail(claimId, commissionAmount, stripeInvoiceUrl)

    // 7. Log action
    await logWorkflowAction(
      claimId,
      'commission_invoice_sent',
      `נוצרה חשבונית לעמלה: ${commissionAmount} ש"ח (15% מ-${verifiedAmount} ש"ח)`
    )
  } catch (error) {
    console.error('Error handling settlement proof verification:', error)
    throw error
  }
}

// =====================================================
// Email Functions
// =====================================================

/**
 * Send email requesting settlement proof upload
 */
async function sendSettlementProofRequestEmail(claim: any): Promise<void> {
  const emailBody = `
שלום ${claim.profiles.full_name},

🎉 מזל טוב! התביעה שלך אושרה!

כדי להשלים את התהליך, אנא העלה אסמכתא לתשלום שקיבלת מהחברה:
- תמונה של המחאה
- צילום מסך של העברה בנקאית
- קבלה על תשלום במזומן

**סכום התביעה שאושר:** ₪${claim.claim_amount.toLocaleString('he-IL')}

לאחר אימות האסמכתא, נחייב עמלת הצלחה של 15% בלבד מהסכום שקיבלת.

להעלאת אסמכתא, היכנס לחשבונך:
${process.env.NEXT_PUBLIC_SITE_URL}/claims/${claim.id}

בברכה,
צוות CashBus

---
*עמלת הצלחה: 15% בלבד - אנחנו מרוויחים רק כשאתה מרוויח!*
  `.trim()

  // TODO: Send via email API
  await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: claim.profiles.email,
      subject: '🎉 מזל טוב! התביעה אושרה - נא להעלות אסמכתא',
      body: emailBody,
    }),
  })
}

/**
 * Send confirmation to user after uploading proof
 */
async function sendUserConfirmationEmail(
  claimId: string,
  claimedAmount: number
): Promise<void> {
  // Get user email
  const { data: claim } = await supabase
    .from('claims')
    .select('user_id, profiles(email, full_name)')
    .eq('id', claimId)
    .single()

  if (!claim) return

  const emailBody = `
שלום ${claim.profiles.full_name},

✅ האסמכתא שלך התקבלה בהצלחה!

**סכום שדווח:** ₪${claimedAmount.toLocaleString('he-IL')}

האסמכתא נמצאת כעת בבדיקת צוות האדמינים.
לאחר אימות הסכום, תקבל חשבונית לתשלום עמלת ההצלחה (15%).

**עמלה משוערת:** ₪${calculateCommission(claimedAmount).toLocaleString('he-IL')} (15%)

נעדכן אותך בקרוב!

בברכה,
צוות CashBus
  `.trim()

  await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: claim.profiles.email,
      subject: '✅ האסמכתא התקבלה - בבדיקה',
      body: emailBody,
    }),
  })
}

/**
 * Send notification to admin for verification
 */
async function sendAdminVerificationRequest(
  claimId: string,
  proof: any
): Promise<void> {
  // TODO: Get admin email from settings
  const adminEmail = 'admin@cashbus.co.il'

  const emailBody = `
אסמכתא חדשה לאימות!

**תביעה:** ${claimId}
**סכום שדווח:** ₪${proof.claimed_amount}
**קובץ:** ${proof.file_url}

אנא אמת את האסמכתא בפאנל האדמין:
${process.env.NEXT_PUBLIC_SITE_URL}/admin/claims/${claimId}
  `.trim()

  await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: adminEmail,
      subject: `🔔 אסמכתא חדשה לאימות - תביעה ${claimId.slice(0, 8)}`,
      body: emailBody,
    }),
  })
}

/**
 * Send commission invoice to user
 */
async function sendCommissionInvoiceEmail(
  claimId: string,
  commissionAmount: number,
  stripeInvoiceUrl: string
): Promise<void> {
  const { data: claim } = await supabase
    .from('claims')
    .select('user_id, profiles(email, full_name), actual_paid_amount')
    .eq('id', claimId)
    .single()

  if (!claim) return

  const emailBody = `
שלום ${claim.profiles.full_name},

✅ האסמכתא שלך אומתה!

**סכום שאומת:** ₪${claim.actual_paid_amount.toLocaleString('he-IL')}
**עמלת הצלחה (15%):** ₪${commissionAmount.toLocaleString('he-IL')}

כעת נותר רק לשלם את עמלת ההצלחה דרך הקישור הבא:
${stripeInvoiceUrl}

💡 **תזכורת:** עמלת ההצלחה היא 15% בלבד מהסכום שקיבלת, ומשולמת רק לאחר שזכית!

תודה שבחרת ב-CashBus 🚌

בברכה,
צוות CashBus
  `.trim()

  await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: claim.profiles.email,
      subject: `💰 חשבונית לתשלום - עמלת הצלחה ${commissionAmount} ש"ח`,
      body: emailBody,
    }),
  })
}

// =====================================================
// Stripe Integration
// =====================================================

/**
 * Generate Stripe invoice for commission payment
 */
async function generateStripeInvoice(
  userId: string,
  claimId: string,
  amount: number
): Promise<string> {
  try {
    // TODO: Implement actual Stripe integration
    // For now, return mock URL

    const response = await fetch('/api/stripe/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        claimId,
        amount,
        currency: 'ILS',
        description: `עמלת הצלחה - תביעה ${claimId.slice(0, 8)}`,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create Stripe invoice')
    }

    const { invoiceUrl } = await response.json()
    return invoiceUrl
  } catch (error) {
    console.error('Error generating Stripe invoice:', error)
    // Return mock URL for development
    return `https://invoice.stripe.com/mock/${claimId}`
  }
}

// =====================================================
// Workflow Logging
// =====================================================

/**
 * Log workflow action to execution_logs table
 */
async function logWorkflowAction(
  claimId: string,
  actionType: string,
  description: string
): Promise<void> {
  const { error } = await supabase.from('execution_logs').insert({
    claim_id: claimId,
    action_type: actionType,
    description,
    success: true,
  })

  if (error) {
    console.error('Error logging workflow action:', error)
  }
}

// =====================================================
// Status Change Handlers
// =====================================================

/**
 * Handle claim status change
 * Triggers collection workflow when appropriate
 */
export async function handleClaimStatusChange(
  claimId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  // Trigger collection workflow when claim is approved or settled
  if (
    (newStatus === 'approved' || newStatus === 'settled' || newStatus === 'paid') &&
    oldStatus !== newStatus
  ) {
    await triggerCollectionWorkflow(claimId)
  }
}

// =====================================================
// Cron Jobs / Background Tasks
// =====================================================

/**
 * Send reminder emails for pending commission payments
 * Run daily via cron
 */
export async function sendCommissionPaymentReminders(): Promise<void> {
  // Get all claims with verified proofs but unpaid commission
  const { data: claims, error } = await supabase
    .from('claims')
    .select('*, settlement_proofs(*)')
    .eq('commission_paid', false)
    .not('system_commission_due', 'is', null)

  if (error || !claims) {
    console.error('Error fetching claims for reminders:', error)
    return
  }

  for (const claim of claims) {
    // Check if payment request was sent more than 3 days ago
    const { data: paymentRequest } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('claim_id', claim.id)
      .eq('payment_type', 'commission')
      .eq('status', 'sent')
      .single()

    if (paymentRequest) {
      const sentDate = new Date(paymentRequest.sent_at)
      const daysSinceSent = Math.floor(
        (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysSinceSent >= 3) {
        // Send reminder email
        await sendPaymentReminder(claim.id, paymentRequest.stripe_payment_url)
      }
    }
  }
}

/**
 * Send payment reminder email
 */
async function sendPaymentReminder(
  claimId: string,
  paymentUrl: string
): Promise<void> {
  const { data: claim } = await supabase
    .from('claims')
    .select('profiles(email, full_name), system_commission_due')
    .eq('id', claimId)
    .single()

  if (!claim) return

  const emailBody = `
שלום ${claim.profiles.full_name},

🔔 תזכורת ידידותית: עדיין לא שילמת את עמלת ההצלחה.

**סכום לתשלום:** ₪${claim.system_commission_due.toLocaleString('he-IL')}

לתשלום, לחץ כאן:
${paymentUrl}

תודה!
צוות CashBus
  `.trim()

  await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: claim.profiles.email,
      subject: '🔔 תזכורת: תשלום עמלת הצלחה',
      body: emailBody,
    }),
  })
}
