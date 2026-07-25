'use server'

import path from 'node:path'
import os from 'node:os'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { deployFunction, getOrCreateBucket, deploySiteFromBundle, renderMediaOnLambda, getRenderProgress, downloadMedia, deleteRender } from '@remotion/lambda'
import { createClient } from '@/lib/supabase/server'
import { getFamily } from '@/lib/family'
import { getRemotionLambdaEnv } from '@/lib/server-env'
import { REMOTION_LAMBDA_REGION, REMOTION_LAMBDA_SITE_NAME, REMOTION_LAMBDA_DELETE_AFTER, REMOTION_LAMBDA_COMPOSITION_BY_STYLE } from '@/lib/remotion-lambda-config'
import { getPhotoDisplayUrls } from '@/lib/photo-thumbnails'
import { normalizeTransition, normalizeCameraMotion } from '@/lib/reel-timeline-options'
import { isReelRenderLimitReached, incrementReelRenderUsage } from '@/lib/reel-render-usage'
import type { ReelStoryboardStructure } from '@/lib/reel-storyboard-types'
import type { ReelCompositionScene } from '@/remotion/ReelTimelineComposition'

/**
 * §Content Studio 3.0, Sprint 5 -- Vorschau-/Finalrender über die
 * BESTEHENDE Remotion-Lambda-Infrastruktur (eu-central-1, siehe Etappe 1/2 +
 * scripts/reel-lambda-test.mjs) und die bestehende Job-Queue-Tabelle
 * `content_reel_renders` (Sprint 1) -- "keine neue Renderinfrastruktur und
 * kein paralleles Datenmodell" (Nutzervorgabe, wörtlich). Läuft bewusst
 * ausschließlich client-getriggert per Polling (kein Webhook/Hintergrund-
 * prozess ohne Nutzer-Session) -- einfacher, und "Status und Fortschritt
 * per Polling anzeigen" war explizit gefordert.
 */

const RENDER_URL_TTL_SECONDS = 3600 // §"ausschließlich kurzlebige Signed URLs" (Nutzervorgabe): lang genug für einen kompletten Lambda-Render, trotzdem befristet.
const SOURCE_BUCKET = 'documents'
const OUTPUT_BUCKET = 'content-reels'
const BUNDLE_DIR = path.join(process.cwd(), 'remotion', '.output')
const MAX_ERROR_MESSAGE_LENGTH = 500

export type ReelRenderStatus = {
  id: string
  quality: 'preview_lowres' | 'final'
  status: string
  progressPercent: number | null
  errorMessage: string | null
  downloadUrl: string | null
  costDisplay: string | null
  outputSizeBytes: number | null
  renderDurationSeconds: number | null
  requestedAt: string
}

type StartResult = { ok: boolean; renderRowId?: string; error?: string }
type PollResult = { ok: boolean; render?: ReelRenderStatus; error?: string }

async function loadOwnedRenderContext(projectId: string) {
  const { id: familyId } = await getFamily()
  const supabase = await createClient()
  const { data: project } = await supabase
    .from('content_projects')
    .select('id, family_id, trip_id, reel_style, reel_duration_seconds')
    .eq('id', projectId).eq('family_id', familyId).eq('project_type', 'reel')
    .maybeSingle()
  if (!project) return null

  const { data: draft } = await supabase
    .from('content_drafts')
    .select('id, structure')
    .eq('project_id', projectId).eq('draft_type', 'video_reel')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!draft) return null

  return { supabase, familyId, project, draftId: draft.id, structure: draft.structure as unknown as ReelStoryboardStructure }
}

/**
 * §"Musik nur aus eigener hochgeladener Datei oder ohne Musik;
 * Platzhalter-Presets nicht in den Render übernehmen" (Nutzervorgabe,
 * wörtlich): `music_source==='preset'` liefert bewusst KEINE musicUrl --
 * Presets sind noch reine Label-Auswahl ohne echte Audiodatei (siehe
 * Sprint 4), ein Rendern damit würde eine Musik vortäuschen, die es gar
 * nicht gibt.
 */
