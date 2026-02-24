/**
 * Collection Workflow - Reversed Payment Flow (80/20)
 *
 * NEW Flow (CashBus receives first):
 * 1. Demand letter sent to bus company → include CashBus bank details
 * 2. Bus company pays compensation → CashBus bank account
 * 3. Admin records incoming payment → auto 80/20 split calculated
 * 4. CashBus transfers 80% to customer → customer notified
 * 5. Admin confirms payout completed → workflow done
 *
 * OLD Flow (removed):
 * User gets paid → uploads proof → CashBus invoices 15% → user pays commission
 */

import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import {
  calculateCommission,
  calculatePaymentSplit,
  getClaimSettlementProof,
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

  const html = `<!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    </head>
    <body style="margin:0;padding:0;">
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <pre style="white-space: pre-wrap; font-family: inherit;">${params.body}</pre>
      </div>
    </body>
    </html>`

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
    const { data: claim, error: claimError } = await getSupabase()
      .from('claims')
      .select('*, profiles(*)')
      .eq('id', claimId)
      .single()

    if (claimError || !claim) {
      throw new Error('Claim not found')
    }

    // Check if already has incoming payment
    if (claim.incoming_payment_amount) {
      return
    }

    // Log workflow action
    await logWorkflowAction(
      claimId,
      'awaiting_company_payment',
      'מכתב דרישה נשלח - ממתינים לתשלום מחברת האוטובוסים לחשבון CashBus'
    )
  } catch (error) {
    console.error('Error triggering collection workflow:', error)
    throw error
  }
}

/**
 * Handle incoming payment from bus company
 * Triggered when admin records a payment in the system
 */
export async function handleIncomingPaymentRecorded(
  claimId: string,
  paymentId: string,
  amount: number
): Promise<void> {
  try {
    const split = calculatePaymentSplit(amount)

    // Get claim and user details
    const { data: claim, error } = await getSupabase()
      .from('claims')
      .select('user_id, profiles(email, full_name, bank_name, bank_branch, bank_account_number)')
      .eq('id', claimId)
      .single()

    if (error || !claim) {
      throw new Error('Claim not found')
    }

    const profile = Array.isArray(claim.profiles) ? claim.profiles[0] : claim.profiles

    // 1. Notify user that payment was received
    if (profile?.email) {
      await sendPaymentReceivedNotification(claimId, claim.user_id, profile, split)
    }

    // 2. Notify admin
    const adminEmail = await getAdminEmail()
    await sendEmail({
      to: adminEmail,
      subject: `תשלום התקבל - תביעה ${claimId.slice(0, 8)} - ₪${amount}`,
      body: `
תשלום חדש התקבל מחברת האוטובוסים!

תביעה: ${claimId.slice(0, 8)}
לקוח: ${profile?.full_name || 'לא ידוע'}
סכום שהתקבל: ₪${amount.toLocaleString('he-IL')}

חלוקה 80/20:
• עמלת CashBus (20%): ₪${split.commissionAmount.toLocaleString('he-IL')}
• לתשלום ללקוח (80%): ₪${split.customerPayout.toLocaleString('he-IL')}

פרטי בנק של הלקוח:
• בנק: ${profile?.bank_name || 'לא הוזן'}
• סניף: ${profile?.bank_branch || 'לא הוזן'}
• חשבון: ${profile?.bank_account_number || 'לא הוזן'}

יש להעביר ₪${split.customerPayout.toLocaleString('he-IL')} ללקוח ולאשר בפאנל:
${process.env.NEXT_PUBLIC_SITE_URL}/admin/claims/${claimId}
      `.trim(),
      claimId,
      emailType: 'admin_incoming_payment_notification',
    })

    // 3. Log action
    await logWorkflowAction(
      claimId,
      'incoming_payment_recorded',
      `תשלום התקבל: ₪${amount} | עמלה: ₪${split.commissionAmount} | ללקוח: ₪${split.customerPayout}`
    )
  } catch (error) {
    console.error('Error handling incoming payment:', error)
    throw error
  }
}

