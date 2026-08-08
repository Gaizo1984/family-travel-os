import type { PackingCategory, PackingItem, PackingSource, PackingStatus, PackingPriority, NeedsCheck } from '@/lib/packing-list'
import { PACKING_CATEGORY_ORDER, PACKING_PRIORITY_ORDER, SAFETY_CRITICAL_CATEGORIES } from '@/lib/packing-list'

/** §"Leicht und ausgewogen reicht, wir reisen i.d.R. mit wenig Gepäck" (Nutzer-Feedback): "komfortabel" bewusst entfernt statt nur versteckt. */
export type PackStyle = 'leicht' | 'ausgewogen'
export const PACK_STYLE_ORDER: PackStyle[] = ['leicht', 'ausgewogen']
export const PACK_STYLE_LABELS: Record<PackStyle, string> = { leicht: 'Leicht', ausgewogen: 'Ausgewogen' }

export type PackingFollowUpAnswers = {
  packStyle: PackStyle
  laundryAvailable: boolean
  specialEvents: string
  needsStroller: boolean
  needsCarSeat: boolean
  needsCarrier: boolean
  needsDiapers: boolean
  hasDrone: boolean
}

/** §"'Noch prüfen' ist kein Prioritätswert" (Nutzervorgabe, Packliste 2.0): AI-seitiger Rückgabewert inkl. "none" -- wird nach dem Parsen auf `NeedsCheck | null` (lib/packing-list.ts, ohne "none") abgebildet, das echte, filterbare Feld auf packing_items. */
export type NeedsCheckFlag = 'none' | NeedsCheck

/**
 * §"Bei Gesundheit keine Diagnosen oder konkrete Medikamente ableiten. Nur
 * neutrale Einträge ... verwenden" (Nutzervorgabe, wörtlich): strukturelle
 * Absicherung NACH dem Parsen, nicht nur Prompt-Wortlaut -- ein Label der
 * Kategorie 'medikamente_und_gesundheit', das keinem dieser generischen
 * Begriffe entspricht, wird auf den neutralen Standardeintrag zurückgesetzt.
 */
const ALLOWED_HEALTH_LABEL_PATTERNS = [
  'persönliche medikamente', 'medikamente', 'erste hilfe', 'erste-hilfe', 'pflaster', 'verband',
  'fieberthermometer', 'thermometer', 'sonnencreme', 'insektenschutz', 'reiseapotheke',
  'desinfektion', 'schmerzmittel', 'reisetabletten', 'sonnenbrand', 'mückenschutz', 'verbandszeug',
]
const HEALTH_LABEL_FALLBACK = 'Persönliche Medikamente'

export function sanitizeHealthLabel(category: string, label: string): string {
  if (category !== 'medikamente_und_gesundheit') return label
  const lower = label.toLowerCase()
  const isAllowed = ALLOWED_HEALTH_LABEL_PATTERNS.some((p) => lower.includes(p))
  return isAllowed ? label : HEALTH_LABEL_FALLBACK
}

/**
 * §"Medikamente von der Einzelperson weg hin zu Gemeinsam" (Nutzer-Feedback):
 * strukturelle Absicherung NACH dem Parsen, nicht nur Prompt-Wortlaut --
 * dieselbe Kategorie ist ohnehin durch sanitizeHealthLabel auf neutrale,
 * generische Bezeichnungen begrenzt, eine Personenzuordnung wäre also
 * ohnehin irreführend.
 */
export function sanitizeHealthPersonKey(category: string, personKey: string): string {
  return category === 'medikamente_und_gesundheit' ? 'gemeinsam' : personKey
}

/** §Abgleichsschlüssel-Drift durch KI-Uneinheitlichkeit begrenzen (Groß-/Kleinschreibung, Leerzeichen) -- siehe computeRegenerationDiff. */
export function normalizeSourceKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_')
}

export type GeneratedPackingItem = {
  personKey: string
  category: string
  label: string
  quantity: number
  priority: PackingPriority
  isLastMinute: boolean
  reasoning: string
  source: Exclude<PackingSource, 'manuell'>
  sourceKey: string
  needsCheckFlag: NeedsCheckFlag
}

