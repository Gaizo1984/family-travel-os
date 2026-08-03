/**
 * §"Buchung überschneidet sich mit einem anderen Termin" (Nutzervorgabe):
 * verallgemeinerter Paarweise-Überschneidungs-Helfer, extrahiert aus den
 * zwei bisher inline duplizierten Prüfungen in lib/readiness.ts (Etappen-
 * Zeile ~181, Flug-Zeile ~217, beide `aStart<=bEnd && bStart<=aEnd`) --
 * jetzt für beliebige Buchungen/Journey-Events, mit optionaler
 * Teilnehmer-Schnittmenge, damit zwei unabhängige Termine verschiedener
 * Familienmitglieder nicht fälschlich als Konflikt gemeldet werden.
 */
export type IntervalItem = {
  id: string
  label: string
  href: string
  start: string
  end: string
  /** null = gilt für die ganze Familie (z. B. ein gemeinsamer Flug ohne Teilnehmerauswahl) -- schneidet sich immer mit jeder anderen Teilnehmermenge. */
  participantIds: string[] | null
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

export function participantsIntersect(a: string[] | null, b: string[] | null): boolean {
  if (!a || !b || a.length === 0 || b.length === 0) return true
  return a.some((id) => b.includes(id))
}

export function findOverlappingPairs(items: IntervalItem[]): Array<[IntervalItem, IntervalItem]> {
  const pairs: Array<[IntervalItem, IntervalItem]> = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]
      const b = items[j]
      if (!rangesOverlap(a.start, a.end, b.start, b.end)) continue
      if (!participantsIntersect(a.participantIds, b.participantIds)) continue
      pairs.push([a, b])
    }
  }
  return pairs
}