/**
 * Handle customer payout completion
 * Triggered when admin confirms 80% was transferred to customer
 */
export async function handlePayoutCompleted(
  claimId: string,
  payoutAmount: number,
  reference: string
): Promise<void> {
  try {
    const { data: claim, error } = await getSupabase()
      .from('claims')
      .select('user_id, profiles(email, full_name)')
      .eq('id', claimId)
      .single()

    if (error || !claim) {
      throw new Error('Claim not found')
    }

    const profile = Array.isArray(claim.profiles) ? claim.profiles[0] : claim.profiles

    // Send payout confirmation to user
    if (profile?.email) {
      await sendPayoutConfirmationEmail(claimId, claim.user_id, profile, payoutAmount, reference)
    }

    // Log action
    await logWorkflowAction(
      claimId,
      'customer_payout_completed',
      `תשלום ₪${payoutAmount} הועבר ללקוח | אסמכתא: ${reference}`
    )
  } catch (error) {
    console.error('Error handling payout completion:', error)
    throw error
  }
}

/**
 * Handle settlement proof upload (legacy flow - kept for users who got paid directly)
 */
export async function handleSettlementProofUploaded(
  claimId: string,
  proofId: string
): Promise<void> {
  try {
    const { data: proof, error } = await getSupabase()
      .from('settlement_proofs')
      .select('*')
      .eq('id', proofId)
      .single()

    if (error || !proof) {
      throw new Error('Settlement proof not found')
    }

    // Notify admin for verification
    await sendAdminVerificationRequest(claimId, proof)

    // Log action
    await logWorkflowAction(
      claimId,
      'settlement_proof_uploaded',
      `משתמש העלה אסמכתא: ${proof.claimed_amount} ש"ח`
    )

    // Send confirmation to user
    await sendUserProofConfirmationEmail(claimId, proof.claimed_amount)
  } catch (error) {
    console.error('Error handling settlement proof upload:', error)
    throw error
  }
}

// =====================================================
// Email Functions - New Flow (CashBus receives first)
// =====================================================

/**
 * Notify user that payment was received by CashBus
 */
async function sendPaymentReceivedNotification(
  claimId: string,
  userId: string,
  profile: any,
  split: { totalAmount: number; commissionAmount: number; customerPayout: number }
): Promise<void> {
  const emailBody = `
שלום ${profile.full_name},

חדשות מצוינות! קיבלנו תשלום פיצוי בגין התביעה שלך.

סכום שהתקבל מחברת האוטובוסים: ₪${split.totalAmount.toLocaleString('he-IL')}

חלוקה:
• חלקך (80%): ₪${split.customerPayout.toLocaleString('he-IL')}
• עמלת CashBus (20%): ₪${split.commissionAmount.toLocaleString('he-IL')}

נעביר אליך ₪${split.customerPayout.toLocaleString('he-IL')} בהקדם.
${profile.bank_name ? `ההעברה תבוצע לחשבון הבנק שלך (${profile.bank_name}).` : 'אנא ודא/י שפרטי הבנק שלך מעודכנים במערכת.'}

בברכה,
צוות CashBus

---
*מודל 80/20: אתה מקבל 80% מהפיצוי, אנחנו לוקחים רק 20% עמלת הצלחה!*
  `.trim()

  await sendEmail({
    to: profile.email,
    subject: `קיבלנו תשלום פיצוי! ₪${split.customerPayout.toLocaleString('he-IL')} בדרך אליך`,
    body: emailBody,
    claimId,
    userId,
    emailType: 'payment_received_notification',
  })
}

/**
 * Notify user that 80% payout was completed
 */