export const PACKING_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          person_key: { type: 'string', description: 'Exakter Name aus der übergebenen Teilnehmerliste, oder "gemeinsam" für geteilte Gegenstände.' },
          category: { type: 'string', enum: PACKING_CATEGORY_ORDER },
          label: { type: 'string' },
          quantity: { type: 'integer' },
          priority: {
            type: 'string', enum: PACKING_PRIORITY_ORDER,
            description: '"unverzichtbar" nur für wirklich unverzichtbare Dinge (Dokumente, notwendige Medikamente, zwingend benötigte Ausrüstung), "empfohlen" für sinnvolle Standardgegenstände, "optional" für Nice-to-have. Nicht alles ist unverzichtbar.',
          },
          is_last_minute: {
            type: 'boolean',
            description: 'true für Dinge, die typischerweise erst am Abreisetag eingepackt werden (z.B. Zahnbürste, täglich verwendete Medikamente, Mobiltelefon, Ladekabel, Lieblingsspielzeug, Hausschlüssel) -- unabhängig von der Kategorie.',
          },
          reasoning: { type: 'string', description: 'Ein kurzer Satz auf Deutsch, warum dieser Gegenstand vorgeschlagen wird.' },
          source: { type: 'string', enum: ['basisliste', 'wetter', 'aktivitaet', 'buchung', 'hotel', 'bestaetigte_vorliebe', 'fruehere_reiseerfahrung'] },
          source_key: { type: 'string', description: 'Stabiler, sprachunabhängiger Schlüssel für dieses konkrete Konzept (z. B. "kleidung_regenjacke_mama"). MUSS bei einer künftigen erneuten Generierung derselben Reise für dasselbe gedachte Item identisch bleiben.' },
          needs_check_flag: {
            type: 'string', enum: ['none', 'baggage_allowance', 'hotel_amenity', 'airline_rule'],
            description: '"none" außer wenn dieser Vorschlag von einer NICHT bekannten Buchungs-/Hotel-/Gepäckangabe abhängt -- dann statt einer Annahme diesen Flag setzen, niemals eine Gepäckfreigrenze oder Hotel-Ausstattung erfinden.',
          },
        },
        required: ['person_key', 'category', 'label', 'quantity', 'priority', 'is_last_minute', 'reasoning', 'source', 'source_key', 'needs_check_flag'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
}

export type PackingGenerationContext = {
  tripTitle: string
  participants: Array<{ id: string; name: string; ageAtTrip: number | null; isMinor: boolean }>
  stageSummaries: string[]
  hotelChangeCount: number
  weatherSummary: string | null
  activityTitles: string[]
  confirmedMemories: string[]
  followUp: PackingFollowUpAnswers
  /** Reisedauer in Nächten, per lib/trip-dates.ts::deriveTripDateRange ermittelt -- null, wenn kein Zeitraum ableitbar ist. Für realistische Mengenangaben (z. B. Windeln), nicht für die Kleidungsmenge (siehe dortige Anweisung). */
  tripNights: number | null
}

/**
 * §"Windeln-Einstellung darf natürlich nur für [das jüngste Kind] übernommen
 * werden" (Nutzer-Feedback): die Checkbox selbst nennt keinen Namen -- ohne
 * explizite Zuordnung müsste die KI aus dem Kontext raten, WELCHES der
 * womöglich mehreren minderjährigen Teilnehmer gemeint ist (Rate-Risiko wie
 * beim früheren KI-Namensabgleich-Bug bei Hotels). Deshalb wird das jüngste
 * Kind mit bekanntem Alter HIER, deterministisch im Code, ermittelt und im
 * Prompt namentlich genannt -- die KI muss nicht mehr selbst zuordnen.
 */
export function youngestParticipant(participants: PackingGenerationContext['participants']): PackingGenerationContext['participants'][number] | null {
  const withKnownAge = participants.filter((p) => p.ageAtTrip !== null)
  if (withKnownAge.length === 0) return null
  return withKnownAge.reduce((youngest, p) => (p.ageAtTrip! < youngest.ageAtTrip! ? p : youngest))
}

