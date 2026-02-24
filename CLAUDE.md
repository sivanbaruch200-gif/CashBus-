# CLAUDE.md - CashBus Project Memory

## Project Overview
**Description:** CashBus is a Legal-Tech platform for automating compensation claims in public transportation in Israel.

**Vision:** Making legal justice accessible to public transport passengers through automation of documentation (SIRI/GPS) and AI-based demand letter generation.

## Design Principles
- **Design Concept:** Clean, reliable, modern interface
- **Primary Colors:** Orange (#FF8C00) and White
- **Accent Colors:** Navy Blue for trust elements
- **Language:** Full Hebrew (RTL - Right to Left)
- **UI Philosophy:** Minimalist, user-friendly, fast interactions

## Target Audience
- Students
- Soldiers
- Elderly population
- Low socio-economic status individuals
- Regular commuters (800M trips/year in Israel)

## Core Problem & Solution
**Problem:** Public transportation companies exploit bureaucratic complexity to avoid compensating passengers for delays and missed trips.

**Solution:** Platform that:
1. Documents incidents in real-time (legal evidence)
2. Automates warning letter generation via AI
3. Manages "multiple cases" model - aggregating small delays into substantial claims (800-11,000 NIS)

## Key Features
### Evidence Engine
- **Data Sources:** Real-time API (Ministry of Transportation/GTFS-RT) + User GPS
- **User Action:** "Panic" button at station - "bus didn't arrive/didn't stop"
- **Verification:** Cross-reference user location with bus GPS data
- **Output:** Digitally signed 'fault ticket'

### Business Model (Updated)
1. **Freemium:** Free event documentation (no upfront payment)
2. **Success Fee Model (80/20):**
   - Customer pays NOTHING upfront
   - Upon receiving compensation: 80% to customer, 20% to CashBus
   - Compensation transferred to CashBus account first, then 80% forwarded to customer
3. **Payment Collection:** CashBus bank account receives all compensation payments

### Legal Guidelines (From Lawyer Consultations - Updated 2026-02-17)
**Key Principles:**
- System generates letters based on USER-PROVIDED information = legitimate
- User clicks "Send" = user is the sender, not CashBus
- CashBus is a **technology platform**, NOT a law firm
- No unauthorized practice of law (הסגת גבול המקצוע)
- **Lawyer clarified:** If CashBus sells a "letter drafting service" = could be unauthorized practice.
  If CashBus offers a subscription to an app/software that generates letters from USER-INPUT data = boundary is blurred (favorable for CashBus)
- **Same applies to lawsuit drafts** - app generates PDF, USER files it themselves

**Demand Letter Guidelines:**
- **Deadline:** 21 days (not 2 days) - more reasonable for response
- **Content:** "במכתב אפשר לכתוב מה שרוצים" - no legal restrictions on demand letter content
- **Compensation amounts:** No fixed amount in law for breach of contract (bus not arriving).
  Can base demands on transportation regulations (תקנות 428ג, 399א) + interest escalation
- **DO NOT specify amounts as if from regulation** - there is no regulation specifying amounts
- **Threat Strategy:** Threaten to report to Ministry of Transportation (משרד התחבורה)
  - DO NOT actually send complaints to Ministry
  - Keep it as a THREAT in the letter, don't actually contact the regulator
  - Ministry doesn't handle compensation - only courts do
- **Reminders:** Weekly/biweekly reminders (NOT every 2 days - that's excessive and could be considered harassment)

**Legal Precedent:**
- Case: תק (י-ם) 5312/07 (Jerusalem Small Claims Court, 31.03.2008)
- Ruling: 2,000 NIS compensation for train delay
- Key Quote: "הקפדה על לוח זמנים היא אינטרס לאומי" (adherence to schedule is national interest)
- Note: District Court ruled differently in 2008 regarding rail - Supreme Court hasn't decided
- **Application:** Precedent can be cited for buses as well (same principle)

**Incident Types:**
- Bus delay (איחור)
- Bus didn't arrive (לא הגיע)
- Bus didn't stop (לא עצר) - NEW: Need to add detection logic

### Legal Automation
- **Delay Log:** Accumulates incidents per company
- **Threshold Alerts:** Notifies when user has grounds for claim (e.g., 3 delays = X NIS potential)
- **AI Drafting:** LLM-powered (GPT-4) legal document generation using precedents and current law

## Technical Stack
- **Frontend:** Next.js 14 + React + Tailwind CSS
- **Database:** Supabase (PostgreSQL + Auth)
- **AI Engine:** GPT-4 for legal document generation
- **APIs:**
  - SIRI/GTFS-RT (Ministry of Transportation)
  - OpenBus Stride API (real-time vehicle locations)
- **Geolocation:** Professional GPS engine with accuracy tracking
- **Edge Functions:** Supabase Edge Functions for GTFS automation

## Competitive Advantage
- **vs. Moovit/Pango:** They provide info only; we recover money
- **vs. "15 Minutes":** They advocate policy change; we execute claims
- **Unique Value:** Real-time legal documentation + AI automation + aggregated claims model

## Current Status
- **Phase:** 4 - Legal Automation & Admin System
- **Last Updated:** 2026-02-20
- **Status:** In Progress - Payment/Subscription/Points system implemented, awaiting Stripe Price ID config

## Recent Updates (2026-02-20)
### Payment / Subscription / Points System - Completed:
**Phase A (Payments):**
- ✅ `lib/commissionService.ts` - 20% commission, reversed payment flow
- ✅ `lib/collectionWorkflow.ts` - 80/20 split emails
- ✅ `app/api/admin/record-payment/route.ts` + `confirm-payout/route.ts`
- ✅ `app/admin/claims/[id]/page.tsx` - 3-step payment UI
- ✅ `supabase/migrations/payment_overhaul_v1.sql` - Run in DB ✓
- ✅ `supabase/migrations/add_bank_details_to_templates.sql` - Run in DB ✓

**Phase B (Subscriptions):**
- ✅ `supabase/migrations/add_subscriptions.sql` - Run in DB ✓
- ✅ `lib/subscriptionService.ts`
- ✅ `app/api/stripe/create-subscription/route.ts`
- ✅ `components/SubscriptionGate.tsx`
- ✅ `app/subscription/page.tsx`
- ⚠️ **MISSING:** Add `STRIPE_SUBSCRIPTION_PRICE_ID=price_xxx` to `.env.local`
- ⚠️ **MISSING:** Add subscription Stripe webhook events in Dashboard

**Phase C (Points/Loyalty):**
- ✅ `supabase/migrations/add_points_system.sql` - **NEEDS to be run in DB**
- ✅ `lib/pointsService.ts`
- ✅ `app/api/points/daily-login/route.ts`
- ✅ `components/PointsBadge.tsx` - Add to headers as needed
- ✅ `components/DailyLoginReward.tsx` - Add to authenticated pages
- ✅ `app/subscription/page.tsx` - Points redemption section added

### Points System Rules:
- 10 pts per incident, 50 pts per claim, 5 pts daily login + streak bonus (max 30/day)
- 300 pts = 1 free month subscription
- Streak resets if user skips a day

## Previous Updates (2026-02-17)
### PDF Hebrew Rendering - Fixed & Deployed:
1. ✅ **Hebrew font** - Noto Sans Hebrew loaded from `public/fonts/NotoSansHebrew-Regular.ttf`
2. ✅ **processRTL()** - Fixed: simple full reversal + bracket mirroring (removed broken LTR re-reversal that caused numbers to display backwards)
3. ✅ **Professional PDF layout** - Header + separator + footer with Ref ID + page numbers
4. ✅ **Letter Queue real data** - Fetches actual incident data instead of hardcoded values
5. ✅ **submissionId fix** - Corrected claimId → submissionId for email logging
6. ⏳ **Test PDF endpoint** - `app/api/test-pdf-email/route.ts` exists for testing (DELETE after verification)
7. ⏳ **Awaiting verification** - Need to test that RTL fix actually displays correctly

### Template Updates Needed (Based on Lawyer Feedback):
- **Remove specific compensation amounts** from lawsuit_draft template (אין תקנה בנוגע לסכום)
- **Update reminder frequency** from every 2 days to weekly/biweekly
- **Rephrase demand basis** - reference regulations + interest, not specific NIS amounts

## Previous Updates (2026-02-14)
### Visual Refactor (Dark Theme) - Completed:
All 16+ files migrated from old Tailwind classes (bg-white, text-gray-*, bg-orange-*) to new dark theme design tokens (bg-surface-raised, text-content-primary, bg-accent, etc.). Tokens defined in `tailwind.config.js` and `globals.css`.

### Build Fixes - Completed:
1. ✅ **Auth route conflict** - Deleted `app/auth/route.ts` (conflicted with `app/auth/page.tsx`), created proper `app/auth/callback/page.tsx` for magic link OTP flow
2. ✅ **Missing supabase exports** - Added all missing types and functions to `lib/supabase.ts`:
   - Types: `Incident`, `Claim`, `ParentalConsent`, `BusCompany`, `LegalSubmission`
   - Functions: `updateIncidentToClaimed`, `adminUpdateIncidentStatus`, `adminMarkIncidentPaid`, `uploadPDFDocument`, `getUserIncidents`, `getUserClaims`, `getAllIncidentsForAdmin`, `getAdminStatistics`, `getParentalConsentByToken`, `submitParentalConsent`
3. ✅ **isUserAdmin** - Updated to work with or without userId parameter (fetches from session if not provided)
4. ✅ **createIncidentWithPhoto** - Updated to handle photo and receipt file uploads to Supabase Storage
5. ✅ **Profile type** - Extended with `home_address`, `city`, `postal_code`, `total_incidents`, `total_claims`, `total_received`, `total_potential`
6. ✅ **LegalSubmission type** - Extended with all automation/email/form tracking fields

### Previous Updates (2026-02-06):
### Bug Fixes Completed:
1. ✅ **Scale icon import** - Added missing import in `app/admin/claims/[id]/page.tsx`
2. ✅ **Payment Modal** - Added `showPaymentModal` state and full modal UI for payment registration
3. ✅ **Email Sending in Letter Queue** - Connected `handleSendEmail` to actual API:
   - Generates PDF → Uploads to Storage → Calls `/api/send-legal-email`
   - Added missing `generateWarningLetterPDF`, `WarningLetterFilename`, `WarningLetterData` to pdfGenerator
4. ✅ **Created /api/send-email** - New endpoint for simple text emails (used by collectionWorkflow.ts)

### Legal Consultation (Sent to Lawyer):
Questions sent regarding:
1. עמלת הצלחה - האם דורש רישיון?
2. ראיות GPS+SIRI - בסיס משפטי?
3. איחוד תביעות של משתמשים שונים
4. תנאי שימוש - נוסח מקובל?
5. רישום מאגרי מידע - חובה?

**Status:** ממתינים לתשובה מעורכת הדין

## Phase Progress
- ✅ **Phase 1:** Infrastructure Setup and Initial Design - Completed
- ✅ **Phase 2:** Evidence & Reporting Upgrade - Completed
- ✅ **Phase 3:** Advanced UX & Case Management - Completed
- ✅ **Phase 3.5:** Infrastructure Upgrade - Completed
  - Professional GPS Engine with accuracy tracking
  - GTFS Data Automation (Edge Function + Cron)
  - OpenBus Stride API integration (real-time SIRI data)
  - Automated incident verification logic
  - **Real-Time Data Validation System**
- 🔄 **Phase 4:** Legal Automation (AI Letters) - In Progress
  - ✅ Admin panel for claims management
  - ✅ Letter queue with email sending
  - ✅ PDF generation from templates
  - ✅ Payment tracking modal
  - ⏳ Legal review of Terms of Service
  - ⏳ Privacy policy finalization

## New Infrastructure (Phase 3.5)

### Data Validation System (STRICT - No Guessing)
**Critical:** All validation uses RAW data only. No AI estimation or guessing allowed.

#### Validation Flow:
1. **GPS Capture** → Raw coordinates + accuracy from device
2. **Station Validation** → Cross-check against `gtfs_stops` (300m radius)
3. **SIRI Validation** → Real-time bus position from Stride API
4. **Evidence Chain** → All timestamps and data sources displayed

#### API Endpoints:
- `app/api/validate-location/route.ts` - GPS vs GTFS stops (Haversine, 300m)
- `app/api/validate-siri/route.ts` - Real-time bus verification via Stride

#### User Feedback Messages:
- **Station Found (Green):** "מיקום אומת: תחנת [שם התחנה]"
- **No Station (Red):** "לא זוהתה תחנה בקרבת מקום על פי נתוני לוויין"
- **Bus Not Found (Green):** "אימות דיגיטלי הושלם: האוטובוס לא נמצא במערכת SIRI"
- **Bus Found (Orange):** "נתוני SIRI מראים שהאוטובוס עבר או נמצא בקרבת התחנה"

### Professional GPS Engine
- `components/PanicButton.tsx` - Enhanced with:
  - `enableHighAccuracy: true` for precise location
  - `timeout: 10000` (10 seconds)
  - `maximumAge: 0` (always fresh position)
  - Error handling with Hebrew messages
  - Accuracy display (מעולה/טוב/סביר)
  - **4-Step Flow:** Button → GPS → Station Validation → Form

### GTFS Data Automation
- `lib/gtfsService.ts` - GTFS data processing
- `supabase/functions/gtfs-update/index.ts` - Daily Edge Function
- `supabase/gtfs-tables.sql` - Database schema for routes/stops
- `GTFS_DEPLOYMENT_GUIDE.md` - Deployment instructions
- Cron job: Runs daily at 3:00 AM

### OpenBus Stride API
- `lib/strideService.ts` - Real-time SIRI data service
- Base URL: `https://open-bus-stride-api.hasadna.org.il`
- Endpoints: `/siri_vehicle_locations/list`, `/gtfs_stops/list`
- Operator mapping for all Israeli bus companies

### Verification Service
- `lib/verificationService.ts` - Core verification logic
- `app/api/verify-incident/route.ts` - API endpoint
- `supabase/verification-schema.sql` - Schema updates
- Auto-verification with confidence levels (high/medium/low)

## Deployment Checklist
1. Run `supabase/gtfs-tables.sql` in SQL Editor
2. Deploy Edge Function: `supabase functions deploy gtfs-update`
3. Trigger initial load: `curl -X POST .../functions/v1/gtfs-update`
4. Verify: `SELECT COUNT(*) FROM gtfs_stops;` (should be ~25,000+)
5. Set up cron job for daily updates

## Legal Pages (NEW)
- **Terms of Service:** `app/terms/page.tsx` - Full terms including 80/20 model
- **Privacy Policy:** `app/privacy/page.tsx` - Data collection & handling

## Lawyer Consultation Results (2026-02-17)
**Status:** ✅ תשובות התקבלו מעורך הדין

### Questions & Answers:
1. **הסגת גבול המקצוע (Unauthorized Practice):**
   - ✅ אם המערכת מציעה מינוי לאפליקציה שמייצרת מכתבים מנתוני המשתמש → הגבול מטשטש (בסדר)
   - ⚠️ אם מוכרים "שירות עריכת מכתב בשם הלקוח" → זה יכול להיחשב הסגת גבול
   - **מסקנה:** CashBus = פלטפורמת טכנולוגיה, לא שירות משפטי

2. **נקיבת סכום פיצוי:**
   - ✅ "במכתב אפשר לכתוב מה שרוצים אין חוקיות"
   - ⚠️ אין בחוק סכום פיצוי קבוע - לא לכתוב סכומים כאילו יש תקנה ספציפית
   - **מסקנה:** להסיר סכום ספציפי מהתבניות, לבסס על תקנות + ריבית

3. **תזכורות אוטומטיות:**
   - ❌ כל יומיים = מוגזם, עלול להיחשב הטרדה
   - ✅ שבוע/שבועיים = סביר
   - **מסקנה:** לעדכן תדירות תזכורות ל-7 ימים minimum

4. **גוף היעד למכתב:**
   - ✅ אין חובה חוקית לשלוח לגוף ספציפי
   - ✅ פנייה לגוף רגולטורי = מנוף לחץ טוב
   - **מסקנה:** להשאיר כאיום במכתב, לא לשלוח בפועל למשרד התחבורה

5. **כתב תביעה PDF:**
   - ✅ אותו עיקרון כמו סעיף 1 - האפליקציה מייצרת, המשתמש מגיש בעצמו
   - **מסקנה:** זה בסדר, כל עוד המשתמש הוא שמגיש

### Still pending (not yet sent):
- מכתב התראה במייל vs. דואר רשום
- הסכמת הורים לקטינים - נוסח נדרש
- ביטוח אחריות מקצועית

## Related Documents
- [Master Plan](MASTER_PLAN.md)
- [Phase 1 Setup Plan](plans/phase-1-setup.md)
- [Phase 2 Summary](PHASE_2_SUMMARY.md)
- [Phase 3 Summary](PHASE_3_SUMMARY.md)
- [GTFS Deployment Guide](GTFS_DEPLOYMENT_GUIDE.md)
- [Storage Setup Guide](STORAGE_SETUP.md)
- [Context](CONTEXT.md)
- [Terms of Service](app/terms/page.tsx)
- [Privacy Policy](app/privacy/page.tsx)
- [Legal Questions for Lawyer](docs/LAWYER_QUESTIONS_FOCUSED.md) - שאלות לעורכת דין
