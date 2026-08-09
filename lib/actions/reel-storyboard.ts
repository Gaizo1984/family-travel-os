'use server'

import OpenAI from 'openai'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { getFamily } from '@/lib/family'
import { createJob, completeJob, failJob } from '@/lib/ai-generation-jobs'
import { buildTripDigest } from '@/lib/trip-digest'
import { assessPhotoBatch } from '@/lib/photo-quality-analysis'
import { reelMediaLimitFor } from '@/lib/reel-media-limits'
import { REEL_STYLE_LABELS } from '@/lib/ai-style-guidelines'
import { FACT_RULE_INSTRUCTION, NO_CLICHE_INSTRUCTION } from '@/lib/ai-style-guidelines'
import { BASE_CONTENT_PROPS } from '@/lib/content-schema-fragments'

/**
 * §Content Studio 3.0, Sprint 3 -- KI-Storyboard für ein Reel-Projekt.
 * Zweistufig, wie im bestehenden Content-Studio-Muster
 * (lib/actions/content-sessions.ts::analyzeContentSession): Stufe 1 =
 * `assessPhotoBatch` (identische, einzige Bildbewertungs-Implementierung der
 * App) zur Kuratierung, Stufe 2 = EIN weiterer Bild-Aufruf (nicht textbasiert
 * wie sonst üblich), da `assessPhotoBatch` keine Bildbeschreibung liefert und
 * Stufe 2 sonst ohne visuelle Grundlage für Szenentext/-auswahl wäre.
 *
 * §"GPT-5.6 Terra für Storyboard und Szenenauswahl verwenden" (Nutzervorgabe,
 * wörtlich): Modellname exakt wie vom Nutzer benannt, bewusst abweichend vom
 * sonst im Repo für alle anderen KI-Flows genutzten `gpt-5.4`.
 */
const OPENAI_MODEL = 'gpt-5.6-terra'

const STORAGE_BUCKET = 'travel-documents'

type Candidate = {
  sourceType: 'photo' | 'video'
  sourceId: string
  buffer: Buffer
  mimeType: string
  durationSeconds: number | null
}

const STORYBOARD_SCENE_SCHEMA_ITEM = {
  type: 'object',
  properties: {
    source_type: { type: 'string', enum: ['photo', 'video'] },
    source_id: { type: 'string', description: 'Exakte ID aus der übergebenen Medienliste, nie erfunden' },
    duration_seconds: { type: 'number', description: 'Anzeigedauer dieser Szene im fertigen Reel' },
    transition: { type: 'string', description: 'Übergang zur nächsten Szene, z.B. cut, fade, whip_pan, zoom' },
    camera_motion: { type: 'string', description: 'Kamerabewegung im Standbild, z.B. ken_burns_in, ken_burns_out, static, pan_left, pan_right' },
    text_overlay: { type: 'string', description: 'Kurzer Textoverlay für diese Szene, leerer String wenn keiner passt' },
    video_start_seconds: {
      type: ['number', 'null'],
      description: 'Nur bei source_type="video": Startzeitpunkt im Quellclip in Sekunden. Bei source_type="photo" immer null.',
    },
  },
  required: ['source_type', 'source_id', 'duration_seconds', 'transition', 'camera_motion', 'text_overlay', 'video_start_seconds'],
  additionalProperties: false,
} as const

function buildStoryboardSchema(minScenes: number, maxScenes: number) {
  return {
    type: 'object',
    properties: {
      ...BASE_CONTENT_PROPS,
      hook: { type: 'string', description: 'Erster Moment/Text, der Aufmerksamkeit erzeugt' },
      scenes: {
        type: 'array',
        minItems: minScenes,
        maxItems: maxScenes,
        description: 'Kuratierte, sinnvoll geordnete Szenenfolge -- nicht zwingend jedes übergebene Medium, Wiederholungen/nahezu identische Motive vermeiden.',
        items: STORYBOARD_SCENE_SCHEMA_ITEM,
      },
      music_direction: { type: 'string', description: 'Musikrichtung/Stimmung als Beschreibung, keine urheberrechtlich geschützten Songtitel' },
      outro: { type: 'string' },
      reasoning: { type: 'string', description: 'Nachvollziehbare, kurze Begründung für Auswahl und Reihenfolge der Szenen' },
    },
    required: ['caption', 'hashtags', 'quality_check', 'hook', 'scenes', 'music_direction', 'outro', 'reasoning'],
    additionalProperties: false,
  }
}