async function sendPayoutConfirmationEmail(
  claimId: string,
  userId: string,
  profile: any,
  payoutAmount: number,
  reference: string
): Promise<void> {
  const emailBody = `
שלום ${profile.full_name},

הכסף בדרך אליך!

₪${payoutAmount.toLocaleString('he-IL')} הועברו לחשבון הבנק שלך.
אסמכתא: ${reference}

ההעברה אמורה להגיע תוך 1-3 ימי עסקים.

תודה שבחרת ב-CashBus!

בברכה,
צוות CashBus
  `.trim()

  await sendEmail({
    to: profile.email,
    subject: `הכסף הועבר! ₪${payoutAmount.toLocaleString('he-IL')} לחשבונך`,
    body: emailBody,
    claimId,
    userId,
    emailType: 'payout_confirmation',
  })
}

// =====================================================
// Email Functions - Legacy (settlement proof flow)
// =====================================================

/**
 * Send confirmation to user after uploading proof
 */
async function sendUserProofConfirmationEmail(
  claimId: string,
  claimedAmount: number
): Promise<void> {
  const { data: claim } = await getSupabase()
    .from('claims')
    .select('user_id, profiles(email, full_name)')
    .eq('id', claimId)
    .single()

  if (!claim) return

  const profile = Array.isArray(claim.profiles) ? claim.profiles[0] : claim.profiles
  if (!profile) return

  const split = calculatePaymentSplit(claimedAmount)

  const emailBody = `
שלום ${profile.full_name},

האסמכתא שלך התקבלה בהצלחה!

סכום שדווח: ₪${claimedAmount.toLocaleString('he-IL')}
חלקך (80%): ₪${split.customerPayout.toLocaleString('he-IL')}
עמלת CashBus (20%): ₪${split.commissionAmount.toLocaleString('he-IL')}

האסמכתא נמצאת כעת בבדיקת צוות האדמינים.

בברכה,
צוות CashBus
  `.trim()

  await sendEmail({
    to: profile.email,
    subject: 'האסמכתא התקבלה - בבדיקה',
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

תביעה: ${claimId}
סכום שדווח: ₪${proof.claimed_amount}
קובץ: ${proof.file_url}

אנא אמת את האסמכתא בפאנל האדמין:
${process.env.NEXT_PUBLIC_SITE_URL}/admin/claims/${claimId}
  `.trim()

  const adminEmail = await getAdminEmail()

  await sendEmail({
    to: adminEmail,
    subject: `אסמכתא חדשה לאימות - תביעה ${claimId.slice(0, 8)}`,
    body: emailBody,
    claimId,
    emailType: 'admin_verification_request',
  })
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
 * Send reminder emails for claims with pending customer payouts
 * Run weekly via cron
 */
export async function sendPendingPayoutReminders(): Promise<void> {
  const { data: payments, error } = await getSupabase()
    .from('incoming_payments')
    .select('*, claims(id, user_id, profiles(email, full_name))')
    .eq('customer_payout_status', 'pending')

  if (error || !payments) {
    console.error('Error fetching pending payouts for reminders:', error)
    return
  }

  const adminEmail = await getAdminEmail()

  if (payments.length > 0) {
    const summary = payments.map(p => {
      const claim = Array.isArray(p.claims) ? p.claims[0] : p.claims
      const profile = claim?.profiles
      const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name
      return `• ${name || 'לא ידוע'} - ₪${p.customer_payout} (התקבל ${new Date(p.received_date).toLocaleDateString('he-IL')})`
    }).join('\n')

    await sendEmail({
      to: adminEmail,
      subject: `תזכורת: ${payments.length} תשלומי לקוח ממתינים להעברה`,
      body: `
יש ${payments.length} תשלומים שהתקבלו מחברות אוטובוסים וטרם הועברו ללקוחות:

${summary}

אנא בצע את ההעברות בפאנל האדמין:
${process.env.NEXT_PUBLIC_SITE_URL}/admin/claims
      `.trim(),
      emailType: 'admin_payout_reminder',
    })
  }
}
