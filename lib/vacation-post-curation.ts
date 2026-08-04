import OpenAI from 'openai'
import { addDaysIso, isoToday } from '@/lib/date-utils'

/**
 * §"Urlaubsbeitrag aus dem Bild-Check" (Nutzervorgabe): reine Kurations-
 * Logik (Auswahl + Reihenfolge aus bereits vorhandenen Bild-Check-
 * Bewertungen) -- KEINE zweite Bildanalyse. Die KI sieht hier bewusst keine
 * Bilder mehr, nur die bereits von `assessImageCheckBatch` gelieferten
 * Scores/Begründungen als Text -- exakt "die KI darf vorhandene Bilder nur
 * auswählen und ordnen, keine Erlebnisse/Reiseinformationen erfinden"
 * (Nutzervorgabe, wörtlich). Gleiches Aufruf-/Fehlerverhalten wie
 * lib/photo-quality-analysis.ts: nie werfen, `null` bei fehlendem Key oder
 * Fehler, kein Bild-/Response-Payload-Logging.
 */

export const MAX_VACATION_POST_PHOTOS = 15
export const VACATION_POST_EXPIRY_DAYS_AFTER_TRIP_END = 7

/**
 * §"Spätestens 7 Tage nach Reiseende, Löschfrist darf sich nicht durch
 * bloßes Anzeigen verlängern" (Nutzervorgabe, wörtlich): Referenzdatum ist
 * IMMER das Reiseende, nie der Vormerk-/Anzeigezeitpunkt -- dadurch
 * strukturell erfüllt, nicht nur durch Disziplin an den Aufrufstellen.
 * Fällt auf "heute + 7 Tage" zurück, falls die Reise noch kein Enddatum hat
 * (wird bei der automatischen Kuration ohnehin mit dem dann sicher
 * bekannten Enddatum neu gesetzt).
 */
export function computeVacationPostExpiresAt(tripEndDateIso: string | null): string {
  const base = tripEndDateIso ?? isoToday()
  return `${addDaysIso(base, VACATION_POST_EXPIRY_DAYS_AFTER_TRIP_END)}T00:00:00.000Z`
}

const OPENAI_MODEL_VACATION_POST_CURATION = process.env.OPENAI_MODEL_VACATION_POST_CURATION ?? 'gpt-5.6-terra'
const OPENAI_REASONING_VACATION_POST_CURATION = (process.env.OPENAI_REASONING_VACATION_POST_CURATION ?? 'medium') as 'low' | 'medium' | 'high'

export type VacationPostCandidate = {
  photoId: string
  score: number | null
  reasoning: string | null
  pinned: boolean
  existingRank: number | null
}

export type VacationPostSelectionEntry = { photoId: string; rank: number; selectionReason: string }

/** §"Ablauf darf sich nicht durch bloßes Anzeigen verlängern": Begründung wird nur an definierten Schreibpunkten (Vormerken/Kuration) verändert, nie beim Lesen. Gleiches Anhänge-Idiom wie reasoningWithCheckNotice (Packliste). */
export function withSelectionReasonAppended(existingReasoning: string | null, selectionReason: string): string {
  if (!selectionReason) return existingReasoning ?? ''
  return existingReasoning ? `${existingReasoning} · ${selectionReason}` : selectionReason
}

