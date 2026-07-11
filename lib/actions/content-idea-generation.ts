'use server'

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { buildTripDigest } from '@/lib/trip-digest'

/** Gleiches Modell wie die bestehende Pass-/ESTA-/Beleg-/Reiseideen-KI. */
const OPENAI_MODEL = 'gpt-5.4'

const CONTENT_IDEA_SCHEMA = {
  type: 'object',
  properties: {
    usable: { type: 'boolean', description: 'false, wenn aus den Eingaben keine sinnvollen Content-Ideen ableitbar sind' },
    detected_location: { type: ['string', 'null'], description: 'Nur bei hochgeladenem Foto und wirklich erkennbarem Ort — sonst null, niemals raten' },
    detected_mood: { type: ['string', 'null'], description: 'Nur bei hochgeladenem Foto — wahrgenommene Stimmung, sonst null' },
    reasoning: {
      type: 'string',
      description: 'Kurze Erklärung (2-3 Sätze) an die Familie, WARUM genau diese Ideen vorgeschlagen wurden — bezieht sich konkret auf die genutzten Reisedaten/den Stil, keine Floskeln.',
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
          format: { type: 'string', enum: ['reel', 'carousel', 'story', 'caption'] },
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
  required: ['usable', 'detected_location', 'detected_mood', 'reasoning', 'suggestions'],
  additionalProperties: false,
}

const CONTENT_IDEA_PROMPT = (
  'Du entwickelst aus echten Reisedaten und optional einem Foto maximal 4 hochwertige, ' +
  'unterscheidbare Social-Media-Content-Ideen für eine Familie — Qualität vor Menge, ' +
  'lieber 2 wirklich gute als 4 generische. Nutze ' +
  'ausschließlich die gegebenen Reisedaten und den Stil-Kontext als Faktengrundlage ' +
  '— erfinde keine Orte, Ereignisse oder Details, die dort nicht stehen. Falls ein ' +
  'Foto beigefügt ist: erkenne Ort/Stimmung nur, wenn wirklich zuverlässig erkennbar ' +
  '— sonst null setzen, niemals raten. Setze "usable" auf false, wenn aus den ' +
  'Eingaben keine sinnvolle Idee entwickelbar ist. Erkläre der Familie in "reasoning" ' +
  'kurz und konkret, worauf sich die vorgeschlagenen Ideen stützen (z. B. bestimmte ' +
  'Etappen, Buchungen, der Fotoinhalt oder der Content-Stil).'
)

export async function generateContentIdeas(formData: FormData) {
  const tripId = String(formData.get('trip_id') ?? '')
  const contextText = String(formData.get('context_text') ?? '').trim()
  const contentGoal = String(formData.get('content_goal') ?? '').trim()

  const newPath = '/content-studio/new'

  if (!tripId)
    redirect(`${newPath}?error=${encodeURIComponent('Bitte eine Reise auswählen.')}`)

  if (!process.env.OPENAI_API_KEY)
    redirect(`${newPath}?error=${encodeURIComponent('Die Content-Ideen-KI ist aktuell nicht konfiguriert.')}`)

  const supabase = await createClient()
  const { data: family } = await supabase.from('families').select('id, content_style_preference').limit(1).single()
  if (!family?.id)
    redirect(`${newPath}?error=${encodeURIComponent('Familiendaten nicht gefunden')}`)

  const tripDigest = await buildTripDigest(tripId)

  let sourceMediaPath: string | null = null
  let imageContentPart: { type: 'input_image'; image_url: string; detail: 'high' } | null = null

  const file = formData.get('file')
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith('image/'))
      redirect(`${newPath}?error=${encodeURIComponent('Für die Bildanalyse wird ein Foto (JPEG, PNG oder WebP) benötigt — Video wird diese Phase nicht inhaltlich analysiert.')}`)
    if (file.size > 10 * 1024 * 1024)
      redirect(`${newPath}?error=${encodeURIComponent('Die Datei ist zu groß (maximal 10 MB).')}`)

    sourceMediaPath = `content-media/${family.id}/${crypto.randomUUID()}.${file.type.split('/')[1] || 'jpg'}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(sourceMediaPath, file, { contentType: file.type })
    if (uploadError)
      redirect(`${newPath}?error=${encodeURIComponent('Foto-Upload fehlgeschlagen: ' + uploadError.message)}`)

    const bytes = Buffer.from(await file.arrayBuffer())
    imageContentPart = { type: 'input_image', image_url: `data:${file.type};base64,${bytes.toString('base64')}`, detail: 'high' }
  }

  const styleText = family.content_style_preference
    ? `Content-Stil der Familie: ${JSON.stringify(family.content_style_preference)}.`
    : ''

  const contextParts = [
    `Reisedaten: ${tripDigest}`,
    styleText || null,
    contentGoal ? `Gewünschtes Content-Ziel: ${contentGoal}.` : null,
    contextText ? `Zusätzlicher Kontext: ${contextText}` : null,
  ].filter(Boolean).join('\n')

  let parsed: {
    usable: boolean
    detected_location: string | null
    detected_mood: string | null
    reasoning: string
    suggestions: Array<{ title: string; format: string; hook: string; angle: string; caption_draft: string; hashtags: string[] }>
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const content: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail: 'high' }> = [
      { type: 'input_text', text: `${CONTENT_IDEA_PROMPT}\n\n${contextParts}` },
    ]
    if (imageContentPart) content.push(imageContentPart)

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

  // Find-or-create den Content-Projects-Container für diese Reise — vermeidet
  // eine separate "Projekt anlegen"-UI, da ein Projekt hier implizit entsteht.
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

  const { data: idea, error: ideaError } = await supabase.from('content_ideas').insert({
    family_id: family.id,
    project_id: projectId,
    trip_id: tripId,
    source_input_text: contextText || null,
    source_media_storage_path: sourceMediaPath,
    content_goal: contentGoal || null,
    suggestions: parsed.suggestions,
    reasoning: parsed.reasoning,
    status: 'suggested',
  }).select('id').single()

  if (ideaError || !idea)
    redirect(`${newPath}?error=${encodeURIComponent('Speicherfehler: ' + (ideaError?.message ?? 'unbekannt'))}`)

  redirect(`/content-studio/ideas/${idea.id}`)
}
