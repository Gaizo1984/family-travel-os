'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFamily } from '@/lib/family'
import { createUploadSlots, downloadAndClearStagedUpload, type UploadSlot } from '@/lib/actions/photo-staging'
import { parseStagedPaths } from '@/lib/staged-paths'
import { compressImageForStorage } from '@/lib/image-compression'
import { assessImageCheckBatch, compressForAiAnalysis, type ImageCheckAssessment } from '@/lib/photo-quality-analysis'
import { MAX_IMAGE_CHECK_PHOTOS, MAX_RETAINED_MEMORIES_PER_TRIP } from '@/lib/content-session-limits'

const TEMP_IMAGE_TTL_HOURS = 24

/**
 * §"Bild-Check ist kein neuer Content-Typ" (Nutzervorgabe, wörtlich):
 * eigener `project_type='image_check'` -- `content_projects.project_type`
 * hat kein CHECK-Constraint, daher keine Migration nötig, exakt das
 * etablierte Muster jedes bisherigen Content-Studio-Features.
 */
export async function startImageCheckProject(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const newPath = '/content-studio/bild-check/new'
  if (!tripId) redirect(`${newPath}?error=${encodeURIComponent('Bitte eine Reise auswählen.')}`)

  const supabase = await createClient()
  const { id: familyId } = await getFamily()
  const { data: trip } = await supabase.from('trips').select('title').eq('id', tripId).maybeSingle()

  const { data: project, error } = await supabase.from('content_projects').insert({
    family_id: familyId,
    trip_id: tripId,
    title: trip?.title ? `Bild-Check · ${trip.title}` : 'Bild-Check',
    status: 'uploading',
    project_type: 'image_check',
  }).select('id').single()

  if (error || !project)
    redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + (error?.message ?? 'unbekannt'))}`)

  redirect(`/content-studio/bild-check/${project.id}`)
}

/** Dünner Wrapper um das bestehende Signed-Upload-URL-Muster (lib/actions/photo-staging.ts) -- exakt wie createContentSessionUploadSlots. */
export async function createImageCheckUploadSlots(count: number): Promise<UploadSlot[]> {
  const { id: familyId } = await getFamily()
  return createUploadSlots(familyId, count)
}

/**
 * §"Maximal fünf Bilder" (Nutzervorgabe, wörtlich): wie
 * uploadContentSessionPhotos, aber auf MAX_IMAGE_CHECK_PHOTOS begrenzt und
 * ohne dHash-Duplikaterkennung (bei ≤5 Fotos in einem Rutsch nicht nötig --
 * die KI-Vergleichsbewertung erkennt ähnliche Motive ohnehin selbst).
 */
export async function uploadImageCheckPhotos(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '')
  const returnPath = `/content-studio/bild-check/${projectId}`
  if (!projectId) redirect('/content-studio/bild-check/new')

  const supabase = await createClient()
  const { data: project } = await supabase
    .from('content_projects').select('id, family_id')
    .eq('id', projectId).eq('project_type', 'image_check').maybeSingle()
  if (!project) redirect('/content-studio/bild-check/new')

  let stagedPaths = parseStagedPaths(formData.get('uploaded_paths'))
  if (stagedPaths.length === 0) redirect(returnPath)

  const { count: existingCount } = await supabase
    .from('content_project_photos').select('id', { count: 'exact', head: true }).eq('project_id', projectId)
  const remainingSlots = Math.max(0, MAX_IMAGE_CHECK_PHOTOS - (existingCount ?? 0))

  if (remainingSlots === 0)
    redirect(`${returnPath}?error=${encodeURIComponent(`Es sind bereits maximal ${MAX_IMAGE_CHECK_PHOTOS} Fotos hochgeladen.`)}`)

  const cappedCount = Math.max(0, stagedPaths.length - remainingSlots)
  stagedPaths = stagedPaths.slice(0, remainingSlots)

  const expiresAt = new Date(Date.now() + TEMP_IMAGE_TTL_HOURS * 60 * 60 * 1000).toISOString()
  let savedCount = 0
  let failedCount = 0

  for (const stagingPath of stagedPaths) {
    try {
      const staged = await downloadAndClearStagedUpload(stagingPath)
      if (!staged || !staged.mimeType.startsWith('image/') || staged.buffer.length > 15 * 1024 * 1024) {
        failedCount++
        continue
      }

      const compressed = await compressImageForStorage(staged.buffer)
      const storagePath = `content-session/${project.family_id}/${projectId}/${crypto.randomUUID()}.webp`

      const { error: uploadError } = await supabase.storage.from('documents')
        .upload(storagePath, new Blob([new Uint8Array(compressed)], { type: 'image/webp' }), { contentType: 'image/webp', cacheControl: '31536000' })
      if (uploadError) { failedCount++; continue }

      const { error: insertError } = await supabase.from('content_project_photos').insert({
        project_id: projectId, storage_path: storagePath, temporary: true, expires_at: expiresAt,
      })
      if (insertError) {
        await supabase.storage.from('documents').remove([storagePath])
        failedCount++
        continue
      }
      savedCount++
    } catch {
      failedCount++
    }
  }

  if (savedCount > 0) await supabase.from('content_projects').update({ status: 'ready_for_analysis' }).eq('id', projectId)

  const capMessage = cappedCount > 0
    ? ` ${cappedCount} Foto${cappedCount === 1 ? '' : 's'} wurde${cappedCount === 1 ? '' : 'n'} wegen des Limits von ${MAX_IMAGE_CHECK_PHOTOS} Fotos nicht hochgeladen.`
    : ''

  if (savedCount === 0 && failedCount > 0)
    redirect(`${returnPath}?error=${encodeURIComponent('Keines der Fotos konnte gespeichert werden.' + capMessage)}`)
  if (failedCount > 0)
    redirect(`${returnPath}?uploaded=${savedCount}&error=${encodeURIComponent(`${failedCount} von ${stagedPaths.length} Fotos konnten nicht gespeichert werden.${capMessage}`)}`)
  if (cappedCount > 0)
    redirect(`${returnPath}?uploaded=${savedCount}&error=${encodeURIComponent(capMessage.trim())}`)
  redirect(`${returnPath}?uploaded=${savedCount}`)
}

export type ImageCheckResultItem = ImageCheckAssessment & { photoId: string }
export type ImageCheckResult = { ok: boolean; results?: ImageCheckResultItem[]; error?: string }

/**
 * §"Analyse nur durch ausdrücklichen Klick" (Nutzervorgabe, wörtlich): kein
 * FormData-Action, client-aufgerufen wie startReelRender -- läuft komplett
 * in einem try/catch (gleiches Absturz-Schutz-Muster wie zuletzt bei
 * reel-render.ts), damit ein unerwarteter Fehler nie die Seite abstürzen
 * lässt. Schreibt NICHTS in die Datenbank -- das Ergebnis lebt nur im
 * Client-State der aufrufenden Komponente (Datenschutz-Vorgabe: keine
 * dauerhafte Speicherung ohne ausdrückliche Nutzeraktion).
 */
export async function runImageCheckAnalysis(projectId: string): Promise<ImageCheckResult> {
  try {
    const supabase = await createClient()
    const { id: familyId } = await getFamily()
    const { data: project } = await supabase
      .from('content_projects').select('id, trip_id')
      .eq('id', projectId).eq('family_id', familyId).eq('project_type', 'image_check').maybeSingle()
    if (!project) return { ok: false, error: 'Projekt nicht gefunden.' }

    const { data: photoRows } = await supabase
      .from('content_project_photos').select('id, storage_path')
      .eq('project_id', projectId).order('created_at', { ascending: true })
    const rows = photoRows ?? []
    if (rows.length === 0) return { ok: false, error: 'Bitte zuerst Fotos hochladen.' }

    const loaded = await Promise.all(rows.map(async (row) => {
      try {
        const { data: signed } = await supabase.storage.from('documents').createSignedUrl(row.storage_path, 60)
        if (!signed?.signedUrl) return null
        const res = await fetch(signed.signedUrl)
        const buffer = Buffer.from(await res.arrayBuffer())
        const aiBuffer = await compressForAiAnalysis(buffer)
        return { id: row.id, buffer: aiBuffer, mimeType: 'image/webp' as const }
      } catch {
        return null
      }
    }))
    const photos = loaded.filter((p): p is { id: string; buffer: Buffer; mimeType: 'image/webp' } => p !== null)
    if (photos.length === 0) return { ok: false, error: 'Fotos konnten nicht geladen werden.' }

    const assessments = await assessImageCheckBatch(
      photos.map((p) => ({ buffer: p.buffer, mimeType: p.mimeType })),
      'Bewerte diese Reisefotos einer Familie für die Weiterverwendung als Beitrag, Story oder Reel.',
    )
    if (!assessments) return { ok: false, error: 'Die Analyse ist gerade nicht verfügbar. Bitte gleich noch einmal versuchen.' }

    const results: ImageCheckResultItem[] = assessments
      .map((a) => ({ ...a, photoId: photos[a.photoIndex]?.id ?? '' }))
      .filter((r) => r.photoId)

    return { ok: true, results }
  } catch (e) {
    console.error('[image-check] runImageCheckAnalysis: unerwarteter Fehler', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: 'Analyse fehlgeschlagen (unerwarteter Fehler). Bitte gleich noch einmal versuchen.' }
  }
}

/**
 * §"Erst durch diesen Button soll das Bild in den bestehenden Beitrag- oder
 * Story-Workflow übernommen werden" (Nutzervorgabe, wörtlich): legt eine
 * neue Content-Session an (kleine, bewusst eigenständige Insert-Logik statt
 * Umbau von startContentSession, das selbst redirected und sich daher nicht
 * zwischenschalten lässt) und hängt die vorhandene Foto-Zeile per
 * `UPDATE ... SET project_id` um -- kein erneuter Upload, keine zweite
 * Kompression (schema-legal, siehe Migration content_project_photos: keine
 * Immutability-Regel auf project_id).
 */
export async function adoptImageCheckPhotoToSession(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const projectId = String(formData.get('project_id') ?? '')
  const format = String(formData.get('format') ?? '')
  const returnPath = `/content-studio/bild-check/${projectId}`
  if (!photoId || !projectId || (format !== 'carousel' && format !== 'story')) redirect(returnPath)

  const supabase = await createClient()
  const { id: familyId } = await getFamily()

  const { data: bildCheckProject } = await supabase
    .from('content_projects').select('id, trip_id')
    .eq('id', projectId).eq('family_id', familyId).eq('project_type', 'image_check').maybeSingle()
  if (!bildCheckProject) redirect(returnPath)

  const { data: photo } = await supabase
    .from('content_project_photos').select('id').eq('id', photoId).eq('project_id', projectId).maybeSingle()
  if (!photo) redirect(`${returnPath}?error=${encodeURIComponent('Foto nicht gefunden.')}`)

  const { data: trip } = bildCheckProject.trip_id
    ? await supabase.from('trips').select('title').eq('id', bildCheckProject.trip_id).maybeSingle()
    : { data: null }

  const formatLabel = format === 'story' ? 'Story' : 'Beitrag'
  const { data: newSession, error } = await supabase.from('content_projects').insert({
    family_id: familyId, trip_id: bildCheckProject.trip_id,
    title: trip?.title ? `${formatLabel} · ${trip.title}` : formatLabel,
    status: 'ready_for_analysis', project_type: 'session', output_format: format,
  }).select('id').single()

  if (error || !newSession)
    redirect(`${returnPath}?error=${encodeURIComponent('Speicherfehler: ' + (error?.message ?? 'unbekannt'))}`)

  const expiresAt = new Date(Date.now() + TEMP_IMAGE_TTL_HOURS * 60 * 60 * 1000).toISOString()
  await supabase.from('content_project_photos')
    .update({ project_id: newSession.id, temporary: true, expires_at: expiresAt })
    .eq('id', photoId)

  redirect(`/content-studio/session/${newSession.id}`)
}

/**
 * §"Erst durch diesen Button soll das Bild in den bestehenden Reel-Workflow
 * übernommen werden" (Nutzervorgabe, wörtlich): Reels lesen ausschließlich
 * aus memory_photos (nicht aus content_project_photos) -- hier ist ein
 * Umhängen NICHT möglich, es braucht denselben Copy-Pattern wie
 * retainContentSessionPhotoAsMemory (eigenständige Funktion wegen des
 * anderen Redirect-Ziels).
 */
export async function adoptImageCheckPhotoToReel(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const projectId = String(formData.get('project_id') ?? '')
  const returnPath = `/content-studio/bild-check/${projectId}`
  if (!photoId || !projectId) redirect(returnPath)

  const supabase = await createClient()
  const { id: familyId } = await getFamily()

  const { data: bildCheckProject } = await supabase
    .from('content_projects').select('id, trip_id')
    .eq('id', projectId).eq('family_id', familyId).eq('project_type', 'image_check').maybeSingle()
  if (!bildCheckProject?.trip_id) redirect(`${returnPath}?error=${encodeURIComponent('Diese Auswahl ist keiner Reise zugeordnet.')}`)

  const { data: photo } = await supabase
    .from('content_project_photos').select('id, storage_path').eq('id', photoId).eq('project_id', projectId).maybeSingle()
  if (!photo) redirect(`${returnPath}?error=${encodeURIComponent('Foto nicht gefunden.')}`)

  const { count } = await supabase
    .from('memory_photos').select('id', { count: 'exact', head: true })
    .eq('trip_id', bildCheckProject.trip_id).eq('is_selected', true)
  if ((count ?? 0) >= MAX_RETAINED_MEMORIES_PER_TRIP)
    redirect(`${returnPath}?error=${encodeURIComponent('Für diese Reise sind bereits 25 Erinnerungen gespeichert. Bitte zuerst ein Bild ersetzen oder entfernen.')}`)

  const { data: downloaded, error: downloadError } = await supabase.storage.from('documents').download(photo.storage_path)
  if (downloadError || !downloaded) redirect(`${returnPath}?error=${encodeURIComponent('Foto konnte nicht geladen werden.')}`)

  const buffer = Buffer.from(await downloaded.arrayBuffer())
  const compressed = await compressImageForStorage(buffer)
  const memoryPath = `memories/${familyId}/${crypto.randomUUID()}.webp`

  const { error: uploadError } = await supabase.storage.from('documents')
    .upload(memoryPath, new Blob([new Uint8Array(compressed)], { type: 'image/webp' }), { contentType: 'image/webp', cacheControl: '31536000' })
  if (uploadError) redirect(`${returnPath}?error=${encodeURIComponent('Speicherfehler: ' + uploadError.message)}`)

  const { error: insertError } = await supabase.from('memory_photos').insert({
    family_id: familyId, trip_id: bildCheckProject.trip_id, storage_path: memoryPath, is_selected: true,
  })
  if (insertError) {
    await supabase.storage.from('documents').remove([memoryPath])
    redirect(`${returnPath}?error=${encodeURIComponent('Speicherfehler: ' + insertError.message)}`)
  }

  redirect('/content-studio/reel/new')
}
