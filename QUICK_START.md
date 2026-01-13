# CashBus - Quick Start Guide

Get your CashBus development environment running in minutes.

---

## Prerequisites

- Node.js 18+ installed
- Supabase account with project created
- Git (optional)

---

## Step 1: Environment Setup

1. Copy the environment template:
```bash
cp .env.local.example .env.local
```

2. Edit `.env.local` and add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Get these from: https://app.supabase.com/project/YOUR_PROJECT_ID/settings/api

---

## Step 2: Database Setup

1. Go to Supabase SQL Editor: https://app.supabase.com/project/YOUR_PROJECT_ID/sql

2. Copy and paste the entire contents of [supabase/schema.sql](supabase/schema.sql)

3. Click **"Run"**

4. Verify all tables were created:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';
```

You should see: `profiles`, `incidents`, `claims`, `legal_documents`, `admin_users`

---

## Step 3: Storage Setup

**Important:** This step is required for photo uploads to work.

1. Follow the complete guide: [STORAGE_SETUP.md](STORAGE_SETUP.md)

**Quick version:**
1. Go to Storage: https://app.supabase.com/project/YOUR_PROJECT_ID/storage/buckets
2. Create new bucket: `incident-photos` (public)
3. Set up RLS policies (see STORAGE_SETUP.md for SQL)

---

## Step 4: Install Dependencies

```bash
npm install
```

This installs:
- Next.js 14
- React 18
- Tailwind CSS
- Supabase client
- Lucide React icons
- TypeScript

---

## Step 5: Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

---

## First Time User Flow

### 1. **Sign Up**
- Navigate to http://localhost:3000
- You'll be redirected to `/auth`
- Create an account with:
  - Email
  - Password (min 6 characters)
  - Full name
  - Phone number

### 2. **Check Email**
- Supabase sends a confirmation email
- Click the link to verify
- Return to http://localhost:3000

### 3. **Test the Panic Button**
- Click the red panic button
- **Allow GPS access** when browser prompts
- Wait for GPS to lock (1-2 seconds)
- Fill in incident details:
  - Bus line: `480` (example)
  - Company: `אגד` (Egged)
  - Type: `לא הגיע` (No arrival)
  - Optional: Add damage (e.g., taxi ₪50)
  - Optional: Upload a photo
- Click **"שלח דיווח"**

### 4. **View Your Dashboard**
- See your incident in "פעילות אחרונה"
- Check "My Account" widget for potential compensation
- Watch your statistics update

---

## Testing Phase 2 Features

### Test GPS Verification:
1. Click panic button
2. Verify GPS permission prompt appears
3. Check that location is captured (green checkmark)
4. Proceed to form

### Test Compensation Calculation:
1. Fill in bus line and company
2. Select incident type
3. Add damage amount
4. Watch the green compensation box update in real-time

### Test Photo Upload:
1. Click photo upload area
2. On mobile: Use camera
3. On desktop: Select image file
4. Verify preview appears
5. Submit form
6. Check Supabase Storage for uploaded file

---

## Troubleshooting

### "Missing Supabase environment variables"
- Check that `.env.local` exists
- Verify URL and KEY are correct
- Restart dev server after changes

### GPS not working
- Use HTTPS (localhost works on Chrome)
- Check browser permissions
- Try on mobile device

### Photo upload fails
- Verify Storage bucket `incident-photos` exists
- Check RLS policies are configured
- Ensure file is <5MB and is an image
- Check browser console for errors

### User can't sign in
- Check Supabase Auth is enabled
- Verify email confirmation (check spam folder)
- Try password reset

---

## Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Type check
npx tsc --noEmit
```

---

## Project Structure

```
CashBus/
├── app/
│   ├── page.tsx              # Main dashboard
│   ├── auth/page.tsx         # Login/signup
│   └── layout.tsx            # Root layout
├── components/
│   ├── PanicButton.tsx       # Two-step reporting form
│   ├── MyAccountWidget.tsx   # Financial summary
│   └── StatusLight.tsx       # GPS verification indicator
├── lib/
│   ├── supabase.ts           # Database & auth helpers
│   └── compensation.ts       # Compensation calculation logic
├── supabase/
│   └── schema.sql            # Database schema
├── public/                   # Static assets
└── .env.local               # Environment variables (not in git)
```

---

## Key Features (Phase 1 + 2)

✅ User authentication (Supabase Auth)
✅ Hebrew RTL support
✅ Responsive design (mobile-first)
✅ GPS location capture
✅ Two-step incident reporting
✅ Photo upload with preview
✅ Real-time compensation calculation
✅ Dashboard with financial summary
✅ Recent activity feed

---

## What's Not Working Yet

⏳ Ministry of Transportation API (Phase 3)
⏳ Station name geocoding (Phase 3)
⏳ Claim aggregation (Phase 4)
⏳ AI-powered legal letters (Phase 4)
⏳ Email notifications (Future)

---

## Need Help?

1. Check [PHASE_2_SUMMARY.md](PHASE_2_SUMMARY.md) for feature details
2. Check [STORAGE_SETUP.md](STORAGE_SETUP.md) for storage issues
3. Review Supabase logs: https://app.supabase.com/project/YOUR_PROJECT_ID/logs
4. Check browser console for errors (F12)

---

## Production Deployment

When ready to deploy:

1. Build the app: `npm run build`
2. Deploy to Vercel/Netlify
3. Add environment variables in hosting dashboard
4. Test on mobile devices
5. Update CORS settings in Supabase if needed

---

**Last Updated:** 2026-01-03
**Version:** Phase 2
