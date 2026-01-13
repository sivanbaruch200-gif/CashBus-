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

### Business Model
1. **Freemium:** Free event documentation
2. **Warning Letter (Low Ticket):** 29-49 NIS for AI-generated official warning letter
3. **Success Fee (High Ticket):** 15-20% commission on final compensation from court cases

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
- **Phase:** 3.5 - Infrastructure Upgrade (Evidence Engine)
- **Last Updated:** 2026-01-09
- **Status:** Completed

## Phase Progress
- ✅ **Phase 1:** Infrastructure Setup and Initial Design - Completed
- ✅ **Phase 2:** Evidence & Reporting Upgrade - Completed
- ✅ **Phase 3:** Advanced UX & Case Management - Completed
- ✅ **Phase 3.5:** Infrastructure Upgrade - Completed
  - Professional GPS Engine with accuracy tracking
  - GTFS Data Automation (Edge Function + Cron)
  - OpenBus Stride API integration (real-time SIRI data)
  - Automated incident verification logic
  - **Real-Time Data Validation System** (NEW)
- ⏳ **Phase 4:** Legal Automation (AI Letters) - Pending

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

## Related Documents
- [Master Plan](MASTER_PLAN.md)
- [Phase 1 Setup Plan](plans/phase-1-setup.md)
- [Phase 2 Summary](PHASE_2_SUMMARY.md)
- [Phase 3 Summary](PHASE_3_SUMMARY.md)
- [GTFS Deployment Guide](GTFS_DEPLOYMENT_GUIDE.md)
- [Storage Setup Guide](STORAGE_SETUP.md)
- [Context](CONTEXT.md)
