# Zero-Touch Legal Automation - Implementation Guide

## Overview

This document describes the **Zero-Touch Automation System** for CashBus - a fully automated legal submission system where users only report incidents, and the system handles all legal processes automatically.

**Created:** 2026-01-05
**Status:** ✅ Core Implementation Complete

---

## What Was Built

### 1. Database Schema (`supabase/zero-touch-automation.sql`)

#### New Tables:

**`bus_companies`** - Bus company contact database
- Company name (Hebrew & English)
- Contact email for submissions
- Online form URL for web automation
- `requires_form_automation` flag (for companies like Egged)
- Ministry reporting configuration
- Active status and admin notes

**`legal_submissions`** - Submission tracking system
- Links to claims and users
- Submission type (email/web_form/postal)
- Email fields (to, bcc, subject, body, message_id)
- Web form fields (url, data, confirmation number)
- PDF attachment tracking
- Automation status and error handling
- Retry logic (max 3 retries)
- Ministry notification tracking
- Delivery confirmation data

#### Updated Tables:

**`profiles`** - Added mandatory fields for legal filings
- `id_number` (TEXT NOT NULL) - Israeli ID number
- `home_address` (TEXT) - Full street address
- `city` (TEXT) - City name
- `postal_code` (TEXT) - Postal code
- `address_verified` (BOOLEAN) - Verification status

#### Seed Data:
Pre-populated with 9 major Israeli bus companies:
- אגד (Egged) - Web form automation
- דן (Dan) - Email
- קווים (Kavim) - Email
- מטרופולין (Metropoline) - Email
- נתיב אקספרס (Nateev Express) - Email
- סופרבוס (Superbus) - Email
- אפיקים (Afikim) - Email
- גלים (Galim) - Email
- רכבת ישראל (Israel Railways) - Email + Form

---

### 2. TypeScript Types (`lib/supabase.ts`)

Updated and added types:
- ✅ `Profile` - Updated with address fields
- ✅ `BusCompany` - New type for company data
- ✅ `LegalSubmission` - New type for submission tracking

---

### 3. Smart Submission Service (`lib/legalSubmissions.ts`)

Core automation engine with:

#### Company Management:
- `getBusCompany()` - Lookup company by name
- `getAllBusCompanies()` - Get all active companies
- `getSubmissionMethod()` - Determine best submission method

#### Submission Logic:
- `submitLegalDocument()` - **MAIN ORCHESTRATOR**
  - Creates submission record
  - Routes to email or web form handler
  - Tracks status and errors
  - Handles retries

#### Email Handler:
- `submitViaEmail()` - Sends email with PDF attachment
- **ALWAYS BCC: `Pniotcrm@mot.gov.il`**
- Generates professional Hebrew legal letter
- Tracks message ID and delivery

#### Web Form Handler:
- `submitViaWebForm()` - Automates form filling
- Uses Puppeteer for browser automation
- Takes screenshot as proof
- Sends separate email to Ministry

#### Helper Functions:
- `createLegalSubmission()` - Create submission record
- `updateSubmissionStatus()` - Update submission state
- `markMinistryNotified()` - Log Ministry notification
- `getClaimSubmissions()` - Get all submissions for a claim
- `retrySubmission()` - Retry failed submissions

---

### 4. Email API (`app/api/send-legal-email/route.ts`)

REST API endpoint for sending legal emails:
- **POST** `/api/send-legal-email`
- Downloads PDF from storage
- Sends email via Resend (or SendGrid)
- **CRITICAL:** Always includes Ministry BCC
- Returns message ID for tracking

**Current Status:** Mock implementation (Resend not installed)

**To Enable:**
```bash
npm install resend
```

Then uncomment the Resend code in the file.

---

### 5. Web Form API (`app/api/submit-web-form/route.ts`)

REST API endpoint for web form automation:
- **POST** `/api/submit-web-form`
- Uses Puppeteer for browser automation
- Fills form fields with user data
- Uploads PDF if form supports it
- Takes screenshot as confirmation
- Notifies Ministry via separate email

**Current Status:** Mock implementation (Puppeteer not installed)

**To Enable:**
```bash
npm install puppeteer
```

Then uncomment the Puppeteer code in the file.

---

### 6. Admin Interface (`app/admin/companies/page.tsx`)

Admin panel for managing bus companies:
- View all companies with contact info
- Add new companies
- Edit company details
- Configure submission methods
- See submission method badges (Email/Form/Manual)
- Ministry notification reminder

**Access:** `/admin/companies`

---

### 7. User Profile Page (`app/profile/page.tsx`)

User-facing profile settings:
- Collect mandatory ID number
- Collect full home address
- Profile completeness indicator
- Zero-Touch automation explanation
- Privacy and security notes
- Form validation (Israeli ID format)

