import type { FamilyDnaSummary } from '@/lib/family-dna'
import type { Destination, MoodKey } from '@/lib/data/destination-knowledge'

export type ScoredDestination = {
  destination: Destination
  score: number
  reasoning: string
}

/**
 * Rein deterministisches Scoring (keine KI, kein Live-Wetter/Preis) — bewertet
 * statisches Zielwissen gegen die Familien-Travel-DNA (Reisekompass-Gewichte,
 * Hotelkriterien) und vermeidet Wiederholungen bereits bereister Ziele.
 */
export function scoreDestinations(
  destinations: Destination[],
  dna: FamilyDnaSummary,
  options: { seasonMonths?: string[] | null; mood?: MoodKey | null; avoidNames?: string[] } = {},
): ScoredDestination[] {
  const prefByKey = new Map(dna.preferences.map((p) => [p.category_key, p.weight]))
  const avoidLower = (options.avoidNames ?? []).map((n) => n.toLowerCase())
  const weight = (key: string) => prefByKey.get(key) ?? 3

  const filtered = destinations.filter((d) => {
    if (options.seasonMonths && d.bestSeasonMonths && !d.bestSeasonMonths.some((m) => options.seasonMonths!.includes(m))) return false
    if (options.mood && !d.moods.includes(options.mood)) return false
    return true
  })

  const scored = filtered.map((d) => {
    let score = 0
    const reasons: string[] = []

    if (d.hotelStyleTags.includes('architektur_design') || d.hotelStyleTags.includes('charakter_statt_kette')) {
      const w = weight('hotels_design')
      if (w >= 4) { score += w; reasons.push('eurem hohen Gewicht auf Hotels & Design') }
    }
    if (d.moods.includes('natur_kinder') || d.moods.includes('ende_der_welt') || d.hotelStyleTags.includes('naturintegration')) {
      const w = weight('natur_landschaft')
      if (w >= 4) { score += w; reasons.push('eurer Vorliebe für Natur & Landschaft') }
    }
    if (d.moods.includes('meer_pur') || d.hotelStyleTags.includes('pool_strand')) {
      const w = weight('strand_wasser')
      if (w >= 4) { score += w; reasons.push('eurem Wunsch nach Strand & Wasser') }
    }
    if (d.moods.includes('kultur_ohne_pflicht')) {
      const w = weight('kultur_entdecken')
      if (w >= 4) { score += w; reasons.push('eurem Interesse an Kultur & Entdecken') }
    }
    if (d.moods.includes('natur_kinder') || d.moods.includes('grosse_reise')) {
      const w = weight('erlebnisse_fuer_alle')
      if (w >= 4) { score += w; reasons.push('eurem Wunsch nach Erlebnissen für alle') }
    }

    const tempoWeight = weight('reisetempo')
    if (tempoWeight <= 2 && d.pace === 'entspannt') { score += (3 - tempoWeight); reasons.push('eurem entspannten Reisetempo') }
    if (tempoWeight >= 4 && d.pace === 'aktiv') { score += tempoWeight; reasons.push('eurem Wunsch nach mehr Stationen und Tempo') }

    const hotelCriteriaMatches = d.hotelStyleTags.filter((t) => dna.hotelCriteria.includes(t))
    if (hotelCriteriaMatches.length > 0) {
      score += hotelCriteriaMatches.length
      reasons.push('euren Kriterien für außergewöhnliche Hotels')
    }

    let avoidNote = ''
    if (avoidLower.some((a) => a.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(a))) {
      score -= 3
      avoidNote = ' Ihr wart bereits an einem ähnlichen Ort — für Abwechslung niedriger eingestuft.'
    }

    const reasoning = reasons.length > 0
      ? `Passt zu ${reasons.slice(0, 2).join(' und ')}.${avoidNote}`
      : `Eine solide, ausgewogene Option auf Basis eures Reisekompasses.${avoidNote}`

    return { destination: d, score, reasoning }
  })

  return scored.sort((a, b) => b.score - a.score)
}
