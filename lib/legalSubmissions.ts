/**
 * Legal Submissions Service - Zero-Touch Automation
 *
 * This service handles automated submission of legal documents to bus companies:
 * 1. Email submissions (with Ministry BCC)
 * 2. Web form automation (for companies like Egged)
 * 3. Smart routing based on company preferences
 */

import { supabase } from './supabase'
import type { BusCompany, LegalSubmission, Claim, Profile } from './supabase'

// Ministry of Transport email - MUST be BCC'd on all submissions
export const MINISTRY_EMAIL = 'Pniotcrm@mot.gov.il'

// =====================================================
// Company Lookup & Routing
// =====================================================

/**
 * Get company details by name
 */
export async function getBusCompany(companyName: string): Promise<BusCompany | null> {
  const { data, error } = await supabase
    .from('bus_companies')
    .select('*')
    .eq('company_name', companyName)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching bus company:', error)
    return null
  }

  return data
}

/**
 * Get all active bus companies (for admin UI)
 */
export async function getAllBusCompanies(): Promise<BusCompany[]> {
  const { data, error } = await supabase
    .from('bus_companies')
    .select('*')
    .eq('is_active', true)
    .order('company_name')

  if (error) {
    console.error('Error fetching bus companies:', error)
    return []
  }

  return data || []
}

/**
 * Determine best submission method for a company
 * Returns: 'email', 'web_form', or 'manual'
 */
export async function getSubmissionMethod(companyName: string): Promise<'email' | 'web_form' | 'manual'> {
  const company = await getBusCompany(companyName)

  if (!company) {
    return 'manual'
  }

  // Priority: Form automation > Email > Manual
  if (company.requires_form_automation && company.online_form_url) {
    return 'web_form'
  } else if (company.public_contact_email) {
    return 'email'
  }

  return 'manual'
}

// =====================================================
// Submission Creation & Tracking
// =====================================================

/**
 * Create a new legal submission record
 */