**Access:** `/profile`

---

## How It Works: The Zero-Touch Flow

### Step 1: User Reports Incident
```
User presses "Panic Button" → Incident logged with GPS + timestamp
```

### Step 2: System Aggregates Claims
```
3+ incidents → Auto-create claim → Calculate compensation amount
```

### Step 3: Generate Legal Document
```
AI generates PDF warning letter using GPT-4 + legal templates
```

### Step 4: Smart Routing (NEW!)
```typescript
const method = await getSubmissionMethod(claim.bus_company)

if (method === 'email') {
  // Send email with PDF attachment
  // BCC: Pniotcrm@mot.gov.il
  await submitViaEmail(...)
}
else if (method === 'web_form') {
  // Use Puppeteer to fill form
  // Screenshot confirmation
  // Email Ministry separately
  await submitViaWebForm(...)
}
else {
  // Manual submission required
  // Notify admin
}
```

### Step 5: Ministry Reporting (MANDATORY)
```
EVERY submission → BCC: Pniotcrm@mot.gov.il
Log: ministry_notified = TRUE
Audit trail in legal_submissions table
```

### Step 6: Track & Retry
```
Monitor delivery status
Auto-retry on failure (max 3 times)
Update user on progress
```

---

## Database Deployment

### Run SQL Migration

1. Open Supabase Dashboard SQL Editor
2. Run the migration file:

```bash
# File: supabase/zero-touch-automation.sql
```

This will:
- ✅ Create `bus_companies` table
- ✅ Create `legal_submissions` table
- ✅ Update `profiles` table with address fields
- ✅ Set up RLS policies
- ✅ Create indexes for performance
- ✅ Add triggers for updated_at
- ✅ Insert seed data (9 bus companies)

### Verify Installation

Run these queries in SQL Editor:

```sql
-- Check bus_companies
SELECT company_name, public_contact_email, requires_form_automation
FROM bus_companies
ORDER BY company_name;

-- Check profiles structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('id_number', 'home_address', 'city');

-- Test submission method function
SELECT company_name, get_company_submission_method(company_name) AS method
FROM bus_companies;
```

---

## Next Steps: Production Deployment

### 1. Install Email Service (CRITICAL)

```bash
npm install resend
```

Get API key from: https://resend.com

Add to `.env.local`:
```
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

Uncomment code in: `app/api/send-legal-email/route.ts`

### 2. Install Web Automation (OPTIONAL but recommended)

```bash
npm install puppeteer
```

Uncomment code in: `app/api/submit-web-form/route.ts`

**Note:** Puppeteer requires additional setup for production (headless Chrome in Docker)

### 3. Configure Company-Specific Form Selectors

Edit `app/api/submit-web-form/route.ts` to add CSS selectors for each company's form:

```typescript
const formSelectors = {
  'אגד': {
    name: '#fullName',
    id: '#idNumber',
    phone: '#phoneNumber',
    // etc...
  },
  // Add more companies
}
```

### 4. Set Up Email Domain

Configure SPF/DKIM records for `cashbus.co.il`:
- From: `legal@cashbus.co.il`
- Reply-To: `support@cashbus.co.il`

### 5. Test Ministry Email

Send test email to: `Pniotcrm@mot.gov.il`

Verify they receive it and it doesn't bounce.

### 6. Create Admin User

Run in Supabase SQL Editor:

```sql
-- Replace with your admin email
INSERT INTO admin_users (id, email, role, can_approve_claims)
SELECT id, email, 'super_admin', true
FROM auth.users
WHERE email = 'admin@cashbus.co.il';
```

### 7. Update Navigation

Add links to new pages in your app:

```tsx
// In navigation menu
<Link href="/profile">הגדרות פרופיל</Link>
<Link href="/admin/companies">ניהול חברות</Link>
```

---

## Security Considerations

### ✅ What We're Doing Right

1. **Ministry Transparency** - All submissions BCC'd to government
2. **RLS Policies** - Users can only see their own data
3. **Admin-Only Access** - Company management restricted to admins
4. **Encryption** - ID numbers should be encrypted at rest (TODO)
5. **Audit Trail** - All submissions logged in `legal_submissions`

### ⚠️ Important Warnings

1. **ID Numbers** - Consider encrypting in production
2. **PDF Storage** - Ensure proper access controls on Supabase Storage
3. **Email Rate Limits** - Monitor Resend usage
4. **Web Automation** - May break if companies change forms
5. **Ministry Email** - NEVER skip BCC - it's legally required

---

## Testing Checklist

### Before Going Live:

- [ ] Run SQL migration in Supabase
- [ ] Verify all 9 companies inserted
- [ ] Install Resend and test email sending
- [ ] Send test email to Ministry (verify delivery)
- [ ] Test profile form (ID validation)
- [ ] Test admin companies page
- [ ] Create test submission (email method)
- [ ] Verify BCC to Ministry works
- [ ] Check submission tracking in database
- [ ] Test retry logic for failed submissions
- [ ] Install Puppeteer (optional)
- [ ] Test web form automation (Egged)
- [ ] Verify screenshot capture
- [ ] Check all RLS policies work
- [ ] Test with real user account

---

## File Structure

```
CashBus/
├── supabase/
│   └── zero-touch-automation.sql          # Database schema
├── lib/
│   ├── supabase.ts                        # Updated types
│   └── legalSubmissions.ts                # Smart submission service
├── app/
│   ├── api/
│   │   ├── send-legal-email/route.ts      # Email API
│   │   └── submit-web-form/route.ts       # Web automation API
│   ├── admin/
│   │   └── companies/page.tsx             # Admin UI
│   └── profile/page.tsx                   # User profile settings
└── ZERO_TOUCH_IMPLEMENTATION.md           # This file
```

---

## API Reference

### Submit Legal Document (Orchestrator)

```typescript
import { submitLegalDocument } from '@/lib/legalSubmissions'

