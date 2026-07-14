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
