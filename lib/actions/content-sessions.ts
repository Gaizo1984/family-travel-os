'use server'

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getFamily } from '@/lib/family'
import { createUploadSlots, downloadAndClearStagedUpload, type UploadSlot } from '@/lib/actions/photo-staging'
import { parseStagedPaths } from '@/lib/staged-paths'
import { compressImageForStorage } from '@/lib/image-compression'
import { computeDHash, hammingDistance, DUPLICATE_HASH_THRESHOLD } from '@/lib/image-hash'
import { buildTripDigest } from '@/lib/trip-digest'
import {
  NO_CLICHE_INSTRUCTION, FACT_RULE_INSTRUCTION, ENGAGEMENT_ANGLE_INSTRUCTION,
  tonalityInstruction, languageInstruction, CONTENT_FOCUS_LABELS, CONTENT_MOOD_LABELS,
} from '@/lib/ai-style-guidelines'
import { MAX_RETAINED_MEMORIES_PER_TRIP, MAX_PHOTOS_BY_FORMAT, DEFAULT_MAX_PHOTOS, MAX_SELECTED_FOR_CAROUSEL, CONTENT_FORMAT_LABELS } from '@/lib/content-session-limits'
import type { Json } from '@/lib/supabase/types'

/** Gleiches Modell wie alle übrigen KI-Flows (Pass/ESTA/Beleg/Reiseideen/Content). */
const OPENAI_MODEL = 'gpt-5.4'

/** §"Beliebig viele Bilder (10/30/50+)": kein Gesamt-Limit -- der Client ruft dies in Batches von maximal 20 mehrfach auf (createUploadSlots-Limit). Das eigentliche formatabhängige Limit greift erst in uploadContentSessionPhotos/analyzeContentSession. */
export async function createContentSessionUploadSlots(count: number): Promise<UploadSlot[]> {
  const { id: familyId } = await getFamily()
  return createUploadSlots(familyId, count)
}

const TEMP_IMAGE_TTL_HOURS = 24

/**
 * §"Content Studio 2.0": legt den Session-Container an (content_projects,
 * project_type='session' -- kollidiert nie mit den bestehenden 'ideas'/
 * 'photo_analysis'-Projekten derselben Reise). Die Content-Art wird jetzt
 * NICHT hier, sondern über chooseContentSessionFormat abgefragt -- BEVOR der
 * Bild-Upload beginnt, damit das formatabhängige Upload-Limit von Anfang an
 * gilt statt erst nachträglich bei "Content erstellen".
 */
