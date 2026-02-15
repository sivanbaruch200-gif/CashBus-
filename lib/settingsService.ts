/**
 * Settings Service - Read/write app_settings from Supabase
 *
 * Two modes:
 * 1. Server-side (service role key) - used by collectionWorkflow, cron jobs
 * 2. Client-side (anon key + RLS) - used by admin settings page
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Server-side client (bypasses RLS via service role)
function getServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables')
  }
  return createClient(url, key)
}

/**
 * Get a single setting value (server-side)
 * Returns the parsed JSONB value, or the fallback if not found
 */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const { data, error } = await getServerSupabase()
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single()

    if (error || !data) return fallback
    return data.value as T
  } catch {
    return fallback
  }
}

/**
 * Set a single setting value (server-side)
 */
export async function setSetting(key: string, value: unknown, userId?: string): Promise<void> {
  const { error } = await getServerSupabase()
    .from('app_settings')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    })

  if (error) {
    throw new Error(`Failed to save setting "${key}": ${error.message}`)
  }
}

/**
 * Get all settings as a key-value object (server-side)
 */
export async function getAllSettings(): Promise<Record<string, unknown>> {
  const { data, error } = await getServerSupabase()
    .from('app_settings')
    .select('key, value')

  if (error || !data) return {}

  const result: Record<string, unknown> = {}
  for (const row of data) {
    result[row.key] = row.value
  }
  return result
}

// =====================================================
// Convenience helpers
// =====================================================

/**
 * Get admin email - used by collectionWorkflow and other notification senders
 * Priority: DB → env var → hardcoded default
 */
export async function getAdminEmail(): Promise<string> {
  const dbEmail = await getSetting<string>('admin_email', '')
  if (dbEmail) return dbEmail

  return process.env.ADMIN_EMAIL || 'cash.bus200@gmail.com'
}
