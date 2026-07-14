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
import { NO_CLICHE_INSTRUCTION, FACT_RULE_INSTRUCTION, tonalityInstruction, languageInstruction } from '@/lib/ai-style-guidelines'
import { MAX_RETAINED_MEMORIES_PER_TRIP } from '@/lib/content-session-limits'
import type { Json } from '@/lib/supabase/types'

/** Gleiches Modell wie alle übrigen KI-Flows (Pass/ESTA/Beleg/Reiseideen/Content). */
const OPENAI_MODEL = 'gpt-5.4'

/** §"Beliebig viele Bilder (10/30/50+)": kein Gesamt-Limit -- der Client ruft dies in Batches von maximal 20 mehrfach auf (createUploadSlots-Limit). */
export async function createContentSessionUploadSlots(count: number): Promise<UploadSlot[]> {
  const { id: familyId } = await getFamily()
  return createUploadSlots(familyId, count)
}

const TEMP_IMAGE_TTL_HOURS = 24

/**
 * §"Content Studio 2.0": legt den Session-Container an (content_projects,
 * project_type='session' -- kollidiert nie mit den bestehenden 'ideas'/
 * 'photo_analysis'-Projekten derselben Reise). Content-Art/Sprache/Tonalität
 * werden bewusst NICHT hier, sondern erst bei "Content erstellen"
 * (analyzeContentSession) abgefragt -- passend zum empfohlenen Ablauf
 * "Reise -> Bilder -> Content-Art -> Tonalität -> Content erstellen".
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
 * §"Bilder werden nur zur Content-Erstellung verwendet und nicht dauerhaft
 * gespeichert": eigener Storage-Pfad (content-session/... statt content-
 * media/...) + `temporary=true` + `expires_at` (24h) -- Grundlage für den
 * Cleanup-Cron (app/api/cron/cleanup-content-sessions). Einzelne
 * fehlgeschlagene Fotos brechen den restlichen Batch nicht ab.
 */
export async function uploadContentSessionPhotos(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '')
  const returnPath = `/content-studio/session/${projectId}`
  if (!projectId) redirect('/content-studio/session/new')

  const supabase = await createClient()
  const { data: project } = await supabase.from('content_projects').select('id, family_id').eq('id', projectId).maybeSingle()
  if (!project) redirect('/content-studio/session/new')

  const stagedPaths = parseStagedPaths(formData.get('uploaded_paths'))
  if (stagedPaths.length === 0) redirect(returnPath)

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

  if (savedCount === 0)
    redirect(`${returnPath}?error=${encodeURIComponent('Keines der Fotos konnte gespeichert werden.')}`)
  if (failedCount > 0)
    redirect(`${returnPath}?uploaded=${savedCount}&error=${encodeURIComponent(`${failedCount} von ${stagedPaths.length} Fotos konnten nicht gespeichert werden.`)}`)
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
}

