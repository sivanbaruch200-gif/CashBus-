# CashBus - Supabase Setup Guide

## 🎯 Overview
This guide will help you set up and configure Supabase for the CashBus platform.

---

## 📋 Prerequisites
- Supabase account (free tier works)
- Project created on Supabase
- Your project URL and anon key

---

## ✅ Step 1: Database Schema Setup

### 1.1 Access SQL Editor
1. Go to https://app.supabase.com
2. Select your project: `ltlfifqtprtkwprwwpxq`
3. Navigate to **SQL Editor** in the left sidebar

### 1.2 Run Schema Script
1. Open [supabase/schema.sql](supabase/schema.sql)
2. Copy the entire SQL script
3. Paste into Supabase SQL Editor
4. Click **Run** or press `Ctrl + Enter`

### 1.3 Verify Tables Created
Run this verification query:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'incidents', 'claims', 'legal_documents', 'admin_users');
```

You should see all 5 tables listed.

---

## 🔐 Step 2: Authentication Setup

### 2.1 Enable Email Authentication
1. Go to **Authentication** > **Providers**
2. Enable **Email** provider
3. Configure email templates (optional):
   - Confirmation email
   - Password reset email
   - Magic link email

### 2.2 Configure Authentication Settings
1. Go to **Authentication** > **Settings**
2. Set the following:
   - **Site URL**: `http://localhost:3000` (development)
   - **Redirect URLs**: Add `http://localhost:3000/auth`
   - **Auto-confirm users**: Disable (for production)
   - **Enable email confirmations**: Enable

### 2.3 (Optional) Enable Additional Providers
For future social login:
- Google OAuth
- Facebook Login
- Apple Sign In

---

## 📁 Step 3: Storage Setup (Future Feature)

For storing incident photos and legal PDFs:

1. Go to **Storage** in left sidebar
2. Create two buckets:

### Bucket 1: `incident-photos`
- **Public**: No
- **Allowed MIME types**: `image/jpeg, image/png, image/webp`
- **Max file size**: 5 MB

### Bucket 2: `legal-documents`
- **Public**: No
- **Allowed MIME types**: `application/pdf`
- **Max file size**: 10 MB

### Storage Policies (RLS)
```sql
-- Allow users to upload their own incident photos
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'incident-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to view their own photos
CREATE POLICY "Users can view own photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'incident-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 🔑 Step 4: API Keys

### 4.1 Get Your Keys
1. Go to **Settings** > **API**
2. Copy the following:
   - **Project URL**: Already set in `.env.local`
   - **anon/public key**: Already set in `.env.local`

### 4.2 Verify `.env.local` File
Your [.env.local](.env.local) should contain:
```env
NEXT_PUBLIC_SUPABASE_URL=https://ltlfifqtprtkwprwwpxq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your_key_here
```

✅ **Status**: Already configured!

---

## 🧪 Step 5: Testing the Setup

### 5.1 Test User Registration
1. Start your development server:
   ```bash
   npm install
   npm run dev
   ```

2. Navigate to http://localhost:3000/auth

3. Register a new user:
   - Full Name: `Test User`
   - Phone: `050-1234567`
   - Email: `test@example.com`
   - Password: `test123456`

4. Check Supabase:
   - Go to **Authentication** > **Users**
   - Verify new user appears
   - Go to **Table Editor** > **profiles**
   - Verify profile was auto-created

### 5.2 Test Panic Button (Incident Creation)
1. Login with your test user
2. Allow location permissions when prompted
3. Click the red panic button
4. Wait for "מאומת" (verified) status
5. Check Supabase:
   - Go to **Table Editor** > **incidents**
   - Verify new incident was created with GPS coordinates

### 5.3 Expected Database State
After testing, you should have:
- **profiles** table: 1 row (your test user)
- **incidents** table: 1+ rows (panic button presses)
- **claims** table: 0 rows (created in Phase 2)

---

## 📊 Step 6: Database Monitoring

### 6.1 View Real-Time Data
1. Go to **Table Editor**
2. Select any table (profiles, incidents, etc.)
3. View data in spreadsheet format
4. Can manually edit/delete for testing

### 6.2 Query Data Directly
Use **SQL Editor** to run queries:

```sql
-- View all users with their incident count
SELECT
  p.full_name,
  p.total_incidents,
  p.total_received,
  p.total_potential
