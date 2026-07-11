import OpenAI from 'openai'

/** Gleiches Modell wie die übrigen KI-Flows (Pass/ESTA/Beleg/Reiseideen/Content). */
const OPENAI_MODEL = 'gpt-5.4'

/** Vercel-/Kosten-Obergrenze pro einzelnem KI-Aufruf — bei mehr Fotos wird in mehreren Batches iteriert (siehe Aufrufer). */
export const MAX_PHOTOS_ANALYZED_PER_CALL = 20

export type PhotoAssessment = { photoIndex: number; qualityScore: number; isBestMotif: boolean }

/**
 * §"Es darf keine zweite, parallele Bildanalyse-Implementierung geben":
 * dieses Schema-/Prompt-/Parsing-Fragment ist die EINZIGE Quelle für
 * Foto-Qualitäts-/Motiv-Bewertung in der App. Content Studio komponiert es in
 * seinen eigenen, größeren KI-Aufruf (Qualität + Content-Ideen in einem
 * Request, aus Kostengründen), Travel Memory nutzt es über `assessPhotoBatch`
 * eigenständig — beide greifen auf exakt dieselbe Definition zu, nichts wird
 * dupliziert.
 */
export const PHOTO_ASSESSMENT_SCHEMA_FIELD = {
  type: 'array',
  description: 'Genau ein Eintrag pro übergebenem Foto, in derselben Reihenfolge — Qualitäts-/Motiv-Bewertung für die Fotoauswahl.',
  items: {
    type: 'object',
    properties: {
      photo_index: { type: 'integer', description: 'Index des Fotos in der übergebenen Reihenfolge, beginnend bei 0' },
      quality_score: { type: 'integer', description: '1 (schwach) bis 10 (hervorragendes Motiv)' },
      is_best_motif: { type: 'boolean', description: 'true für die besten, für den jeweiligen Zweck wirklich geeigneten Motive' },
    },
    required: ['photo_index', 'quality_score', 'is_best_motif'],
    additionalProperties: false,
  },
} as const

export const PHOTO_ASSESSMENT_PROMPT_FRAGMENT =
  'Bewerte JEDES Foto einzeln in "photo_assessments" (gleiche Reihenfolge wie übergeben) nach Bildqualität/Eignung als Motiv, ' +
  'und markiere die wirklich besten als "is_best_motif":true.'

type RawPhotoAssessment = { photo_index: number; quality_score: number; is_best_motif: boolean }

export function parsePhotoAssessments(raw: RawPhotoAssessment[]): PhotoAssessment[] {
  return raw.map((a) => ({ photoIndex: a.photo_index, qualityScore: a.quality_score, isBestMotif: a.is_best_motif }))
}

const STANDALONE_SCHEMA = {
  type: 'object',
  properties: { photo_assessments: PHOTO_ASSESSMENT_SCHEMA_FIELD },
  required: ['photo_assessments'],
  additionalProperties: false,
}

/**
 * Eigenständiger Aufruf für Fälle ohne zusätzlichen Content-Bedarf (z. B.
 * Travel Memory) — nutzt exakt dasselbe Schema-/Prompt-Fragment wie Content
 * Studio, nur ohne die zusätzlichen Content-Idea-Felder. Ein Aufruf deckt
 * maximal `MAX_PHOTOS_ANALYZED_PER_CALL` Fotos ab — bei mehr muss der
 * Aufrufer selbst in mehreren Batches iterieren. Gibt bei fehlendem API-Key
 * oder jedem Fehler `null` zurück, statt die Seite abstürzen zu lassen.
 */
export async function assessPhotoBatch(
  photos: Array<{ buffer: Buffer; mimeType: string }>,
  contextText: string,
): Promise<PhotoAssessment[] | null> {
  if (photos.length === 0) return []
  if (!process.env.OPENAI_API_KEY) return null

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const content: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail: 'high' }> = [
      { type: 'input_text', text: `${PHOTO_ASSESSMENT_PROMPT_FRAGMENT}\n\n${contextText}` },
    ]
    for (const p of photos.slice(0, MAX_PHOTOS_ANALYZED_PER_CALL)) {
      content.push({ type: 'input_image', image_url: `data:${p.mimeType};base64,${p.buffer.toString('base64')}`, detail: 'high' })
    }

    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [{ role: 'user', content }],
      text: { format: { type: 'json_schema', name: 'photo_assessment', schema: STANDALONE_SCHEMA, strict: true } },
    })
    const parsed = JSON.parse(response.output_text)
    return parsePhotoAssessments(parsed.photo_assessments)
  } catch {
    return null
  }
}
