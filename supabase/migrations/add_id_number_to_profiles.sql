-- =====================================================
-- Add id_number column to profiles table
-- Date: 2026-02-24
-- Purpose: Store Israeli ID number (ת.ז.) collected during registration
--          Required for legal demand letters ({{id_number}} template tag)
-- =====================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS id_number TEXT;

COMMENT ON COLUMN public.profiles.id_number IS 'Israeli national ID number (תעודת זהות) - 9 digits, collected during registration, used in legal demand letters';