const DIAPER_LABEL_PATTERN = 'windel'

/**
 * §"Windeln-Einstellung darf natürlich nur für [das jüngste Kind] übernommen
 * werden" (Nutzer-Feedback): strukturelle Absicherung NACH dem Parsen,
 * analog zu sanitizeHealthPersonKey -- verlässt sich nicht allein auf
 * Prompt-Befolgung, jeder Windel-Gegenstand bekommt zwangsläufig den Namen
 * des tatsächlich gemeinten Kindes, egal was die KI als person_key liefert.
 */
export function sanitizeDiaperPersonKey(label: string, personKey: string, diaperChildName: string | null): string {
  if (!diaperChildName) return personKey
  return label.toLowerCase().includes(DIAPER_LABEL_PATTERN) ? diaperChildName : personKey
}

function followUpSummary(f: PackingFollowUpAnswers, diaperChild: PackingGenerationContext['participants'][number] | null): string {
  const lines = [
    `Packstil: ${PACK_STYLE_LABELS[f.packStyle]}`,
    `Waschmöglichkeit vor Ort: ${f.laundryAvailable ? 'ja' : 'nein/unbekannt'}`,
    f.specialEvents.trim() ? `Besondere Anlässe: ${f.specialEvents.trim()}` : null,
    f.needsStroller ? 'Kinderwagen wird benötigt.' : null,
    f.needsCarSeat ? 'Kindersitz wird benötigt.' : null,
    f.needsCarrier ? 'Babytrage wird benötigt.' : null,
    f.needsDiapers && diaperChild
      ? `Windeln werden ausschließlich für ${diaperChild.name}${diaperChild.ageAtTrip !== null ? ` (${diaperChild.ageAtTrip} Jahre)` : ''} benötigt -- für kein anderes Familienmitglied.`
      : f.needsDiapers ? 'Es reist noch ein Kind mit, das Windeln trägt (kein Alter bekannt, aus dem Kontext das plausibelste Kind wählen).' : null,
    f.hasDrone ? 'Es wird eine Drohne mitgenommen.' : null,
  ].filter((l): l is string => Boolean(l))
  return lines.join('\n')
}

/**
 * §"Unbekannte Hotel- oder Gepäckinformationen niemals erfinden" (Nutzervorgabe):
 * der Prompt nennt NUR tatsächlich bekannte Fakten -- Gepäckfreigrenzen und
 * Hotel-Ausstattung sind im Datenmodell strukturell nicht vorhanden (siehe
 * lib/bookings.ts BOOKING_TYPE_CONFIG), deshalb wird hier explizit auf deren
 * Fehlen hingewiesen statt sie wegzulassen -- das Modell soll aktiv
 * `needs_check_flag` setzen, nicht raten.
 */