async function loadOwnedReelProjectWithDetails(projectId: string, familyId: string) {
  const lumiCore = await createLumiCoreClient()
  const { data: project } = await lumiCore
    .from('travel_content_projects')
    .select('id, household_id, trip_id, project_type, reel_style, reel_duration_seconds')
    .eq('id', projectId)
    .eq('household_id', familyId)
    .eq('project_type', 'reel')
    .maybeSingle()
  return project
}

/**
 * §"Fakten nur aus Reisedaten und Medienanalyse ableiten" + "keine
 * Gesichtsidentifikation" (Nutzervorgaben, wörtlich): fester Prompt-Baustein,
 * in beiden KI-Stufen verwendet, wo relevant.
 */
const NO_FACE_ID_INSTRUCTION =
  'Analysiere ausschließlich Bildkomposition, Motiv, Aktivität, Licht und Ort. Führe KEINE Gesichtsidentifikation durch ' +
  'und nenne keine Namen oder Identitäten abgebildeter Personen, selbst wenn du sie zu erkennen glaubst.'

export async function generateReelStoryboard(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '')
  const returnTo = String(formData.get('return_to') ?? '').trim()
  if (!projectId) redirect('/content-studio')
  if (!process.env.OPENAI_API_KEY)
    redirect(`${returnTo}?error=${encodeURIComponent('Die Content-KI ist aktuell nicht konfiguriert.')}`)

  const { id: familyId } = await getFamily()
  const project = await loadOwnedReelProjectWithDetails(projectId, familyId)
  if (!project || !project.trip_id) redirect(returnTo || '/content-studio')

  const supabase = await createClient()
  const lumiCore = await createLumiCoreClient()
  const jobId = await createJob(familyId, 'reel_storyboard_generate', supabase)

  after(async () => {
    try {
      const durationSeconds = (project.reel_duration_seconds ?? 30) as 15 | 30 | 60
      const limit = reelMediaLimitFor(durationSeconds)
      const reelStyleLabel = REEL_STYLE_LABELS[project.reel_style ?? ''] ?? project.reel_style ?? 'Family Memory'

      const { data: itemsRaw } = await lumiCore
        .from('travel_content_reel_media_items')
        .select('source_type, source_id')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })
      const items = itemsRaw ?? []
      if (items.length < limit.min) {
        await failJob(jobId, `Bitte zuerst mindestens ${limit.min} Medien auswählen.`, supabase)
        return
      }

      const photoIds = items.filter((i) => i.source_type === 'photo').map((i) => i.source_id)
      const videoIds = items.filter((i) => i.source_type === 'video').map((i) => i.source_id)

      const [{ data: photoRowsRaw }, { data: videoRowsRaw }] = await Promise.all([
        photoIds.length > 0
          ? lumiCore.from('travel_memory_photos').select('id, storage_path').in('id', photoIds)
          : Promise.resolve({ data: [] as { id: string; storage_path: string }[] }),
        videoIds.length > 0
          ? lumiCore.from('travel_memory_videos').select('id, storage_path, thumbnail_storage_path, duration_seconds').in('id', videoIds)
          : Promise.resolve({ data: [] as { id: string; storage_path: string; thumbnail_storage_path: string | null; duration_seconds: number | null }[] }),
      ])
      const photoRows = photoRowsRaw ?? []
      const videoRows = videoRowsRaw ?? []

      const missingPosterframe = videoRows.some((v) => !v.thumbnail_storage_path)
      if (missingPosterframe) {
        await failJob(jobId, 'Für mindestens ein Video fehlt noch das Standbild. Bitte erneut versuchen.', supabase)
        return
      }

      const photoById = new Map(photoRows.map((p) => [p.id, p]))
      const videoById = new Map(videoRows.map((v) => [v.id, v]))

      // §Reihenfolge der ausgewählten Medien (sort_order) bleibt die Ladereihenfolge -- fehlerhafte Einzelmedien brechen den Rest nicht ab.
      const loaded = await Promise.all(items.map(async (item): Promise<Candidate | null> => {
        try {
          if (item.source_type === 'photo') {
            const row = photoById.get(item.source_id)
            if (!row) return null
            const { data: signed } = await lumiCore.storage.from(STORAGE_BUCKET).createSignedUrl(row.storage_path, 60)
            if (!signed?.signedUrl) return null
            const res = await fetch(signed.signedUrl)
            const buffer = Buffer.from(await res.arrayBuffer())
            return { sourceType: 'photo', sourceId: item.source_id, buffer, mimeType: 'image/webp', durationSeconds: null }
          }
          const row = videoById.get(item.source_id)
          if (!row?.thumbnail_storage_path) return null
          const { data: signed } = await lumiCore.storage.from(STORAGE_BUCKET).createSignedUrl(row.thumbnail_storage_path, 60)
          if (!signed?.signedUrl) return null
          const res = await fetch(signed.signedUrl)
          const buffer = Buffer.from(await res.arrayBuffer())
          return { sourceType: 'video', sourceId: item.source_id, buffer, mimeType: 'image/jpeg', durationSeconds: row.duration_seconds }
        } catch {
          return null
        }
      }))
      const candidates = loaded.filter((c): c is Candidate => c !== null)
      if (candidates.length < 2) {
        await failJob(jobId, 'Die Medien konnten nicht geladen werden. Bitte gleich noch einmal versuchen.', supabase)
        return
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const tripDigest = await buildTripDigest(project.trip_id as string)

      await lumiCore.from('travel_content_projects').update({ status: 'analyzing' }).eq('id', projectId)

      // ── Stufe 1: Kuratierung über die einzige, gemeinsame Bildbewertungs-Implementierung ──
      const assessments = await assessPhotoBatch(
        candidates.map((c) => ({ buffer: c.buffer, mimeType: c.mimeType })),
        `Bewerte diese Fotos/Video-Standbilder einer Familienreise für ein ${durationSeconds}-Sekunden-Reise-Reel im Stil "${reelStyleLabel}".`,
      )
      if (!assessments) {
        await failJob(jobId, 'Die Bildanalyse ist gerade nicht verfügbar. Bitte gleich noch einmal versuchen.', supabase)
        return
      }

      const manifestText = candidates
        .map((c, idx) => {
          const a = assessments.find((x) => x.photoIndex === idx)
          const qualityPart = a ? `Qualität ${a.qualityScore}/10${a.isBestMotif ? ', bestes Motiv' : ''}` : 'nicht bewertet'
          const durationPart = c.sourceType === 'video' && c.durationSeconds != null ? `, Clip-Länge ${Math.round(c.durationSeconds)}s` : ''
          return `[${idx}] source_type=${c.sourceType} source_id=${c.sourceId} -- ${qualityPart}${durationPart}`
        })
        .join('\n')

      const sceneCountGuidance = durationSeconds === 15
        ? 'Nutze für dieses 15-Sekunden-Reel eine kompakte Szenenzahl (eher wenige, aber starke Szenen).'
        : durationSeconds === 30
          ? 'Nutze für dieses 30-Sekunden-Reel eine größere Szenenzahl als bei einem 15-Sekunden-Reel.'
          : 'Nutze für dieses 60-Sekunden-Reel eine deutlich größere Szenenzahl als bei 15/30 Sekunden -- genug Abwechslung für die volle Länge, ohne einzelne Szenen unnötig zu strecken.'

      const minScenes = Math.min(3, candidates.length)
      const maxScenes = candidates.length

      const promptText = [
        `Du bist Video-Regisseur und erstellst ein Storyboard für ein ${durationSeconds}-Sekunden-Reise-Reel (Format 9:16, Stil "${reelStyleLabel}") einer Familie, ausschließlich aus den unten aufgeführten, bereits vorhandenen Fotos/Video-Standbildern.`,
        FACT_RULE_INSTRUCTION,
        NO_CLICHE_INSTRUCTION,
        NO_FACE_ID_INSTRUCTION,
        sceneCountGuidance,
        `Die Summe aller "duration_seconds" der Szenen soll ungefähr ${durationSeconds} Sekunden ergeben (kleine Abweichung ist ok).`,
        'Wähle bewusst eine Teilmenge aus, wenn Medien sich stark ähneln oder redundant wirken -- vermeide Wiederholungen/nahezu identische Motive in direkter Folge.',
        'Referenziere ausschließlich "source_id"-Werte exakt aus der Liste unten (mit passendem source_type), erfinde keine IDs.',
        'Bei source_type="video": "video_start_seconds" muss innerhalb der angegebenen Clip-Länge liegen. Bei source_type="photo": "video_start_seconds" ist immer null.',
        'Begründe Auswahl und Reihenfolge kurz und nachvollziehbar in "reasoning".',
        'Führe außerdem einen ehrlichen, kurzen Qualitäts-Check durch (quality_check).',
        `Reisekontext: ${tripDigest}`,
        `Medienliste (Index, Typ, ID, Bewertung):\n${manifestText}`,
      ].filter(Boolean).join('\n\n')

      const content: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail: 'high' }> = [
        { type: 'input_text', text: promptText },
      ]
      for (const c of candidates) content.push({ type: 'input_image', image_url: `data:${c.mimeType};base64,${c.buffer.toString('base64')}`, detail: 'high' })

      let result: {
        caption: string; hashtags: string[]; quality_check: unknown; hook: string; outro: string
        music_direction: string; reasoning: string
        scenes: Array<{
          source_type: 'photo' | 'video'; source_id: string; duration_seconds: number
          transition: string; camera_motion: string; text_overlay: string; video_start_seconds: number | null
        }>
      }
      try {
        const response = await openai.responses.create({
          model: OPENAI_MODEL,
          input: [{ role: 'user', content }],
          text: { format: { type: 'json_schema', name: 'reel_storyboard', schema: buildStoryboardSchema(minScenes, maxScenes), strict: true } },
        })
        result = JSON.parse(response.output_text)
      } catch {
        await failJob(jobId, 'Das Storyboard konnte gerade nicht erstellt werden. Bitte gleich noch einmal versuchen.', supabase)
        return
      }

      // §Verteidigung gegen halluzinierte IDs: nur Szenen behalten, die auf eine tatsächlich übergebene Kandidaten-ID verweisen.
      const candidateKeys = new Set(candidates.map((c) => `${c.sourceType}:${c.sourceId}`))
      const validScenes = result.scenes.filter((s) => candidateKeys.has(`${s.source_type}:${s.source_id}`))
      if (validScenes.length < 2) {
        await failJob(jobId, 'Das Storyboard konnte gerade nicht erstellt werden. Bitte gleich noch einmal versuchen.', supabase)
        return
      }

      const structure = {
        reel_style: project.reel_style,
        reel_duration_seconds: project.reel_duration_seconds,
        hook: result.hook,
        scenes: validScenes.map((s) => ({
          source_type: s.source_type, source_id: s.source_id, duration_seconds: s.duration_seconds,
          transition: s.transition, camera_motion: s.camera_motion, text_overlay: s.text_overlay,
          video_start_seconds: s.source_type === 'video' ? s.video_start_seconds : null,
        })),
        outro: result.outro,
        music_direction: result.music_direction,
        caption: result.caption,
        hashtags: result.hashtags,
        quality_check: result.quality_check,
        reasoning: result.reasoning,
      }

      const { error: draftError } = await lumiCore.from('travel_content_drafts').insert({
        project_id: projectId, draft_type: 'video_reel', structure,
      })
      if (draftError) {
        await failJob(jobId, 'Speicherfehler: ' + draftError.message, supabase)
        return
      }

      await lumiCore.from('travel_content_projects').update({ status: 'draft_created' }).eq('id', projectId)
      await completeJob(jobId, `${returnTo}?storyboard=1`, supabase)
    } catch (e) {
      console.error('[reel-storyboard] generateReelStoryboard fehlgeschlagen:', e instanceof Error ? e.message : e)
      await failJob(jobId, 'Das Storyboard konnte gerade nicht erstellt werden. Bitte später erneut versuchen.', supabase)
    }
  })

  redirect(`${returnTo}?job=${jobId}`)
}
