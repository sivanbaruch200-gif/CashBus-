import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables')
  }
  return createClient(url, key)
}

/**
 * Verify the caller is an admin via their auth token
 */
async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.replace('Bearer ', '')
  const supabase = getSupabase()

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile?.role || !['admin', 'super_admin'].includes(profile.role)) return null
  return user.id
}

/**
 * GET /api/admin/settings - Get all settings
 */
export async function GET(req: NextRequest) {
  const userId = await verifyAdmin(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await getSupabase()
    .from('app_settings')
    .select('key, value')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const settings: Record<string, unknown> = {}
  for (const row of data || []) {
    settings[row.key] = row.value
  }

  return NextResponse.json(settings)
}

/**
 * PUT /api/admin/settings - Update multiple settings at once
 * Body: { "key1": value1, "key2": value2, ... }
 */
export async function PUT(req: NextRequest) {
  const userId = await verifyAdmin(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const supabase = getSupabase()
  const errors: string[] = []

  for (const [key, value] of Object.entries(body)) {
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })

    if (error) {
      errors.push(`${key}: ${error.message}`)
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
