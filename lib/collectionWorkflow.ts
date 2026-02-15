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

import { Resend } from 'resend'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import {
  calculateCommission,
  createCommissionPaymentRequest,
  getClaimSettlementProof,
  isReadyForCommissionCollection,
} from './commissionService'
import { getAdminEmail } from './settingsService'

// Lazy-initialized clients (avoid top-level throws that break build)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables')
  }
  return createClient(url, key)
}

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY environment variable')
  }
  return new Resend(apiKey)
}

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable')
  }
  return new Stripe(key, { apiVersion: '2026-01-28.clover' })
}

// Admin email is fetched dynamically from app_settings table via getAdminEmail()

/**
 * Send email directly via Resend SDK + log to email_logs
 */
async function sendEmail(params: {
  to: string
  subject: string
  body: string
  claimId?: string
  userId?: string
  emailType?: string
}): Promise<void> {
  const resend = getResend()

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <pre style="white-space: pre-wrap; font-family: inherit;">${params.body}</pre>
    </div>
  `

  const { data, error } = await resend.emails.send({
    from: 'CashBus <noreply@cashbuses.com>',
    replyTo: 'cash.bus200@gmail.com',
    to: [params.to],
    subject: params.subject,
    html,
  })

  // Log to email_logs
  await getSupabase().from('email_logs').insert({
    message_id: data?.id || null,
    from_email: 'noreply@cashbuses.com',
    to_email: params.to,
    subject: params.subject,
    status: error ? 'failed' : 'sent',
    error_message: error?.message || null,
    user_id: params.userId || null,
    claim_id: params.claimId || null,
    email_type: params.emailType || 'collection_workflow',
    metadata: {},
  })

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

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
    const { data: claim, error: claimError } = await getSupabase()
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
    const { data: proof, error } = await getSupabase()
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
    const { data: claim, error } = await getSupabase()
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
    await getSupabase()
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
  // Handle profiles as array (Supabase returns arrays for relations)
  const profile = Array.isArray(claim.profiles) ? claim.profiles[0] : claim.profiles
  if (!profile) return

  const emailBody = `
שלום ${profile.full_name},

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

  await sendEmail({
    to: profile.email,
    subject: '🎉 מזל טוב! התביעה אושרה - נא להעלות אסמכתא',
    body: emailBody,
    claimId: claim.id,
    userId: claim.user_id,
    emailType: 'settlement_proof_request',
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
  const { data: claim } = await getSupabase()
    .from('claims')
    .select('user_id, profiles(email, full_name)')
    .eq('id', claimId)
    .single()

  if (!claim) return

  // Handle profiles as array (Supabase returns arrays for relations)
  const profile = Array.isArray(claim.profiles) ? claim.profiles[0] : claim.profiles
  if (!profile) return

  const emailBody = `
שלום ${profile.full_name},

✅ האסמכתא שלך התקבלה בהצלחה!

**סכום שדווח:** ₪${claimedAmount.toLocaleString('he-IL')}

האסמכתא נמצאת כעת בבדיקת צוות האדמינים.
לאחר אימות הסכום, תקבל חשבונית לתשלום עמלת ההצלחה (15%).

**עמלה משוערת:** ₪${calculateCommission(claimedAmount).toLocaleString('he-IL')} (15%)

נעדכן אותך בקרוב!

בברכה,
צוות CashBus
  `.trim()

  await sendEmail({
    to: profile.email,
    subject: '✅ האסמכתא התקבלה - בבדיקה',
    body: emailBody,
    claimId,
    userId: claim.user_id,
    emailType: 'settlement_proof_confirmation',
  })
}

/**
 * Send notification to admin for verification
 */
async function sendAdminVerificationRequest(
  claimId: string,
  proof: any
): Promise<void> {
  const emailBody = `
אסמכתא חדשה לאימות!

**תביעה:** ${claimId}
**סכום שדווח:** ₪${proof.claimed_amount}
**קובץ:** ${proof.file_url}

אנא אמת את האסמכתא בפאנל האדמין:
${process.env.NEXT_PUBLIC_SITE_URL}/admin/claims/${claimId}
  `.trim()

  const adminEmail = await getAdminEmail()

  await sendEmail({
    to: adminEmail,
    subject: `🔔 אסמכתא חדשה לאימות - תביעה ${claimId.slice(0, 8)}`,
    body: emailBody,
    claimId,
    emailType: 'admin_verification_request',
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
  const { data: claim } = await getSupabase()
    .from('claims')
    .select('user_id, profiles(email, full_name), actual_paid_amount')
    .eq('id', claimId)
    .single()

  if (!claim) return

  // Handle profiles as array (Supabase returns arrays for relations)
  const profile = Array.isArray(claim.profiles) ? claim.profiles[0] : claim.profiles
  if (!profile) return

  const emailBody = `
שלום ${profile.full_name},

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

  await sendEmail({
    to: profile.email,
    subject: `💰 חשבונית לתשלום - עמלת הצלחה ${commissionAmount} ש"ח`,
    body: emailBody,
    claimId,
    userId: claim.user_id,
    emailType: 'commission_invoice',
  })
}

// =====================================================
// Stripe Integration
// =====================================================

/**
 * Generate Stripe invoice for commission payment.
 * Calls Stripe SDK directly (server-side).
 */
async function generateStripeInvoice(
  userId: string,
  claimId: string,
  amount: number
): Promise<string> {
  const stripe = getStripe()
  const supabase = getSupabase()

  // Get user profile for Stripe customer creation
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, phone')
    .eq('id', userId)
    .single()

  if (!profile || !profile.email) {
    throw new Error('User profile not found or missing email')
  }

  // Find or create Stripe customer
  const existingCustomers = await stripe.customers.list({
    email: profile.email,
    limit: 1,
  })

  let customer: Stripe.Customer
  if (existingCustomers.data.length > 0) {
    customer = existingCustomers.data[0]
  } else {
    customer = await stripe.customers.create({
      email: profile.email,
      name: profile.full_name || undefined,
      phone: profile.phone || undefined,
      metadata: { user_id: userId },
    })
  }

  // Create invoice
  const invoice = await stripe.invoices.create({
    customer: customer.id,
    collection_method: 'send_invoice',
    days_until_due: 14,
    currency: 'ils',
    description: `עמלת הצלחה - תביעה ${claimId.slice(0, 8)}`,
    metadata: {
      claim_id: claimId,
      user_id: userId,
      payment_type: 'commission',
    },
  })

  // Add invoice item (amount in agorot)
  await stripe.invoiceItems.create({
    customer: customer.id,
    invoice: invoice.id,
    amount: Math.round(amount * 100),
    currency: 'ils',
    description: 'עמלת הצלחה (15%)',
  })

  // Finalize to make it payable
  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id)

  return finalizedInvoice.hosted_invoice_url || `https://invoice.stripe.com/i/${invoice.id}`
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
  const { error } = await getSupabase().from('execution_logs').insert({
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
  const { data: claims, error } = await getSupabase()
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
    const { data: paymentRequest } = await getSupabase()
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
  const { data: claim } = await getSupabase()
    .from('claims')
    .select('profiles(email, full_name), system_commission_due')
    .eq('id', claimId)
    .single()

  if (!claim) return

  // Handle profiles as array (Supabase returns arrays for relations)
  const profile = Array.isArray(claim.profiles) ? claim.profiles[0] : claim.profiles
  if (!profile) return

  const emailBody = `
שלום ${profile.full_name},

🔔 תזכורת ידידותית: עדיין לא שילמת את עמלת ההצלחה.

**סכום לתשלום:** ₪${claim.system_commission_due.toLocaleString('he-IL')}

לתשלום, לחץ כאן:
${paymentUrl}

תודה!
צוות CashBus
  `.trim()

  await sendEmail({
    to: profile.email,
    subject: '🔔 תזכורת: תשלום עמלת הצלחה',
    body: emailBody,
    claimId,
    emailType: 'commission_payment_reminder',
  })
}
