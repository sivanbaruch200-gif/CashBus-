# GTFS Data Deployment Guide

This guide explains how to deploy the GTFS Edge Function and populate the bus stops database from the Ministry of Transportation.

## Prerequisites

1. Supabase CLI installed: `npm install -g supabase`
2. Access to your Supabase project dashboard
3. Project linked: `supabase link --project-ref YOUR_PROJECT_REF`

---

## Step 1: Create GTFS Tables in Supabase

Run the following SQL in your Supabase SQL Editor (Dashboard > SQL Editor > New Query):

```sql
-- Copy contents from: supabase/gtfs-tables.sql
```

Or run via CLI:
```bash
supabase db push
```

**Important Tables Created:**
- `gtfs_routes` - Bus routes (line numbers, operators)
- `gtfs_stops` - Bus stops with coordinates
- `gtfs_agencies` - Operator mappings
- `find_nearest_stop()` - Function for location validation

---

## Step 2: Deploy the GTFS Update Edge Function

### Option A: Deploy via Supabase CLI (Recommended)

```bash
# Navigate to project root
cd "c:\Users\sivan\OneDrive\Desktop\CashBus- Project"

# Deploy the function
supabase functions deploy gtfs-update --project-ref YOUR_PROJECT_REF
```

### Option B: Manual Deployment via Dashboard

1. Go to Supabase Dashboard > Edge Functions
2. Click "Create a new function"
3. Name it `gtfs-update`
4. Copy contents from `supabase/functions/gtfs-update/index.ts`

---

## Step 3: Run Initial GTFS Data Load

### Option A: Via HTTP Request (Recommended)

Use curl or Postman to trigger the function:

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/gtfs-update" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

**Find your keys:**
- Project Ref: Dashboard > Settings > General
- Anon Key: Dashboard > Settings > API > `anon` key

### Option B: Via Supabase Dashboard

1. Go to Edge Functions > gtfs-update
2. Click "Invoke" button
3. Body: `{}`
4. Click "Run"

### Expected Response:
```json
{
  "success": true,
  "message": "GTFS update completed",
  "stats": {
    "routes": { "total": 5000, "processed": 5000, "errors": 0 },
    "stops": { "total": 25000, "processed": 25000, "errors": 0 }
  },
  "timestamp": "2026-01-09T12:00:00.000Z"
}
```

---

## Step 4: Set Up Daily Cron Job

To keep GTFS data updated automatically, set up a cron job:

### Using pg_cron Extension

1. Enable pg_cron in Supabase Dashboard > Database > Extensions
2. Run this SQL:

```sql
-- Schedule daily update at 3:00 AM Israel time (UTC+2)
SELECT cron.schedule(
  'gtfs-daily-update',
  '0 1 * * *',  -- 1:00 AM UTC = 3:00 AM Israel
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/gtfs-update',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) AS request_id;
  $$
);
```

### Verify Cron Job:
```sql
SELECT * FROM cron.job;
```

---

## Step 5: Verify Data Load

Check that stops were loaded:

```sql
-- Count stops
SELECT COUNT(*) FROM gtfs_stops;

-- Should return ~25,000+ stops

-- Test nearest stop function
SELECT * FROM find_nearest_stop(32.0853, 34.7818, 500);
-- Should return stops near Tel Aviv center
```

---

## Troubleshooting

### "GTFS_EMPTY" Error in App
The gtfs_stops table is empty. Run the Edge Function to load data:
```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/gtfs-update" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Edge Function Timeout
The GTFS file is large (~50MB). If timeout occurs:
1. Increase function timeout in Supabase Dashboard
2. Or run in smaller batches

### Permission Errors
Ensure RLS policies are set:
```sql
-- Allow public read
CREATE POLICY "gtfs_stops_public_select" ON gtfs_stops FOR SELECT USING (true);
```

---

## API Endpoints Used

### Stride API (for SIRI real-time data)
- Base URL: `https://open-bus-stride-api.hasadna.org.il`
- Docs: `https://open-bus-stride-api.hasadna.org.il/docs`

Key endpoints:
- `/siri_vehicle_locations/list` - Real-time bus positions
- `/gtfs_stops/list` - Stop information
- `/gtfs_routes/list` - Route information

### Ministry of Transportation GTFS
- URL: `https://gtfs.mot.gov.il/gtfsfiles/israel-public-transportation.zip`
- Updated daily
- Contains: routes.txt, stops.txt, trips.txt, etc.

---

## Data Flow Summary

```
1. User presses Panic Button
   ↓
2. GPS coordinates captured (navigator.geolocation)
   ↓
3. /api/validate-location called
   → Queries gtfs_stops table (Supabase)
   → Uses Haversine formula (300m radius)
   → Returns: station name, code, distance
   ↓
4. User selects bus line + company
   ↓
5. /api/validate-siri called
   → Queries Stride API (siri_vehicle_locations)
   → Checks 10-min time window
   → Returns: bus found/not found
   ↓
6. Evidence chain displayed to user
   ↓
7. Form submitted with complete evidence data
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `supabase/gtfs-tables.sql` | Database schema for GTFS tables |
| `supabase/functions/gtfs-update/index.ts` | Edge Function for daily updates |
| `lib/gtfsService.ts` | Client-side GTFS utilities |
| `lib/strideService.ts` | Stride API client |
| `app/api/validate-location/route.ts` | Location validation endpoint |
| `app/api/validate-siri/route.ts` | SIRI verification endpoint |
| `components/PanicButton.tsx` | UI with validation flow |

---

## Quick Start Commands

```bash
# 1. Deploy Edge Function
supabase functions deploy gtfs-update

# 2. Trigger initial data load
curl -X POST "https://YOUR_REF.supabase.co/functions/v1/gtfs-update" \
  -H "Authorization: Bearer YOUR_KEY"

# 3. Verify in SQL Editor
SELECT COUNT(*) FROM gtfs_stops;
```
