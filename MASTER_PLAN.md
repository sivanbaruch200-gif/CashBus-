# MASTER_PLAN.md - CashBus High-Level Development Plan

## Vision Statement
Making legal justice accessible to public transport passengers in Israel through automation of documentation (SIRI/GPS) and AI-based demand letter generation.

---

## Development Stages

### 📍 Stage 1: Infrastructure Setup and Initial Design 🔄 [In Progress]
**Status:** In Progress
**Details:** [plans/phase-1-setup.md](plans/phase-1-setup.md)

#### Tasks:
- [x] Set up Next.js + Tailwind project (orange-white color scheme)
- [ ] Create main Dashboard UI with "My Account" widget
- [ ] Design 3 critical user forms:
  1. **Login/Registration Form** - User-friendly onboarding explaining the process
  2. **Quick Request Submission Form** - Fast form with minimal required fields
  3. **Status and Summary Form** - Division of received vs. pending compensations
- [ ] Admin Dashboard Design:
  - Page for creating letters
  - Managing all claim types (letters, workflows)
  - Configurable workflow that auto-executes when saved
- [ ] Database Setup (Supabase)

---

### 📍 Stage 2: User System and Permissions 📋 [Not Started]
**Status:** Not Started
**Details:** [plans/phase-2-user-system.md](plans/phase-2-user-system.md)

#### Tasks:
- [ ] Registration page with system explanation (Onboarding)
- [ ] Permission request mechanism (GPS, Camera, Notifications)
- [ ] Request status page and financial summary
- [ ] User authentication and authorization system

---

### 📍 Stage 3: Evidence Mechanism and API Integration 📋 [Not Started]
**Status:** Not Started
**Details:** [plans/phase-3-evidence.md](plans/phase-3-evidence.md)

#### Tasks:
- [ ] "Quick Report" button logic
  - Send notification to admin about new complaint
  - Open user form for incident details
- [ ] Green light indicator (verification with Ministry of Transportation)
- [ ] API Integration (SIRI/GTFS-RT)
- [ ] GPS location cross-referencing with bus data
- [ ] Digital signature for 'fault tickets'

---

### 📍 Stage 4: Admin Management System and Legal Automation 📊 [Not Started]
**Status:** Not Started
**Details:** [plans/phase-4-admin-legal.md](plans/phase-4-admin-legal.md)

#### Tasks:
- [ ] **Admin Status Page:**
  - Central table of all clients and their requests
  - Stats: submitted / approved / pending
  - View total commission (20%) from all clients
  - Real-time updates of incoming revenue
- [ ] **Case Sorting Page:**
  - Filter by bus company (Egged/Kavim/Dan) for group lawsuits
  - Categorize by damage type (layoffs, replacement taxi, etc.)
- [ ] **Admin Control Page:**
  - Edit workflow from complaint receipt to compensation transfer
  - Define process automation rules
- [ ] **Automatic Letter Generator (PDF):**
  - Operates according to Admin Control Page sequence
  - AI-powered using legal precedents and Regulation 428g
- [ ] **Legal Workflow Management:**
  - Automated escalation (warning letter → claim → court)
  - Integration with legal templates

---

## MVP Roadmap (Alternative View)

### MVP Stage 1: Basic Reporting
- Develop location-based reporting button
- Save reports to database

### MVP Stage 2: Verification
- Integration with Ministry of Transport API
- Automatic verification of incidents

### MVP Stage 3: Legal Automation
- Generate legally drafted PDF letters
- Email system to transport companies

---

## Key Metrics & Success Criteria

### User Metrics:
- Number of registered users
- Incident reports per month
- Conversion rate: Free → Paid letter
- Conversion rate: Letter → Legal representation

### Business Metrics:
- Revenue from warning letters (29-49 NIS each)
- Success fee revenue (15-20% of compensations)
- Average claim value per user
- Customer satisfaction score

### Legal Metrics:
- Success rate of warning letters
- Average compensation amount
- Time from incident to compensation
- Court case win rate

---

## Technical Requirements Summary

### APIs & Integrations:
- [ ] GTFS-RT API access (Ministry of Transportation)
- [ ] GPS location services
- [ ] Email service (for sending letters)
- [ ] PDF generation service
- [ ] Payment processing (for user fees)

### Legal Assets:
- [ ] Collect 3-5 leading court rulings as AI training examples
- [ ] Database of legal precedents
- [ ] Regulation 428g templates
- [ ] Company-specific claim procedures

### Infrastructure:
- [ ] Supabase database setup
- [ ] User authentication system
- [ ] Admin panel
- [ ] Mobile-responsive web app
- [ ] Hebrew RTL support throughout

---

## Timeline Overview
*Note: Focus on implementation steps, not time estimates. Scheduling determined by team capacity.*

**Current Focus:** Phase 1 - Infrastructure and Dashboard UI

---

## Document History
- **Created:** 2026-01-03
- **Last Updated:** 2026-01-03
- **Version:** 1.0
