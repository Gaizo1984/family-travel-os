import OpenAI from 'openai'
import sharp from 'sharp'

/** Gleiches Modell wie die übrigen KI-Flows (Pass/ESTA/Beleg/Reiseideen/Content). */
const OPENAI_MODEL = 'gpt-5.4'

/** §"Bild-Check"-Konfiguration serverseitig per Env-Var überschreibbar (Nutzervorgabe, wörtlich) -- bisher gab es dafür im gesamten Repo kein Muster, jedes OPENAI_MODEL war eine harte Konstante. Diese beiden Werte bleiben die Code-Defaults, wenn die Env-Vars nicht gesetzt sind. */
const OPENAI_MODEL_IMAGE_CHECK = process.env.OPENAI_MODEL_IMAGE_CHECK ?? 'gpt-5.6-terra'
const OPENAI_REASONING_EFFORT_IMAGE_CHECK = process.env.OPENAI_REASONING_IMAGE_CHECK ?? 'low'

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

type ImageContentBlock = { type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail: 'high' }

/** §Aus assessPhotoBatch extrahiert, jetzt von beiden Funktionen dieser Datei genutzt -- "erweitern statt eine zweite Architektur bauen" (Nutzervorgabe). */
function buildPhotoContentBlocks(promptText: string, photos: Array<{ buffer: Buffer; mimeType: string }>, maxPhotos: number): ImageContentBlock[] {
  const content: ImageContentBlock[] = [{ type: 'input_text', text: promptText }]
  for (const p of photos.slice(0, maxPhotos)) {
    content.push({ type: 'input_image', image_url: `data:${p.mimeType};base64,${p.buffer.toString('base64')}`, detail: 'high' })
  }
  return content
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
    const content = buildPhotoContentBlocks(`${PHOTO_ASSESSMENT_PROMPT_FRAGMENT}\n\n${contextText}`, photos, MAX_PHOTOS_ANALYZED_PER_CALL)

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

// ─────────────────────────────────────────────────────────────────────────
// §"Bild-Check" (Nutzervorgabe, wörtlich): eigenständiges Tool, KEIN neuer
// Content-Typ -- bis zu 5 Fotos einzeln UND im Vergleich zueinander bewerten
// (Gesamtscore, 6 Teilbewertungen, Rang, "bestes X"-Flags, Tipps). Bewusst
// EIN gemeinsamer Aufruf statt getrennter Einzel-/Vergleichs-Calls (Vorgabe:
// "maximal fünf Bilder in einem gemeinsamen API-Aufruf") -- eigenes, viel
// reicheres Schema als PHOTO_ASSESSMENT_SCHEMA_FIELD, deshalb NICHT dieselbe
// Funktion erweitert (hätte die beiden bestehenden, einfacheren Caller
// memories.ts/reel-storyboard.ts gebrochen), sondern im selben Modul ergänzt.
// ─────────────────────────────────────────────────────────────────────────

export const MAX_IMAGE_CHECK_PHOTOS_PER_CALL = 5

export type ImageCheckAssessment = {
  photoIndex: number
  overallScore: number
  technicalQuality: number
  composition: number
  lightAndColor: number
  subjectImpact: number
  emotionality: number
  socialMediaFit: number
  reasoning: string
  improvementTips: string[]
  rank: number
  isBestOverall: boolean
  isBestForPost: boolean
  isBestForStory: boolean
  isBestReelCover: boolean
  isSimilarOrWeaker: boolean
}

const SCORE_FIELD = (description: string) => ({ type: 'number', description: `0.0 (schwach) bis 10.0 (hervorragend). ${description}` })

const IMAGE_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    photos: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_IMAGE_CHECK_PHOTOS_PER_CALL,
      description: 'Genau ein Eintrag pro übergebenem Foto, in derselben Reihenfolge.',
      items: {
        type: 'object',
        properties: {
          photo_index: { type: 'integer', description: 'Index des Fotos in der übergebenen Reihenfolge, beginnend bei 0' },
          overall_score: SCORE_FIELD('Gesamteindruck über alle Teilbewertungen hinweg.'),
          technical_quality: SCORE_FIELD('Schärfe, Belichtung, Rauschen, Auflösung.'),
          composition: SCORE_FIELD('Bildaufbau, Bildausschnitt, Linienführung, Freiraum.'),
          light_and_color: SCORE_FIELD('Licht, Kontrast, Farbstimmung, Farbtemperatur.'),
          subject_impact: SCORE_FIELD('Wie stark trägt das Motiv selbst, Wiedererkennbarkeit, Klarheit.'),
          emotionality: SCORE_FIELD('Emotionale Wirkung/Atmosphäre.'),
          social_media_fit: SCORE_FIELD('Eignung für Social Media rein anhand des Bildes selbst (Format/Wirkung), NICHT als Reichweiten- oder Erfolgsprognose.'),
          reasoning: { type: 'string', description: 'Kurze, konkrete Begründung für die Bewertung dieses Fotos.' },
          improvement_tips: {
            type: 'array', maxItems: 3, items: { type: 'string' },
            description: 'Maximal 3 konkrete, umsetzbare Verbesserungshinweise, z.B. Zuschnitt, Horizont, Helligkeit, Schatten, Farbtemperatur, Motivposition.',
          },
          rank: { type: 'integer', description: 'Rangfolge 1 (bestes Bild) bis Anzahl der Fotos. Bei nur einem Foto: 1.' },
          is_best_overall: { type: 'boolean', description: 'Bestes Gesamtbild der Auswahl. Bei nur einem Foto: true.' },
          is_best_for_post: { type: 'boolean', description: 'Bestes Bild für einen Beitrag/Post. Bei nur einem Foto: true.' },
          is_best_for_story: { type: 'boolean', description: 'Bestes Bild für eine Story. Bei nur einem Foto: true.' },
          is_best_reel_cover: { type: 'boolean', description: 'Bestes Reel-Titelbild/Cover. Bei nur einem Foto: true.' },
          is_similar_or_weaker: { type: 'boolean', description: 'true, wenn dieses Foto einem anderen Foto der Auswahl sehr ähnlich ist oder klar schwächer als die übrigen.' },
        },
        required: [
          'photo_index', 'overall_score', 'technical_quality', 'composition', 'light_and_color', 'subject_impact',
          'emotionality', 'social_media_fit', 'reasoning', 'improvement_tips', 'rank',
          'is_best_overall', 'is_best_for_post', 'is_best_for_story', 'is_best_reel_cover', 'is_similar_or_weaker',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['photos'],
  additionalProperties: false,
}

const IMAGE_CHECK_PROMPT =
  'Du bist ein professioneller Foto-Prüfer für Reisefotos einer Familie. Bewerte JEDES übergebene Foto einzeln UND im ' +
  'Vergleich zu den anderen Fotos derselben Auswahl (falls mehr als eines). Vergib für jedes Foto einen Gesamtscore und ' +
  'sechs Teilbewertungen (technische Qualität, Bildkomposition, Licht und Farben, Motivwirkung, Emotionalität, ' +
  'Social-Media-Eignung), jeweils 0.0 bis 10.0 mit genau einer Nachkommastelle. Bei mehreren Fotos: vergib eine echte ' +
  'Rangfolge (1 = bestes Bild) und markiere das beste Gesamtbild, das beste Bild für einen Beitrag, das beste Bild für ' +
  'eine Story und das beste Reel-Titelbild -- das kann jeweils dasselbe oder ein unterschiedliches Foto sein, je nach ' +
  'Eignung. Erkenne Fotos, die einem anderen sehr ähnlich sind (z.B. Serienaufnahme) oder klar schwächer als der Rest. ' +
  'Gib zu jedem Foto eine kurze, konkrete Begründung und maximal drei konkrete, direkt umsetzbare Verbesserungshinweise ' +
  '(z.B. Zuschnitt, Horizont begradigen, Helligkeit, Schatten aufhellen, Farbtemperatur, Motivposition). ' +
  'Erzeuge NIEMALS Reichweiten-, Like-, Follower- oder Engagement-Prognosen -- bewerte ausschließlich das Bild selbst.'

function clampScore(n: number): number {
  return Math.round(Math.min(10, Math.max(0, n)) * 10) / 10
}

type RawImageCheckAssessment = {
  photo_index: number; overall_score: number; technical_quality: number; composition: number
  light_and_color: number; subject_impact: number; emotionality: number; social_media_fit: number
  reasoning: string; improvement_tips: string[]; rank: number
  is_best_overall: boolean; is_best_for_post: boolean; is_best_for_story: boolean
  is_best_reel_cover: boolean; is_similar_or_weaker: boolean
}

function parseImageCheckAssessments(raw: RawImageCheckAssessment[]): ImageCheckAssessment[] {
  return raw.map((a) => ({
    photoIndex: a.photo_index,
    overallScore: clampScore(a.overall_score),
    technicalQuality: clampScore(a.technical_quality),
    composition: clampScore(a.composition),
    lightAndColor: clampScore(a.light_and_color),
    subjectImpact: clampScore(a.subject_impact),
    emotionality: clampScore(a.emotionality),
    socialMediaFit: clampScore(a.social_media_fit),
    reasoning: a.reasoning,
    improvementTips: (a.improvement_tips ?? []).slice(0, 3),
    rank: a.rank,
    isBestOverall: a.is_best_overall,
    isBestForPost: a.is_best_for_post,
    isBestForStory: a.is_best_for_story,
    isBestReelCover: a.is_best_reel_cover,
    isSimilarOrWeaker: a.is_similar_or_weaker,
  }))
}

/**
 * §"Vor dem OpenAI-Aufruf nur komprimierte Analyseversionen verwenden, max.
 * lange Kante ~1600px" (Nutzervorgabe, wörtlich): eigene, kleinere Ableitung
 * NUR für den KI-Request-Payload -- rührt nie die gespeicherte Datei an
 * (die bleibt bei den bestehenden 2000px aus compressImageForStorage).
 */
export async function compressForAiAnalysis(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()
}

/**
 * §"Bild-Check": bis zu MAX_IMAGE_CHECK_PHOTOS_PER_CALL Fotos in EINEM
 * Aufruf, Einzel- und Vergleichsbewertung gemeinsam. Score-Rundung/-Clamping
 * passiert IMMER serverseitig (parseImageCheckAssessments/clampScore) --
 * JSON-Schema kann "genau eine Nachkommastelle" nicht selbst erzwingen, das
 * Modell wird also nie blind vertraut. Gleiches Fehlerverhalten wie
 * assessPhotoBatch: nie werfen, immer `null` bei fehlendem Key oder Fehler,
 * niemals Bild-/Response-Payload loggen.
 */
export async function assessImageCheckBatch(
  photos: Array<{ buffer: Buffer; mimeType: string }>,
  contextText: string,
): Promise<ImageCheckAssessment[] | null> {
  if (photos.length === 0) return []
  if (!process.env.OPENAI_API_KEY) return null

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const content = buildPhotoContentBlocks(`${IMAGE_CHECK_PROMPT}\n\n${contextText}`, photos, MAX_IMAGE_CHECK_PHOTOS_PER_CALL)

    const response = await openai.responses.create({
      model: OPENAI_MODEL_IMAGE_CHECK,
      reasoning: { effort: OPENAI_REASONING_EFFORT_IMAGE_CHECK as 'low' | 'medium' | 'high' },
      input: [{ role: 'user', content }],
      text: { format: { type: 'json_schema', name: 'image_check', schema: IMAGE_CHECK_SCHEMA, strict: true } },
    })
    const parsed = JSON.parse(response.output_text)
    return parseImageCheckAssessments(parsed.photos)
  } catch (e) {
    console.error('[image-check] assessImageCheckBatch fehlgeschlagen', e instanceof Error ? e.message : 'unknown')
    return null
  }
}