export function buildPackingPrompt(ctx: PackingGenerationContext): string {
  const participantsText = ctx.participants
    .map((p) => `- ${p.name}${p.ageAtTrip !== null ? ` (${p.ageAtTrip} Jahre bei Reisebeginn)` : p.isMinor ? ' (minderjährig, genaues Alter unbekannt)' : ' (Erwachsene/r)'}`)
    .join('\n')
  const diaperChild = ctx.followUp.needsDiapers ? youngestParticipant(ctx.participants) : null

  return `Erstelle eine personenbezogene Packliste für die Reise "${ctx.tripTitle}".

Teilnehmer (person_key MUSS exakt einem dieser Namen oder "gemeinsam" entsprechen):
${participantsText}

Etappen:
${ctx.stageSummaries.length > 0 ? ctx.stageSummaries.join('\n') : 'Keine Etappen hinterlegt.'}
${ctx.hotelChangeCount > 1 ? `Die Reise hat ${ctx.hotelChangeCount} Unterkunftswechsel.` : ''}
${ctx.tripNights !== null ? `Gesamtreisedauer: ${ctx.tripNights} Nächte.` : ''}

Wetter:
${ctx.weatherSummary ?? 'Keine echte Vorhersage verfügbar (Reisebeginn liegt außerhalb des 5-Tage-Fensters) -- gib stattdessen eine kurz als Schätzung gekennzeichnete, allgemeine Klimaeinschätzung für Ziel und Reisezeitraum, markiere jeden darauf basierenden Gegenstand in reasoning als "geschätztes Klima".'}

Geplante Aktivitäten/Restaurants (nur Titel, roh -- interpretiere selbst ob Strand/Pool/Sport/Wandern/formelles Essen etc. relevant ist):
${ctx.activityTitles.length > 0 ? ctx.activityTitles.map((t) => `- ${t}`).join('\n') : 'Keine hinterlegt.'}

Bestätigte Vorlieben/frühere Packerfahrung dieser Familie:
${ctx.confirmedMemories.length > 0 ? ctx.confirmedMemories.map((m) => `- ${m}`).join('\n') : 'Keine bekannt.'}

Antworten der Familie:
${followUpSummary(ctx.followUp, diaperChild)}

Wichtige Einschränkungen:
- Gepäckfreigrenzen (Fluggewicht/-anzahl) sind NICHT bekannt. Erfinde niemals eine konkrete Grenze -- setze bei betroffenen Vorschlägen needs_check_flag="baggage_allowance".
- Hotel-Ausstattung (Handtücher, Föhn, Babybett, Waschmöglichkeit) ist NICHT bekannt, außer explizit oben genannt. Erfinde nichts -- setze needs_check_flag="hotel_amenity".
- Triff niemals verbindliche Aussagen zu verbotenen Gegenständen oder aktuellen Airline-Sicherheitsregeln -- setze bei relevanten Gegenständen needs_check_flag="airline_rule".
- Kategorie "medikamente_und_gesundheit": ausschließlich neutrale, generische Einträge wie "Persönliche Medikamente", niemals Diagnosen oder konkrete Medikamentennamen ableiten. "Erste-Hilfe-Set" NICHT als eigenen, zusätzlichen Gegenstand vorschlagen -- ist eine Dopplung zu "Persönliche Medikamente"/"Reiseapotheke" und bereits darin enthalten.
- Größere Kinderausstattung (Reisebett/Kinderbett, Kinderwagen, Kindersitz, Babytrage) NUR vorschlagen, wenn die Familie das ausdrücklich in "Antworten der Familie" oben angegeben hat. Ohne ausdrückliche Angabe NICHT vorschlagen -- diese Dinge sind oft vor Ort vorhanden, werden anders gelöst (z. B. Kind schläft im Elternbett) oder unnötiger Ballast, das kannst du nicht wissen.
- Windeln NUR vorschlagen, wenn "Antworten der Familie" oben ausdrücklich ein Kind nennt, das noch Windeln trägt -- dann als eigener Gegenstand mit EXAKT dem dort genannten Namen als person_key (niemals einem anderen Teilnehmer, auch wenn mehrere Kinder mitreisen) und einer REALISTISCHEN, konkreten Menge (quantity), nicht 1: bei "Gesamtreisedauer" oben als Grundlage ca. 5-6 Windeln pro Tag rechnen, plus etwas Puffer für Reisetage/Verzögerungen -- z. B. bei 10 Nächten realistisch 60-70 Stück, nicht weniger.
- Wenn "Antworten der Familie" oben eine Drohne nennt: NUR die Drohne selbst als einen Gegenstand vorschlagen (person_key="gemeinsam", needs_check_flag="airline_rule" wegen unbekannter Akku-/Mitnahmeregeln je Airline/Zielland) -- KEINE weiteren Einzelteile wie Ladegerät, Ersatzakku, Ersatzpropeller, Speicherkarte oder Schutztasche separat auflisten, das zählt bereits zur Drohnenausrüstung selbst.
- Wenn Strand/Pool/Meer relevant ist (siehe Aktivitäten/Etappen oben): eine wasserdichte Tasche/Pouch für Handy, Portemonnaie und Schlüssel als sinnvollen Standardgegenstand vorschlagen (zum Schutz beim Schwimmen/im Wasser) -- das ist UNABHÄNGIG von einer eventuellen Drohne, niemals als Drohnenzubehör bezeichnen.
- Gegenstände, die typischerweise für die ganze Familie gemeinsam gelten (z. B. Ladegeräte, Sonnencreme, Insektenschutz), bekommen person_key="gemeinsam", NICHT eine Einzelperson -- außer es handelt sich eindeutig um ein persönliches Gerät.
- Kategorie "medikamente_und_gesundheit": IMMER person_key="gemeinsam", niemals eine Einzelperson -- die Einträge sind ohnehin nur neutrale, generische Bezeichnungen (siehe unten), eine Personenzuordnung wäre irreführend.
- Priorität differenziert wirklich: "unverzichtbar" nur für Dokumente, notwendige Medikamente, zwingend benötigte Ausrüstung -- nicht jeder Gegenstand ist unverzichtbar, die meisten sind "empfohlen" oder "optional".
- Mengen NICHT automatisch für jeden Reisetag ein vollständiges Kleidungsset -- weniger bei verlässlichem Waschservice, mehr Wechselkleidung bei kleinen Kindern, elegante Kleidung nur bei passendem Anlass, Regenausstattung abhängig vom Wetter/Forecast oben.
- Sportkleidung (z. B. Sport-/Funktionsshirt, kurze Sporthose, Sportschuhe) für JEDEN Teilnehmer als Basis-Vorschlag einplanen, nicht nur bei einer ausdrücklich gebuchten Sportaktivität -- Bewegung (Spaziergänge, Hotel-Fitnessraum, spontaner Sport) ist auf den meisten Reisen plausibel, auch ohne Buchung. Bei explizit gebuchten Sportaktivitäten (z. B. Tauchen, Wandern, Tennis) zusätzlich aktivitätsspezifische Kleidung/Ausrüstung ergänzen.
- Kurze Hosen IMMER als "Shorts" bezeichnen, nicht als "leichte Hose"/"leichte Hosen". Lange (Stoff-/Sommer-)Hosen separat als eigenen Gegenstand führen (z. B. "Leichte lange Hose"), nie unter der Bezeichnung "Shorts" vermischen.
- is_last_minute=true für Dinge, die erst am Abreisetag eingepackt werden können (Zahnbürste, täglich verwendete Medikamente, Handy, Ladekabel, Lieblingsspielzeug, Hausschlüssel) -- unabhängig von der sonstigen Kategorie des Gegenstands.
- Jeder Gegenstand braucht einen stabilen source_key, der bei einer künftigen erneuten Generierung für dasselbe gedachte Item identisch bleibt.`
}