const CONTENT_FORMAT_SCHEMAS: Record<string, Record<string, unknown>> = {
  caption: {
    type: 'object',
    properties: { ...BASE_CONTENT_PROPS },
    required: ['caption', 'hashtags'],
    additionalProperties: false,
  },
  carousel: {
    type: 'object',
    properties: {
      ...BASE_CONTENT_PROPS,
      cover_photo_id: { type: 'string', description: 'ID des empfohlenen Titelbilds aus der Fotoliste' },
      slides: {
        type: 'array', minItems: 5, maxItems: 12,
        items: {
          type: 'object',
          properties: { photo_id: { type: 'string' }, text: { type: 'string' } },
          required: ['photo_id', 'text'], additionalProperties: false,
        },
      },
      closing_note: { type: 'string', description: 'Kurzer Text für die Abschluss-Slide' },
    },
    required: ['caption', 'hashtags', 'cover_photo_id', 'slides', 'closing_note'],
    additionalProperties: false,
  },
  story: {
    type: 'object',
    properties: {
      ...BASE_CONTENT_PROPS,
      frames: {
        type: 'array',
        items: {
          type: 'object',
          properties: { photo_id: { type: 'string' }, text: { type: 'string' } },
          required: ['photo_id', 'text'], additionalProperties: false,
        },
      },
      sticker_idea: { type: 'string', description: 'Idee für Sticker/Umfrage, kurz' },
      opening_note: { type: 'string' },
      closing_note: { type: 'string' },
    },
    required: ['caption', 'hashtags', 'frames', 'sticker_idea', 'opening_note', 'closing_note'],
    additionalProperties: false,
  },
  reel: {
    type: 'object',
    properties: {
      ...BASE_CONTENT_PROPS,
      hook: { type: 'string', description: 'Erster Satz/Einstieg, der Aufmerksamkeit erzeugt' },
      clip_order: {
        type: 'array',
        items: {
          type: 'object',
          properties: { photo_id: { type: 'string' }, text_overlay: { type: 'string' } },
          required: ['photo_id', 'text_overlay'], additionalProperties: false,
        },
      },
      music_direction: { type: 'string', description: 'Musikrichtung als Beschreibung, keine urheberrechtlich geschützten Songtitel' },
    },
    required: ['caption', 'hashtags', 'hook', 'clip_order', 'music_direction'],
    additionalProperties: false,
  },
  day_recap: {
    type: 'object',
    properties: { ...BASE_CONTENT_PROPS },
    required: ['caption', 'hashtags'],
    additionalProperties: false,
  },
  highlight: {
    type: 'object',
    properties: { ...BASE_CONTENT_PROPS },
    required: ['caption', 'hashtags'],
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
    required: ['caption', 'hashtags', 'family_perspective', 'design_atmosphere', 'food', 'pool_or_beach', 'factual_rating'],
    additionalProperties: false,
  },
}

const FORMAT_TO_DRAFT_TYPE: Record<string, string> = {
  caption: 'caption', carousel: 'carousel_plan', story: 'story_plan', reel: 'reel_plan',
  day_recap: 'day_recap', highlight: 'highlight', hotel_content: 'hotel_content',
}

/** §"Content-Paket": Reihenfolge/Bestandteile des Bündels -- Story bekommt eine zusätzliche Anweisung für 5-8 Ideen statt der sonst unbegrenzten Anzahl. */
const PACKAGE_COMPONENT_FORMATS = ['caption', 'carousel', 'story', 'reel', 'day_recap'] as const

type SessionPhoto = { id: string; storagePath: string; buffer: Buffer; mimeType: string }

/**
 * §"Content erstellen -- nur nach ausdrücklichem Klick, kein automatischer
 * KI-Aufruf": zweistufig wie der bestehende Bildanalyse-Flow
 * (lib/actions/photo-analysis-generation.ts) -- (1) Qualität/Beschreibung
 * batch-weise mit Bildern, (2) EIN textbasierter Aufruf für das gewählte
 * Format, kein erneuter Bild-Upload. Reisekontext ausschließlich aus
 * buildTripDigest (echte Buchungen/Etappen/Journey-Einträge) -- keine
 * erfundenen Orte/Abläufe.
 */