async function resolveScenesForRender(
  supabase: Awaited<ReturnType<typeof createClient>>, structure: ReelStoryboardStructure, photoVariant: 'thumb800' | 'original',
): Promise<{ scenes: ReelCompositionScene[]; musicUrl: string | null } | null> {
  const photoIds = structure.scenes.filter((s) => s.source_type === 'photo').map((s) => s.source_id)
  const videoIds = structure.scenes.filter((s) => s.source_type === 'video').map((s) => s.source_id)

  const [{ data: photoRows }, { data: videoRows }] = await Promise.all([
    photoIds.length > 0 ? supabase.from('memory_photos').select('id, storage_path').in('id', photoIds) : Promise.resolve({ data: [] as { id: string; storage_path: string }[] }),
    videoIds.length > 0 ? supabase.from('memory_videos').select('id, storage_path').in('id', videoIds) : Promise.resolve({ data: [] as { id: string; storage_path: string }[] }),
  ])

  const photoPathById = new Map((photoRows ?? []).map((p) => [p.id, p.storage_path]))
  const photoUrlByPath = (photoRows?.length ?? 0) > 0
    ? await getPhotoDisplayUrls(SOURCE_BUCKET, (photoRows ?? []).map((p) => p.storage_path), photoVariant)
    : new Map()

  const videoUrlById = new Map<string, string>()
  for (const v of videoRows ?? []) {
    const { data: signed } = await supabase.storage.from(SOURCE_BUCKET).createSignedUrl(v.storage_path, RENDER_URL_TTL_SECONDS)
    if (signed?.signedUrl) videoUrlById.set(v.id, signed.signedUrl)
  }

  const scenes: ReelCompositionScene[] = []
  for (const s of structure.scenes) {
    let mediaUrl = ''
    if (s.source_type === 'photo') {
      const storagePath = photoPathById.get(s.source_id)
      mediaUrl = storagePath ? (photoUrlByPath.get(storagePath)?.url ?? '') : ''
    } else {
      mediaUrl = videoUrlById.get(s.source_id) ?? ''
    }
    if (!mediaUrl) return null // §Fehlendes Medium darf keinen kaputten Render auslösen -- lieber vorher abbrechen.
    scenes.push({
      sourceType: s.source_type, mediaUrl, durationSeconds: s.duration_seconds,
      transition: normalizeTransition(s.transition), cameraMotion: normalizeCameraMotion(s.camera_motion),
      textOverlay: s.text_overlay, videoStartSeconds: s.video_start_seconds,
    })
  }

  let musicUrl: string | null = null
  if (structure.music_source === 'custom' && structure.music_storage_path) {
    const { data: signed } = await supabase.storage.from(SOURCE_BUCKET).createSignedUrl(structure.music_storage_path, RENDER_URL_TTL_SECONDS)
    musicUrl = signed?.signedUrl ?? null
  }
  return { scenes, musicUrl }
}

async function toRenderStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: {
    id: string; quality: string; status: string; progress_percent: number | null; error_message: string | null
    output_storage_path: string | null; cost_estimate_usd: number | null; output_size_bytes: number | null
    render_duration_seconds: number | null; requested_at: string
  },
): Promise<ReelRenderStatus> {
  let downloadUrl: string | null = null
  if (row.status === 'completed' && row.output_storage_path) {
    const { data: signed } = await supabase.storage.from(OUTPUT_BUCKET).createSignedUrl(row.output_storage_path, RENDER_URL_TTL_SECONDS)
    downloadUrl = signed?.signedUrl ?? null
  }
  return {
    id: row.id, quality: row.quality as 'preview_lowres' | 'final', status: row.status,
    progressPercent: row.progress_percent, errorMessage: row.error_message, downloadUrl,
    costDisplay: row.cost_estimate_usd != null ? `$${Number(row.cost_estimate_usd).toFixed(3)}` : null,
    outputSizeBytes: row.output_size_bytes, renderDurationSeconds: row.render_duration_seconds, requestedAt: row.requested_at,
  }
}

/**
 * §"Zuerst Low-Res-Vorschau, danach optional Finalrender" (Nutzervorgabe):
 * ein Finalrender wird nur akzeptiert, wenn für denselben Draft bereits
 * mindestens ein abgeschlossener Vorschau-Render existiert.
 *
 * §"Vorschau und Finalrender müssen exakt 15 oder 30 Sekunden lang sein"
 * (Nutzervorgabe): Gesamtdauer wird VOR dem Trigger hart geprüft --
 * `calculateMetadata` (remotion/Root.tsx) würde zwar ohnehin die reale
 * Szenensumme rendern, ein Render mit einer bereits falschen Timeline soll
 * aber gar nicht erst starten, sondern klar auf die Timeline verweisen.
 */