FROM profiles p
ORDER BY p.created_at DESC;

-- View recent incidents with user info
SELECT
  i.incident_type,
  i.bus_company,
  i.incident_datetime,
  i.verified,
  p.full_name
FROM incidents i
JOIN profiles p ON i.user_id = p.id
ORDER BY i.created_at DESC
LIMIT 10;

-- Check incident statistics by company
SELECT
  bus_company,
  COUNT(*) as total_incidents,
  SUM(CASE WHEN verified THEN 1 ELSE 0 END) as verified_count
FROM incidents
GROUP BY bus_company;
```

---

## 🛡️ Security Best Practices

### Row Level Security (RLS)
✅ Already enabled on all tables via schema.sql

### Policy Summary:
- **profiles**: Users can only view/edit their own profile
- **incidents**: Users can only create/view their own incidents
- **claims**: Users can only create/view their own claims
- **legal_documents**: Users can only view their own documents

### Test RLS Policies:
```sql
-- Try to view another user's data (should return empty)
SELECT * FROM incidents WHERE user_id != auth.uid();
```

---

## 🔄 Database Triggers & Functions

### Auto-Created Profile on Signup
When a user signs up, a profile is automatically created via the `handle_new_user()` trigger.

**Test:**
1. Sign up a new user
2. Check `profiles` table immediately
3. Should see new row with user's name and phone

### Auto-Increment Incident Count
When an incident is created, the user's `total_incidents` counter increments automatically.

**Test:**
1. Press panic button
2. Check `profiles` table
3. See `total_incidents` increase by 1

---

## 📈 Future Enhancements

### Phase 2 Features:
- [ ] Email notifications (Supabase Edge Functions)
- [ ] Webhooks for claim status updates
- [ ] Scheduled verification checks (Supabase Cron)
- [ ] Analytics dashboard (Supabase Charts)

### Phase 3 Features:
- [ ] Real-time subscriptions for live updates
- [ ] Supabase Realtime for collaborative admin panel
- [ ] File upload for incident photos
- [ ] PDF generation and storage

---

## 🐛 Troubleshooting

### Issue: "Missing Supabase environment variables"
**Solution:**
1. Check `.env.local` exists in project root
2. Restart development server: `npm run dev`
3. Verify no typos in variable names

### Issue: User registration fails
**Solution:**
1. Check Supabase **Logs** for errors
2. Verify email provider is enabled
3. Check RLS policies allow INSERT on profiles

### Issue: Panic button doesn't create incident
**Solution:**
1. Allow location permissions in browser
2. Check browser console for errors
3. Verify RLS policies on incidents table
4. Check Supabase **Logs** > **Postgres Logs**

### Issue: Tables not created
**Solution:**
1. Re-run schema.sql in SQL Editor
2. Check for syntax errors in SQL output
3. Verify you have owner permissions on project

---

## 📞 Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Discord**: https://discord.supabase.com
- **Project Logs**: https://app.supabase.com/project/ltlfifqtprtkwprwwpxq/logs

---

## ✅ Setup Checklist

Use this checklist to verify your setup:

- [x] Supabase project created
- [x] `.env.local` file configured
- [ ] SQL schema executed successfully
- [ ] All 5 tables visible in Table Editor
- [ ] Email authentication enabled
- [ ] Test user registered successfully
- [ ] Profile auto-created for test user
- [ ] Panic button creates incident successfully
- [ ] GPS coordinates captured correctly
- [ ] RLS policies working (can't see other users' data)
- [ ] Triggers working (incident count increments)

---

## 🎉 You're Ready!

Once all checklist items are complete, your CashBus Supabase backend is fully operational.

Next steps:
1. Test the full user flow (signup → login → panic button)
2. Monitor database growth in Table Editor
3. Move to Phase 2: Enhanced incident reporting form

---

**Last Updated:** 2026-01-03
**Version:** 1.0
