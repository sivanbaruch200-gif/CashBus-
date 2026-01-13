# CashBus PDF Generator Setup Guide

## ✅ Phase 4: Legal Letter Generator - COMPLETE

This document explains the PDF generation system that was built for CashBus admin interface.

---

## 🎯 What Was Built

A complete **Legal Warning Letter Generator** that allows admins to:
1. Generate professional Hebrew RTL PDF legal documents
2. Upload PDFs to Supabase Storage automatically
3. Track all generated documents in the database
4. Download PDFs instantly
5. Update claim status to "claimed" automatically

---

## 📦 Installed Packages

```bash
npm install jspdf file-saver
```

- **jsPDF**: PDF generation library
- **file-saver**: Client-side file download utility

---

## 📁 Files Created/Modified

### 1. **lib/pdfGenerator.ts** - PDF Generation Utility
**Purpose:** Core PDF generation logic with Hebrew RTL support

**Key Functions:**
- `generateWarningLetterPDF(data)` - Main PDF generation function
- `downloadPDF(blob, filename)` - Download PDF to user's device
- `generateWarningLetterFilename()` - Create unique filename

**Features:**
- ✅ Full Hebrew RTL text support
- ✅ Professional legal document layout
- ✅ CashBus branding (orange header)
- ✅ Legal citations (תקנה 428ז)
- ✅ Automatic compensation calculation
- ✅ Customer and incident details
- ✅ Damage description and amounts
- ✅ Payment demand notice
- ✅ Warning of legal action
- ✅ Document reference number
- ✅ A4 format, portrait orientation

**PDF Structure:**
```
┌─────────────────────────────────────┐
│ [LOGO] CashBus    Contact Details   │
├─────────────────────────────────────┤
│         מכתב התראה                  │
│  לפי תקנה 428ז לתקנות השירותים      │
├─────────────────────────────────────┤
│ Date: [תאריך]                       │
│ To: [חברת אוטובוס]                  │
│ Subject: תביעה לפיצוי               │
├─────────────────────────────────────┤
│ Customer Details                     │
│ - Name, ID, Phone, Address           │
├─────────────────────────────────────┤
│ Incident Description                 │
│ - Date, Time, Location               │
│ - Type of incident                   │
│ - GPS verification                   │
├─────────────────────────────────────┤
│ Damage Details (if any)              │
│ - Type, Amount, Description          │
├─────────────────────────────────────┤
│ Legal Basis                          │
│ - תקנה 428ז                          │
│ - חוק הגנת הצרכן                     │
│ - Court precedents                   │
├─────────────────────────────────────┤
│ ┌───────────────────────────────┐   │
│ │   Compensation Calculation    │   │
│ │   Base: XX ₪                  │   │
│ │   Damage: XX ₪                │   │
│ │   ═══════════════             │   │
│ │   Total: XXX ₪                │   │
│ └───────────────────────────────┘   │
├─────────────────────────────────────┤
│ Payment Demand                       │
│ - 7 days to pay                      │
│ - Bank transfer or cash              │
├─────────────────────────────────────┤
│ ┌───────────────────────────────┐   │
│ │   ⚠ WARNING                   │   │
│ │   If not paid within 7 days,  │   │
│ │   legal action will be taken. │   │
│ └───────────────────────────────┘   │
├─────────────────────────────────────┤
│ בכבוד רב,                           │
│ [Customer Name]                      │
│ באמצעות פלטפורמת CashBus             │
├─────────────────────────────────────┤
│ Reference: [Document ID]             │
└─────────────────────────────────────┘
```

---

### 2. **lib/supabase.ts** - Storage & Database Functions
**Added Functions:**

```typescript
// Upload PDF to Supabase Storage
uploadPDFDocument(pdfBlob, filename, folder)

// Update document record with file info
updateDocumentGenerationFile(documentId, filePath, fileUrl, fileSize)

// Get incident data for PDF generation
getIncidentForPDF(incidentId)

// Update incident status to 'claimed'
updateIncidentToClaimed(incidentId)
```

---

### 3. **app/admin/claims/[id]/page.tsx** - Admin Detail Page
**Modified to include:**

**New State:**
```typescript
const [generatingPDF, setGeneratingPDF] = useState(false)
const [pdfGenerated, setPdfGenerated] = useState(false)
const [pdfUrl, setPdfUrl] = useState<string | null>(null)
const [pdfError, setPdfError] = useState<string | null>(null)
```

