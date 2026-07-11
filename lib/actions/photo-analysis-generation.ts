'use server'

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { computeDHash, hammingDistance, DUPLICATE_HASH_THRESHOLD } from '@/lib/image-hash'
import { getFamily } from '@/lib/family'
import { buildTripDigest } from '@/lib/trip-digest'
import { PHOTO_CATEGORIES, RECOMMENDATIONS, type PhotoCategory, type Recommendation } from '@/lib/photo-analysis'

/** Gleiches Modell wie die übrigen KI-Flows (Pass/ESTA/Beleg/Reiseideen/Content). */
const OPENAI_MODEL = 'gpt-5.4'
const MAX_PHOTOS_PER_UPLOAD = 20
const MAX_PHOTOS_ANALYZED_PER_CALL = 20

const PHOTO_CATEGORIZATION_SCHEMA = {
  type: 'object',
  properties: {
    photo_categorizations: {
      type: 'array',
      description: 'Genau ein Eintrag pro übergebenem Foto, in derselben Reihenfolge.',
      items: {
        type: 'object',
        properties: {
          photo_index: { type: 'integer', description: 'Index des Fotos in der übergebenen Reihenfolge, beginnend bei 0' },
          quality_score: { type: 'integer', description: '1 (schwach) bis 10 (hervorragend)' },
          categories: {
            type: 'array',
            description: 'Alle zutreffenden Kategorien für dieses Foto (kann leer sein, mehrere möglich)',
            items: { type: 'string', enum: PHOTO_CATEGORIES },
          },
          reasoning: { type: 'string', description: 'Kurze, konkrete Begründung (1 Satz) für Bewertung/Kategorien' },
          recommendation: { type: 'string', enum: RECOMMENDATIONS, description: 'Empfohlenes Ausgabeformat für dieses Foto' },
        },
        required: ['photo_index', 'quality_score', 'categories', 'reasoning', 'recommendation'],
        additionalProperties: false,
      },
    },
  },
  required: ['photo_categorizations'],
  additionalProperties: false,
}

const CONTENT_GENERATION_SCHEMA = {
  type: 'object',
  properties: {
    caption: { type: 'string', description: 'Fertige Bildunterschrift mit Emojis, passend zum Titelbild' },
    hashtags: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    hook: { type: 'string', description: 'Erster Satz/Einstieg für Reel oder Story, der Aufmerksamkeit erzeugt' },
    story_structure: {
      type: 'array',
      description: 'Empfohlene Reihenfolge/Aufbau einer Story-Serie',
      items: {
        type: 'object',
        properties: { photo_id: { type: 'string' }, note: { type: 'string' } },
        required: ['photo_id', 'note'],
        additionalProperties: false,
      },
    },
    reel_order: {
      type: 'array',
      description: 'Empfohlene Schnittreihenfolge für ein Reel',
      items: {
        type: 'object',
        properties: { photo_id: { type: 'string' }, note: { type: 'string' } },
        required: ['photo_id', 'note'],
        additionalProperties: false,
      },
    },
    music_suggestions: { type: 'array', items: { type: 'string' }, maxItems: 5, description: 'Musik-/Sound-Stimmungen, keine urheberrechtlich konkreten Songtitel' },
    photobook_chapters: {
      type: 'array',
      description: 'Vorschlag für Fotobuch-Kapitel',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          photo_ids: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'photo_ids'],
        additionalProperties: false,
      },
    },
    travel_diary: { type: 'string', description: 'Kurzer, persönlicher Reisetagebuch-Eintrag (3-5 Sätze) basierend auf den erkannten Motiven' },
  },
  required: ['caption', 'hashtags', 'hook', 'story_structure', 'reel_order', 'music_suggestions', 'photobook_chapters', 'travel_diary'],
  additionalProperties: false,
}

type PhotoInput = { buffer: Buffer; mimeType: string }