export async function createLegalSubmission(
  claimId: string,
  userId: string,
  companyName: string,
  pdfUrl: string,
  pdfFilename: string
): Promise<LegalSubmission | null> {
  const company = await getBusCompany(companyName)
  const submissionMethod = await getSubmissionMethod(companyName)

  const { data, error } = await supabase
    .from('legal_submissions')
    .insert({
      claim_id: claimId,
      user_id: userId,
      company_id: company?.id,
      submission_type: submissionMethod,
      submission_status: 'pending',
      pdf_url: pdfUrl,
      pdf_filename: pdfFilename,
      email_bcc: MINISTRY_EMAIL,
      ministry_notified: false,
      retry_count: 0,
      max_retries: 3,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating legal submission:', error)
    throw error
  }

  return data
}

/**
 * Update submission status
 */
export async function updateSubmissionStatus(
  submissionId: string,
  status: LegalSubmission['submission_status'],
  additionalData?: Partial<LegalSubmission>
): Promise<void> {
  const { error } = await supabase
    .from('legal_submissions')
    .update({
      submission_status: status,
      ...additionalData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId)

  if (error) {
    console.error('Error updating submission status:', error)
    throw error
  }
}

/**
 * Mark Ministry as notified
 */
export async function markMinistryNotified(submissionId: string): Promise<void> {
  const { error } = await supabase
    .from('legal_submissions')
    .update({
      ministry_notified: true,
      ministry_notification_sent_at: new Date().toISOString(),
    })
    .eq('id', submissionId)

  if (error) {
    console.error('Error marking ministry notified:', error)
    throw error
  }
}

// =====================================================
// Smart Submission Orchestrator
// =====================================================

export interface SubmissionData {
  claim: Claim
  profile: Profile
  pdfUrl: string
  pdfFilename: string
}

/**
 * Main orchestrator: Submits legal document using the best method
 * This is the ZERO-TOUCH entry point
 */
export async function submitLegalDocument(data: SubmissionData): Promise<{
  success: boolean
  submissionId?: string
  method: 'email' | 'web_form' | 'manual'
  error?: string
}> {
  const { claim, profile, pdfUrl, pdfFilename } = data

  try {
    // 1. Create submission record
    const submission = await createLegalSubmission(
      claim.id,
      profile.id,
      claim.bus_company,
      pdfUrl,
      pdfFilename
    )

    if (!submission) {
      throw new Error('Failed to create submission record')
    }

    // 2. Determine submission method
    const method = await getSubmissionMethod(claim.bus_company)
    const company = await getBusCompany(claim.bus_company)

    if (!company) {
      throw new Error(`Company not found: ${claim.bus_company}`)
    }

    // 3. Route to appropriate submission handler
    let success = false
    let error: string | undefined

    switch (method) {
      case 'email':
        if (!company.public_contact_email) {
          error = 'Company has no email configured'
          break
        }
        success = await submitViaEmail(submission, company, profile, claim, pdfUrl)
        break

      case 'web_form':
        if (!company.online_form_url) {
          error = 'Company has no form URL configured'
          break
        }
        success = await submitViaWebForm(submission, company, profile, claim, pdfUrl)
        break

      case 'manual':
        error = 'Manual submission required - no automation available for this company'
        await updateSubmissionStatus(submission.id, 'pending', {
          automation_status: 'requires_manual_action',
        })
        break
    }

    // 4. Update final status
    if (success) {
      await updateSubmissionStatus(submission.id, 'sent')
      return { success: true, submissionId: submission.id, method }
    } else {
      await updateSubmissionStatus(submission.id, 'failed', {
        automation_error_message: error || 'Unknown error',
      })
      return { success: false, submissionId: submission.id, method, error }
    }
  } catch (err) {
    console.error('Error in submitLegalDocument:', err)
    return {
      success: false,
      method: 'manual',
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

// =====================================================
// Email Submission Handler
// =====================================================

async function submitViaEmail(
  submission: LegalSubmission,
  company: BusCompany,
  profile: Profile,
  claim: Claim,
  pdfUrl: string
): Promise<boolean> {
  try {
    // Update status to in_progress
    await updateSubmissionStatus(submission.id, 'in_progress', {
      automation_method: 'email_api',
      email_to: company.public_contact_email,
    })

    // Prepare email data
    const emailData = {
      to: company.public_contact_email!,
      bcc: MINISTRY_EMAIL,
      subject: `דרישה לפיצוי - ${profile.full_name} - קו ${claim.incident_ids.length} אירועים`,
      body: generateEmailBody(profile, claim),
      pdfUrl,
      submissionId: submission.id,
    }

    // Call email API endpoint
    const response = await fetch('/api/send-legal-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Email sending failed')
    }

    const result = await response.json()

    // Update submission with email details
    await updateSubmissionStatus(submission.id, 'sent', {
      email_sent_at: new Date().toISOString(),
      email_message_id: result.messageId,
      email_subject: emailData.subject,
      email_body: emailData.body,
    })

    // Mark ministry as notified
    await markMinistryNotified(submission.id)

    return true
  } catch (error) {
    console.error('Email submission error:', error)
    await updateSubmissionStatus(submission.id, 'failed', {
      automation_error_message: error instanceof Error ? error.message : 'Email failed',
    })
    return false
  }
}

// =====================================================
// Web Form Submission Handler
// =====================================================

async function submitViaWebForm(
  submission: LegalSubmission,
  company: BusCompany,
  profile: Profile,
  claim: Claim,
  pdfUrl: string
): Promise<boolean> {
  try {
    // Update status to in_progress
    await updateSubmissionStatus(submission.id, 'in_progress', {
      automation_method: 'web_automation',
      form_url: company.online_form_url,
    })

    // Prepare form data
    const formData = {
      fullName: profile.full_name,
      idNumber: profile.id_number,
      phone: profile.phone,
      address: profile.home_address,
      city: profile.city,
      postalCode: profile.postal_code,
      companyName: company.company_name,
      formUrl: company.online_form_url!,
      pdfUrl,
      submissionId: submission.id,
      // Notify ministry via separate email
      notifyMinistry: true,
    }

    // Call web automation API endpoint
    const response = await fetch('/api/submit-web-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Form submission failed')
    }

    const result = await response.json()

    // Update submission with form details
    await updateSubmissionStatus(submission.id, 'sent', {
      form_submitted_at: new Date().toISOString(),
      form_confirmation_number: result.confirmationNumber,
      form_data: formData,
      delivery_confirmation_data: result.screenshot ? { screenshot: result.screenshot } : {},
    })

    // Mark ministry as notified (via separate email)
    await markMinistryNotified(submission.id)

    return true
  } catch (error) {
    console.error('Web form submission error:', error)
    await updateSubmissionStatus(submission.id, 'failed', {
      automation_error_message: error instanceof Error ? error.message : 'Form submission failed',
    })
    return false
  }
}

// =====================================================
// Email Body Generator
// =====================================================

function generateEmailBody(profile: Profile, claim: Claim): string {
  const today = new Date().toLocaleDateString('he-IL')

  return `
לכבוד
${claim.bus_company}

הנדון: דרישה לפיצוי בגין עיכובים והפרת התחייבויות שירות

שלום רב,

אני, ${profile.full_name}, ת.ז. ${profile.id_number}, פונה/ת אליכם בדרישה לפיצוי בגין ${claim.incident_ids.length} מקרים מתועדים של הפרת התחייבויות שירות בקווי הסעה שלכם.

המקרים המתועדים כוללים עיכובים משמעותיים, אי-הגעת אוטובוסים לתחנה, ואי-עצירה במקומות שנקבעו.

בהתאם לפקודת התעבורה ולתקנות הובלה בתחבורה ציבורית, חברת הסעות נושאת באחריות להעניק פיצוי לנוסעים עבור הפרות כאלה.

**סכום הפיצוי הנדרש:** ₪${claim.claim_amount.toLocaleString('he-IL')}

מצ"ב מסמך מפורט עם כל האירועים המתועדים, כולל GPS, תמונות, ותיעוד זמנים.

אבקש את תשומת לבכם לטיפול בנושא זה בהקדם האפשרי. במידה ולא יתקבל מענה תוך 14 יום, אאלץ/אאלצה לפנות לבית המשפט לתביעות קטנות.

בברכה,
${profile.full_name}
טלפון: ${profile.phone}
כתובת: ${profile.home_address || 'לא צוין'}, ${profile.city || ''}

תאריך: ${today}

---
מסמך זה נוצר באמצעות מערכת CashBus - פלטפורמת זכויות נוסעים
העתק לידיעה: משרד התחבורה (Pniotcrm@mot.gov.il)
  `.trim()
}

// =====================================================
// Helper Functions for Admin UI
// =====================================================

/**
 * Get all submissions for a claim
 */
export async function getClaimSubmissions(claimId: string): Promise<LegalSubmission[]> {
  const { data, error } = await supabase
    .from('legal_submissions')
    .select('*')
    .eq('claim_id', claimId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching claim submissions:', error)
    return []
  }

  return data || []
}

/**
 * Get submission by ID
 */
export async function getSubmissionById(submissionId: string): Promise<LegalSubmission | null> {
  const { data, error } = await supabase
    .from('legal_submissions')
    .select('*')
    .eq('id', submissionId)
    .single()

  if (error) {
    console.error('Error fetching submission:', error)
    return null
  }

  return data
}

/**
 * Retry a failed submission
 */
export async function retrySubmission(submissionId: string): Promise<boolean> {
  const submission = await getSubmissionById(submissionId)

  if (!submission) {
    return false
  }

  if (submission.retry_count >= submission.max_retries) {
    console.error('Max retries reached for submission:', submissionId)
    return false
  }

  // Increment retry count
  await supabase
    .from('legal_submissions')
    .update({
      retry_count: submission.retry_count + 1,
      submission_status: 'pending',
    })
    .eq('id', submissionId)

  // TODO: Re-trigger submission via the orchestrator
  return true
}
