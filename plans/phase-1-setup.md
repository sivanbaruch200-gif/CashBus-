# Phase 1: Infrastructure Setup and Initial Design

**Status:** 🔄 In Progress
**Phase Duration:** Foundation stage for CashBus platform
**Goal:** Establish technical foundation and create core UI components

---

## Overview
This phase focuses on setting up the technical infrastructure and designing the critical user-facing forms that will serve as the foundation for the CashBus platform.

---

## 1. User Interface - 3 Critical Forms

### 1.1 Login/Registration Form
**Status:** ⏳ Pending
**Priority:** High

**Requirements:**
- Minimalist design with orange (#FF8C00) and white color scheme
- User-friendly interface that explains the compensation process
- Clear value proposition: "How to get compensation for transportation delays"
- Collect only necessary information:
  - Full Name
  - Phone Number
  - Email Address
  - ID Number (for legal claims)
- Hebrew RTL support
- Mobile-first responsive design

**User Flow:**
1. Landing page with brief explanation (2-3 sentences)
2. Registration form
3. SMS/Email verification
4. Quick tutorial (3 screens max)

---

### 1.2 Quick Request Submission Form
**Status:** ⏳ Pending
**Priority:** High

**Requirements:**
- Ultra-fast form submission (< 30 seconds to complete)
- **Required Fields:**
  - Bus Line Number
  - Station Name (autocomplete)
  - Type of Issue:
    - ⏰ Delay (20+ minutes)
    - 🚫 Didn't stop at station
    - ❌ Didn't arrive at all
  - Date & Time (auto-filled, editable)
  - Bus Company (auto-detected from line number)

- **Optional Field:**
  - "Damage Incurred" (free text or predefined options):
    - 🚕 Taxi cost (amount field)
    - 💼 Lost workday
    - 🎓 Missed exam/class
    - 🏥 Medical appointment missed
    - Other (text field)

**Technical Notes:**
- GPS auto-capture on form open
- Station autocomplete using Ministry of Transportation database
- Photo upload option (bus number, station sign)
- Offline support - queue submissions when no connection

---

### 1.3 Status and Summary Form ("My Wallet")
**Status:** ✅ Completed (Dashboard with integrated widget)
**Priority:** High

**Design Requirements:**
- **"My Account" Widget (Top of Page):**
  - Savings account icon
  - **Amount Received:** Total compensation paid out (green, large number)
  - **Potential Compensation:** Pending claims total (orange, slightly smaller)
  - Visual progress indicator (received vs. potential)

- **Request Status List:**
  - Each request card shows:
    - Date of incident
    - Bus line and company
    - Claim amount
    - Status badge:
      - 🟡 Submitted
      - 🔵 Under Review
      - 🟢 Approved
      - 🔴 Rejected
      - ⚖️ In Legal Process
    - Action buttons (View Details, Upload Evidence)

- **Financial Summary:**
  - Monthly breakdown chart
  - Success rate percentage
  - Average compensation per claim

**Gamification Elements:**
- Achievement badges (e.g., "First Claim", "Justice Warrior")
- Progress towards next claim threshold
- Referral rewards tracking

---

## 2. Admin Dashboard - Management and Control

### 2.1 Admin Status Page
**Status:** ⏳ Pending
**Priority:** Medium

**Features:**
- **Central Client Table:**
  - Columns:
    - Client Name
    - Total Requests
    - Approved
    - Pending
    - Rejected
    - Total Compensation Won
    - Commission Earned (20%)
  - Sortable and filterable
  - Search functionality
  - Export to CSV/Excel

- **Business Metrics Panel:**
  - Total revenue (commission) - real-time updates
  - Monthly recurring revenue (MRR)
  - Active clients count
  - Average claim value
  - Success rate percentage

- **View Case Details:**
  - Click on client to see all their cases
  - Timeline view of each case progression
  - Document repository per case

---

### 2.2 Case Sorting Page
**Status:** ⏳ Pending
**Priority:** Medium

**Filtering Capabilities:**
- **By Bus Company:**
  - Egged
  - Kavim
  - Dan
  - Metropoline
  - Others
  - Purpose: Enable "group lawsuit" for same route/company

- **By Damage Category:**
  - Layoffs/Termination
  - Replacement taxi expenses
  - Missed appointments
  - Educational impact
  - Medical emergencies

- **By Legal Status:**
  - Warning letter sent
  - Awaiting company response
  - Ready for court filing
  - In litigation
  - Settled

**Bulk Actions:**
- Select multiple cases for group lawsuit
- Generate consolidated claim letter
- Mass status update
- Export selected cases

---

### 2.3 Claim Submission Page (Letter Generator)
**Status:** ⏳ Pending
**Priority:** High

**Functionality:**
- **Letter Template Selection:**
  - Warning letter (first contact)
  - Formal claim letter (pre-lawsuit)
  - Small claims court filing
  - Class action notice

- **Auto-Population:**
  - Client details
  - Incident details
  - Legal clauses (Regulation 428g)
  - Calculated compensation amount
  - Supporting evidence references

- **AI-Powered Generation:**
  - LLM integration (GPT-4)
  - Legal precedent database
  - Tone adjustment (formal/assertive)
  - Company-specific addressing

- **Workflow Definition:**
  - Admin configures: Incident → Warning → Claim → Court
  - Set automatic triggers (e.g., no response in 14 days → escalate)
  - Email/postal delivery scheduling
  - Follow-up reminders

**PDF Generation:**
- Professional legal document formatting
- Digital signature support
- Watermarking
- Track delivery and read receipts

---

## 3. Database Setup (Supabase)

### 3.1 Database Schema Design
**Status:** ⏳ Pending
**Priority:** High

**Tables:**

#### Users
```sql
- id (UUID, PK)
- email (unique)
- phone (unique)
- full_name
- id_number (encrypted)
- created_at
- last_login
- status (active/suspended)
```

#### Incidents
```sql
- id (UUID, PK)
- user_id (FK → Users)
- bus_line
- bus_company
- station_name
- station_gps_lat
- station_gps_lng
- incident_type (delay/no_stop/no_arrival)
- incident_datetime
- user_gps_lat
- user_gps_lng
- damage_type
- damage_amount
- photo_urls (array)
- verified (boolean)
- verification_data (JSON - API response)
- created_at
```

#### Claims
```sql
- id (UUID, PK)
- user_id (FK → Users)
- incident_ids (array of UUIDs)
- claim_amount
- status (submitted/approved/rejected/in_court)
- letter_sent_date
- response_received_date
- compensation_received_date
- compensation_amount
- commission_amount
- created_at
- updated_at
```

#### Legal_Documents
```sql
- id (UUID, PK)
- claim_id (FK → Claims)
- document_type (warning/claim/court_filing)
- pdf_url
- sent_date
- delivery_status
- created_at
```

#### Admin_Users
```sql
- id (UUID, PK)
- email
- role (super_admin/case_manager/legal_reviewer)
- created_at
```

---

## 4. Technical Setup

### 4.1 Project Initialization
**Status:** ✅ Completed
**Tasks:**
- [x] Set up React project structure
- [x] Configure Tailwind CSS with custom theme
- [x] Install dependencies (lucide-react icons, Supabase client setup)
- [x] Set up Next.js configuration with Hebrew i18n
- [x] Create TypeScript configuration

### 4.2 Custom Tailwind Configuration
**Status:** ✅ Completed

**Color Palette:**
```javascript
colors: {
  primary: {
    orange: '#FF8C00',
    navy: '#1E3A8A',
  },
  status: {
    pending: '#FCD34D',
    approved: '#10B981',
    rejected: '#EF4444',
    legal: '#6366F1',
  }
}
```

**RTL Configuration:**
- [x] Enable RTL direction globally
- [x] Configure Tailwind for Hebrew text support
- [x] Font: Assistant (Google Fonts - Hebrew support)

### 4.3 Component Library Setup
**Status:** ✅ Completed

**Base Components:**
- [x] Button (primary/secondary variants) - via Tailwind utility classes
- [x] Card - completed
- [x] Badge - completed (status badges)
- [ ] Input (text/number/date with RTL) - pending
- [ ] Select/Dropdown - pending
- [ ] Modal - pending
- [ ] Toast notifications - pending

---

## 5. Development Environment

### 5.1 Tools & Services
- **Code Editor:** VSCode
- **Version Control:** Git
- **Database:** Supabase (PostgreSQL)
- **Hosting:** TBD (Vercel/Netlify)
- **API Testing:** Postman/Insomnia

### 5.2 Development Workflow
1. Feature branch from `main`
2. Local development and testing
3. Code review
4. Merge to `main`
5. Deploy to staging
6. User testing
7. Production deployment

---

## 6. Completion Criteria

### Phase 1 Complete When:
- [x] Project documentation created (CLAUDE.md, MASTER_PLAN.md)
- [x] Main Dashboard UI functional with "My Account" widget
- [x] Dashboard components created:
  - [x] MyAccountWidget (savings display)
  - [x] PanicButton (incident reporting)
  - [x] StatusLight (GPS verification)
- [x] Hebrew RTL working throughout
- [x] Mobile-responsive design implemented
- [ ] All 3 user forms designed and coded (Login, Quick Submit - pending)
- [ ] Admin dashboard basic structure in place
- [ ] Supabase database schema implemented
- [ ] Basic routing between pages functional

---

## Next Steps (Phase 2 Preview)
- User authentication system
- Permission requests (GPS, camera, notifications)
- Onboarding tutorial flow
- Email verification system

---

## Document History
- **Created:** 2026-01-03
- **Last Updated:** 2026-01-03
- **Version:** 1.0
