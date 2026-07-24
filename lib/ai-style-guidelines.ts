/**
 * §"Keine generischen KI-Floskeln"/Faktenregel bisher pro KI-Flow separat
 * dupliziert (content-strategy-ai.ts, concierge-ai.ts, today-ai.ts,
 * content-idea-generation.ts). Für Content-Sessions erstmals als EIN
 * geteiltes Fragment gebündelt, statt ein fünftes Mal denselben Text zu
 * schreiben. Nur von lib/actions/content-sessions.ts genutzt (bestehende
 * Flows bleiben unverändert, kein Umbau bestehender Prompts in Phase 1).
 */
export const NO_CLICHE_INSTRUCTION =
  'Vermeide generische KI-Floskeln wie "unvergessliche Momente", "magische Erinnerungen" oder ' +
  '"ein Paradies auf Erden" -- außer die Familie wünscht sie ausdrücklich. Schreibe konkret, ' +
  'persönlich und hochwertig, nicht werblich überladen.'

export const FACT_RULE_INSTRUCTION =
  'Nutze ausschließlich die gegebenen Reisedaten (Buchungen, Etappen, Journey-Einträge) und den ' +
  'sichtbaren Bildinhalt als Faktengrundlage. Erfinde keine Hotels, Orte, Erlebnisse oder ' +
  'Tagesabläufe, die dort nicht stehen. Unsichere Inhalte neutral formulieren oder auslassen, ' +
  'niemals raten.'

export const CONTENT_TONALITY_OPTIONS = [
  { value: 'elegant_emotional', label: 'Elegant und emotional' },
  { value: 'casual_familiar', label: 'Locker und familiär' },
  { value: 'luxurious_restrained', label: 'Luxuriös und zurückhaltend' },
  { value: 'humorous', label: 'Humorvoll' },
  { value: 'informative', label: 'Informativ' },
  { value: 'short_modern', label: 'Kurz und modern' },
  { value: 'family_style', label: 'Eigener Familien-Stil' },
] as const
export type ContentTonality = (typeof CONTENT_TONALITY_OPTIONS)[number]['value']

export const CONTENT_TONALITY_LABELS: Record<string, string> = Object.fromEntries(
  CONTENT_TONALITY_OPTIONS.map((o) => [o.value, o.label]),
)

export function tonalityInstruction(tonality: string | null): string {
  const label = tonality ? CONTENT_TONALITY_LABELS[tonality] : null
  return label ? `Gewünschte Tonalität: ${label}.` : ''
}

export function languageInstruction(language: string): string {
  if (language === 'en') return 'Write all output in English.'
  if (language === 'both') return 'Liefere jeden Text zweisprachig: zuerst Deutsch, danach die englische Fassung, klar getrennt.'
  return 'Schreibe alle Ausgaben auf Deutsch.'
}

/** §"Geführter Content-Kontext": kompakte Fokus-Auswahl vor der Content-Erstellung -- fließt in die Passungsprüfung und den Generierungs-Prompt ein. */
export const CONTENT_FOCUS_OPTIONS = [
  { value: 'ausflug', label: 'Ausflug' },
  { value: 'strandtag', label: 'Strandtag' },
  { value: 'hotelmoment', label: 'Hotelmoment' },
  { value: 'familienmoment', label: 'Familienmoment' },
  { value: 'essen', label: 'Essen oder Restaurant' },
  { value: 'natur', label: 'Natur' },
  { value: 'tagesrueckblick', label: 'Tagesrückblick' },
  { value: 'mix', label: 'Mix' },
  { value: 'custom', label: 'Eigener Fokus' },
] as const
export const CONTENT_FOCUS_LABELS: Record<string, string> = Object.fromEntries(
  CONTENT_FOCUS_OPTIONS.map((o) => [o.value, o.label]),
)

export const CONTENT_MOOD_OPTIONS = [
  { value: 'ueberraschend', label: 'Überraschend' },
  { value: 'entspannend', label: 'Entspannend' },
  { value: 'lustig', label: 'Lustig' },
  { value: 'luxurioes', label: 'Luxuriös' },
  { value: 'abenteuerlich', label: 'Abenteuerlich' },
  { value: 'emotional', label: 'Emotional' },
  { value: 'kinderfokussiert', label: 'Kinderfokussiert' },
  { value: 'informativ', label: 'Informativ' },
  { value: 'ruhig', label: 'Besonders ruhig' },
] as const
export const CONTENT_MOOD_LABELS: Record<string, string> = Object.fromEntries(
  CONTENT_MOOD_OPTIONS.map((o) => [o.value, o.label]),
)

/** §Content Studio 3.0: die drei Reel-Stile aus dem MVP-Zuschnitt -- fließen später in Storyboard-/Rendering-Prompt ein (Sprint 3+), hier bereits als Auswahl-Katalog für den Einstieg (Sprint 1). */
export const REEL_STYLE_OPTIONS = [
  { value: 'luxury_travel', label: 'Luxury Travel' },
  { value: 'family_memory', label: 'Family Memory' },
  { value: 'dynamic_adventure', label: 'Dynamic Adventure' },
] as const
export type ReelStyle = (typeof REEL_STYLE_OPTIONS)[number]['value']
export const REEL_STYLE_LABELS: Record<string, string> = Object.fromEntries(
  REEL_STYLE_OPTIONS.map((o) => [o.value, o.label]),
)

/** §"Klickstärke ohne Clickbait": ein zum Entwurf passender Content-Winkel statt generischer KI-Floskeln oder billiger Übertreibung. */
export const ENGAGEMENT_ANGLE_INSTRUCTION =
  'Wähle einen zum Material passenden Content-Winkel (z.B. Kontrast, Überraschung, Familienmoment, ' +
  'persönlicher Tipp, ehrliche Beobachtung, kleine Geschichte, Luxus und Atmosphäre, hilfreicher Mehrwert, ' +
  'unerwartetes Highlight, ruhiger emotionaler Moment) und baue Hook/Caption entsprechend auf. ' +
  'Kein billiges Clickbait, keine falschen Versprechen, keine erfundenen Erlebnisse, keine übertriebene Werbesprache.'
