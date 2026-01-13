# CashBus - Project Context (For Claude)

**Last Updated:** 2026-01-03
**Current Phase:** Phase 3 - Completed

---

## Quick Context Summary

CashBus is a Legal-Tech platform for automating compensation claims for Israeli public transportation passengers. It documents incidents (delays, no-shows) as legal evidence and calculates potential compensation based on Israeli Regulation 428g.

---

## What Has Been Built (Phases 1-3)

### ✅ Phase 1: Infrastructure
- Next.js + Tailwind setup
- Supabase database (5 tables with RLS)
- User authentication (signup/login/logout)
- Hebrew RTL throughout
- Orange (#FF8C00) and white design system
- Main dashboard with MyAccountWidget
- Basic panic button prototype

### ✅ Phase 2: Evidence & Reporting
- **Two-step reporting form:**
  - Step 1: GPS verification
  - Step 2: Detailed incident form (bus line, company, type, damage, photo)
- **Compensation calculation engine** ([lib/compensation.ts](lib/compensation.ts))
  - Real-time calculation based on incident type and damages
  - Legal basis: תקנה 428ז
  - Displays estimated ₪ amount
- **Photo upload to Supabase Storage**
  - Camera integration
  - Preview before submit
  - Stored in user-specific folders
- **Enhanced database operations**
  - `createIncidentWithPhoto()` function
  - Automatic profile stats updates
  - Photo URL storage in incidents table

### ✅ Phase 3: Advanced UX & Case Management (JUST COMPLETED)
- **My Claims Archive Page** ([app/claims/page.tsx](app/claims/page.tsx))
  - Two-column layout: list + details
  - Interactive Google Maps showing incident location
  - Photo evidence display
  - Detailed compensation breakdown with legal basis
  - Case metadata (company, line, type, date, status)
  - Click to select and view full case details
- **Enhanced Bus Company Dropdown**
  - 12 Israeli bus companies (Egged, Dan, Kavim, Metropoline, etc.)
  - Styled select with custom chevron
  - Focus states and transitions
- **Real-Time Statistics**
  - Dashboard calculates actual compensation from all incidents
  - Accurate total potential based on compensation engine
  - No static database values

---

## Current Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript
- **Styling:** Tailwind CSS (custom orange theme)
- **Database:** Supabase PostgreSQL
- **Storage:** Supabase Storage (for photos)
- **Auth:** Supabase Auth
- **Icons:** Lucide React
- **Language:** Hebrew (RTL)

---

## Database Schema

**Tables:**
1. `profiles` - User information and financial summary
2. `incidents` - Individual reported events (with GPS, photos)
3. `claims` - Aggregated compensation claims
4. `legal_documents` - Generated PDF letters
5. `admin_users` - Admin access control

**Storage Buckets:**
1. `incident-photos` - User-uploaded evidence (public read, RLS for write)

---

## Key Files & Their Purpose

### Components
- `components/PanicButton.tsx` - Two-step form with enhanced company dropdown
- `components/MyAccountWidget.tsx` - Shows received/potential compensation
- `components/StatusLight.tsx` - GPS verification status indicator

### Pages
- `app/page.tsx` - Main dashboard with real-time statistics
- `app/claims/page.tsx` - My Claims archive with map & photo evidence
- `app/auth/page.tsx` - Login/signup page
- `app/layout.tsx` - Root layout with Hebrew font

### Libraries
- `lib/supabase.ts` - Database helpers + photo upload functions
- `lib/compensation.ts` - Legal compensation calculation logic

### Config
- `supabase/schema.sql` - Database schema (run once in Supabase)
- `.env.local` - Environment variables (not in git)
- `tailwind.config.ts` - Custom colors and RTL

### Documentation
- `CLAUDE.md` - Project memory (this gets updated each phase)
- `MASTER_PLAN.md` - Overall roadmap
- `PHASE_2_SUMMARY.md` - Detailed Phase 2 accomplishments
- `PHASE_3_SUMMARY.md` - Detailed Phase 3 accomplishments
- `STORAGE_SETUP.md` - Supabase Storage configuration guide
- `CONTEXT.md` - This file - quick context for Claude
- `QUICK_START.md` - Developer onboarding

---

## What's NOT Done Yet (Future Phases)

### Phase 4: Legal Automation (Next Up)
- AI-powered warning letter generation (GPT-4)
- PDF document creation
- Email delivery to bus companies
- Claim aggregation (multiple incidents → single lawsuit)
- Admin dashboard for case management

### Phase 5: API Integration
- Ministry of Transportation SIRI/GTFS-RT API
- Real GPS-to-bus verification (currently simulated)
- Station name geocoding
- Automatic bus company detection from line number

---

## Common Development Tasks

### Adding a New Incident Field:
1. Update TypeScript interface in `lib/supabase.ts` (`Incident`)
2. Update database schema in Supabase (if persistent)
3. Add form field in `components/PanicButton.tsx`
4. Update `handleIncidentSubmit()` in `app/page.tsx`

### Modifying Compensation Logic:
1. Edit `lib/compensation.ts`
2. Update `calculateCompensation()` function
3. No other changes needed (auto-updates)

### Adding a New Page:
1. Create `app/new-page/page.tsx`
2. Import layout from `app/layout.tsx`
3. Add navigation link in `app/page.tsx`

---

## Important Constraints & Decisions

### Design
- **Only Hebrew** - No English UI elements
- **Orange primary** - #FF8C00 for all CTAs
- **RTL everything** - text-right, reversed icons
- **Mobile-first** - Most users on phones at bus stops

### Legal
- **GPS is evidence** - Must capture high-accuracy location
- **Photos are public** - Needed for sharing with courts/companies
- **Calculations transparent** - Must cite legal basis (תקנה 428ז)
- **No deletion** - Incidents can be hidden but not deleted (audit trail)

### Technical
- **Supabase RLS** - All tables have Row Level Security
- **User folders** - Photos stored as `{user_id}/{incident_id}_{timestamp}.ext`
- **Graceful degradation** - Photo upload fails don't block incident creation
- **Type safety** - Full TypeScript, no `any` types

---

## Testing Checklist (Before Deploying)

- [ ] User can sign up and receive confirmation email
- [ ] GPS permission works on mobile
- [ ] Panic button advances through all 3 steps
- [ ] Compensation calculation shows correct amounts
- [ ] Photo upload works (mobile camera + desktop file)
- [ ] Photos appear in Supabase Storage
- [ ] Incident appears in "Recent Activity"
- [ ] Profile stats update (total_potential, total_incidents)
- [ ] Can sign out and sign back in
- [ ] Hebrew text displays correctly (no broken RTL)

---

## Known Issues / Limitations

1. **No station geocoding** - Saves "תחנה נוכחית" placeholder
2. **Simulated verification** - Uses setTimeout instead of real API
3. **No image compression** - Photos uploaded at full size
4. **HEIC format** - iOS photos may need conversion
5. **Local GPS only** - HTTPS required for production GPS

---

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Get from: https://app.supabase.com/project/YOUR_PROJECT_ID/settings/api

---

## Supabase Setup Required (One-Time)

1. **Database:** Run `supabase/schema.sql` in SQL Editor
2. **Storage:** Create `incident-photos` bucket (public)
3. **RLS Policies:** Follow [STORAGE_SETUP.md](STORAGE_SETUP.md)
4. **Auth:** Enable email auth in Supabase dashboard

---

## When Helping With This Project

### Always Consider:
1. **Hebrew RTL** - All UI text must be Hebrew, right-aligned
2. **Legal compliance** - We're building evidence for courts
3. **Mobile UX** - Users are at bus stops, frustrated, in a hurry
4. **Type safety** - Use TypeScript interfaces
5. **Existing patterns** - Follow compensation.ts style for new logic

### Never Do:
1. Remove GPS capture (legal requirement)
2. Make photos private (courts need access)
3. Skip compensation calculation display (users want to see $)
4. Add English text (Hebrew only)
5. Use `any` types (TypeScript strict mode)

---

## Next Conversation Starters

Depending on what you want to do next:

### "Integrate Ministry API"
→ Start Phase 3, connect to SIRI/GTFS-RT

### "Add claim aggregation"
→ Let users combine incidents into single lawsuit

### "Build admin dashboard"
→ Case management for legal team

### "Generate warning letters"
→ AI-powered legal document creation

### "Improve photo upload"
→ Add compression, filters, OCR

---

## Recent Changes (Phase 3)

**Date:** 2026-01-03

**Changes:**
- Created `app/claims/page.tsx` - My Claims archive with map & photos
- Enhanced bus company dropdown with 12 companies
- Updated `lib/compensation.ts` with new company mappings
- Modified dashboard to calculate real-time statistics from incidents
- Created Phase 3 summary documentation

**Testing Status:** ⏳ Ready for user testing

---

## How to Resume Work

1. Read [PHASE_3_SUMMARY.md](PHASE_3_SUMMARY.md) for what was just completed
2. If starting Phase 4, check [MASTER_PLAN.md](MASTER_PLAN.md) for roadmap
3. Run `npm run dev` and test current features
4. Test the new My Claims page at `/claims`
5. Ask user what they want to build next

---

**This document is for Claude to quickly understand project state when starting a new conversation or when user runs `/context`**
