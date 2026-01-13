# Supabase Storage Setup for CashBus

This guide explains how to set up the Storage bucket in Supabase for handling incident photos.

## Overview

CashBus uses Supabase Storage to store evidence photos uploaded by users when reporting incidents. These photos serve as legal evidence for compensation claims.

---

## Step 1: Create Storage Bucket

1. Go to your Supabase Dashboard: https://app.supabase.com/project/YOUR_PROJECT_ID/storage/buckets

2. Click **"New bucket"**

3. Configure the bucket:
   - **Name:** `incident-photos`
   - **Public bucket:** ✅ **Checked** (photos need to be accessible for legal documents)
   - **File size limit:** 5 MB (sufficient for mobile photos)
   - **Allowed MIME types:** `image/jpeg, image/jpg, image/png, image/webp`

4. Click **"Create bucket"**

---

## Step 2: Configure Storage Policies (RLS)

After creating the bucket, you need to set up Row Level Security (RLS) policies to control access.

### Navigate to Policies

1. In the Storage section, click on `incident-photos` bucket
2. Click on **"Policies"** tab
3. Click **"New policy"**

### Policy 1: Allow Authenticated Users to Upload

**Policy Name:** `Users can upload own incident photos`

**Allowed operation:** `INSERT`

**Target roles:** `authenticated`

**Policy definition:**
```sql
((bucket_id = 'incident-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))
```

**Explanation:** Users can only upload to their own folder (folder name = user ID)

### Policy 2: Allow Public Read Access

**Policy Name:** `Public read access for incident photos`

**Allowed operation:** `SELECT`

**Target roles:** `public`

**Policy definition:**
```sql
(bucket_id = 'incident-photos'::text)
```

**Explanation:** Anyone with the URL can view the photos (needed for sharing with bus companies and courts)

### Policy 3: Allow Users to Delete Own Photos

**Policy Name:** `Users can delete own photos`

**Allowed operation:** `DELETE`

**Target roles:** `authenticated`

**Policy definition:**
```sql
((bucket_id = 'incident-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))
```

**Explanation:** Users can only delete photos from their own folder

---

## Step 3: Verify Setup

Run this test from your browser console (after logging in):

```javascript
// Test upload
const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
const { data, error } = await supabase.storage
  .from('incident-photos')
  .upload('test-folder/test.jpg', testFile)

console.log('Upload result:', { data, error })

// Test public URL
const { data: urlData } = supabase.storage
  .from('incident-photos')
  .getPublicUrl('test-folder/test.jpg')

console.log('Public URL:', urlData.publicUrl)
```

---

## File Structure

Photos are stored with this structure:

```
incident-photos/
├── {user_id_1}/
│   ├── {incident_id}_1234567890.jpg
│   ├── {incident_id}_1234567891.png
│   └── ...
├── {user_id_2}/
│   ├── {incident_id}_1234567892.jpg
│   └── ...
└── ...
```

**Format:** `{user_id}/{incident_id}_{timestamp}.{extension}`

This ensures:
- Easy organization by user
- Unique filenames (timestamp)
- Traceable to specific incidents

---

## Security Considerations

### ✅ What We're Doing Right

1. **Folder-based access control** - Users can only upload to their own folders
2. **Public read** - Necessary for sharing evidence with legal entities
3. **File size limits** - Prevents abuse (5MB max)
4. **MIME type restrictions** - Only image files allowed

### ⚠️ Important Notes

1. **Public URLs** - Photos are publicly accessible if someone has the URL. This is intentional for legal purposes.

2. **No sensitive data** - Never store ID cards or personal documents in this bucket. Only incident photos (buses, stations, schedules).

3. **Deletion** - Users can delete their own photos, but this should be logged for audit purposes.

4. **Storage costs** - Monitor usage. Each photo is ~1-3 MB. Plan for growth.

---

## Troubleshooting

### Error: "new row violates row-level security policy"

**Solution:** Check that the policy for INSERT is correctly configured with the folder name check.

### Error: "Failed to upload file"

**Possible causes:**
1. File too large (>5MB)
2. Invalid MIME type (not an image)
3. User not authenticated
4. Bucket doesn't exist

### Photos not loading

**Check:**
1. Is the bucket public?
2. Is the `SELECT` policy configured for public access?
3. Is the URL correctly formatted?

---

## Alternative: SQL Setup Script

If you prefer SQL, run this in the Supabase SQL Editor:

```sql
-- Create storage bucket (run this manually in Dashboard, not SQL)
-- Then create policies:

-- Policy 1: Upload
CREATE POLICY "Users can upload own incident photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'incident-photos' AND
  (auth.uid())::text = (storage.foldername(name))[1]
);

-- Policy 2: Read
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'incident-photos');

-- Policy 3: Delete
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'incident-photos' AND
  (auth.uid())::text = (storage.foldername(name))[1]
);
```

---

## Next Steps

After setting up storage:

1. ✅ Test photo upload from the app
2. ✅ Verify photos appear in Supabase Storage UI
3. ✅ Test public URL access
4. Set up image optimization (future phase)
5. Set up automatic backups (future phase)

---

## Related Files

- [lib/supabase.ts](lib/supabase.ts) - Photo upload functions
- [components/PanicButton.tsx](components/PanicButton.tsx) - Photo capture UI
- [app/page.tsx](app/page.tsx) - Incident submission handler

---

**Created:** 2026-01-03
**Last Updated:** 2026-01-03
**Phase:** 2 - Evidence and Reporting Upgrade
