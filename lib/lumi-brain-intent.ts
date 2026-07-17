/**
 * §"LUMI Brain / Frag LUMI": deterministisches Keyword-Matching als erste
 * Stufe (gleiches Muster wie `lib/today.ts::detectLumiIntent`, das für die
 * bereits bestehende Kategorie-/Tagesplan-Weiterleitung unverändert bleibt
 * und hier NICHT dupliziert wird -- `askConcierge` prüft weiterhin zuerst
 * `detectLumiIntent`, erst danach diese fünf neuen Intents). Kein
 * zusätzlicher KI-Klassifizierungsaufruf: erkennt das Keyword-Matching
 * nichts eindeutig, bleibt es beim bestehenden freien Fließtext-Pfad
 * (`generateConciergeAnswer`).
 */

export type LumiBrainIntentType = 'reise_check' | 'familienfit' | 'vergleich' | 'journey_support' | 'inspiration'

export type LumiBrainIntent =
  | { type: 'reise_check' }
  | { type: 'familienfit' }
  | { type: 'vergleich'; subject: 'hotel' | 'flight' | 'general' }
  | { type: 'journey_support'; subject: 'plan_day' | 'today_important' | 'free_days' | 'combine_activities' }
  | { type: 'inspiration' }

const REISE_CHECK_KEYWORDS = ['was fehlt', 'fehlt noch', 'reisebereit', 'bereit für die reise', 'noch offen', 'was ist offen', 'checkliste']

const FAMILIENFIT_KEYWORDS = [
  'sinnvoll mit', 'mit unseren kindern', 'mit den kindern', 'für die kinder', 'realistisch',
  'zu voll', 'zu anstrengend', 'familiengerecht', 'schlafzeiten', 'transferzeit', 'zu viel für',
]

const VERGLEICH_HOTEL_KEYWORDS = ['welches hotel', 'hotel passt besser', 'hotel vergleich', 'besseres hotel']
const VERGLEICH_FLIGHT_KEYWORDS = ['welche flugverbindung', 'welcher flug', 'flug passt besser', 'flug vergleich', 'bessere flugverbindung']
const VERGLEICH_GENERAL_KEYWORDS = ['beste verhältnis', 'komfort, reisezeit', 'preis-leistung', 'was passt besser']

const JOURNEY_PLAN_DAY_KEYWORDS = ['plane', 'planen', 'tag planen', 'tagesplan']
const JOURNEY_TODAY_KEYWORDS = ['heute wichtig', 'was ist heute', 'was steht heute an']
const JOURNEY_FREE_DAYS_KEYWORDS = ['freie tage', 'freier tag', 'noch nichts geplant', 'offene tage']
const JOURNEY_COMBINE_KEYWORDS = ['kombinieren', 'sinnvoll verbinden', 'zusammenlegen']

const INSPIRATION_KEYWORDS = [
  'ähneln', 'ähnlich wie', 'passt zu unseren bisherigen', 'wie unsere bisherigen', 'erfahrungswissen',
  'bisherige reisen', 'bisherige hotels', 'welche reiseziele', 'passen zu uns', 'passen am besten',
]

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw))
}

/**
 * Reine, synchrone Keyword-Erkennung -- kein LLM-Call. Reihenfolge ist
 * bewusst: spezifischere Intents (Vergleich/Familienfit) vor dem generischen
 * Journey-Support geprüft, damit z. B. "welches Hotel passt besser" nicht
 * fälschlich als allgemeine Journey-Frage durchgeht.
 */
export function detectLumiBrainIntent(questionText: string): LumiBrainIntent | null {
  const text = questionText.toLowerCase()

  if (includesAny(text, REISE_CHECK_KEYWORDS)) return { type: 'reise_check' }
  if (includesAny(text, FAMILIENFIT_KEYWORDS)) return { type: 'familienfit' }
  if (includesAny(text, VERGLEICH_HOTEL_KEYWORDS)) return { type: 'vergleich', subject: 'hotel' }
  if (includesAny(text, VERGLEICH_FLIGHT_KEYWORDS)) return { type: 'vergleich', subject: 'flight' }
  if (includesAny(text, VERGLEICH_GENERAL_KEYWORDS)) return { type: 'vergleich', subject: 'general' }
  if (includesAny(text, JOURNEY_FREE_DAYS_KEYWORDS)) return { type: 'journey_support', subject: 'free_days' }
  if (includesAny(text, JOURNEY_TODAY_KEYWORDS)) return { type: 'journey_support', subject: 'today_important' }
  if (includesAny(text, JOURNEY_COMBINE_KEYWORDS)) return { type: 'journey_support', subject: 'combine_activities' }
  if (includesAny(text, JOURNEY_PLAN_DAY_KEYWORDS)) return { type: 'journey_support', subject: 'plan_day' }
  if (includesAny(text, INSPIRATION_KEYWORDS)) return { type: 'inspiration' }

  return null
}

/** Grobe, best-effort Erkennung eines im Fragetext genannten Datums (z. B. "25. Juli") -- kein volles NLU, nur Regex gegen deutsche Monatsnamen. Gibt `null`, wenn nichts Eindeutiges gefunden wird -- der Aufrufer muss diesen Fall ehrlich benennen, nicht raten. */
const GERMAN_MONTHS: Record<string, number> = {
  januar: 1, februar: 2, märz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
}

export function extractMentionedDayMonth(questionText: string): { day: number; month: number } | null {
  const match = questionText.toLowerCase().match(/(\d{1,2})\.?\s*(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)/)
  if (!match) return null
  const day = Number(match[1])
  const month = GERMAN_MONTHS[match[2]]
  if (day < 1 || day > 31) return null
  return { day, month }
}