export async function analyzePhotos(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const newPath = '/content-studio/analyze'

  if (!tripId)
    redirect(`${newPath}?error=${encodeURIComponent('Bitte eine Reise auswählen.')}`)

  const rawFiles = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (rawFiles.length === 0)
    redirect(`${newPath}?error=${encodeURIComponent('Bitte mindestens ein Foto auswählen.')}`)
  if (rawFiles.length > MAX_PHOTOS_PER_UPLOAD)
    redirect(`${newPath}?error=${encodeURIComponent(`Maximal ${MAX_PHOTOS_PER_UPLOAD} Fotos pro Upload.`)}`)
  for (const f of rawFiles) {
    if (!f.type.startsWith('image/'))
      redirect(`${newPath}?error=${encodeURIComponent('Nur Fotos werden unterstützt (JPEG, PNG, WebP).')}`)
    if (f.size > 10 * 1024 * 1024)
      redirect(`${newPath}?error=${encodeURIComponent('Mindestens eine Datei ist zu groß (maximal 10 MB pro Foto).')}`)
  }
  if (!process.env.OPENAI_API_KEY)
    redirect(`${newPath}?error=${encodeURIComponent('Die Bildanalyse-KI ist aktuell nicht konfiguriert.')}`)

  const supabase = await createClient()
  const { id: familyId } = await getFamily()

  // Eigener Projekt-Typ 'photo_analysis' — kollidiert nie mit dem
  // 'ideas'-Projekt derselben Reise (Content-Ideen bleiben unverändert).
  const { data: existingProject } = await supabase
    .from('content_projects')
    .select('id')
    .eq('family_id', familyId)
    .eq('trip_id', tripId)
    .eq('project_type', 'photo_analysis')
    .maybeSingle()

  let projectId = existingProject?.id
  if (!projectId) {
    const { data: trip } = await supabase.from('trips').select('title').eq('id', tripId).maybeSingle()
    const { data: newProject, error: projectError } = await supabase.from('content_projects').insert({
      family_id: familyId, trip_id: tripId, title: trip?.title ?? 'Bildanalyse', status: 'active', project_type: 'photo_analysis',
    }).select('id').single()
    if (projectError || !newProject)
      redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + (projectError?.message ?? 'unbekannt'))}`)
    projectId = newProject.id
  }

  // §"KI nur bei echtem Mehrwert": Dubletten werden NIE per KI erkannt, nur
  // per deterministischem Perceptual Hash (lib/image-hash.ts) — identisches
  // Muster wie Content-Ideen/Travel Memory.
  const { data: existingPhotosRaw } = await supabase
    .from('content_project_photos').select('id, phash').eq('project_id', projectId).not('phash', 'is', null)
  const hashPool = (existingPhotosRaw ?? []) as { id: string; phash: string }[]

  const uploadedPhotos: PhotoInput[] = await Promise.all(
    rawFiles.map(async (f) => ({ buffer: Buffer.from(await f.arrayBuffer()), mimeType: f.type })),
  )

  type NewPhotoRow = { id: string; isDuplicate: boolean; buffer: Buffer; mimeType: string }
  const newPhotoRows: NewPhotoRow[] = []

  for (const photo of uploadedPhotos) {
    const ext = photo.mimeType.split('/')[1] || 'jpg'
    const storagePath = `content-media/${projectId}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('documents')
      .upload(storagePath, photo.buffer, { contentType: photo.mimeType })
    if (uploadError)
      redirect(`${newPath}?error=${encodeURIComponent('Foto-Upload fehlgeschlagen: ' + uploadError.message)}`)

    const phash = await computeDHash(photo.buffer)
    const duplicateOf = phash !== null
      ? hashPool.find((p) => hammingDistance(p.phash, phash) <= DUPLICATE_HASH_THRESHOLD) ?? null
      : null
    const isDuplicate = duplicateOf !== null

    const { data: photoRow, error: photoError } = await supabase.from('content_project_photos').insert({
      project_id: projectId,
      storage_path: storagePath,
      phash,
      is_duplicate_of: duplicateOf?.id ?? null,
      is_selected: !isDuplicate,
    }).select('id').single()

    if (photoError || !photoRow)
      redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + (photoError?.message ?? 'unbekannt'))}`)

    if (phash) hashPool.push({ id: photoRow.id, phash })
    newPhotoRows.push({ id: photoRow.id, isDuplicate, buffer: photo.buffer, mimeType: photo.mimeType })
  }

  const toAnalyze = newPhotoRows.filter((p) => !p.isDuplicate)
  if (toAnalyze.length === 0)
    redirect(`${newPath}?error=${encodeURIComponent('Alle hochgeladenen Fotos wurden als Dubletten bereits vorhandener Fotos erkannt.')}`)

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const tripDigest = await buildTripDigest(tripId)

  // Kategorisierung in Batches von MAX_PHOTOS_ANALYZED_PER_CALL — bei
  // "beliebig vielen" Fotos wird über mehrere Batches iteriert.
  const categorizedPhotos: Array<{ id: string; qualityScore: number; categories: PhotoCategory[]; reasoning: string; recommendation: Recommendation }> = []

  for (let i = 0; i < toAnalyze.length; i += MAX_PHOTOS_ANALYZED_PER_CALL) {
    const batch = toAnalyze.slice(i, i + MAX_PHOTOS_ANALYZED_PER_CALL)
    try {
      const content: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail: 'high' }> = [
        {
          type: 'input_text',
          text:
            'Analysiere jedes Foto einer Familienreise einzeln in "photo_categorizations" (gleiche Reihenfolge wie übergeben). ' +
            'Erkenne insbesondere: bestes Familienfoto, emotionalstes Bild, Landschaft, Drohnenfoto, luxuriösestes Bild, ' +
            'Titelbild-Kandidat, sowie Eignung für Story/Reel/Album. Vergib nur zutreffende Kategorien, keine Pflichtzuordnung. ' +
            `Reisekontext: ${tripDigest}`,
        },
      ]
      for (const p of batch) {
        content.push({ type: 'input_image', image_url: `data:${p.mimeType};base64,${p.buffer.toString('base64')}`, detail: 'high' })
      }

      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [{ role: 'user', content }],
        text: { format: { type: 'json_schema', name: 'photo_categorization', schema: PHOTO_CATEGORIZATION_SCHEMA, strict: true } },
      })
      const parsed = JSON.parse(response.output_text) as {
        photo_categorizations: Array<{ photo_index: number; quality_score: number; categories: string[]; reasoning: string; recommendation: string }>
      }

      await Promise.all(parsed.photo_categorizations.map((c) => {
        const photo = batch[c.photo_index]
        if (!photo) return Promise.resolve()
        categorizedPhotos.push({
          id: photo.id, qualityScore: c.quality_score,
          categories: c.categories as PhotoCategory[], reasoning: c.reasoning, recommendation: c.recommendation as Recommendation,
        })
        return supabase.from('content_project_photos').update({
          quality_score: c.quality_score,
          categories: c.categories,
          reasoning: c.reasoning,
          recommendation: c.recommendation,
          analyzed_at: new Date().toISOString(),
        }).eq('id', photo.id)
      }))
    } catch {
      // Ein fehlgeschlagener Batch darf die übrigen Batches nicht abbrechen —
      // dessen Fotos bleiben unanalysiert, aber gespeichert (kein Datenverlust).
      continue
    }
  }

  if (categorizedPhotos.length === 0)
    redirect(`${newPath}?error=${encodeURIComponent('Die Bildanalyse-KI ist gerade nicht verfügbar. Bitte gleich noch einmal versuchen.')}`)

  // Aggregierte Inhalte (Caption/Hashtags/Hook/Story/Reel/Musik/Fotobuch/Tagebuch)
  // — EIN zusätzlicher, textbasierter KI-Call (keine erneuten Bild-Uploads,
  // Kostenkontrolle), der die Kategorisierung aus Schritt 1 als Kontext nutzt.
  const manifestText = categorizedPhotos
    .map((p) => `Foto ${p.id}: Qualität ${p.qualityScore}/10, Kategorien: [${p.categories.join(', ') || '—'}], Empfehlung: ${p.recommendation}. ${p.reasoning}`)
    .join('\n')

  let contentResult: {
    caption: string; hashtags: string[]; hook: string
    story_structure: Array<{ photo_id: string; note: string }>
    reel_order: Array<{ photo_id: string; note: string }>
    music_suggestions: string[]
    photobook_chapters: Array<{ title: string; photo_ids: string[] }>
    travel_diary: string
  } | null = null

  try {
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{
        role: 'user',
        content: [{
          type: 'input_text',
          text:
            'Erstelle aus der folgenden Foto-Kategorisierung einer Familienreise hochwertige, fertige Inhalte: ' +
            'Bildunterschrift mit Emojis, Hashtags, einen Hook, eine Story-Aufbau-Reihenfolge, eine Reel-Schnittreihenfolge, ' +
            'Musik-/Sound-Stimmungsvorschläge (keine konkreten urheberrechtlich geschützten Songtitel), Fotobuch-Kapitel und ' +
            'einen kurzen, persönlichen Reisetagebuch-Eintrag. Referenziere Fotos über ihre Foto-ID aus der Liste unten. ' +
            `Reisekontext: ${tripDigest}\n\nFoto-Kategorisierung:\n${manifestText}`,
        }],
      }],
      text: { format: { type: 'json_schema', name: 'content_generation', schema: CONTENT_GENERATION_SCHEMA, strict: true } },
    })
    contentResult = JSON.parse(response.output_text)
  } catch {
    redirect(`${newPath}?error=${encodeURIComponent('Die Inhalte-Generierung ist gerade nicht verfügbar. Bitte gleich noch einmal versuchen.')}`)
  }

  const { data: analysis, error: analysisError } = await supabase.from('content_photo_analyses').insert({
    family_id: familyId,
    project_id: projectId,
    trip_id: tripId,
    caption: contentResult!.caption,
    hashtags: contentResult!.hashtags,
    hook: contentResult!.hook,
    story_structure: contentResult!.story_structure,
    reel_order: contentResult!.reel_order,
    music_suggestions: contentResult!.music_suggestions,
    photobook_chapters: contentResult!.photobook_chapters,
    travel_diary: contentResult!.travel_diary,
  }).select('id').single()

  if (analysisError || !analysis)
    redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + (analysisError?.message ?? 'unbekannt'))}`)

  redirect(`/content-studio/analyze/${analysis.id}`)
}