export async function startReelRender(projectId: string, quality: 'preview_lowres' | 'final'): Promise<StartResult> {
  try {
    getRemotionLambdaEnv()
  } catch {
    return { ok: false, error: 'Rendering ist aktuell nicht konfiguriert.' }
  }

  const ctx = await loadOwnedRenderContext(projectId)
  if (!ctx) return { ok: false, error: 'Projekt/Storyboard nicht gefunden.' }

  const target = ctx.project.reel_duration_seconds ?? 30
  const total = ctx.structure.scenes.reduce((sum, s) => sum + s.duration_seconds, 0)
  if (Math.abs(total - target) > 0.05)
    return { ok: false, error: `Die Gesamtdauer der Timeline (${total.toFixed(1)}s) weicht von ${target}s ab. Bitte zuerst in der Timeline ausgleichen.` }

  if (quality === 'final') {
    const { count: previewCount } = await ctx.supabase.from('content_reel_renders')
      .select('id', { count: 'exact', head: true }).eq('draft_id', ctx.draftId).eq('quality', 'preview_lowres').eq('status', 'completed')
    if (!previewCount) return { ok: false, error: 'Bitte zuerst eine Vorschau erfolgreich rendern.' }
  }

  if (await isReelRenderLimitReached(ctx.familyId)) return { ok: false, error: 'Monatslimit für Reel-Renders erreicht.' }

  const compositionId = REMOTION_LAMBDA_COMPOSITION_BY_STYLE[ctx.project.reel_style ?? ''] ?? 'FamilyMemoryReel'
  const resolved = await resolveScenesForRender(ctx.supabase, ctx.structure, quality === 'final' ? 'original' : 'thumb800')
  if (!resolved) return { ok: false, error: 'Mindestens ein Medium konnte nicht geladen werden. Bitte gleich noch einmal versuchen.' }

  const { data: renderRow, error: insertError } = await ctx.supabase.from('content_reel_renders').insert({
    draft_id: ctx.draftId, quality, status: 'queued', provider: 'remotion_lambda', attempt_count: 1, max_attempts: 2,
  }).select('id').single()
  if (insertError || !renderRow) return { ok: false, error: 'Speicherfehler.' }

  // §Zähler wird schon HIER erhöht, nicht erst bei Erfolg -- jeder Versuch
  // verursacht echte AWS-Kosten unabhängig vom Ausgang (siehe reel-render-usage.ts).
  await incrementReelRenderUsage(ctx.familyId)

  if (!existsSync(BUNDLE_DIR)) {
    await ctx.supabase.from('content_reel_renders').update({ status: 'failed', error_message: 'Render-Bundle nicht gefunden.' }).eq('id', renderRow.id)
    return { ok: false, error: 'Rendering ist aktuell nicht verfügbar.' }
  }

  try {
    const { functionName } = await deployFunction({
      region: REMOTION_LAMBDA_REGION, createCloudWatchLogGroup: true, memorySizeInMb: 2048, diskSizeInMb: 2048, timeoutInSeconds: 120,
    })
    const { bucketName } = await getOrCreateBucket({ region: REMOTION_LAMBDA_REGION, enableFolderExpiry: true })
    const { serveUrl } = await deploySiteFromBundle({
      bucketName, region: REMOTION_LAMBDA_REGION, bundleDir: BUNDLE_DIR, siteName: REMOTION_LAMBDA_SITE_NAME,
    })

    const isPreview = quality === 'preview_lowres'
    const renderResult = await renderMediaOnLambda({
      region: REMOTION_LAMBDA_REGION, functionName, serveUrl, composition: compositionId,
      codec: 'h264', deleteAfter: REMOTION_LAMBDA_DELETE_AFTER, concurrency: 1,
      inputProps: { scenes: resolved.scenes, style: ctx.project.reel_style ?? 'family_memory', musicUrl: resolved.musicUrl },
      scale: isPreview ? 0.5 : 1, jpegQuality: isPreview ? 60 : 90,
    })

    await ctx.supabase.from('content_reel_renders').update({
      status: 'rendering', provider_job_id: renderResult.renderId, aws_bucket_name: bucketName, aws_function_name: functionName,
    }).eq('id', renderRow.id)

    return { ok: true, renderRowId: renderRow.id }
  } catch {
    await ctx.supabase.from('content_reel_renders').update({ status: 'failed', error_message: 'Render konnte nicht gestartet werden.' }).eq('id', renderRow.id)
    return { ok: false, error: 'Render konnte nicht gestartet werden. Bitte gleich noch einmal versuchen.' }
  }
}

/** Initiale Liste für die Render-Seite (Server-Component-Ladevorgang) -- dieselbe Formatierung wie das Polling, damit Erst-Render und Poll-Updates identisch aussehen. */
export async function listReelRenders(projectId: string): Promise<ReelRenderStatus[]> {
  const ctx = await loadOwnedRenderContext(projectId)
  if (!ctx) return []
  const { data: rows } = await ctx.supabase.from('content_reel_renders').select('*').eq('draft_id', ctx.draftId).order('requested_at', { ascending: false })
  return Promise.all((rows ?? []).map((row) => toRenderStatus(ctx.supabase, row)))
}

/**
 * §"Status und Fortschritt per Polling anzeigen" + "AWS-Zwischendatei nach
 * erfolgreicher Übernahme löschen" + "MP4 nur über Signed URL anzeigen und
 * herunterladen" (Nutzervorgabe, wörtlich): der Poll-Tick, der `done:true`
 * zuerst sieht, lädt herunter, übernimmt nach Supabase Storage und löscht
 * danach aktiv die AWS-Zwischendatei -- alles in diesem einen Aufruf, kein
 * separater Hintergrundschritt.
 */