function normalizeQuantity(raw: unknown): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 1
}

function isNeedsCheckFlag(value: unknown): value is NeedsCheckFlag {
  return value === 'none' || value === 'baggage_allowance' || value === 'hotel_amenity' || value === 'airline_rule'
}

function isPackingPriorityFromAi(value: unknown): value is PackingPriority {
  return value === 'unverzichtbar' || value === 'empfohlen' || value === 'optional'
}

function isPackingSourceFromAi(value: unknown): value is Exclude<PackingSource, 'manuell'> {
  return typeof value === 'string' && ['basisliste', 'wetter', 'aktivitaet', 'buchung', 'hotel', 'bestaetigte_vorliebe', 'fruehere_reiseerfahrung'].includes(value)
}

/** Parst und normalisiert die rohe KI-Antwort -- wirft nie, überspringt einzelne unbrauchbare Einträge statt die ganze Generierung abzubrechen. */
export function parseGeneratedItems(raw: unknown): GeneratedPackingItem[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { items?: unknown }).items)) return []
  const items = (raw as { items: unknown[] }).items

  const result: GeneratedPackingItem[] = []
  for (const entry of items) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const category = typeof e.category === 'string' ? e.category : 'gemeinsam'
    const rawLabel = typeof e.label === 'string' ? e.label.trim() : ''
    if (!rawLabel) continue
    const label = sanitizeHealthLabel(category, rawLabel)
    const sourceKeyRaw = typeof e.source_key === 'string' && e.source_key.trim() ? e.source_key : `${category}_${rawLabel}`
    const rawPersonKey = typeof e.person_key === 'string' && e.person_key.trim() ? e.person_key.trim() : 'gemeinsam'

    result.push({
      personKey: sanitizeHealthPersonKey(category, rawPersonKey),
      category, label, quantity: normalizeQuantity(e.quantity),
      priority: isPackingPriorityFromAi(e.priority) ? e.priority : 'empfohlen',
      isLastMinute: e.is_last_minute === true,
      reasoning: typeof e.reasoning === 'string' ? e.reasoning : '',
      source: isPackingSourceFromAi(e.source) ? e.source : 'basisliste',
      sourceKey: normalizeSourceKey(sourceKeyRaw),
      needsCheckFlag: isNeedsCheckFlag(e.needs_check_flag) ? e.needs_check_flag : 'none',
    })
  }
  return result
}

