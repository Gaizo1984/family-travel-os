/**
 * §Gemeinsames JSON-Schema-Fragment (caption/hashtags/quality_check) für
 * KI-Content-Aufrufe -- aus lib/actions/content-sessions.ts ausgelagert, weil
 * eine 'use server'-Datei ausschließlich async Functions exportieren darf
 * (Next.js-Build-Fehler "A 'use server' file can only export async
 * functions"). Reine Konstante, kein Server-Action-Code, deshalb hier statt
 * dort.
 */
export const BASE_CONTENT_PROPS = {
  caption: { type: 'string', description: 'Fertige Bildunterschrift mit Emojis' },
  hashtags: { type: 'array', items: { type: 'string' }, maxItems: 12 },
  quality_check: {
    type: 'object',
    description: 'Ehrliche Kurzbewertung: Bild-Text-Passung, visuelle Vielfalt, Hook-Stärke, Engagement-Potenzial, Authentizität.',
    properties: {
      rating: { type: 'string', enum: ['stark', 'solide', 'verbesserungsfaehig'] },
      summary: { type: 'string', description: 'Ein bis zwei Sätze Begründung' },
      suggestions: { type: 'array', items: { type: 'string' }, description: 'Konkrete Verbesserungsvorschläge, leeres Array wenn rating="stark"' },
    },
    required: ['rating', 'summary', 'suggestions'],
    additionalProperties: false,
  },
} as const
