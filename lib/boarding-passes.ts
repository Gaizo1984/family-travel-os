/**
 * Feste Anzeige-Reihenfolge für den Boardingpass-Vollbild-Viewer (§7.1): Marcel,
 * Sarah, Elias, Lia, Lumi — explizite Vorgabe, nicht aus Datenbank-IDs ableitbar
 * (Personen-IDs sind chronologisch nach Anlage vergeben, nicht nach Alter/Rolle).
 * Unbekannte Namen fallen ans Ende, alphabetisch, statt zu verschwinden.
 */
export const FAMILY_BOARDING_PASS_ORDER = ['Marcel', 'Sarah', 'Elias', 'Lia', 'Lumi']

export function sortForBoardingPassViewer<T extends { name: string }>(persons: T[]): T[] {
  return [...persons].sort((a, b) => {
    const ai = FAMILY_BOARDING_PASS_ORDER.indexOf(a.name)
    const bi = FAMILY_BOARDING_PASS_ORDER.indexOf(b.name)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.name.localeCompare(b.name)
  })
}