const CURATION_SCHEMA = {
  type: 'object',
  properties: {
    selection: {
      type: 'array',
      description: 'Ausgewählte Fotos in empfohlener Reihenfolge, erstes Element = Titelbild.',
      items: {
        type: 'object',
        properties: {
          photo_id: { type: 'string', description: 'Exakte photo_id aus der übergebenen Kandidatenliste.' },
          selection_reason: { type: 'string', description: 'Kurzer Satz, warum dieses Foto an dieser Stelle in der Dramaturgie steht.' },
        },
        required: ['photo_id', 'selection_reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['selection'],
  additionalProperties: false,
}

/**
 * §"Nicht ausschließlich nach höchstem Score" + Dramaturgie-Kriterien
 * (Nutzervorgabe, wörtlich übernommen): Kandidatenliste enthält bewusst nur
 * bereits vorhandene Metadaten (Score/Begründung aus Bild-Check), nie Bilder
 * selbst.
 */
export function buildCurationPrompt(candidates: VacationPostCandidate[], tripDigest: string, availableSlots: number): string {
  const list = candidates
    .map((c) => `- photo_id=${c.photoId}${c.score !== null ? `, Instagram-Score ${c.score}/10` : ', kein Score bekannt'}${c.reasoning ? `, Notiz: ${c.reasoning}` : ''}`)
    .join('\n')

  return `Kuratiere aus den folgenden, bereits einzeln bewerteten Reisefotos höchstens ${availableSlots} für einen Instagram-Karussell-Beitrag zum Reiseabschluss.

Reisekontext (einzige Faktengrundlage, erfinde nichts darüber hinaus):
${tripDigest || 'Keine weiteren Reisedaten hinterlegt.'}

Kandidaten (bereits von einer separaten Bildanalyse bewertet -- du bewertest NICHT neu, du wählst nur aus und ordnest):
${list}

Kriterien (keins davon ist allein ausschlaggebend):
- Bildqualität/Instagram-Eignung (bereits gegebener Score) -- NICHT ausschließlich danach auswählen.
- Unterschiedliche Motive und Situationen, keine ähnlichen/nahezu identischen Bilder doppelt (auf Notizen zu Ähnlichkeit achten).
- Ausgewogene Verteilung: Familie, Hotel/Unterkunft, Landschaft, Aktivitäten, Details.
- Reiseverlauf (siehe Reisekontext) sinnvoll widerspiegeln.
- Emotionale Wirkung.
- Sinnvolle Dramaturgie, als Orientierung (an das tatsächliche Material anpassen, nicht stur erzwingen): starkes Titelbild -> Anreise/erster Eindruck -> Hotel/Atmosphäre -> Familienmomente -> Aktivitäten/Highlights -> Landschaft/Tiere/Details -> emotionales Abschlussbild.
- Das erste ausgewählte Foto muss als starkes Karussell-Titelbild taugen.

Weniger als ${availableSlots} Fotos sind zulässig, wenn das Material keine sinnvoll größere Auswahl hergibt -- erzwinge keine Anzahl. Gib die Auswahl in der empfohlenen Reihenfolge zurück (erstes Element = Titelbild).`
}

type RawCurationSelection = { photo_id?: unknown; selection_reason?: unknown }

/** Verwirft jeden Eintrag mit unbekannter/doppelter photo_id oder ohne gültigen Text -- vertraut dem Modell nie blind. */
export function parseCurationResult(raw: unknown, validPhotoIds: Set<string>): Array<{ photoId: string; selectionReason: string }> {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { selection?: unknown }).selection)) return []
  const items = (raw as { selection: RawCurationSelection[] }).selection

  const seen = new Set<string>()
  const result: Array<{ photoId: string; selectionReason: string }> = []
  for (const entry of items) {
    const photoId = typeof entry.photo_id === 'string' ? entry.photo_id : ''
    if (!photoId || !validPhotoIds.has(photoId) || seen.has(photoId)) continue
    seen.add(photoId)
    result.push({ photoId, selectionReason: typeof entry.selection_reason === 'string' ? entry.selection_reason : '' })
  }
  return result
}

/**
 * §"Fixierte Bilder... dürfen durch eine erneute KI-Kuration nicht ungefragt
 * überschrieben werden" (Nutzervorgabe, wörtlich): strukturell erzwungen,
 * nicht nur per Prompt -- fixierte Fotos mit bestehendem Rang behalten
 * GENAU diesen Rang, fixierte ohne Rang bekommen vorrangig die nächsten
 * freien Plätze, erst danach füllt die KI-Auswahl die verbleibenden Plätze.
 */
export function mergeCurationWithPinned(
  allCandidates: VacationPostCandidate[],
  llmSelection: Array<{ photoId: string; selectionReason: string }>,
  maxSlots: number,
): VacationPostSelectionEntry[] {
  const pinned = allCandidates.filter((c) => c.pinned)
  const pinnedWithRank = pinned.filter((c) => c.existingRank !== null).sort((a, b) => a.existingRank! - b.existingRank!)
  const pinnedWithoutRank = pinned.filter((c) => c.existingRank === null)

  const usedRanks = new Set(pinnedWithRank.map((c) => c.existingRank!).filter((r) => r <= maxSlots))
  const availableRanks: number[] = []
  for (let r = 1; r <= maxSlots; r++) if (!usedRanks.has(r)) availableRanks.push(r)

  const result: VacationPostSelectionEntry[] = pinnedWithRank
    .filter((c) => c.existingRank! <= maxSlots)
    .map((c) => ({ photoId: c.photoId, rank: c.existingRank!, selectionReason: 'Fixiert' }))

  for (const c of pinnedWithoutRank) {
    const rank = availableRanks.shift()
    if (rank === undefined) break
    result.push({ photoId: c.photoId, rank, selectionReason: 'Fixiert' })
  }

  for (const sel of llmSelection) {
    const rank = availableRanks.shift()
    if (rank === undefined) break
    result.push({ photoId: sel.photoId, rank, selectionReason: sel.selectionReason })
  }

  return result.sort((a, b) => a.rank - b.rank)
}

/**
 * Einziger OpenAI-Aufruf dieses Moduls -- reine Text-Kuration über bereits
 * vorhandene Bewertungen, kein erneuter Bild-Upload/-Analyse. Gibt bei
 * fehlendem API-Key, Fehler oder wenn nichts zu kuratieren ist `null`/eine
 * reine Pin-Liste zurück, wirft nie.
 */
export async function curateVacationPostSelection(
  candidates: VacationPostCandidate[],
  tripDigest: string,
): Promise<VacationPostSelectionEntry[] | null> {
  if (candidates.length === 0) return []

  const unpinned = candidates.filter((c) => !c.pinned)
  const pinnedCount = candidates.length - unpinned.length
  const availableSlots = Math.max(0, MAX_VACATION_POST_PHOTOS - pinnedCount)

  if (unpinned.length === 0 || availableSlots === 0) {
    return mergeCurationWithPinned(candidates, [], MAX_VACATION_POST_PHOTOS)
  }
  if (!process.env.OPENAI_API_KEY) return null

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.responses.create({
      model: OPENAI_MODEL_VACATION_POST_CURATION,
      reasoning: { effort: OPENAI_REASONING_VACATION_POST_CURATION },
      input: [{ role: 'user', content: [{ type: 'input_text', text: buildCurationPrompt(unpinned, tripDigest, availableSlots) }] }],
      text: { format: { type: 'json_schema', name: 'vacation_post_curation', schema: CURATION_SCHEMA, strict: true } },
    })
    const parsed = JSON.parse(response.output_text)
    const validIds = new Set(unpinned.map((c) => c.photoId))
    const selection = parseCurationResult(parsed, validIds).slice(0, availableSlots)

    return mergeCurationWithPinned(candidates, selection, MAX_VACATION_POST_PHOTOS)
  } catch (e) {
    console.error('[vacation-post-curation] curateVacationPostSelection fehlgeschlagen', e instanceof Error ? e.message : 'unknown')
    return null
  }
}