/** Bildet den AI-seitigen Rückgabewert (inkl. "none") auf das echte, persistierte Feld ab (lib/packing-list.ts::NeedsCheck, ohne "none" -- dort ist "kein Wert" schlicht `null`). */
export function needsCheckFlagToPersisted(flag: NeedsCheckFlag): NeedsCheck | null {
  return flag === 'none' ? null : flag
}

/**
 * §"Reisepässe etc. können bereits abgehakt sein, wenn diese in der App
 * hinterlegt und aktuell sind" (Nutzer-Feedback): rein deterministische
 * Nachbearbeitung NACH dem Parsen -- die KI kennt den Dokumentenstatus
 * nicht und soll ihn nicht raten, das entscheidet dieselbe Travel-
 * Requirements-Engine wie Ready to Travel (lib/travel-requirements.ts).
 */
export function buildReadyPassportPersonKeys(
  requirements: Array<{ type: string; status: string; personId: string | null }>,
  participants: Array<{ id: string; name: string }>,
): Set<string> {
  const nameById = new Map(participants.map((p) => [p.id, p.name.toLowerCase()]))
  const keys = new Set<string>()
  for (const r of requirements) {
    if (r.type !== 'passport' || r.status !== 'satisfied' || !r.personId) continue
    const name = nameById.get(r.personId)
    if (name) keys.add(name)
  }
  return keys
}

const PASSPORT_LABEL_PATTERN = 'reisepass'

export function initialStatusForItem(
  item: { category: string; label: string; personKey: string },
  readyPassportPersonKeys: Set<string>,
): PackingStatus {
  const isPassportDoc = item.category === 'dokumente' && item.label.toLowerCase().includes(PASSPORT_LABEL_PATTERN)
  if (isPassportDoc && readyPassportPersonKeys.has(item.personKey.toLowerCase())) return 'eingepackt'
  return 'offen'
}

export function reasoningWithReadinessNotice(reasoning: string, isPreChecked: boolean): string {
  if (!isPreChecked) return reasoning
  const notice = 'Bereits in LUMI hinterlegt und gültig -- als eingepackt vorbelegt.'
  return reasoning ? `${reasoning} ${notice}` : notice
}

// ─────────────────────────────── Diff ───────────────────────────────

export type PackingDiffBucket = 'neu_vorgeschlagen' | 'geaendert' | 'nicht_mehr_erforderlich'
export type PackingDiffEntry = {
  bucket: PackingDiffBucket
  key: string // `${personKey}|${sourceKey}`, stable identity for form round-tripping
  label: string
  personId: string | null
  personLabel: string
  category: string
  quantity: number
  priority: PackingPriority
  isLastMinute: boolean
  needsCheck: NeedsCheck | null
  reasoning: string
  source: PackingSource
  sourceKey: string
  existingItemId: string | null // gesetzt bei geaendert/nicht_mehr_erforderlich
}

/**
 * §"Manuell hinzugefügte Gegenstände erhalten, bereits gepackte erhalten,
 * nicht benötigte nicht sofort erneut vorschlagen, keine Duplikate,
 * sicherheitskritische Inhalte niemals automatisch entfernen" (Nutzervorgabe):
 * reine Vergleichsfunktion, kein Schreibzugriff -- siehe applyPackingListDiff
 * (lib/actions/packing-list-generation.ts) für die tatsächliche Übernahme.
 */