export async function startContentSession(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const stageId = String(formData.get('stage_id') ?? '').trim() || null
  const contentDate = String(formData.get('content_date') ?? '').trim() || null
  const newPath = '/content-studio/session/new'

  if (!tripId) redirect(`${newPath}?error=${encodeURIComponent('Bitte eine Reise auswählen.')}`)

  const supabase = await createClient()
  const { id: familyId } = await getFamily()
  const { data: trip } = await supabase.from('trips').select('title').eq('id', tripId).maybeSingle()

  const { data: project, error } = await supabase.from('content_projects').insert({
    family_id: familyId,
    trip_id: tripId,
    title: trip?.title ?? 'Content-Session',
    status: 'uploading',
    project_type: 'session',
    content_date: contentDate,
    stage_id: stageId,
  }).select('id').single()

  if (error || !project)
    redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + (error?.message ?? 'unbekannt'))}`)

  redirect(`/content-studio/session/${project.id}`)
}

/**
 * §"Content-Art steht vor dem Bild-Upload fest": setzt/ändert output_format
 * auf der Session. Ein späteres Ändern (z.B. Beitrag -> Story) bleibt
 * möglich -- das jeweils gültige Upload-/Analyse-Limit wird an anderer
 * Stelle (uploadContentSessionPhotos/analyzeContentSession) immer live aus
 * dem AKTUELLEN output_format gelesen, nie zwischengespeichert.
 */
export async function chooseContentSessionFormat(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '')
  const outputFormat = String(formData.get('output_format') ?? '').trim()
  const returnPath = `/content-studio/session/${projectId}`
  if (!projectId) redirect('/content-studio/session/new')
  if (!outputFormat || !(outputFormat === 'package' || outputFormat in CONTENT_FORMAT_SCHEMAS))
    redirect(`${returnPath}?error=${encodeURIComponent('Bitte eine Content-Art auswählen.')}`)

  const supabase = await createClient()
  await supabase.from('content_projects').update({ output_format: outputFormat }).eq('id', projectId)
  redirect(returnPath)
}

/**
 * §"Bilder werden nur zur Content-Erstellung verwendet und nicht dauerhaft
 * gespeichert": eigener Storage-Pfad (content-session/... statt content-
 * media/...) + `temporary=true` + `expires_at` (24h) -- Grundlage für den
 * Cleanup-Cron (app/api/cron/cleanup-content-sessions). Einzelne
 * fehlgeschlagene Fotos brechen den restlichen Batch nicht ab.
 *
 * §"Formatabhängige Bildlimits": das Limit gilt für die Gesamtmenge bereits
 * gespeicherter (nicht-Dubletten-)Fotos der Session -- ein Upload, der das
 * Limit überschreiten würde, wird an der Grenze gekappt statt komplett
 * abgelehnt, mit klarer Rückmeldung, wie viele davon NICHT gespeichert wurden.
 */
export async function uploadContentSessionPhotos(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '')
  const returnPath = `/content-studio/session/${projectId}`
  if (!projectId) redirect('/content-studio/session/new')

  const supabase = await createClient()
  const { data: project } = await supabase.from('content_projects').select('id, family_id, output_format').eq('id', projectId).maybeSingle()
  if (!project) redirect('/content-studio/session/new')

  let stagedPaths = parseStagedPaths(formData.get('uploaded_paths'))
  if (stagedPaths.length === 0) redirect(returnPath)

  const maxPhotos = project.output_format ? (MAX_PHOTOS_BY_FORMAT[project.output_format] ?? DEFAULT_MAX_PHOTOS) : DEFAULT_MAX_PHOTOS
  const { count: existingCount } = await supabase
    .from('content_project_photos').select('id', { count: 'exact', head: true })
    .eq('project_id', projectId).is('is_duplicate_of', null)
  const remainingSlots = Math.max(0, maxPhotos - (existingCount ?? 0))
  const formatLabel = project.output_format ? (CONTENT_FORMAT_LABELS[project.output_format] ?? project.output_format) : 'diese Content-Art'

  if (remainingSlots === 0)
    redirect(`${returnPath}?error=${encodeURIComponent(`Für ${formatLabel} sind bereits maximal ${maxPhotos} Fotos hochgeladen.`)}`)

  const cappedCount = Math.max(0, stagedPaths.length - remainingSlots)
  stagedPaths = stagedPaths.slice(0, remainingSlots)

  const { data: existingPhotosRaw } = await supabase
    .from('content_project_photos').select('id, phash').eq('project_id', projectId).not('phash', 'is', null)
  const hashPool = (existingPhotosRaw ?? []) as { id: string; phash: string }[]

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
        .upload(storagePath, new Blob([new Uint8Array(compressed)], { type: 'image/webp' }), { contentType: 'image/webp' })
      if (uploadError) { failedCount++; continue }

      const phash = await computeDHash(compressed)
      const duplicateOf = phash !== null
        ? hashPool.find((p) => hammingDistance(p.phash, phash) <= DUPLICATE_HASH_THRESHOLD) ?? null
        : null

      const { data: photoRow, error: insertError } = await supabase.from('content_project_photos').insert({
        project_id: projectId,
        storage_path: storagePath,
        phash,
        is_duplicate_of: duplicateOf?.id ?? null,
        is_selected: !duplicateOf,
        temporary: true,
        expires_at: expiresAt,
      }).select('id').single()

      if (insertError || !photoRow) {
        await supabase.storage.from('documents').remove([storagePath])
        failedCount++
        continue
      }
      if (phash) hashPool.push({ id: photoRow.id, phash })
      savedCount++
    } catch {
      failedCount++
    }
  }

  if (savedCount > 0)
    await supabase.from('content_projects').update({ status: 'ready_for_analysis' }).eq('id', projectId)

  const capMessage = cappedCount > 0 ? ` ${cappedCount} Foto${cappedCount === 1 ? '' : 's'} wurde${cappedCount === 1 ? '' : 'n'} wegen des Limits von ${maxPhotos} Fotos für ${formatLabel} nicht hochgeladen.` : ''

  if (savedCount === 0 && failedCount > 0)
    redirect(`${returnPath}?error=${encodeURIComponent('Keines der Fotos konnte gespeichert werden.' + capMessage)}`)
  if (failedCount > 0)
    redirect(`${returnPath}?uploaded=${savedCount}&error=${encodeURIComponent(`${failedCount} von ${stagedPaths.length} Fotos konnten nicht gespeichert werden.${capMessage}`)}`)
  if (cappedCount > 0)
    redirect(`${returnPath}?uploaded=${savedCount}&error=${encodeURIComponent(capMessage.trim())}`)
  redirect(`${returnPath}?uploaded=${savedCount}`)
}

const ASSESSMENT_BATCH_SIZE = 20

const SESSION_ASSESSMENT_SCHEMA = {
  type: 'object',
  properties: {
    assessments: {
      type: 'array',
      description: 'Genau ein Eintrag pro übergebenem Foto, in derselben Reihenfolge.',
      items: {
        type: 'object',
        properties: {
          photo_index: { type: 'integer', description: 'Index des Fotos in der übergebenen Reihenfolge, beginnend bei 0' },
          quality_score: { type: 'integer', description: '1 (schwach) bis 10 (hervorragendes Motiv)' },
          is_best_motif: { type: 'boolean' },
          visual_description: { type: 'string', description: 'Kurze, konkrete Beschreibung (1 Satz): Motiv/Szene/Stimmung' },
        },
        required: ['photo_index', 'quality_score', 'is_best_motif', 'visual_description'],
        additionalProperties: false,
      },
    },
  },
  required: ['assessments'],
  additionalProperties: false,
}

const BASE_CONTENT_PROPS = {
  caption: { type: 'string', description: 'Fertige Bildunterschrift mit Emojis' },
  hashtags: { type: 'array', items: { type: 'string' }, maxItems: 12 },
  quality_check: {
    type: 'object',
    description: 'Ehrliche Kurzbewertung: Bild-Text-Passung, visuelle Vielfalt, Hook-Stärke, Engagement-Potenzial, Authentizität.',
    properties: {
      rating: { type: 'string', enum: ['stark', 'solide', 'verbesserungsfaehig'] },
      summary: { type: 'string', description: 'Ein bis zwei Sätze Begründung' },
      suggestions: { type: 'array', items: { type: 'string' }, description: 'Konkrete Verbesserungsvorschläge, leeres Array wenn rating="stark"' },
    },
    required: ['rating', 'summary', 'suggestions'],
    additionalProperties: false,
  },
}

const CONTENT_FORMAT_SCHEMAS: Record<string, Record<string, unknown>> = {
  carousel: {
    type: 'object',
    properties: {
      ...BASE_CONTENT_PROPS,
      cover_photo_id: { type: 'string', description: 'ID des empfohlenen Titelbilds aus der Fotoliste' },
      cover_reasoning: { type: 'string', description: 'Kurze Begründung für Titelbild und Bildauswahl/-reihenfolge' },
      slides: {
        type: 'array', minItems: 1, maxItems: 7,
        description: `Maximal ${MAX_SELECTED_FOR_CAROUSEL} ausgewählte Bilder in sinnvoller Reihenfolge mit visueller Vielfalt.`,
        items: {
          type: 'object',
          properties: { photo_id: { type: 'string' }, text: { type: 'string' } },
          required: ['photo_id', 'text'], additionalProperties: false,
        },
      },
      closing_note: { type: 'string', description: 'Kurzer Text für die Abschluss-Slide' },
    },
    required: ['caption', 'hashtags', 'quality_check', 'cover_photo_id', 'cover_reasoning', 'slides', 'closing_note'],
    additionalProperties: false,
  },
  story: {
    type: 'object',
    properties: {
      ...BASE_CONTENT_PROPS,
      slides: {
        type: 'array', minItems: 1, maxItems: 4,
        description: 'Entweder EIN starkes Bild oder eine Storyline aus 2-4 Slides -- kurze, spontane Texte, deutlich kürzer als ein Beitrags-Caption.',
        items: {
          type: 'object',
          properties: { photo_id: { type: 'string' }, text: { type: 'string' } },
          required: ['photo_id', 'text'], additionalProperties: false,
        },
      },
      sticker_idea: { type: 'string', description: 'Idee für Sticker/Umfrage/Interaktion, kurz -- leerer String wenn nicht passend' },
      opening_note: { type: 'string' },
      closing_note: { type: 'string' },
    },
    required: ['caption', 'hashtags', 'quality_check', 'slides', 'sticker_idea', 'opening_note', 'closing_note'],
    additionalProperties: false,
  },
  reel: {
    type: 'object',
    properties: {
      ...BASE_CONTENT_PROPS,
      hook: { type: 'string', description: 'Erster Satz/Einstieg, der Aufmerksamkeit erzeugt' },
      scenes: {
        type: 'array',
        description: 'Konkrete Szenenreihenfolge mit Dramaturgie (Intro/Hauptteil/Outro), nicht nur eine Bilderliste.',
        items: {
          type: 'object',
          properties: { photo_id: { type: 'string' }, text: { type: 'string' } },
          required: ['photo_id', 'text'], additionalProperties: false,
        },
      },
      music_direction: { type: 'string', description: 'Musikrichtung/Stimmung als Beschreibung, keine urheberrechtlich geschützten Songtitel' },
      outro: { type: 'string' },
    },
    required: ['caption', 'hashtags', 'quality_check', 'hook', 'scenes', 'music_direction', 'outro'],
    additionalProperties: false,
  },
  day_recap: {
    type: 'object',
    properties: { ...BASE_CONTENT_PROPS },
    required: ['caption', 'hashtags', 'quality_check'],
    additionalProperties: false,
  },
  highlight: {
    type: 'object',
    properties: { ...BASE_CONTENT_PROPS },
    required: ['caption', 'hashtags', 'quality_check'],
    additionalProperties: false,
  },
  hotel_content: {
    type: 'object',
    properties: {
      ...BASE_CONTENT_PROPS,
      family_perspective: { type: 'string', description: 'Kurzer Absatz: das Hotel aus Familienperspektive' },
      design_atmosphere: { type: 'string', description: 'Kurzer Absatz: Design und Atmosphäre' },
      food: { type: 'string', description: 'Kurzer Absatz: Essen/Gastronomie' },
      pool_or_beach: { type: 'string', description: 'Kurzer Absatz: Pool oder Strand' },
      factual_rating: { type: 'string', description: 'Sachliche, nicht werbliche Kurzbewertung -- nur auf Basis vorhandener Reisedaten/Bilder, keine erfundenen Fakten' },
    },
    required: ['caption', 'hashtags', 'quality_check', 'family_perspective', 'design_atmosphere', 'food', 'pool_or_beach', 'factual_rating'],
    additionalProperties: false,
  },
}

const FORMAT_TO_DRAFT_TYPE: Record<string, string> = {
  carousel: 'carousel_plan', story: 'story_plan', reel: 'reel_plan',
  day_recap: 'day_recap', highlight: 'highlight', hotel_content: 'hotel_content',
}

/** §"Content-Paket": Reihenfolge/Bestandteile des Bündels. Caption ist bewusst KEIN eigener Bestandteil mehr -- der Text gehört immer direkt zum jeweiligen Format. */
const PACKAGE_COMPONENT_FORMATS = ['carousel', 'story', 'reel', 'day_recap'] as const

/** Reihenfolge-Schlüssel je Draft-Typ -- carousel_plan/story_plan nennen ihn "slides", reel_plan "scenes"; beide Item-Formen sind identisch ({photo_id, text}). */
const ITEMS_KEY_BY_DRAFT_TYPE: Record<string, 'slides' | 'scenes'> = {
  carousel_plan: 'slides', story_plan: 'slides', reel_plan: 'scenes',
}

type SessionPhoto = { id: string; storagePath: string; buffer: Buffer; mimeType: string }
type Assessment = { id: string; qualityScore: number; isBestMotif: boolean; description: string }

const FIT_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    fit: { type: 'string', enum: ['good', 'weak'] },
    reason: { type: 'string', description: 'Kurze, ehrliche Begründung (1-2 Sätze)' },
    missing_motifs: { type: 'array', items: { type: 'string' }, description: 'Konkret fehlende Motive/Szenen -- leeres Array wenn fit="good"' },
    suggested_focus: { type: 'string', description: 'Konkreter, enger passender Alternativ-Fokus -- leerer String wenn fit="good"' },
  },
  required: ['fit', 'reason', 'missing_motifs', 'suggested_focus'],
  additionalProperties: false,
}

/**
 * §"Bild-Text-Passungsprüfung": eigener, günstiger Text-Call (keine Bilder
 * erneut anhängen -- nutzt dasselbe Manifest wie die spätere Generierung)
 * VOR der eigentlichen Content-Erzeugung. Verhindert, dass LUMI z.B. bei
 * Fokus "Ausflug" aber nur ähnlichen Strandbildern eine erfundene
 * Ausflugsgeschichte erzeugt.
 */
async function checkContentFit(
  openai: OpenAI, tripDigest: string, manifestText: string, formatLabel: string,
  focusLabel: string, moodLabels: string[], hint: string,
): Promise<{ fit: 'good' | 'weak'; reason: string; missingMotifs: string[]; suggestedFocus: string }> {
  const promptText = [
    'Prüfe ehrlich und kritisch, ob die vorhandenen Fotos zum gewünschten Content passen, BEVOR irgendein Text erzeugt wird.',
    `Gewählter Content-Fokus: ${focusLabel}. Format: ${formatLabel}.`,
    moodLabels.length ? `Gewünschte Stimmung/Besonderheit: ${moodLabels.join(', ')}.` : null,
    hint ? `Hinweis der Familie: ${hint}` : null,
    'Frage dich: Passen die Bilder zum Fokus? Erzählen sie die gewünschte Geschichte? Gibt es genug ' +
      'unterschiedliche Motive? Würde eine Caption/ein Hook zu dem passen, was tatsächlich zu sehen ist? ' +
      'Reicht das Material für dieses Format? Lieber "weak" melden als eine erfundene Geschichte ermöglichen.',
    'Bei "weak": beschreibe in missing_motifs konkret, welche Motive fehlen, und schlage in suggested_focus ' +
      'einen engeren, tatsächlich passenden Fokus vor (z.B. "Strandmoment statt Ausflug", "ruhiger Abschluss ' +
      'des Tages", "Familienmoment am Meer", "Hotel-/Landschaftsfokus").',
    FACT_RULE_INSTRUCTION,
    `Reisekontext: ${tripDigest}`,
    `Foto-Übersicht:\n${manifestText}`,
  ].filter(Boolean).join('\n\n')

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: [{ role: 'user', content: [{ type: 'input_text', text: promptText }] }],
    text: { format: { type: 'json_schema', name: 'content_fit_check', schema: FIT_CHECK_SCHEMA, strict: true } },
  })
  const parsed = JSON.parse(response.output_text) as {
    fit: 'good' | 'weak'; reason: string; missing_motifs: string[]; suggested_focus: string
  }
  return { fit: parsed.fit, reason: parsed.reason, missingMotifs: parsed.missing_motifs, suggestedFocus: parsed.suggested_focus }
}

/**
 * §"Content erstellen -- nur nach ausdrücklichem Klick, kein automatischer
 * KI-Aufruf": zweistufig wie der bestehende Bildanalyse-Flow
 * (lib/actions/photo-analysis-generation.ts) -- (1) Qualität/Beschreibung
 * batch-weise mit Bildern, (2) EIN textbasierter Aufruf für das gewählte
 * Format, kein erneuter Bild-Upload. Reisekontext ausschließlich aus
 * buildTripDigest (echte Buchungen/Etappen/Journey-Einträge) -- keine
 * erfundenen Orte/Abläufe. Die Content-Art kommt jetzt aus dem bereits
 * gewählten `project.output_format`, nicht mehr aus diesem Formular.
 */
export async function analyzeContentSession(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '')
  const language = String(formData.get('language') ?? 'de').trim()
  const tonality = String(formData.get('tonality') ?? '').trim() || null
  const contentFocus = String(formData.get('content_focus') ?? '').trim() || null
  const customFocus = String(formData.get('custom_focus') ?? '').trim() || null
  const mood = formData.getAll('mood').map(String).filter(Boolean)
  const hintText = String(formData.get('hint_text') ?? '').trim() || null
  const forceCreate = formData.get('force_create') === '1'
  const returnPath = `/content-studio/session/${projectId}`

  if (!projectId) redirect('/content-studio/session/new')
  if (!process.env.OPENAI_API_KEY)
    redirect(`${returnPath}?error=${encodeURIComponent('Die Content-KI ist aktuell nicht konfiguriert.')}`)

  const supabase = await createClient()
  const { data: project } = await supabase
    .from('content_projects').select('id, trip_id, family_id, output_format').eq('id', projectId).maybeSingle()
  if (!project?.trip_id) redirect(`${returnPath}?error=${encodeURIComponent('Session nicht gefunden.')}`)

  const outputFormat = project.output_format ?? ''
  const isPackage = outputFormat === 'package'
  if (!outputFormat || (!isPackage && !CONTENT_FORMAT_SCHEMAS[outputFormat]))
    redirect(`${returnPath}?error=${encodeURIComponent('Bitte zuerst eine Content-Art auswählen.')}`)

  await supabase.from('content_projects').update({
    status: 'analyzing', language, tonality,
    content_focus: contentFocus, custom_focus: customFocus, mood: mood.length ? mood : null, hint_text: hintText,
  }).eq('id', projectId)

  const focusLabel = contentFocus === 'custom' ? customFocus : (contentFocus ? CONTENT_FOCUS_LABELS[contentFocus] ?? contentFocus : null)
  const moodLabels = mood.map((m) => CONTENT_MOOD_LABELS[m] ?? m)
  const formatLabel = isPackage ? 'Content-Paket' : (CONTENT_FORMAT_LABELS[outputFormat] ?? outputFormat)
  const maxPhotos = MAX_PHOTOS_BY_FORMAT[outputFormat] ?? DEFAULT_MAX_PHOTOS

  const { data: photoRowsRaw } = await supabase
    .from('content_project_photos')
    .select('id, storage_path')
    .eq('project_id', projectId)
    .is('is_duplicate_of', null)
    .order('created_at', { ascending: true })
  // §Verteidigung: falls das Format nach dem Upload gewechselt wurde und mehr
  // Fotos als für das NEUE Format erlaubt in der DB liegen, wird die Analyse
  // trotzdem hart auf das aktuelle Limit gekappt.
  const rows = (photoRowsRaw ?? []).slice(0, maxPhotos)
  if (rows.length === 0)
    redirect(`${returnPath}?error=${encodeURIComponent('Keine Fotos für diese Session gefunden.')}`)

  // Bilder für die Analyse laden -- nur einmal, Stufe 2 nutzt ausschließlich
  // Text. Unabhängig pro Foto, deshalb parallel statt sequenziell (vgl.
  // analyzeTripMemoryPhotos in lib/actions/memories.ts).
  const loaded = await Promise.all(rows.map(async (row): Promise<SessionPhoto | null> => {
    try {
      const { data: signed } = await supabase.storage.from('documents').createSignedUrl(row.storage_path, 60)
      if (!signed?.signedUrl) return null
      const res = await fetch(signed.signedUrl)
      const buffer = Buffer.from(await res.arrayBuffer())
      return { id: row.id, storagePath: row.storage_path, buffer, mimeType: 'image/webp' }
    } catch {
      return null
    }
  }))
  const photos: SessionPhoto[] = loaded.filter((p): p is SessionPhoto => p !== null)
  if (photos.length === 0)
    redirect(`${returnPath}?error=${encodeURIComponent('Fotos konnten nicht geladen werden.')}`)

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const tripDigest = await buildTripDigest(project.trip_id)

  const assessments: Assessment[] = []

  for (let i = 0; i < photos.length; i += ASSESSMENT_BATCH_SIZE) {
    const batch = photos.slice(i, i + ASSESSMENT_BATCH_SIZE)
    try {
      const content: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail: 'high' }> = [
        {
          type: 'input_text',
          text:
            'Bewerte jedes Foto einer Familienreise einzeln in "assessments" (gleiche Reihenfolge wie übergeben): ' +
            'Bildqualität, Eignung als bestes Motiv, und eine kurze visuelle Beschreibung (Motiv/Szene/Stimmung). ' +
            `Reisekontext: ${tripDigest}`,
        },
      ]
      for (const p of batch) content.push({ type: 'input_image', image_url: `data:${p.mimeType};base64,${p.buffer.toString('base64')}`, detail: 'high' })

      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [{ role: 'user', content }],
        text: { format: { type: 'json_schema', name: 'session_photo_assessment', schema: SESSION_ASSESSMENT_SCHEMA, strict: true } },
      })
      const parsed = JSON.parse(response.output_text) as {
        assessments: Array<{ photo_index: number; quality_score: number; is_best_motif: boolean; visual_description: string }>
      }
      for (const a of parsed.assessments) {
        const photo = batch[a.photo_index]
        if (!photo) continue
        assessments.push({ id: photo.id, qualityScore: a.quality_score, isBestMotif: a.is_best_motif, description: a.visual_description })
        await supabase.from('content_project_photos').update({
          quality_score: a.quality_score, reasoning: a.visual_description, analyzed_at: new Date().toISOString(),
        }).eq('id', photo.id)
      }
    } catch {
      // Ein fehlgeschlagener Batch darf die übrigen Batches nicht abbrechen.
      continue
    }
  }

  if (assessments.length === 0)
    redirect(`${returnPath}?error=${encodeURIComponent('Die Bildanalyse ist gerade nicht verfügbar. Bitte gleich noch einmal versuchen.')}`)

  // §"Beitrag: LUMI wählt maximal 7 aus": Einschränkung passiert HIER im
  // Code (nicht nur per Prompt-Anweisung) -- das Manifest, das an die
  // Text-Generierung geht, enthält für carousel von vornherein nur die
  // stärksten MAX_SELECTED_FOR_CAROUSEL Fotos, die KI kann also gar keine
  // anderen Foto-IDs referenzieren.
  const manifestSource = outputFormat === 'carousel' && !isPackage
    ? [...assessments].sort((a, b) => Number(b.isBestMotif) - Number(a.isBestMotif) || b.qualityScore - a.qualityScore).slice(0, MAX_SELECTED_FOR_CAROUSEL)
    : assessments

  const manifestText = manifestSource
    .map((a) => `Foto-ID ${a.id}: Qualität ${a.qualityScore}/10${a.isBestMotif ? ', bestes Motiv' : ''}. ${a.description}`)
    .join('\n')

  // §"Bild-Text-Passungsprüfung": nur wenn ein Fokus gewählt wurde (ohne
  // Fokus gibt es nichts, wogegen geprüft werden könnte) und nicht bereits
  // per "Mit vorhandenem Material erstellen" bewusst übersteuert wurde.
  // Schlägt der Check selbst technisch fehl, wird nicht blockiert (fail-open).
  if (focusLabel && !forceCreate) {
    try {
      const fit = await checkContentFit(openai, tripDigest, manifestText, formatLabel, focusLabel, moodLabels, hintText ?? '')
      if (fit.fit === 'weak') {
        redirect(`${returnPath}?fit=weak&reason=${encodeURIComponent(fit.reason)}&missing=${encodeURIComponent(fit.missingMotifs.join('; '))}&altfocus=${encodeURIComponent(fit.suggestedFocus)}`)
      }
    } catch {
      // Passungsprüfung nicht verfügbar -- Generierung läuft trotzdem weiter.
    }
  }

  const guidedContext = { focusLabel, moodLabels, hint: hintText, forceCreate }

  // §"Content-Paket": erzeugt mehrere Bestandteile (Beitrag/Story/Reel/
  // Tagesrückblick) in einem Lauf, jeder als eigener content_drafts-
  // Eintrag -- einzeln bearbeitbar/verwerfbar, kein Gruppen-Datensatz nötig
  // (bereits über project_id verknüpft, wie alle anderen Drafts der Session).
  if (isPackage) {
    let createdCount = 0
    for (const componentFormat of PACKAGE_COMPONENT_FORMATS) {
      try {
        const componentManifest = componentFormat === 'carousel'
          ? [...assessments].sort((a, b) => Number(b.isBestMotif) - Number(a.isBestMotif) || b.qualityScore - a.qualityScore).slice(0, MAX_SELECTED_FOR_CAROUSEL)
            .map((a) => `Foto-ID ${a.id}: Qualität ${a.qualityScore}/10${a.isBestMotif ? ', bestes Motiv' : ''}. ${a.description}`).join('\n')
          : manifestText
        const extra = componentFormat === 'story' ? 'Erzeuge 2 bis 4 Story-Slides (oder genau 1, wenn nur ein Bild wirklich trägt).' : undefined
        const result = await generateFormatContent(openai, componentFormat, tripDigest, componentManifest, tonality, language, guidedContext, extra)
        const structure = buildDraftStructure(componentFormat, result)
        const { data: draft } = await supabase.from('content_drafts').insert({
          project_id: projectId, draft_type: FORMAT_TO_DRAFT_TYPE[componentFormat], structure: structure as Json,
        }).select('id').single()
        if (draft) createdCount++
      } catch {
        // Ein fehlgeschlagener Bestandteil darf das restliche Paket nicht abbrechen.
        continue
      }
    }

    if (createdCount === 0)
      redirect(`${returnPath}?error=${encodeURIComponent('Das Content-Paket konnte nicht erstellt werden. Bitte gleich noch einmal versuchen.')}`)

    await supabase.from('content_projects').update({ status: 'draft_created' }).eq('id', projectId)
    redirect(`${returnPath}?package=${createdCount}`)
  }

  let contentResult: Record<string, unknown>
  try {
    contentResult = await generateFormatContent(openai, outputFormat, tripDigest, manifestText, tonality, language, guidedContext)
  } catch {
    redirect(`${returnPath}?error=${encodeURIComponent('Die Inhalte-Generierung ist gerade nicht verfügbar. Bitte gleich noch einmal versuchen.')}`)
  }

  const structure = buildDraftStructure(outputFormat, contentResult)

  const { data: draft, error: draftError } = await supabase.from('content_drafts').insert({
    project_id: projectId,
    draft_type: FORMAT_TO_DRAFT_TYPE[outputFormat],
    structure: structure as Json,
  }).select('id').single()

  if (draftError || !draft)
    redirect(`${returnPath}?error=${encodeURIComponent('Speicherfehler: ' + (draftError?.message ?? 'unbekannt'))}`)

  await supabase.from('content_projects').update({ status: 'draft_created' }).eq('id', projectId)

  redirect(`/content-studio/drafts/${draft.id}`)
}

/** Ein Text-Call für EIN Content-Format -- von Einzelformat- und Content-Paket-Erzeugung gemeinsam genutzt. */
async function generateFormatContent(
  openai: OpenAI, format: string, tripDigest: string, manifestText: string,
  tonality: string | null, language: string,
  guidedContext: { focusLabel: string | null; moodLabels: string[]; hint: string | null; forceCreate: boolean },
  extraInstruction?: string,
): Promise<Record<string, unknown>> {
  const formatLabel = CONTENT_FORMAT_LABELS[format] ?? format
  const promptText = [
    `Du bist Social-Media-Stratege für eine Familie und erstellst einen fertigen "${formatLabel}"-Vorschlag aus echten Reisefotos.`,
    FACT_RULE_INSTRUCTION,
    NO_CLICHE_INSTRUCTION,
    ENGAGEMENT_ANGLE_INSTRUCTION,
    tonalityInstruction(tonality),
    languageInstruction(language),
    guidedContext.focusLabel ? `Gewünschter Content-Fokus: ${guidedContext.focusLabel}.` : null,
    guidedContext.moodLabels.length ? `Gewünschte Stimmung/Besonderheit: ${guidedContext.moodLabels.join(', ')}.` : null,
    guidedContext.hint ? `Hinweis der Familie: ${guidedContext.hint}` : null,
    guidedContext.forceCreate
      ? 'Die Bilder passen nicht perfekt zum ursprünglich gewählten Fokus -- passe den Fokus ehrlich und ' +
        'erkennbar an das tatsächlich sichtbare Material an, statt etwas zu behaupten, das die Bilder nicht zeigen.'
      : null,
    extraInstruction ?? null,
    'Referenziere Fotos ausschließlich über ihre Foto-ID aus der Liste unten, erfinde keine IDs.',
    'Führe außerdem einen ehrlichen, kurzen Qualitäts-Check durch (quality_check): passt das Ergebnis wirklich ' +
      'gut zu Bildern/Fokus, oder gibt es etwas, das die Familie noch verbessern könnte?',
    `Reisekontext: ${tripDigest}`,
    `Foto-Übersicht:\n${manifestText}`,
  ].filter(Boolean).join('\n\n')

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: [{ role: 'user', content: [{ type: 'input_text', text: promptText }] }],
    text: { format: { type: 'json_schema', name: 'session_content', schema: CONTENT_FORMAT_SCHEMAS[format], strict: true } },
  })
  return JSON.parse(response.output_text)
}

/** Baut aus dem KI-Ergebnis die structure-Form, die der Content-Vorschau-Editor (content-studio/drafts/[draftId]) versteht. Slides/Scenes sind bewusst einheitlich {photo_id, text}. */
function buildDraftStructure(format: string, result: Record<string, unknown>): Record<string, unknown> {
  const hashtags = result.hashtags ?? []
  const qualityCheck = result.quality_check ?? null
  if (format === 'carousel') {
    return {
      slides: (result.slides as Array<{ photo_id: string; text: string }>).map((s) => ({ photo_id: s.photo_id, text: s.text })),
      hashtags, caption: result.caption, cover_photo_id: result.cover_photo_id, cover_reasoning: result.cover_reasoning,
      closing_note: result.closing_note, quality_check: qualityCheck,
    }
  }
  if (format === 'story') {
    return {
      slides: (result.slides as Array<{ photo_id: string; text: string }>).map((s) => ({ photo_id: s.photo_id, text: s.text })),
      hashtags, caption: result.caption, sticker_idea: result.sticker_idea, opening_note: result.opening_note,
      closing_note: result.closing_note, quality_check: qualityCheck,
    }
  }
  if (format === 'reel') {
    return {
      scenes: (result.scenes as Array<{ photo_id: string; text: string }>).map((s) => ({ photo_id: s.photo_id, text: s.text })),
      outro: result.outro, hashtags, caption: result.caption, hook: result.hook, music_direction: result.music_direction,
      quality_check: qualityCheck,
    }
  }
  if (format === 'hotel_content') {
    return {
      text: result.caption, hashtags,
      family_perspective: result.family_perspective, design_atmosphere: result.design_atmosphere,
      food: result.food, pool_or_beach: result.pool_or_beach, factual_rating: result.factual_rating,
      quality_check: qualityCheck,
    }
  }
  return { text: result.caption, hashtags, quality_check: qualityCheck }
}

/** Baut das Foto-Manifest für eine Regenerierung aus bereits gespeicherten Bewertungen (kein erneuter Bild-Upload/keine erneute Bildanalyse nötig). */
async function rebuildManifestForProject(
  supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, restrictToPhotoIds?: string[],
): Promise<string> {
  const { data: rows } = await supabase.from('content_project_photos').select('id, quality_score, reasoning').eq('project_id', projectId).is('is_duplicate_of', null)
  const filtered = (rows ?? []).filter((r) => r.quality_score !== null && (!restrictToPhotoIds || restrictToPhotoIds.includes(r.id)))
  return filtered.map((r) => `Foto-ID ${r.id}: Qualität ${r.quality_score}/10. ${r.reasoning ?? ''}`).join('\n')
}

/**
 * §"Komplett alternative Version generieren"/"Text-Passage neu formulieren":
 * ruft dieselbe Text-Generierung erneut auf. `field` bestimmt, was aus dem
 * Ergebnis übernommen wird -- bei "full" die komplette Struktur (inkl. neuer
 * Bildauswahl/-reihenfolge), bei einem einzelnen Feld NUR dieses Feld, damit
 * die bestehende Bildauswahl/-reihenfolge sonst unangetastet bleibt.
 */
export async function regenerateContentSessionDraftPart(formData: FormData) {
  const draftId = String(formData.get('draft_id') ?? '')
  const field = String(formData.get('field') ?? 'full')
  const returnPath = `/content-studio/drafts/${draftId}`

  if (!process.env.OPENAI_API_KEY)
    redirect(`${returnPath}?error=${encodeURIComponent('Die Content-KI ist aktuell nicht konfiguriert.')}`)

  const supabase = await createClient()
  const { data: draft } = await supabase.from('content_drafts').select('project_id, draft_type, structure').eq('id', draftId).maybeSingle()
  if (!draft) redirect(returnPath)

  const format = Object.entries(FORMAT_TO_DRAFT_TYPE).find(([, v]) => v === draft.draft_type)?.[0]
  if (!format) redirect(returnPath)

  const { data: project } = await supabase
    .from('content_projects')
    .select('trip_id, tonality, language, content_focus, custom_focus, mood, hint_text')
    .eq('id', draft.project_id).maybeSingle()
  if (!project?.trip_id) redirect(`${returnPath}?error=${encodeURIComponent('Zugehörige Reise nicht gefunden.')}`)

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const tripDigest = await buildTripDigest(project.trip_id)
  const manifestText = await rebuildManifestForProject(supabase, draft.project_id)
  if (!manifestText)
    redirect(`${returnPath}?error=${encodeURIComponent('Für die Regenerierung fehlen die ursprünglichen Bildbewertungen (Fotos evtl. bereits gelöscht).')}`)

  const focusLabel = project.content_focus === 'custom' ? project.custom_focus : (project.content_focus ? CONTENT_FOCUS_LABELS[project.content_focus] ?? project.content_focus : null)
  const moodLabels = (project.mood ?? []).map((m) => CONTENT_MOOD_LABELS[m] ?? m)
  const guidedContext = { focusLabel, moodLabels, hint: project.hint_text, forceCreate: false }

  let result: Record<string, unknown>
  try {
    result = await generateFormatContent(openai, format, tripDigest, manifestText, project.tonality, project.language ?? 'de', guidedContext)
  } catch {
    redirect(`${returnPath}?error=${encodeURIComponent('Die Regenerierung ist gerade nicht verfügbar. Bitte gleich noch einmal versuchen.')}`)
  }

  const existingStructure = draft.structure as Record<string, unknown>
  let nextStructure: Record<string, unknown>

  if (field === 'full') {
    nextStructure = buildDraftStructure(format, result)
  } else {
    nextStructure = { ...existingStructure }
    if (field === 'hashtags') nextStructure.hashtags = result.hashtags ?? []
    else if (field === 'caption') nextStructure.caption = result.caption
    else if (field === 'hook' && format === 'reel') nextStructure.hook = result.hook
    else nextStructure = { ...existingStructure }
  }

  await supabase.from('content_drafts').update({ structure: nextStructure as Json }).eq('id', draftId)
  redirect(returnPath)
}

/** §"Reihenfolge per Auf/Ab ändern" -- bewusst kein Drag-and-Drop (kein bestehender Baustein dafür), sondern zwei einfache Buttons je Bild, konsistent mit dem übrigen Formular-Muster der App. */
export async function moveContentSessionDraftItem(formData: FormData) {
  const draftId = String(formData.get('draft_id') ?? '')
  const index = Number(formData.get('index') ?? '-1')
  const direction = String(formData.get('direction') ?? '')
  const returnPath = `/content-studio/drafts/${draftId}`

  const supabase = await createClient()
  const { data: draft } = await supabase.from('content_drafts').select('draft_type, structure').eq('id', draftId).maybeSingle()
  const itemsKey = draft ? ITEMS_KEY_BY_DRAFT_TYPE[draft.draft_type] : undefined
  if (!draft || !itemsKey) redirect(returnPath)

  const structure = draft.structure as Record<string, unknown>
  const items = [...((structure[itemsKey] as unknown[]) ?? [])]
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || index >= items.length || swapWith < 0 || swapWith >= items.length) redirect(returnPath)

  const tmp = items[index]
  items[index] = items[swapWith]
  items[swapWith] = tmp

  await supabase.from('content_drafts').update({ structure: { ...structure, [itemsKey]: items } as Json }).eq('id', draftId)
  redirect(returnPath)
}

/** Entfernt ein Bild aus der Auswahl (nicht aus der Session-Fotoliste selbst). */
export async function removeContentSessionDraftItem(formData: FormData) {
  const draftId = String(formData.get('draft_id') ?? '')
  const index = Number(formData.get('index') ?? '-1')
  const returnPath = `/content-studio/drafts/${draftId}`

  const supabase = await createClient()
  const { data: draft } = await supabase.from('content_drafts').select('draft_type, structure').eq('id', draftId).maybeSingle()
  const itemsKey = draft ? ITEMS_KEY_BY_DRAFT_TYPE[draft.draft_type] : undefined
  if (!draft || !itemsKey) redirect(returnPath)

  const structure = draft.structure as Record<string, unknown>
  const items = [...((structure[itemsKey] as unknown[]) ?? [])]
  if (index < 0 || index >= items.length) redirect(returnPath)
  items.splice(index, 1)

  await supabase.from('content_drafts').update({ structure: { ...structure, [itemsKey]: items } as Json }).eq('id', draftId)
  redirect(returnPath)
}

/** Fügt ein bisher nicht ausgewähltes Session-Foto der Bildauswahl eines Drafts hinzu (Beitrag: bis MAX_SELECTED_FOR_CAROUSEL). */
export async function addContentSessionDraftItem(formData: FormData) {
  const draftId = String(formData.get('draft_id') ?? '')
  const photoId = String(formData.get('photo_id') ?? '')
  const returnPath = `/content-studio/drafts/${draftId}`

  const supabase = await createClient()
  const { data: draft } = await supabase.from('content_drafts').select('draft_type, structure').eq('id', draftId).maybeSingle()
  const itemsKey = draft ? ITEMS_KEY_BY_DRAFT_TYPE[draft.draft_type] : undefined
  if (!draft || !itemsKey || !photoId) redirect(returnPath)

  const structure = draft.structure as Record<string, unknown>
  const items = [...((structure[itemsKey] as Array<{ photo_id: string; text: string }>) ?? [])]
  if (draft.draft_type === 'carousel_plan' && items.length >= MAX_SELECTED_FOR_CAROUSEL) redirect(returnPath)
  if (items.some((i) => i.photo_id === photoId)) redirect(returnPath)
  items.push({ photo_id: photoId, text: '' })

  await supabase.from('content_drafts').update({ structure: { ...structure, [itemsKey]: items } as Json }).eq('id', draftId)
  redirect(returnPath)
}

/** §"Titelbild ändern" (nur Beitrag). */
export async function setContentSessionDraftCover(formData: FormData) {
  const draftId = String(formData.get('draft_id') ?? '')
  const photoId = String(formData.get('photo_id') ?? '')
  const returnPath = `/content-studio/drafts/${draftId}`

  const supabase = await createClient()
  const { data: draft } = await supabase.from('content_drafts').select('structure').eq('id', draftId).maybeSingle()
  if (!draft) redirect(returnPath)
  const structure = draft.structure as Record<string, unknown>
  await supabase.from('content_drafts').update({ structure: { ...structure, cover_photo_id: photoId } as Json }).eq('id', draftId)
  redirect(returnPath)
}

/**
 * §"Text bearbeiten/speichern": ersetzt updateContentDraft (content-ideas.ts)
 * für Session-Entwürfe -- jenes generische Speichern rekonstruiert slides/
 * scenes NUR aus Text-Feldern und würde die photo_id-Zuordnung dabei
 * stillschweigend verwerfen. Hier werden photo_id und Text paarweise
 * (gleiche Reihenfolge) aus dem Formular übernommen.
 */
export async function saveContentSessionDraftText(formData: FormData) {
  const draftId = String(formData.get('draft_id') ?? '')
  const returnPath = `/content-studio/drafts/${draftId}`

  const supabase = await createClient()
  const { data: draft } = await supabase.from('content_drafts').select('draft_type, structure').eq('id', draftId).maybeSingle()
  if (!draft) redirect(returnPath)

  const structure = { ...(draft.structure as Record<string, unknown>) }
  const itemsKey = ITEMS_KEY_BY_DRAFT_TYPE[draft.draft_type]

  if (itemsKey) {
    const photoIds = formData.getAll('item_photo_id').map(String)
    const texts = formData.getAll('item_text').map(String)
    structure[itemsKey] = photoIds.map((photo_id, i) => ({ photo_id, text: texts[i] ?? '' }))
  }

  if (formData.has('caption')) structure.caption = String(formData.get('caption') ?? '')
  if (formData.has('hashtags')) structure.hashtags = String(formData.get('hashtags') ?? '').split(',').map((h) => h.trim()).filter(Boolean)

  if (draft.draft_type === 'reel_plan') {
    if (formData.has('hook')) structure.hook = String(formData.get('hook') ?? '')
    if (formData.has('music_direction')) structure.music_direction = String(formData.get('music_direction') ?? '')
    if (formData.has('outro')) structure.outro = String(formData.get('outro') ?? '')
  }
  if (draft.draft_type === 'story_plan') {
    if (formData.has('sticker_idea')) structure.sticker_idea = String(formData.get('sticker_idea') ?? '')
    if (formData.has('opening_note')) structure.opening_note = String(formData.get('opening_note') ?? '')
    if (formData.has('closing_note')) structure.closing_note = String(formData.get('closing_note') ?? '')
  }
  if (draft.draft_type === 'carousel_plan') {
    if (formData.has('closing_note')) structure.closing_note = String(formData.get('closing_note') ?? '')
  }
  if (draft.draft_type === 'hotel_content' || draft.draft_type === 'day_recap' || draft.draft_type === 'highlight') {
    if (formData.has('text')) structure.text = String(formData.get('text') ?? '')
  }

  await supabase.from('content_drafts').update({ structure: structure as Json }).eq('id', draftId)
  redirect(returnPath)
}

/** §"Entwurf löschen" -- kein Foto-Storage betroffen (Drafts referenzieren Fotos nur lose über ID). */
export async function deleteContentSessionDraft(formData: FormData) {
  const draftId = String(formData.get('draft_id') ?? '')
  const projectId = String(formData.get('project_id') ?? '')
  const supabase = await createClient()
  await supabase.from('content_drafts').delete().eq('id', draftId)
  redirect(`/content-studio/session/${projectId}`)
}

/**
 * §"Temporäre Bilder jetzt löschen": gehärtetes Muster wie deleteMemoryPhoto
 * -- Storage zuerst, DB-Zeile nur bei Erfolg. Löscht ausschließlich
 * `temporary=true, retained_as_memory=false`-Fotos -- bereits als Erinnerung
 * behaltene und ohnehin dauerhafte Fotos werden nie angefasst. Bestehende
 * content_drafts bleiben unverändert (referenzieren Fotos nur lose über
 * Foto-ID im JSON, kein Foreign-Key-Zwang).
 */
export async function deleteContentSessionPhotosNow(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '')
  const returnPath = `/content-studio/session/${projectId}`
  if (!projectId) redirect('/content-studio/session/new')

  const supabase = await createClient()
  const { data: photos } = await supabase
    .from('content_project_photos')
    .select('id, storage_path')
    .eq('project_id', projectId)
    .eq('temporary', true)
    .eq('retained_as_memory', false)

  for (const photo of photos ?? []) {
    const { error: storageError } = await supabase.storage.from('documents').remove([photo.storage_path])
    if (storageError) continue // Storage-Löschung fehlgeschlagen -- DB-Zeile bewusst NICHT gelöscht (kein Storage-Waise/Ghost-Eintrag)
    await supabase.from('content_project_photos').delete().eq('id', photo.id)
  }

  await supabase.from('content_projects').update({ status: 'images_deleted' }).eq('id', projectId)

  redirect(returnPath)
}

/**
 * §"Möchtest du ausgewählte Bilder als Reiseerinnerung behalten?": legt eine
 * NEUE, unabhängige memory_photos-Zeile an (eigene komprimierte Kopie unter
 * memories/..., nicht nur eine Referenz) -- die Quelle bleibt danach ganz
 * normal temporär und läuft unabhängig davon ab. `retained_as_memory`/
 * `memory_photo_id` sind nur Rückverfolgung, keine zweite Wahrheitsquelle.
 */
export async function retainContentSessionPhotoAsMemory(formData: FormData) {
  const photoId = String(formData.get('photo_id') ?? '')
  const projectId = String(formData.get('project_id') ?? '')
  const returnPath = `/content-studio/session/${projectId}`

  const supabase = await createClient()
  const { data: photo } = await supabase
    .from('content_project_photos').select('id, storage_path, retained_as_memory').eq('id', photoId).maybeSingle()
  if (!photo) redirect(`${returnPath}?error=${encodeURIComponent('Foto nicht gefunden.')}`)
  if (photo.retained_as_memory) redirect(returnPath)

  const { data: project } = await supabase.from('content_projects').select('family_id, trip_id').eq('id', projectId).maybeSingle()
  if (!project?.trip_id) redirect(`${returnPath}?error=${encodeURIComponent('Diese Session ist keiner Reise zugeordnet.')}`)

  const { count } = await supabase
    .from('memory_photos').select('id', { count: 'exact', head: true })
    .eq('trip_id', project.trip_id).eq('is_selected', true)
  if ((count ?? 0) >= MAX_RETAINED_MEMORIES_PER_TRIP)
    redirect(`${returnPath}?error=${encodeURIComponent('Für diese Reise sind bereits 25 Erinnerungen gespeichert. Bitte zuerst ein Bild ersetzen oder entfernen.')}`)

  const { data: downloaded, error: downloadError } = await supabase.storage.from('documents').download(photo.storage_path)
  if (downloadError || !downloaded)
    redirect(`${returnPath}?error=${encodeURIComponent('Foto konnte nicht geladen werden.')}`)

  const buffer = Buffer.from(await downloaded.arrayBuffer())
  const compressed = await compressImageForStorage(buffer)
  const memoryPath = `memories/${project.family_id}/${crypto.randomUUID()}.webp`

  const { error: uploadError } = await supabase.storage.from('documents')
    .upload(memoryPath, new Blob([new Uint8Array(compressed)], { type: 'image/webp' }), { contentType: 'image/webp' })
  if (uploadError) redirect(`${returnPath}?error=${encodeURIComponent('Speicherfehler: ' + uploadError.message)}`)

  const { data: memoryPhoto, error: insertError } = await supabase.from('memory_photos').insert({
    family_id: project.family_id, trip_id: project.trip_id, storage_path: memoryPath, is_selected: true,
  }).select('id').single()

  if (insertError || !memoryPhoto) {
    await supabase.storage.from('documents').remove([memoryPath])
    redirect(`${returnPath}?error=${encodeURIComponent('Speicherfehler: ' + (insertError?.message ?? 'unbekannt'))}`)
  }

  await supabase.from('content_project_photos')
    .update({ retained_as_memory: true, memory_photo_id: memoryPhoto.id })
    .eq('id', photoId)

  redirect(returnPath)
}
