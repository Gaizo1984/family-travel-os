'use server'

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { buildTripDigest } from '@/lib/trip-digest'
import { computeDHash, hammingDistance, DUPLICATE_HASH_THRESHOLD } from '@/lib/image-hash'

/** Gleiches Modell wie die bestehende Pass-/ESTA-/Beleg-/Reiseideen-KI. */
const OPENAI_MODEL = 'gpt-5.4'

const MAX_PHOTOS_PER_UPLOAD = 20
const MAX_PHOTOS_ANALYZED_PER_CALL = 20

const CONTENT_STYLE_LABELS: Record<string, string> = {
  luxury: 'Luxury — elegant, hochwertig, ruhig',
  family: 'Family — warm, verspielt, alltagsnah',
  adventure: 'Adventure — energisch, actionreich',
  emotional: 'Emotional — persönlich, berührend',
}

const CONTENT_IDEA_SCHEMA = {
  type: 'object',
  properties: {
    usable: { type: 'boolean', description: 'false, wenn aus den Eingaben keine sinnvollen Content-Ideen ableitbar sind' },
    detected_location: { type: ['string', 'null'], description: 'Nur bei hochgeladenen Fotos und wirklich erkennbarem Ort — sonst null, niemals raten' },
    detected_mood: { type: ['string', 'null'], description: 'Nur bei hochgeladenen Fotos — wahrgenommene Stimmung, sonst null' },
    reasoning: {
      type: 'string',
      description: 'Kurze Erklärung (2-3 Sätze) an die Familie, WARUM genau diese Ideen vorgeschlagen wurden — bezieht sich konkret auf die genutzten Reisedaten/Fotos/den Stil, keine Floskeln.',
    },
    photo_assessments: {
      type: 'array',
      description: 'Genau ein Eintrag pro übergebenem Foto, in derselben Reihenfolge — Qualitäts-/Motiv-Bewertung für die Fotoauswahl.',
      items: {
        type: 'object',
        properties: {
          photo_index: { type: 'integer', description: 'Index des Fotos in der übergebenen Reihenfolge, beginnend bei 0' },
          quality_score: { type: 'integer', description: '1 (schwach) bis 10 (hervorragendes Motiv)' },
          is_best_motif: { type: 'boolean', description: 'true für die besten, für den Content wirklich geeigneten Motive' },
        },
        required: ['photo_index', 'quality_score', 'is_best_motif'],
        additionalProperties: false,
      },
    },
    suggestions: {
      type: 'array',
      description: 'Maximal 4 wirklich hochwertige, unterscheidbare Ideen — lieber weniger und dafür konkret als viele generische.',
      minItems: 2,
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          format: { type: 'string', enum: ['reel', 'carousel', 'story', 'caption', 'feed_post'] },
          hook: { type: 'string', description: 'Erster Satz/Einstieg, der Aufmerksamkeit erzeugt' },
          angle: { type: 'string', description: 'Kreativer Blickwinkel der Idee' },
          caption_draft: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' }, maxItems: 8 },
        },
        required: ['title', 'format', 'hook', 'angle', 'caption_draft', 'hashtags'],
        additionalProperties: false,
      },
    },
  },
  required: ['usable', 'detected_location', 'detected_mood', 'reasoning', 'photo_assessments', 'suggestions'],
  additionalProperties: false,
}

function buildPrompt(language: string, styleKey: string): string {
  const styleText = CONTENT_STYLE_LABELS[styleKey] ? `Gewünschter Content-Stil: ${CONTENT_STYLE_LABELS[styleKey]}.` : ''
  const languageInstruction = language === 'en'
    ? 'Write all output (reasoning, titles, hooks, captions) in English.'
    : 'Schreibe alle Ausgaben (Begründung, Titel, Hooks, Captions) auf Deutsch.'

  return (
    'Du bist Social-Media-Stratege für eine Familie und entwickelst aus echten Reisedaten und optional mehreren Fotos ' +
    'maximal 4 hochwertige, unterscheidbare Content-Ideen (Reel/Carousel/Story/Feed-Post) — Qualität vor Menge. ' +
    'Nutze ausschließlich die gegebenen Reisedaten und den Stil-Kontext als Faktengrundlage — erfinde keine Orte, ' +
    'Ereignisse oder Details, die dort nicht stehen. Falls Fotos beigefügt sind: bewerte JEDES Foto einzeln in ' +
    '"photo_assessments" (gleiche Reihenfolge wie übergeben) nach Bildqualität/Eignung als Social-Media-Motiv, und ' +
    'markiere die wirklich besten als "is_best_motif":true — die Content-Ideen sollen sich an diesen besten Motiven ' +
    'orientieren. Erkenne Ort/Stimmung nur, wenn wirklich zuverlässig erkennbar — sonst null setzen, niemals raten. ' +
    `Setze "usable" auf false, wenn aus den Eingaben keine sinnvolle Idee entwickelbar ist. ${styleText} ${languageInstruction} ` +
    'Erkläre der Familie in "reasoning" kurz und konkret, worauf sich die vorgeschlagenen Ideen stützen.'
  )
}