const result = await submitLegalDocument({
  claim: claimData,
  profile: userData,
  pdfUrl: 'https://storage.supabase.co/...',
  pdfFilename: 'warning-letter.pdf'
})

// Returns:
{
  success: true,
  submissionId: 'uuid',
  method: 'email' | 'web_form' | 'manual',
  error?: string
}
```

### Get Submission Status

```typescript
import { getSubmissionById } from '@/lib/legalSubmissions'

const submission = await getSubmissionById(submissionId)

console.log(submission.submission_status) // 'sent', 'delivered', 'failed', etc.
console.log(submission.ministry_notified) // true/false
```

---

## Environment Variables

Required for production:

```env
# Email Service
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# Site URL (for callbacks)
NEXT_PUBLIC_SITE_URL=https://cashbus.co.il
```

---

## Support & Troubleshooting

### Common Issues

**1. Email not sending**
- Check Resend API key
- Verify domain DNS records
- Check rate limits

**2. Ministry not receiving BCC**
- Verify email address: `Pniotcrm@mot.gov.il`
- Check spam folder
- Verify BCC in email headers

**3. Form automation failing**
- Company changed form structure
- Update CSS selectors
- Check Puppeteer headless mode

**4. Profile validation errors**
- Israeli ID must be 9 digits
- Address fields are required
- Phone format validation

---

## Future Enhancements

### Phase 5 Ideas:

1. **Email Read Receipts** - Track when companies open emails
2. **Automatic Response Parsing** - AI reads company responses
3. **Court Filing Automation** - Auto-file in small claims court
4. **SMS Notifications** - Alert users on submission status
5. **WhatsApp Integration** - Send confirmations via WhatsApp
6. **Multi-Language** - Support English and Arabic
7. **PDF Signing** - Digital signatures on legal docs
8. **Company API Integration** - Direct API calls (if available)

---

## Legal Compliance

### Ministry Reporting Requirement

**Law:** תקנות התעבורה (הובלה בתחבורה ציבורית)
**Requirement:** All legal correspondence with bus companies must be reported to Ministry of Transport
**Implementation:** BCC to `Pniotcrm@mot.gov.il` on every submission
**Audit:** Tracked in `legal_submissions.ministry_notified` field

### Data Protection

**GDPR/Privacy Law Compliance:**
- ID numbers collected only for legal purposes
- Clear consent in profile form
- Data encryption recommended
- Audit trail of all access
- User can delete data (GDPR right to erasure)

---

## Success Metrics

Track these KPIs:

- **Automation Rate:** % of submissions sent automatically (target: >80%)
- **Ministry Reporting:** 100% compliance (MANDATORY)
- **Email Delivery Rate:** % of emails successfully delivered (target: >95%)
- **Form Submission Success:** % of web forms completed (target: >70%)
- **User Profile Completion:** % of users with full address (target: >90%)
- **Response Time:** Time from claim creation to submission (target: <24h)

---

## Conclusion

The Zero-Touch Automation System is now ready for deployment! 🚀

**What's Working:**
- ✅ Database schema with company data
- ✅ Smart routing logic (email vs form)
- ✅ Ministry reporting (BCC on all submissions)
- ✅ User profile collection
- ✅ Admin company management
- ✅ API endpoints (mock mode)

**To Enable Full Automation:**
1. Install Resend for email
2. Install Puppeteer for web forms
3. Configure company-specific selectors
4. Test with real submissions
5. Monitor and iterate

**Questions?** Check the code comments or contact the development team.

---

**Last Updated:** 2026-01-05
**Version:** 1.0.0
**Status:** ✅ Ready for Testing