export function computeRegenerationDiff(
  existingItems: PackingItem[],
  generated: GeneratedPackingItem[],
  participants: Array<{ id: string; name: string }>,
): PackingDiffEntry[] {
  const personIdByName = new Map(participants.map((p) => [p.name.toLowerCase(), p.id]))
  const personNameById = new Map(participants.map((p) => [p.id, p.name]))

  // Nur KI-generierte Zeilen (source_key gesetzt) werden abgeglichen -- manuelle Zeilen (source_key=null) werden nie angefasst.
  const existingByKey = new Map<string, PackingItem>()
  for (const item of existingItems) {
    if (!item.sourceKey) continue
    existingByKey.set(`${item.personId ?? 'gemeinsam'}|${item.sourceKey}`, item)
  }

  const entries: PackingDiffEntry[] = []
  const seenKeys = new Set<string>()

  for (const gen of generated) {
    const personId = gen.personKey.toLowerCase() === 'gemeinsam' ? null : (personIdByName.get(gen.personKey.toLowerCase()) ?? null)
    const key = `${personId ?? 'gemeinsam'}|${gen.sourceKey}`
    seenKeys.add(key)
    const existing = existingByKey.get(key)

    if (!existing) {
      entries.push({
        bucket: 'neu_vorgeschlagen', key, label: gen.label, personId, personLabel: gen.personKey,
        category: gen.category, quantity: gen.quantity, priority: gen.priority, isLastMinute: gen.isLastMinute,
        needsCheck: needsCheckFlagToPersisted(gen.needsCheckFlag),
        reasoning: gen.reasoning, source: gen.source, sourceKey: gen.sourceKey, existingItemId: null,
      })
      continue
    }

    // §"Bereits Gepacktes bleibt eingefroren, auch wenn die KI eine andere Menge vorschlägt" (Nutzervorgabe-Ableitung).
    if (existing.status === 'eingepackt') continue
    // §"Nicht benötigt markierte Vorschläge kommen nicht zurück" (Nutzervorgabe, wörtlich) -- unabhängig vom KI-Output.
    if (existing.status === 'nicht_benoetigt') continue

    const changed = existing.quantity !== gen.quantity || existing.category !== gen.category || existing.label !== gen.label
    if (changed) {
      entries.push({
        bucket: 'geaendert', key, label: gen.label, personId, personLabel: gen.personKey,
        category: gen.category, quantity: gen.quantity, priority: gen.priority, isLastMinute: gen.isLastMinute,
        needsCheck: needsCheckFlagToPersisted(gen.needsCheckFlag),
        reasoning: gen.reasoning, source: gen.source, sourceKey: gen.sourceKey, existingItemId: existing.id,
      })
    }
  }

  for (const [key, existing] of existingByKey) {
    if (seenKeys.has(key)) continue
    if (existing.status === 'eingepackt' || existing.status === 'nicht_benoetigt') continue
    // §"Sicherheitskritische Inhalte niemals automatisch entfernen" (Nutzervorgabe, wörtlich: Reisepässe/erforderliche
    // Dokumente, notwendige Medikamente) -- unabhängig davon, ob die KI sie erneut vorschlägt.
    if (SAFETY_CRITICAL_CATEGORIES.includes(existing.category as PackingCategory)) continue
    entries.push({
      bucket: 'nicht_mehr_erforderlich', key, label: existing.label, personId: existing.personId,
      personLabel: existing.personId ? (personNameById.get(existing.personId) ?? 'gemeinsam') : 'gemeinsam',
      category: existing.category ?? 'gemeinsam', quantity: existing.quantity,
      priority: existing.priority, isLastMinute: existing.isLastMinute, needsCheck: existing.needsCheck,
      reasoning: existing.reasoning ?? '', source: existing.source, sourceKey: existing.sourceKey ?? '', existingItemId: existing.id,
    })
  }

  return entries
}