**Main Handler:**
```typescript
handleGenerateWarningLetter() - Async function that:
  1. Calculates compensation
  2. Generates PDF
  3. Creates database record
  4. Uploads to Storage
  5. Updates incident status
  6. Downloads to user
  7. Shows success message
```

**UI Components:**
- Smart button with loading state
- Success notification banner (green)
- Error notification banner (red)
- Download link for generated PDF
- Status-aware button text

---

## 🗄️ Database Schema

### Tables Used:

#### 1. **document_generations**
Tracks all generated PDFs:
```sql
- id: UUID (primary key)
- claim_id: UUID (references incidents)
- document_type: 'warning_letter' | 'formal_claim' | 'court_filing'
- template_used: TEXT
- file_path: TEXT (path in storage)
- file_url: TEXT (public URL)
- file_size_bytes: INTEGER
- generated_by: UUID (admin user ID)
- generation_method: 'automatic' | 'manual'
- status: 'generated' | 'sent' | 'delivered'
- created_at: TIMESTAMPTZ
```

#### 2. **incidents**
Updated with:
```sql
- status: Changed to 'claimed' after PDF generation
```

---

## ☁️ Supabase Storage Setup

### Bucket Configuration

**Name:** `documents`
**Public:** Yes (for downloadable PDFs)
**File Size Limit:** 50 MB
**Allowed MIME Types:** `application/pdf`

### Folder Structure:
```
documents/
├── legal_documents/
│   ├── warning_letter_[name]_[date]_[id].pdf
│   ├── warning_letter_[name]_[date]_[id].pdf
│   └── ...
├── court_filings/
│   └── (future)
└── settlements/
    └── (future)
```

### Storage Policies (RLS):

1. **Allow Authenticated Uploads**
   - Operation: INSERT
   - Definition: `auth.role() = 'authenticated'`

2. **Allow Public Read**
   - Operation: SELECT
   - Definition: `true` (anyone can download via link)

3. **Allow Admin Delete**
   - Operation: DELETE
   - Definition: `EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())`

---

## 🔧 Setup Instructions

### 1. Admin User Setup

Run this SQL in Supabase SQL Editor:

```sql
-- Add admin user
INSERT INTO admin_users (id, email, role, can_approve_claims, can_generate_letters, can_view_all_users)
SELECT
  id,
  email,
  'super_admin',
  true,
  true,
  true
FROM auth.users
WHERE email = 'sivan.baruch200@gmail.com'
ON CONFLICT (email) DO UPDATE SET
  role = 'super_admin',
  can_approve_claims = true,
  can_generate_letters = true,
  can_view_all_users = true;
```

**File:** `supabase/add-admin-user.sql`

### 2. Storage Bucket Setup

**Option A: Via Supabase Dashboard**
1. Go to Storage section
2. Click "Create Bucket"
3. Name: `documents`
4. Public: ✅ (checked)
5. File size limit: 50 MB
6. Create bucket

**Option B: Via SQL (if supported)**
```sql
-- See: supabase/setup-storage.sql
```

**File:** `supabase/setup-storage.sql`

### 3. Test the System

1. Navigate to: `http://localhost:3001/admin/claims`
2. Click on any incident
3. Click "יצא מכתב התראה" button
4. Wait for PDF generation (2-3 seconds)
5. PDF will:
   - Download automatically
   - Save to Supabase Storage
   - Create database record
   - Update incident status

---

## 🎨 UI/UX Features

### Button States:

**Before Generation:**
```
[ 📄 יצא מכתב התראה ]  (Blue, clickable)
```

**During Generation:**
```
[ ⏳ מייצר מכתב... ]  (Gray, disabled, spinner)
```

**After Generation:**
```
[ ✅ מכתב נוצר ]  (Gray, disabled)
[ ⬇️ הורד מכתב ]  (Green, download link)
```

### Success Banner:
```
┌───────────────────────────────────────────┐
│ ✅ מכתב התראה נוצר בהצלחה!                │
│ המכתב המשפטי נשלח אוטומטית למחשב שלך       │
│ ונשמר במערכת.                              │
│                                            │
│ 🔗 צפה או הורד שוב את המכתב               │
└───────────────────────────────────────────┘
```

