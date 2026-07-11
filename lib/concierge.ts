import { computeTripReadiness } from './readiness'
import { buildTomorrowPrepItems } from './today'
import type { StageInput, TimelineDay } from './journey'

/**
 * §"KI arbeitet nur bei echtem Mehrwert": mehrere Schnellaktionen lassen sich
 * bereits vollständig deterministisch aus vorhandenen, bewährten Bausteinen
 * beantworten (Reisebereitschaft, Morgen-Vorbereitung) — dafür braucht es
 * keinen KI-Aufruf, keine Zwischenspeicherung und kein Veralten. Nur die
 * Schnellaktionen, die echte Abwägung/Synthese brauchen (Wetter anpassen,
 * Alternative finden) sowie Freitext-Fragen gehen über lib/concierge-ai.ts.
 */

export type QuickActionKey =
  | 'today_important' | 'plan_tomorrow' | 'whats_missing' | 'explain_conflict'
  | 'adjust_weather' | 'find_alternative'

export type QuickAction = { key: QuickActionKey; label: string; deterministic: boolean }

export const QUICK_ACTIONS: QuickAction[] = [
  { key: 'today_important', label: 'Was ist heute wichtig?', deterministic: false },
  { key: 'plan_tomorrow', label: 'Plane morgen', deterministic: true },
  { key: 'whats_missing', label: 'Was fehlt?', deterministic: true },
  { key: 'adjust_weather', label: 'Wetter anpassen', deterministic: false },
  { key: 'find_alternative', label: 'Alternative finden', deterministic: false },
  { key: 'explain_conflict', label: 'Konflikt erklären', deterministic: true },
]

export type ConciergeLink = { label: string; href: string }
export type ConciergeAnswer = { title: string; body: string; links: ConciergeLink[] }

/** "Was fehlt?": Hinweise (nicht Konflikte) aus der bestehenden Reisebereitschaft. */
export async function buildWhatsMissingAnswer(tripId: string, tripSlug: string): Promise<ConciergeAnswer> {
  const readiness = await computeTripReadiness(tripId)
  const hints = readiness.findings.filter((f) => f.severity === 'hint')

  if (hints.length === 0) {
    return { title: 'Nichts Offenes gefunden', body: 'Aktuell fehlt nichts Wesentliches für diese Reise — alles Bekannte ist vollständig.', links: [] }
  }
  return {
    title: `${hints.length} ${hints.length === 1 ? 'offener Punkt' : 'offene Punkte'}`,
    body: hints.map((h) => h.message).join(' '),
    links: hints.map((h) => ({ label: h.message, href: h.href })),
  }
}

/** "Konflikt erklären": echte Konflikte aus der bestehenden Reisebereitschaft. */
export async function buildExplainConflictAnswer(tripId: string): Promise<ConciergeAnswer> {
  const readiness = await computeTripReadiness(tripId)
  const conflicts = readiness.findings.filter((f) => f.severity === 'conflict')

  if (conflicts.length === 0) {
    return { title: 'Keine Konflikte', body: 'Aktuell sind keine echten Konflikte bei dieser Reise bekannt.', links: [] }
  }
  return {
    title: `${conflicts.length} ${conflicts.length === 1 ? 'Konflikt' : 'Konflikte'}`,
    body: conflicts.map((c) => c.message).join(' '),
    links: conflicts.map((c) => ({ label: c.message, href: c.href })),
  }
}

/** "Plane morgen": dieselbe deterministische Ableitung wie auf der Heute-Seite. */
export function buildPlanTomorrowAnswer(
  tomorrowDay: TimelineDay | null,
  stages: StageInput[],
  tomorrowIso: string,
  tripSlug: string,
): ConciergeAnswer {
  const items = buildTomorrowPrepItems(tomorrowDay, stages, tomorrowIso)
  if (items.length === 0) {
    return { title: 'Morgen ist nichts Besonderes vorzubereiten', body: 'Kein Check-out, keine Abholung, kein Transport steht für morgen an.', links: [] }
  }
  return {
    title: `${items.length} ${items.length === 1 ? 'Punkt' : 'Punkte'} für morgen`,
    body: items.map((i) => i.text).join(' '),
    links: [{ label: 'Zur Reise', href: `/trips/${tripSlug}` }],
  }
}
