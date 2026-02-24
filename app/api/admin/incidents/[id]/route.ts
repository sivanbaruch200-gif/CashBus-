/**
 * Admin API: Delete Incident
 * DELETE /api/admin/incidents/[id]
 *
 * Query params:
 *   - force=true  → also delete linked claims (use with care!)
 *
 * Returns:
 *   - 200: deleted successfully
 *   - 409: incident has linked claims (pass force=true to override)
 *   - 403: not admin
 *   - 404: incident not found
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isUserAdmin } from '@/lib/supabase'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const incidentId = params.id
  const force = request.nextUrl.searchParams.get('force') === 'true'

  // 1. Admin check
  const isAdmin = await isUserAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // 2. Confirm incident exists
  const { data: incident, error: fetchErr } = await supabase
    .from('incidents')
    .select('id, bus_line, bus_company, incident_type, status')
    .eq('id', incidentId)
    .single()

  if (fetchErr || !incident) {
    return NextResponse.json({ error: 'Incident not found' }, { status: 404 })
  }

  // 3. Check linked claims
  const { data: linkedClaims, error: claimErr } = await supabase
    .from('claims')
    .select('id, status, claim_amount')
    .eq('incident_id', incidentId)

  if (claimErr) {
    return NextResponse.json({ error: 'DB error checking claims' }, { status: 500 })
  }

  if (linkedClaims && linkedClaims.length > 0 && !force) {
    return NextResponse.json({
      error: 'LINKED_CLAIMS',
      message: `לדיווח זה קשורות ${linkedClaims.length} תביעות. העברו force=true למחיקה מלאה.`,
      linkedClaims: linkedClaims.map(c => ({
        id: c.id,
        status: c.status,
        amount: c.claim_amount,
      })),
    }, { status: 409 })
  }

  // 4. If force: delete linked claims first
  if (force && linkedClaims && linkedClaims.length > 0) {
    const claimIds = linkedClaims.map(c => c.id)

    // Delete letter_reminders referencing these claims
    await supabase.from('letter_reminders').delete().in('claim_id', claimIds)

    // Delete the claims themselves
    const { error: deleteClaimsErr } = await supabase
      .from('claims')
      .delete()
      .in('id', claimIds)

    if (deleteClaimsErr) {
      return NextResponse.json({ error: 'Failed to delete linked claims' }, { status: 500 })
    }
  }

  // 5. Delete siri_evidence_snapshots if table exists
  await supabase
    .from('siri_evidence_snapshots')
    .delete()
    .eq('incident_id', incidentId)

  // 6. Delete the incident
  const { error: deleteErr } = await supabase
    .from('incidents')
    .delete()
    .eq('id', incidentId)

  if (deleteErr) {
    return NextResponse.json({ error: 'Failed to delete incident', details: deleteErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    deletedIncidentId: incidentId,
    deletedClaimsCount: linkedClaims?.length ?? 0,
  })
}