### Error Banner:
```
┌───────────────────────────────────────────┐
│ ⚠️ שגיאה ביצירת מכתב                     │
│ [Error message]                            │
│                                        [✕] │
└───────────────────────────────────────────┘
```

---

## 🔄 Complete Workflow

```
User clicks "יצא מכתב התראה"
         ↓
Handler starts (setGeneratingPDF = true)
         ↓
Calculate compensation from incident data
         ↓
Generate PDF using jsPDF
         ↓
Create document_generation record in DB
         ↓
Upload PDF blob to Supabase Storage
         ↓
Update document_generation with file URL
         ↓
Update incident status to 'claimed'
         ↓
Download PDF to admin's computer
         ↓
Show success message + download link
         ↓
setGeneratingPDF = false
setPdfGenerated = true
setPdfUrl = [URL]
```

---

## 📊 Database Tracking

Every PDF generation creates a record:

```typescript
{
  id: "uuid-here",
  claim_id: "incident-uuid",
  document_type: "warning_letter",
  template_used: "default_warning_letter_template",
  file_path: "legal_documents/warning_letter_john_doe_2026-01-04_abc12345.pdf",
  file_url: "https://ltlfifqtprtkwprwwpxq.supabase.co/storage/v1/object/public/documents/legal_documents/...",
  file_size_bytes: 45678,
  generated_by: "admin-uuid",
  generation_method: "manual",
  status: "generated",
  created_at: "2026-01-04T10:30:00Z"
}
```

---

## 🧪 Testing Checklist

- [ ] Admin can access `/admin/claims/[id]`
- [ ] Button shows "יצא מכתב התראה"
- [ ] Click button shows loading spinner
- [ ] PDF downloads automatically
- [ ] Success banner appears
- [ ] Download link works
- [ ] Incident status updates to "claimed"
- [ ] Button disabled after generation
- [ ] PDF saved in Supabase Storage
- [ ] Document record created in DB
- [ ] Hebrew text displays correctly (RTL)
- [ ] Orange branding visible
- [ ] Legal citations included
- [ ] Compensation calculated correctly

---

## 🚀 Production Deployment Notes

### Environment Variables Required:
```env
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
```

### Storage Bucket Must Exist:
- Create `documents` bucket before deploying
- Set to public
- Configure RLS policies

### Admin Users:
- Add admin users to `admin_users` table
- Set appropriate permissions

---

## 📝 Future Enhancements

### Potential Additions:
1. **Email Integration** - Auto-send PDF to customer + bus company
2. **Digital Signature** - Add cryptographic signature to PDFs
3. **Template Editor** - Let admins customize letter templates
4. **Batch Generation** - Generate multiple letters at once
5. **Mail Tracking** - Track if PDFs were opened/read
6. **Custom Branding** - Upload custom logo per admin
7. **Multi-language** - Generate in English/Arabic
8. **Barcode/QR Code** - Add tracking codes to documents

---

## 🛠️ Troubleshooting

### PDF Not Generating?
- Check browser console for errors
- Verify jsPDF is installed: `npm list jspdf`
- Check incident has all required data

### Upload Failing?
- Verify Storage bucket exists: `documents`
- Check bucket is public
- Verify RLS policies are correct
- Check admin user has permissions

### Hebrew Text Issues?
- jsPDF has limited Hebrew support
- Text is right-aligned manually
- Font: Helvetica (has Hebrew glyphs)

### Download Not Working?
- Check popup blocker
- Verify `file-saver` is installed
- Try different browser

---

## 📚 Related Files

```
supabase/
├── add-admin-user.sql        # SQL to add admin
├── setup-storage.sql          # Storage bucket setup
└── phase-4-schema.sql         # document_generations table

lib/
├── pdfGenerator.ts            # PDF generation utility
├── supabase.ts                # Storage upload functions
└── compensation.ts            # Used for calculations

app/admin/claims/[id]/
└── page.tsx                   # Detail page with button
```

---

## ✅ Summary

**What Works:**
- ✅ Generate professional Hebrew legal PDFs
- ✅ Auto-upload to Supabase Storage
- ✅ Track in database
- ✅ Download to admin's device
- ✅ Update claim status
- ✅ Success/error notifications
- ✅ Smart button states

**Next Phase:**
- Workflow automation (trigger PDF generation automatically)
- Email integration
- Batch processing

---

**Last Updated:** 2026-01-04
**Phase:** 4 - Document Generation
**Status:** ✅ Complete