export async function analyzeContentSession(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '')
  const outputFormat = String(formData.get('output_format') ?? '').trim()
  const language = String(formData.get('language') ?? 'de').trim()
  const tonality = String(formData.get('tonality') ?? '').trim() || null
  const returnPath = `/content-studio/session/${projectId}`

  const isPackage = outputFormat === 'package'
  if (!projectId) redirect('/content-studio/session/new')
  if (!outputFormat || (!isPackage && !CONTENT_FORMAT_SCHEMAS[outputFormat]))
    redirect(`${returnPath}?error=${encodeURIComponent('Bitte eine Content-Art auswählen.')}`)
  if (!process.env.OPENAI_API_KEY)
    redirect(`${returnPath}?error=${encodeURIComponent('Die Content-KI ist aktuell nicht konfiguriert.')}`)

  const supabase = await createClient()
  const { data: project } = await supabase
    .from('content_projects').select('id, trip_id, family_id').eq('id', projectId).maybeSingle()
  if (!project?.trip_id) redirect(`${returnPath}?error=${encodeURIComponent('Session nicht gefunden.')}`)

  await supabase.from('content_projects').update({ status: 'analyzing', language, tonality }).eq('id', projectId)

  const { data: photoRows } = await supabase
    .from('content_project_photos')
    .select('id, storage_path')
    .eq('project_id', projectId)
    .is('is_duplicate_of', null)
  const rows = photoRows ?? []
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

  type Assessment = { id: string; qualityScore: number; isBestMotif: boolean; description: string }
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

  const manifestText = assessments
    .map((a) => `Foto-ID ${a.id}: Qualität ${a.qualityScore}/10${a.isBestMotif ? ', bestes Motiv' : ''}. ${a.description}`)
    .join('\n')

  // §"Content-Paket": erzeugt mehrere Bestandteile (Caption/Carousel/Story/
  // Reel/Tagesrückblick) in einem Lauf, jeder als eigener content_drafts-
  // Eintrag -- einzeln bearbeitbar/verwerfbar, kein Gruppen-Datensatz nötig
  // (bereits über project_id verknüpft, wie alle anderen Drafts der Session).
  if (isPackage) {
    const createdCount = { value: 0 }
    for (const componentFormat of PACKAGE_COMPONENT_FORMATS) {
      try {
        const extra = componentFormat === 'story' ? 'Erzeuge 5 bis 8 Story-Ideen (frames) für die Abfolge.' : undefined
        const result = await generateFormatContent(openai, componentFormat, tripDigest, manifestText, tonality, language, extra)
        const structure = buildDraftStructure(componentFormat, result)
        const { data: draft } = await supabase.from('content_drafts').insert({
          project_id: projectId, draft_type: FORMAT_TO_DRAFT_TYPE[componentFormat], structure: structure as Json,
        }).select('id').single()
        if (draft) createdCount.value++
      } catch {
        // Ein fehlgeschlagener Bestandteil darf das restliche Paket nicht abbrechen.
        continue
      }
    }

    if (createdCount.value === 0)
      redirect(`${returnPath}?error=${encodeURIComponent('Das Content-Paket konnte nicht erstellt werden. Bitte gleich noch einmal versuchen.')}`)

    await supabase.from('content_projects').update({ status: 'draft_created' }).eq('id', projectId)
    redirect(`${returnPath}?package=${createdCount.value}`)
  }

  let contentResult: Record<string, unknown>
  try {
    contentResult = await generateFormatContent(openai, outputFormat, tripDigest, manifestText, tonality, language)
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
  tonality: string | null, language: string, extraInstruction?: string,
): Promise<Record<string, unknown>> {
  const promptText = [
    `Du bist Social-Media-Stratege für eine Familie und erstellst einen fertigen ${format === 'caption' ? 'Instagram-Post' : format}-Vorschlag aus echten Reisefotos.`,
    FACT_RULE_INSTRUCTION,
    NO_CLICHE_INSTRUCTION,
    tonalityInstruction(tonality),
    languageInstruction(language),
    extraInstruction ?? null,
    'Referenziere Fotos ausschließlich über ihre Foto-ID aus der Liste unten, erfinde keine IDs.',
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

/** Baut aus dem KI-Ergebnis dieselbe structure-Form, die der bestehende Draft-Editor (content-studio/drafts/[draftId]) bereits versteht. */
function buildDraftStructure(format: string, result: Record<string, unknown>): Record<string, unknown> {
  const hashtags = result.hashtags ?? []
  if (format === 'carousel') {
    return {
      slides: (result.slides as Array<{ photo_id: string; text: string }>).map((s) => ({ text: s.text, photo_id: s.photo_id })),
      hashtags, caption: result.caption, cover_photo_id: result.cover_photo_id, closing_note: result.closing_note,
    }
  }
  if (format === 'story') {
    return {
      slides: (result.frames as Array<{ photo_id: string; text: string }>).map((f) => ({ text: f.text, photo_id: f.photo_id })),
      hashtags, caption: result.caption, sticker_idea: result.sticker_idea, opening_note: result.opening_note, closing_note: result.closing_note,
    }
  }
  if (format === 'reel') {
    return {
      scenes: (result.clip_order as Array<{ photo_id: string; text_overlay: string }>).map((c) => ({ text: c.text_overlay, photo_id: c.photo_id })),
      outro: '', hashtags, caption: result.caption, hook: result.hook, music_direction: result.music_direction,
    }
  }
  if (format === 'hotel_content') {
    return {
      text: result.caption, hashtags,
      family_perspective: result.family_perspective, design_atmosphere: result.design_atmosphere,
      food: result.food, pool_or_beach: result.pool_or_beach, factual_rating: result.factual_rating,
    }
  }
  return { text: result.caption, hashtags }
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
