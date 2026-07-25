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

    // §Content Studio 3.0, Sprint 3: neue Persistenz-Oberflaeche
    // (content_drafts, draft_type='video_reel') -- additiv, keine neue
    // Tabelle/Migration, daher hier statt in einer eigenen Migration geprueft.
    const { data: draft, error: draftError } = await supabase.from('content_drafts').insert({
      project_id: project.id, draft_type: 'video_reel',
      structure: { hook: 'SMOKE-TEST', scenes: [{ source_type: 'photo', source_id: fakeIdA, duration_seconds: 2, transition: 'cut', camera_motion: 'static', text_overlay: '', video_start_seconds: null }], outro: '', music_direction: '', caption: '', hashtags: [], quality_check: null, reasoning: '' },
    }).select('id').single()
    check('content_drafts (draft_type=video_reel) angelegt', !draftError && !!draft?.id, draftError?.message)

    // §Content Studio 3.0, Sprint 4: Timeline-Mutationen (reel-timeline.ts)
    // schreiben die Struktur per Read-Modify-Write auf DIESELBE
    // content_drafts-Zeile zurueck (kein neuer Draft) -- hier geprueft, dass
    // ein solches Update inkl. des Undo-Feldes "_previous_scenes" korrekt
    // rundtrippt (JSONB-Serialisierung).
    const sceneA = { source_type: 'photo', source_id: fakeIdA, duration_seconds: 2, transition: 'cut', camera_motion: 'static', text_overlay: 'A', video_start_seconds: null }
    const sceneB = { source_type: 'video', source_id: fakeIdB, duration_seconds: 3, transition: 'fade', camera_motion: 'ken_burns_in', text_overlay: 'B', video_start_seconds: 1 }
    const { error: updateError } = await supabase.from('content_drafts').update({
      structure: { hook: 'SMOKE-TEST', scenes: [sceneB, sceneA], outro: '', music_direction: '', caption: '', hashtags: [], quality_check: null, reasoning: '', _previous_scenes: [sceneA, sceneB] },
    }).eq('id', draft?.id ?? '')
    const { data: reread } = await supabase.from('content_drafts').select('structure').eq('id', draft?.id ?? '').maybeSingle()
    check(
      'Timeline-Update (Reorder + Undo-Snapshot) rundtrippt korrekt',
      !updateError && reread?.structure?.scenes?.[0]?.source_id === fakeIdB && reread?.structure?._previous_scenes?.length === 2,
      updateError?.message,
    )
    // §Content Studio 3.0, Sprint 5: content_reel_renders (Sprint 1, bisher
    // ungenutzt) plus die neuen additiven Metadaten-Spalten
    // (cost_estimate_usd/output_size_bytes/render_duration_seconds/
    // aws_bucket_name/aws_function_name aus
    // 20260727000011_reel_render_metadata.sql) -- rein DB-seitig geprueft,
    // ohne einen echten AWS-Render auszuloesen.
    const { data: renderRow, error: renderError } = await supabase.from('content_reel_renders').insert({
      draft_id: draft.id, quality: 'preview_lowres', status: 'queued', provider: 'remotion_lambda', attempt_count: 1, max_attempts: 2,
    }).select('id').single()
    check('content_reel_renders-Zeile angelegt', !renderError && !!renderRow?.id, renderError?.message)

    const { error: renderUpdateError } = await supabase.from('content_reel_renders').update({
      status: 'completed', progress_percent: 100, cost_estimate_usd: 0.002, output_size_bytes: 813366,
      render_duration_seconds: 65.8, aws_bucket_name: 'smoke-test-bucket', aws_function_name: 'smoke-test-function',
      output_storage_path: 'smoke-test/unused.mp4', output_duration_seconds: 15,
    }).eq('id', renderRow?.id ?? '')
    if (renderUpdateError?.message?.includes("Could not find the 'aws_bucket_name' column")) {
      console.log('\nÜBERSPRUNGEN - Render-Metadaten-Spalten (' + renderUpdateError.message + ').')
      console.log('Erwartet, solange 20260727000011_reel_render_metadata.sql noch nicht angewendet wurde.\n')
    } else {
      const { data: renderReread } = await supabase.from('content_reel_renders').select('*').eq('id', renderRow?.id ?? '').maybeSingle()
      check(
        'content_reel_renders Render-Metadaten (Kosten/Größe/Dauer) rundtrippen korrekt',
        !renderUpdateError && renderReread?.cost_estimate_usd === 0.002 && renderReread?.output_size_bytes === 813366 && renderReread?.aws_bucket_name === 'smoke-test-bucket',
        renderUpdateError?.message,
      )
    }
    // §Content Studio 3.0, Sprint 6: "fertige Reels löschen und
    // Storage-Dateien mit entfernen" -- prueft das Storage-first-Loeschmuster
    // von deleteReelRender direkt (echte Datei in content-reels, danach
    // Storage-Entfernung + DB-Zeilen-Loeschung, beides verifiziert).
    const outputPath = `smoke-test/${Date.now()}-delete-check.mp4`
    const outputUp = await supabase.storage.from('content-reels').upload(outputPath, new Uint8Array([0, 0, 0, 0]), { contentType: 'video/mp4' })
    await supabase.from('content_reel_renders').update({ output_storage_path: outputPath }).eq('id', renderRow?.id ?? '')
    const removeResult = await supabase.storage.from('content-reels').remove([outputPath])
    const { data: afterRemoveListing } = await supabase.storage.from('content-reels').list('smoke-test', { search: outputPath.split('/').pop() })
    await supabase.from('content_reel_renders').delete().eq('id', renderRow?.id ?? '')
    const { data: renderAfterDelete } = await supabase.from('content_reel_renders').select('id').eq('id', renderRow?.id ?? '').maybeSingle()
    check(
      'deleteReelRender-Muster: Storage-Datei UND DB-Zeile entfernt',
      !outputUp.error && !removeResult.error && !(afterRemoveListing ?? []).some((f) => outputPath.endsWith(f.name)) && !renderAfterDelete,
      outputUp.error?.message ?? removeResult.error?.message,
    )

    await supabase.from('content_drafts').delete().eq('id', draft?.id ?? '')

    // §Sprint 4: eigene Musikdatei landet im bestehenden "documents"-Bucket
    // unter familyId/reel-music/{projectId}/... (kein neuer Bucket, siehe
    // lib/actions/reel-timeline.ts::uploadReelMusic) -- gleiches
    // Signed-Upload+move()-Muster wie Video, hier fuer Audio geprueft.
    const musicStaging = `uploads-staging/smoke-test/music-${Date.now()}`
    const musicFinal = `${familyId}/reel-music/${project.id}/music-${Date.now()}.mp3`
    const musicUp = await supabase.storage.from('documents').upload(musicStaging, new Uint8Array([0, 0, 0, 0]), { contentType: 'audio/mpeg' })
    const musicMv = await supabase.storage.from('documents').move(musicStaging, musicFinal)
    check('Musikdatei-Upload + move() erfolgreich', !musicUp.error && !musicMv.error, (musicUp.error ?? musicMv.error)?.message)
    await supabase.storage.from('documents').remove([musicFinal, musicStaging])

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
