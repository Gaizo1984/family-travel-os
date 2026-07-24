#!/usr/bin/env node
// Einmaliger Smoke-Test fuer Content Studio 3.0 Sprint 2 (Medienauswahl).
// Prueft Storage- und (falls Rechte vorhanden) Datenbank-Operationen direkt
// gegen das echte, migrierte Projekt -- OHNE echte Familienmedien zu
// beruehren, alle Testzeilen/-dateien sind synthetisch und werden am Ende
// entfernt.

const require = (await import('node:module')).createRequire(import.meta.url)
require('dotenv').config({ path: '.env.local', quiet: true })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let failed = false
function check(label, condition, detail) {
  console.log((condition ? 'OK  ' : 'FAIL') + ' - ' + label + (detail ? ` (${detail})` : ''))
  if (!condition) failed = true
}

async function main() {
  // ── 1) Storage: signed-upload-Aequivalent + move() (kein Function-Buffering) ──
  const stagingPath = `uploads-staging/smoke-test/x-${Date.now()}`
  const finalPath = `smoke-test/x-${Date.now()}.mp4`
  const dummyBytes = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])

  const up = await supabase.storage.from('documents').upload(stagingPath, dummyBytes, { contentType: 'video/mp4' })
  check('Staging-Upload erfolgreich', !up.error, up.error?.message)

  const mv = await supabase.storage.from('documents').move(stagingPath, finalPath)
  check('storage.move() erfolgreich (kein Function-Buffering)', !mv.error, mv.error?.message)

  const listing = await supabase.storage.from('documents').list('smoke-test', { search: finalPath.split('/').pop() })
  check('Datei am Zielpfad vorhanden', (listing.data ?? []).some((f) => finalPath.endsWith(f.name)))

  const stagingListing = await supabase.storage.from('documents').list('uploads-staging/smoke-test', { search: stagingPath.split('/').pop() })
  check('Staging-Datei nach move() nicht mehr vorhanden', !(stagingListing.data ?? []).some((f) => stagingPath.endsWith(f.name)))

  await supabase.storage.from('documents').remove([finalPath, stagingPath])

  // ── 2) content_reel_media_items: Insert/Reorder/Delete ──
  // §Bekannter, von Sprint 2 unabhängiger Befund (siehe
  // 20260727000010_service_role_grants.sql): service_role fehlen aktuell
  // die SQL-GRANTs auf ALLEN public-Tabellen -- dieser Teil läuft daher nur,
  // sobald diese Migration angewendet wurde. Klarer Hinweis statt Absturz,
  // falls noch nicht der Fall.
  const personProbe = await supabase.from('persons').select('family_id').limit(1).single()
  if (personProbe.error) {
    console.log(`\nÜBERSPRUNGEN - Datenbank-Teil des Smoke-Tests (${personProbe.error.message}).`)
    console.log('Erwartet, solange 20260727000010_service_role_grants.sql noch nicht angewendet wurde.')
  } else {
    const familyId = personProbe.data.family_id

    const { data: project, error: projectError } = await supabase.from('content_projects').insert({
      family_id: familyId, trip_id: null, title: 'SMOKE-TEST (loeschbar)',
      status: 'uploading', project_type: 'reel', reel_style: 'family_memory', reel_duration_seconds: 15,
    }).select('id').single()
    check('Test-Projekt angelegt', !projectError && !!project?.id, projectError?.message)

    const fakeIdA = crypto.randomUUID()
    const fakeIdB = crypto.randomUUID()
    const { data: itemA } = await supabase.from('content_reel_media_items').insert({
      project_id: project.id, source_type: 'photo', source_id: fakeIdA, sort_order: 0,
    }).select('id').single()
    const { data: itemB } = await supabase.from('content_reel_media_items').insert({
      project_id: project.id, source_type: 'video', source_id: fakeIdB, sort_order: 1,
    }).select('id').single()
    check('Zwei Medien-Items eingefuegt', !!itemA?.id && !!itemB?.id)

    await supabase.from('content_reel_media_items').update({ sort_order: 1 }).eq('id', itemA.id)
    await supabase.from('content_reel_media_items').update({ sort_order: 0 }).eq('id', itemB.id)
    const { data: afterSwap } = await supabase.from('content_reel_media_items').select('id, sort_order').eq('project_id', project.id).order('sort_order')
    check('Reorder-Swap korrekt (B jetzt zuerst)', afterSwap?.[0]?.id === itemB.id && afterSwap?.[1]?.id === itemA.id)

    await supabase.from('content_reel_media_items').delete().eq('id', itemA.id)
    const { count: afterDelete } = await supabase.from('content_reel_media_items').select('id', { count: 'exact', head: true }).eq('project_id', project.id)
    check('Entfernen erfolgreich (nur noch 1 Item)', afterDelete === 1)

    const { data: video, error: videoError } = await supabase.from('memory_videos').insert({
      family_id: familyId, trip_id: null, storage_path: 'smoke-test/unused.mp4', duration_seconds: null,
    }).select('id').single()
    check('memory_videos-Zeile angelegt', !videoError && !!video?.id, videoError?.message)

    await supabase.from('memory_videos').delete().eq('id', video?.id ?? '')
    await supabase.from('content_projects').delete().eq('id', project.id)
    console.log('Cleanup (Datenbank) durchgeführt.')
  }

  console.log(failed ? '\n=== SMOKE TEST: FEHLER ===' : '\n=== SMOKE TEST: GRUEN (ggf. mit erwartetem DB-Teil-Überspringen) ===')
  process.exitCode = failed ? 1 : 0
}

main().catch((e) => {
  console.error('FEHLER:', e.message)
  process.exitCode = 1
})
