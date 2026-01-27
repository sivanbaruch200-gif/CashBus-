-- =====================================================
-- Supabase Storage Setup for Legal Documents
-- Run this in the Supabase SQL Editor
-- =====================================================

-- Create storage bucket for documents (if it doesn't exist)
-- NOTE: This command may need to be run via the Supabase Dashboard > Storage
-- or using the Supabase CLI

-- The bucket should be created with these settings:
-- Name: documents
-- Public: true (so PDFs can be downloaded via link)
-- File size limit: 50MB
-- Allowed MIME types: application/pdf

-- RLS Policies for the 'documents' bucket
-- These policies control who can upload, view, and delete documents

-- Policy 1: Allow authenticated users to upload documents
INSERT INTO storage.policies (bucket_id, name, definition)
VALUES (
  'documents',
  'Allow authenticated uploads',
  'bucket_id = ''documents'' AND auth.role() = ''authenticated'''
)
ON CONFLICT DO NOTHING;

-- Policy 2: Allow public read access to documents
INSERT INTO storage.policies (bucket_id, name, definition)
VALUES (
  'documents',
  'Allow public read',
  'bucket_id = ''documents'''
)
ON CONFLICT DO NOTHING;

-- Policy 3: Allow admins to delete documents
INSERT INTO storage.policies (bucket_id, name, definition)
VALUES (
  'documents',
  'Allow admin delete',
  'bucket_id = ''documents'' AND EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  )'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- MANUAL SETUP INSTRUCTIONS
-- =====================================================

-- If the SQL policies don't work, follow these manual steps in Supabase Dashboard:

-- 1. Go to Storage section in Supabase Dashboard
-- 2. Click "Create Bucket"
-- 3. Name: "documents"
-- 4. Public bucket: YES (checked)
-- 5. File size limit: 50 MB
-- 6. Allowed MIME types: application/pdf
-- 7. Click "Create bucket"

-- 8. Click on the "documents" bucket
-- 9. Go to "Policies" tab
-- 10. Add these policies:

-- Policy 1: "Allow authenticated uploads"
--   Operation: INSERT
--   Policy definition: (auth.role() = 'authenticated')

-- Policy 2: "Allow public read"
--   Operation: SELECT
--   Policy definition: true

-- Policy 3: "Allow admin delete"
--   Operation: DELETE
--   Policy definition:
--     EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())

-- =====================================================
-- RECEIPTS BUCKET SETUP (for taxi receipts and expense claims)
-- =====================================================

-- MANUAL SETUP INSTRUCTIONS for 'receipts' bucket:
-- 1. Go to Storage section in Supabase Dashboard
-- 2. Click "Create Bucket"
-- 3. Name: "receipts"
-- 4. Public bucket: YES (checked)
-- 5. File size limit: 10 MB
-- 6. Allowed MIME types: image/*, application/pdf
-- 7. Click "Create bucket"

-- 8. Click on the "receipts" bucket
-- 9. Go to "Policies" tab
-- 10. Add these policies:

-- Policy 1: "Allow authenticated uploads"
--   Operation: INSERT
--   Target roles: authenticated
--   Policy definition: true

-- Policy 2: "Allow public read"
--   Operation: SELECT
--   Target roles: public
--   Policy definition: true

-- Policy 3: "Allow users to delete own receipts"
--   Operation: DELETE
--   Target roles: authenticated
--   Policy definition: (auth.uid()::text = (storage.foldername(name))[1])

-- =====================================================
-- Verification Query
-- =====================================================

-- Check if buckets exist
SELECT * FROM storage.buckets WHERE name IN ('documents', 'receipts', 'incident-photos');

-- Check policies
SELECT * FROM storage.policies WHERE bucket_id IN ('documents', 'receipts', 'incident-photos');
