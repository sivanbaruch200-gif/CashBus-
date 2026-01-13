# CashBus - Quick Reference Guide

## 🚀 Quick Start Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 🔗 Important URLs

- **Local Development**: http://localhost:3000
- **Auth Page**: http://localhost:3000/auth
- **Supabase Dashboard**: https://app.supabase.com/project/ltlfifqtprtkwprwwpxq
- **Supabase SQL Editor**: https://app.supabase.com/project/ltlfifqtprtkwprwwpxq/editor

## 🗄️ Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | User info & financials | `full_name`, `phone`, `total_received`, `total_potential` |
| `incidents` | Panic button events | `bus_line`, `incident_type`, `user_gps_lat/lng`, `verified` |
| `claims` | Compensation requests | `claim_amount`, `status`, `incident_ids[]` |
| `legal_documents` | Generated PDFs | `document_type`, `pdf_url`, `delivery_status` |
| `admin_users` | Admin access | `role`, `permissions` |

## 📝 Common Supabase Queries

### View All Users
```sql
SELECT full_name, phone, total_incidents, total_received
FROM profiles
ORDER BY created_at DESC;
```

### View Recent Incidents
```sql
SELECT i.*, p.full_name
FROM incidents i
JOIN profiles p ON i.user_id = p.id
ORDER BY i.incident_datetime DESC
LIMIT 10;
```

### Count Incidents by Company
```sql
SELECT bus_company, COUNT(*) as total
FROM incidents
GROUP BY bus_company
ORDER BY total DESC;
```

## 🔑 Environment Variables

File: `.env.local` (already configured)
```env
NEXT_PUBLIC_SUPABASE_URL=https://ltlfifqtprtkwprwwpxq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

## 🎨 Color Palette

```javascript
// Tailwind classes
bg-primary-orange     // #FF8C00 - Main orange
text-primary-navy     // #1E3A8A - Navy blue
status-badge-pending  // Yellow
status-badge-approved // Green
status-badge-rejected // Red
status-badge-legal    // Blue
```

## 📦 Key Files & Their Purpose

| File | What It Does |
|------|-------------|
| `app/page.tsx` | Main Dashboard - shows user stats & panic button |
| `app/auth/page.tsx` | Login/Register page with orange design |
| `lib/supabase.ts` | Supabase client + helper functions |
| `supabase/schema.sql` | Database schema (run in Supabase SQL Editor) |
| `components/PanicButton.tsx` | Red button that captures GPS & creates incident |
| `components/MyAccountWidget.tsx` | Shows received vs potential compensation |
| `components/StatusLight.tsx` | GPS verification status indicator |

## 🔧 Useful Helper Functions

### From `lib/supabase.ts`:

```typescript
// Get current user's profile
const profile = await getCurrentUserProfile()

// Create a new incident (panic button)
await createIncident({
  bus_line: '190',
  bus_company: 'Egged',
  station_name: 'Central Station',
  user_gps_lat: 32.0853,
  user_gps_lng: 34.7818,
  incident_type: 'no_arrival',
  incident_datetime: new Date().toISOString()
})

// Get user's recent incidents
const incidents = await getUserIncidents(10)

// Authentication
await signUp(email, password, fullName, phone)
await signIn(email, password)
await signOut()
```

## 🧪 Testing Workflow

1. **Sign Up**: Go to `/auth`, create account
2. **Verify DB**: Check Supabase Table Editor → `profiles` (should have new user)
3. **Login**: Sign in with created account
4. **Test Panic**: Click red button, allow location
5. **Verify Incident**: Check Supabase → `incidents` table
6. **Check Stats**: Dashboard should show `total_incidents: 1`

## 📊 Database Schema Overview

```
auth.users (Supabase managed)
    ↓
profiles (auto-created via trigger)
    ↓
incidents (created by panic button)
    ↓
claims (aggregates multiple incidents)
    ↓
legal_documents (PDF letters)
```

## 🐛 Common Issues & Fixes

### "Missing environment variables"
```bash
# Solution: Verify .env.local exists and restart server
npm run dev
```

### Panic button doesn't work
```bash
# Check browser console for errors
# Allow location permissions
# Verify you're logged in
```

### Can't see other users' data (RLS working!)
```sql
-- This is correct - RLS prevents seeing others' data
-- To test: login as different user in incognito window
```

## 📱 Mobile Testing

```bash
# Find your local IP
ipconfig  # Windows
ifconfig  # Mac/Linux

# Access from phone on same network
http://192.168.1.XXX:3000
```

## 🔐 Security Notes

- ✅ RLS enabled on all tables
- ✅ Users can only see their own data
- ✅ `.env.local` in `.gitignore`
- ✅ Anon key is safe for client-side (read-only by default)
- ⚠️ Never commit `.env.local` to Git

## 📈 Next Steps (Phase 2)

- [ ] Enhanced incident form (add bus line, station autocomplete)
- [ ] Photo upload for evidence
- [ ] Claim aggregation (multiple incidents → 1 claim)
- [ ] Email notifications
- [ ] Admin dashboard

## 📚 Documentation Files

- **CLAUDE.md** - Project memory & vision
- **MASTER_PLAN.md** - 4-phase roadmap
- **SUPABASE_SETUP.md** - Complete Supabase setup guide
- **DEVELOPMENT_GUIDE.md** - Developer documentation
- **COMPONENT_MAP.md** - Visual component reference
- **plans/phase-1-setup.md** - Phase 1 technical details

## 🆘 Getting Help

1. Check browser console for errors
2. Check Supabase logs (Settings → Logs)
3. Review documentation files
4. Test with SQL queries in Supabase

---

**Last Updated**: 2026-01-03
**Status**: Phase 1 Complete ✅