type PhotoInput = { index: number; buffer: Buffer; mimeType: string }

export async function generateContentIdeas(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const contextText = String(formData.get('context_text') ?? '').trim()
  const contentGoal = String(formData.get('content_goal') ?? '').trim()
  const contentLanguage = String(formData.get('content_language') ?? 'de').trim()
  const contentStyle = String(formData.get('content_style') ?? '').trim()

  const newPath = '/content-studio/new'

  if (!tripId)
    redirect(`${newPath}?error=${encodeURIComponent('Bitte eine Reise auswählen.')}`)

  const supabase = await createClient()
  const { data: family } = await supabase.from('families').select('id, content_style_preference').limit(1).single()
  if (!family?.id)
    redirect(`${newPath}?error=${encodeURIComponent('Familiendaten nicht gefunden')}`)

  const rawFiles = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (rawFiles.length > MAX_PHOTOS_PER_UPLOAD)
    redirect(`${newPath}?error=${encodeURIComponent(`Maximal ${MAX_PHOTOS_PER_UPLOAD} Fotos pro Upload.`)}`)

  for (const f of rawFiles) {
    if (!f.type.startsWith('image/'))
      redirect(`${newPath}?error=${encodeURIComponent('Für die Bildanalyse werden Fotos (JPEG, PNG oder WebP) benötigt — Video wird diese Phase nicht inhaltlich analysiert.')}`)
    if (f.size > 10 * 1024 * 1024)
      redirect(`${newPath}?error=${encodeURIComponent('Mindestens eine Datei ist zu groß (maximal 10 MB pro Foto).')}`)
  }

  if (rawFiles.length === 0 && !contextText && !contentGoal)
    redirect(`${newPath}?error=${encodeURIComponent('Bitte mindestens ein Foto oder einen Kontext angeben.')}`)

  if (!process.env.OPENAI_API_KEY)
    redirect(`${newPath}?error=${encodeURIComponent('Die Content-Ideen-KI ist aktuell nicht konfiguriert.')}`)

  const tripDigest = await buildTripDigest(tripId)

  // Find-or-create den Content-Projects-Container für diese Reise — vermeidet
  // eine separate "Projekt anlegen"-UI, da ein Projekt hier implizit entsteht.
  // Muss VOR dem Foto-Upload feststehen, da der Storage-Pfad jetzt projektbezogen ist.
  const { data: existingProject } = await supabase
    .from('content_projects').select('id').eq('family_id', family.id).eq('trip_id', tripId).maybeSingle()

  let projectId = existingProject?.id
  if (!projectId) {
    const { data: trip } = await supabase.from('trips').select('title').eq('id', tripId).maybeSingle()
    const { data: newProject, error: projectError } = await supabase.from('content_projects').insert({
      family_id: family.id, trip_id: tripId, title: trip?.title ?? 'Content-Projekt', status: 'active',
    }).select('id').single()
    if (projectError || !newProject)
      redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + (projectError?.message ?? 'unbekannt'))}`)
    projectId = newProject.id
  }

  // Bereits vorhandene Fotos dieses Projekts laden — für Dubletten-Abgleich
  // gegen neue Uploads (nicht nur untereinander) und für den analyzed_at-Filter.
  const { data: existingPhotosRaw } = await supabase
    .from('content_project_photos').select('id, phash').eq('project_id', projectId).not('phash', 'is', null)
  const existingPhotos = (existingPhotosRaw ?? []) as { id: string; phash: string }[]

  const uploadedPhotos: PhotoInput[] = []
  for (let i = 0; i < rawFiles.length; i++) {
    const file = rawFiles[i]
    const buffer = Buffer.from(await file.arrayBuffer())
    uploadedPhotos.push({ index: i, buffer, mimeType: file.type })
  }

  // §"KI nur bei echtem Mehrwert": Dubletten werden NIE per KI erkannt, nur
  // per deterministischem Perceptual Hash (lib/image-hash.ts) — sowohl gegen
  // bereits vorhandene Projektfotos als auch untereinander im selben Upload.
  type NewPhotoRow = { id: string; storagePath: string; phash: string | null; isDuplicate: boolean; buffer: Buffer; mimeType: string }
  const newPhotoRows: NewPhotoRow[] = []
  const hashPool: { id: string; phash: string }[] = [...existingPhotos]

  for (const photo of uploadedPhotos) {
    const ext = photo.mimeType.split('/')[1] || 'jpg'
    const photoId = crypto.randomUUID()
    const storagePath = `content-media/${projectId}/${photoId}.${ext}`

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
    newPhotoRows.push({ id: photoRow.id, storagePath, phash, isDuplicate, buffer: photo.buffer, mimeType: photo.mimeType })
  }

  // §"Nur neue Bilder erneut analysieren": ausschließlich frisch hochgeladene,
  // nicht-doppelte Fotos gehen in den KI-Aufruf — nie erneut bereits
  // analysierte Bestandsfotos (die haben ohnehin schon analyzed_at gesetzt).
  const toAnalyze = newPhotoRows.filter((p) => !p.isDuplicate).slice(0, MAX_PHOTOS_ANALYZED_PER_CALL)

  const styleText = family.content_style_preference
    ? `Bestehender Content-Stil der Familie: ${JSON.stringify(family.content_style_preference)}.`
    : ''

  const contextParts = [
    `Reisedaten: ${tripDigest}`,
    styleText || null,
    contentGoal ? `Gewünschtes Content-Ziel: ${contentGoal}.` : null,
    contextText ? `Zusätzlicher Kontext: ${contextText}` : null,
    toAnalyze.length > 0 ? `Anzahl übergebener Fotos: ${toAnalyze.length}.` : 'Keine Fotos übergeben — arbeite rein textbasiert.',
  ].filter(Boolean).join('\n')

  let parsed: {
    usable: boolean
    detected_location: string | null
    detected_mood: string | null
    reasoning: string
    photo_assessments: Array<{ photo_index: number; quality_score: number; is_best_motif: boolean }>
    suggestions: Array<{ title: string; format: string; hook: string; angle: string; caption_draft: string; hashtags: string[] }>
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const content: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail: 'high' }> = [
      { type: 'input_text', text: `${buildPrompt(contentLanguage, contentStyle)}\n\n${contextParts}` },
    ]
    for (const p of toAnalyze) {
      content.push({ type: 'input_image', image_url: `data:${p.mimeType};base64,${p.buffer.toString('base64')}`, detail: 'high' })
    }

    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content }],
      text: {
        format: { type: 'json_schema', name: 'content_ideas', schema: CONTENT_IDEA_SCHEMA, strict: true },
      },
    })
    parsed = JSON.parse(response.output_text)
  } catch {
    redirect(`${newPath}?error=${encodeURIComponent('Die Content-Ideen-KI ist gerade nicht verfügbar. Bitte gleich noch einmal versuchen.')}`)
  }

  if (!parsed.usable || parsed.suggestions.length === 0)
    redirect(`${newPath}?error=${encodeURIComponent('Aus diesen Eingaben konnten keine Content-Ideen entwickelt werden.')}`)

  // Analyse-Ergebnis auf die jeweiligen Fotos zurückschreiben.
  const bestIndices = new Set(parsed.photo_assessments.filter((a) => a.is_best_motif).map((a) => a.photo_index))
  await Promise.all(toAnalyze.map((p, i) => {
    const assessment = parsed.photo_assessments.find((a) => a.photo_index === i)
    return supabase.from('content_project_photos').update({
      quality_score: assessment?.quality_score ?? null,
      analyzed_at: new Date().toISOString(),
      is_selected: bestIndices.size > 0 ? bestIndices.has(i) : true,
    }).eq('id', p.id)
  }))

  const { data: idea, error: ideaError } = await supabase.from('content_ideas').insert({
    family_id: family.id,
    project_id: projectId,
    trip_id: tripId,
    source_input_text: contextText || null,
    source_media_storage_path: newPhotoRows[0]?.storagePath ?? null,
    content_goal: contentGoal || null,
    suggestions: parsed.suggestions,
    reasoning: parsed.reasoning,
    status: 'suggested',
  }).select('id').single()

  if (ideaError || !idea)
    redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + (ideaError?.message ?? 'unbekannt'))}`)

  redirect(`/content-studio/ideas/${idea.id}`)
}
