'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { getFamily } from '@/lib/family'
import { REEL_STYLE_OPTIONS } from '@/lib/ai-style-guidelines'

/**
 * §Content Studio 3.0, Sprint 1: legt den Reel-Projekt-Container an
 * (content_projects, project_type='reel') -- exakt dasselbe Anlage-Muster
 * wie `startContentSession` (lib/actions/content-sessions.ts), inkl.
 * Wiederverwendung des status-Feldes als Fortschritts-State-Machine
 * ("uploading" als generischer Anfangszustand, unabhängig davon, ob als
 * nächstes wirklich hochgeladen oder -- wie hier -- aus vorhandenen Medien
 * ausgewählt wird, siehe Sprint 2).
 *
 * §Sprint 2: nach dem Anlegen geht es direkt zur Medienauswahl
 * (/content-studio/reel/[projectId]/media) -- der tatsächliche nächste
 * Schritt im Flow, statt eines Zwischenstopps auf der generischen,
 * leeren Projektübersicht.
 */
export async function startReelProject(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const reelStyle = String(formData.get('reel_style') ?? '')
  const reelDurationRaw = String(formData.get('reel_duration_seconds') ?? '')
  const newPath = '/content-studio/reel/new'

  if (!tripId) redirect(`${newPath}?error=${encodeURIComponent('Bitte eine Reise auswählen.')}`)

  const validStyle = REEL_STYLE_OPTIONS.some((o) => o.value === reelStyle)
  if (!validStyle) redirect(`${newPath}?error=${encodeURIComponent('Bitte einen Stil auswählen.')}`)

  const reelDurationSeconds = Number(reelDurationRaw)
  if (reelDurationSeconds !== 15 && reelDurationSeconds !== 30 && reelDurationSeconds !== 60) {
    redirect(`${newPath}?error=${encodeURIComponent('Bitte eine Dauer auswählen (15, 30 oder 60 Sekunden).')}`)
  }

  const supabase = await createClient()
  const lumiCore = await createLumiCoreClient()
  const { id: familyId } = await getFamily()
  const { data: trip } = await lumiCore.from('travel_trips').select('title').eq('id', tripId).maybeSingle()

  const { data: project, error } = await lumiCore.from('travel_content_projects').insert({
    household_id: familyId,
    trip_id: tripId,
    title: trip?.title ? `Reel · ${trip.title}` : 'Reel',
    status: 'uploading',
    project_type: 'reel',
    reel_style: reelStyle,
    reel_duration_seconds: reelDurationSeconds,
  }).select('id').single()

  if (error || !project) {
    redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + (error?.message ?? 'unbekannt'))}`)
  }

  redirect(`/content-studio/reel/${project.id}/media`)
}

/**
 * §"Angefangene oder abgeschlossene Projekte sollten erneut aufrufbar sein.
 * Löschung kann/soll manuell erfolgen." (Nutzervorgabe, wörtlich): explizite,
 * manuelle Löschaktion -- es gibt keine automatische Aufräumung für
 * Reel-Projekte. `content_drafts`/`content_reel_media_items`/
 * `content_reel_renders` hängen per `ON DELETE CASCADE` an `content_projects`
 * und werden beim Löschen der Projekt-Zeile automatisch mitentfernt -- das
 * gilt aber NUR für die Datenbank-Zeilen, nicht für Storage-Dateien (kein
 * DB-Cascade kann Supabase-Storage-Objekte löschen). Storage-first (etabliertes
 * Muster): erst fertige Render-Ausgaben (content-reels) und eigene
 * Musikdateien (documents) entfernen, danach erst die Projekt-Zeile.
 */
export async function deleteReelProject(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/content-studio').trim() || '/content-studio'

  const supabase = await createClient()
  const lumiCore = await createLumiCoreClient()
  const { id: familyId } = await getFamily()

  const { data: project } = await lumiCore
    .from('travel_content_projects')
    .select('id')
    .eq('id', projectId).eq('household_id', familyId).eq('project_type', 'reel')
    .maybeSingle()
  if (!project) redirect(returnTo)

  const { data: drafts } = await lumiCore
    .from('travel_content_drafts')
    .select('id, structure')
    .eq('project_id', projectId)

  const draftIds = (drafts ?? []).map((d) => d.id)
  const customMusicPaths = (drafts ?? [])
    .map((d) => (d.structure as unknown as { music_storage_path?: string | null } | null)?.music_storage_path)
    .filter((p): p is string => Boolean(p))

  let renderOutputPaths: string[] = []
  if (draftIds.length > 0) {
    const { data: renders } = await lumiCore
      .from('travel_content_reel_renders')
      .select('output_storage_path')
      .in('draft_id', draftIds)
    renderOutputPaths = (renders ?? []).map((r) => r.output_storage_path).filter((p): p is string => Boolean(p))
  }

  // §"content-reels"-Bucket existiert in Lumi Core (noch) nicht -- bleibt
  // bewusst bei Travels eigenem Bucket (siehe Migrations-Kontext). Eigene
  // Musikdateien (content_drafts.structure.music_storage_path) sind bereits
  // migrierte travel_content_drafts-Daten, daher travel-documents.
  if (renderOutputPaths.length > 0) await supabase.storage.from('content-reels').remove(renderOutputPaths)
  if (customMusicPaths.length > 0) await lumiCore.storage.from('travel-documents').remove(customMusicPaths)

  await lumiCore.from('travel_content_projects').delete().eq('id', projectId)

  redirect(returnTo)
}