export async function pollReelRenderStatus(projectId: string, renderRowId: string): Promise<PollResult> {
  const ctx = await loadOwnedRenderContext(projectId)
  if (!ctx) return { ok: false, error: 'Projekt/Storyboard nicht gefunden.' }

  const { data: row } = await ctx.supabase.from('content_reel_renders').select('*').eq('id', renderRowId).eq('draft_id', ctx.draftId).maybeSingle()
  if (!row) return { ok: false, error: 'Render nicht gefunden.' }

  if (row.status === 'completed' || row.status === 'failed' || !row.provider_job_id || !row.aws_bucket_name || !row.aws_function_name) {
    return { ok: true, render: await toRenderStatus(ctx.supabase, row) }
  }

  let progress
  try {
    progress = await getRenderProgress({
      renderId: row.provider_job_id, bucketName: row.aws_bucket_name, functionName: row.aws_function_name, region: REMOTION_LAMBDA_REGION,
    })
  } catch {
    // §Transienter Netzwerk-/AWS-Fehler beim Abfragen selbst -- kein Status-Wechsel, der nächste Poll-Tick versucht es erneut.
    return { ok: true, render: await toRenderStatus(ctx.supabase, row) }
  }

  if (progress.fatalErrorEncountered) {
    const message = (progress.errors ?? []).map((e) => e.message).filter(Boolean).join('; ').slice(0, MAX_ERROR_MESSAGE_LENGTH) || 'Unbekannter Renderfehler.'
    await ctx.supabase.from('content_reel_renders').update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() }).eq('id', renderRowId)
    return { ok: true, render: await toRenderStatus(ctx.supabase, { ...row, status: 'failed', error_message: message }) }
  }

  if (!progress.done) {
    const percent = Math.round((progress.overallProgress ?? 0) * 100)
    await ctx.supabase.from('content_reel_renders').update({ progress_percent: percent }).eq('id', renderRowId)
    return { ok: true, render: await toRenderStatus(ctx.supabase, { ...row, progress_percent: percent }) }
  }

  const tmpPath = path.join(os.tmpdir(), `reel-render-${renderRowId}.mp4`)
  try {
    await downloadMedia({ region: REMOTION_LAMBDA_REGION, bucketName: row.aws_bucket_name, renderId: row.provider_job_id, outPath: tmpPath })
    const fileBuffer = readFileSync(tmpPath)
    const outputPath = `${ctx.familyId}/${projectId}/${ctx.draftId}/${row.quality}-${renderRowId}.mp4`
    const { error: uploadError } = await ctx.supabase.storage.from(OUTPUT_BUCKET).upload(outputPath, fileBuffer, { contentType: 'video/mp4', upsert: true })

    if (uploadError) {
      const message = 'Übernahme nach Supabase Storage fehlgeschlagen.'
      await ctx.supabase.from('content_reel_renders').update({ status: 'failed', error_message: message }).eq('id', renderRowId)
      return { ok: true, render: await toRenderStatus(ctx.supabase, { ...row, status: 'failed', error_message: message }) }
    }

    // §Löschung NUR nach erfolgreicher Übernahme, Fehler dabei sind nicht fatal (deleteAfter-Lifecycle-Regel bleibt als Sicherheitsnetz).
    await deleteRender({ region: REMOTION_LAMBDA_REGION, bucketName: row.aws_bucket_name, renderId: row.provider_job_id }).catch(() => null)

    const requestedAtMs = new Date(row.requested_at).getTime()
    const renderDurationSeconds = Math.round((Date.now() - requestedAtMs) / 100) / 10
    const outputDurationSeconds = ctx.structure.scenes.reduce((sum, s) => sum + s.duration_seconds, 0)

    const updatePayload = {
      status: 'completed', progress_percent: 100, output_storage_path: outputPath, output_duration_seconds: outputDurationSeconds,
      cost_estimate_usd: progress.costs?.accruedSoFar ?? null, output_size_bytes: progress.outputSizeInBytes ?? null,
      render_duration_seconds: renderDurationSeconds, completed_at: new Date().toISOString(),
    }
    await ctx.supabase.from('content_reel_renders').update(updatePayload).eq('id', renderRowId)
    return { ok: true, render: await toRenderStatus(ctx.supabase, { ...row, ...updatePayload }) }
  } catch {
    const message = 'Übernahme des Renders fehlgeschlagen.'
    await ctx.supabase.from('content_reel_renders').update({ status: 'failed', error_message: message }).eq('id', renderRowId)
    return { ok: true, render: await toRenderStatus(ctx.supabase, { ...row, status: 'failed', error_message: message }) }
  } finally {
    if (existsSync(tmpPath)) unlinkSync(tmpPath)
  }
}
