/**
 * Deterministische Erzeugung einer gedeckelten Auswahl von Hin-/Rückflug-
 * Datumskombinationen für die flexible Flugsuche ("Reisefenster + gewünschte
 * Nächtezahl" → mehrere gültige Kombinationen vergleichen), ohne das volle
 * Kreuzprodukt ungefiltert an die Flight Engine zu senden. Gleiche Eingabe
 * ergibt immer dieselbe Auswahl (kein Zufall) — Voraussetzung dafür, dass
 * die Live-Vorschau im Formular exakt zeigt, was beim Absenden tatsächlich
 * gesucht wird.
 */

export const MAX_FLEXIBLE_DATE_COMBINATIONS = 15 // Zielobergrenze pro Nutzeraktion/Klick (Vorgabe: 10–20)

export type DateCombination = { departureDate: string; returnDate: string; nights: number }

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime()
  const db = new Date(`${b}T00:00:00Z`).getTime()
  return Math.round((db - da) / 86400000)
}

function nightsRange(nightsMin: number, nightsMax: number): number[] {
  const lo = Math.min(nightsMin, nightsMax)
  const hi = Math.max(nightsMin, nightsMax)
  const values: number[] = []
  for (let n = lo; n <= hi; n++) values.push(n)
  return values
}

/** Alle gültigen Abflugtage für eine feste Nächtezahl innerhalb des Reisefensters (aufsteigend sortiert). */
function validDeparturesForNights(windowStart: string, windowEnd: string, nights: number): string[] {
  const lastValidOffset = daysBetween(windowStart, windowEnd) - nights
  if (lastValidOffset < 0) return []
  const dates: string[] = []
  for (let offset = 0; offset <= lastValidOffset; offset++) dates.push(addDays(windowStart, offset))
  return dates
}

/**
 * Wählt `count` Indizes gleichmäßig verteilt aus `[0, length-1]` -- nimmt bei
 * `count > 1` immer Index 0 (frühester Termin) und Index `length-1`
 * (spätester Termin) mit auf, der Rest wird arithmetisch dazwischen verteilt.
 * Rein arithmetisch, ohne Zufallskomponente.
 */
function evenIndices(length: number, count: number): number[] {
  if (length <= 0 || count <= 0) return []
  if (count >= length) return Array.from({ length }, (_, i) => i)
  if (count === 1) return [Math.floor((length - 1) / 2)]
  const indices = new Set<number>()
  for (let i = 0; i < count; i++) indices.add(Math.round((i * (length - 1)) / (count - 1)))
  return Array.from(indices).sort((a, b) => a - b)
}

/**
 * Verteilt `totalBudget` per Round-Robin gleichmäßig über die Nächte-Werte
 * (Töpfe mit Kapazität `capacities[i]`) -- kein Nächte-Wert wird bevorzugt;
 * ungenutztes Budget eines ausgeschöpften Topfs wandert automatisch an
 * Töpfe mit noch offenem Spielraum weiter.
 */
function distributeBudget(totalBudget: number, capacities: number[]): number[] {
  const allocations = capacities.map(() => 0)
  let remaining = totalBudget
  let progress = true
  while (remaining > 0 && progress) {
    progress = false
    for (let i = 0; i < capacities.length && remaining > 0; i++) {
      if (allocations[i] < capacities[i]) {
        allocations[i] += 1
        remaining -= 1
        progress = true
      }
    }
  }
  return allocations
}

/**
 * Für "Weitere Datumsvarianten prüfen": wählt `count` Indizes aus den in
 * Batch `batch` noch NICHT verwendeten Indizes, wieder gleichmäßig verteilt
 * über die verbleibende Menge -- füllt so bei jedem weiteren Klick die
 * Lücken zwischen den bereits geprüften Terminen auf, statt zu überlappen
 * oder zufällig neue Termine zu ziehen. Deterministisch: gleicher `batch`
 * liefert immer dieselbe Auswahl.
 */
function batchIndices(length: number, count: number, batch: number): number[] {
  const used = new Set<number>()
  for (let prevBatch = 0; prevBatch < batch; prevBatch++) {
    const remaining = Array.from({ length }, (_, i) => i).filter((i) => !used.has(i))
    if (remaining.length === 0) break
    const picked = evenIndices(remaining.length, Math.min(count, remaining.length)).map((i) => remaining[i])
    picked.forEach((i) => used.add(i))
  }
  const remaining = Array.from({ length }, (_, i) => i).filter((i) => !used.has(i))
  return evenIndices(remaining.length, Math.min(count, remaining.length)).map((i) => remaining[i]).sort((a, b) => a - b)
}

/**
 * Live-Vorschau (rein arithmetisch, kein Request): wie viele Kombinationen
 * gäbe es theoretisch (`total`, ungekürztes Kreuzprodukt), und wie viele
 * werden nach dem Verdichtungsverfahren tatsächlich geprüft (`capped`).
 */
export function countFlexibleDateCombinations(
  windowStart: string,
  windowEnd: string,
  nightsMin: number,
  nightsMax: number,
): { total: number; capped: number } {
  if (!windowStart || !windowEnd || windowEnd < windowStart) return { total: 0, capped: 0 }
  const capacities = nightsRange(nightsMin, nightsMax).map(
    (n) => validDeparturesForNights(windowStart, windowEnd, n).length,
  )
  const total = capacities.reduce((sum, c) => sum + c, 0)
  return { total, capped: Math.min(total, MAX_FLEXIBLE_DATE_COMBINATIONS) }
}

/**
 * Erzeugt die tatsächlich zu suchenden Datumskombinationen. `batch=0` ist
 * die erste, gedeckelte, übers ganze Fenster verteilte Auswahl; `batch=1,2,…`
 * ("Weitere Datumsvarianten prüfen") füllt deterministisch weitere Lücken.
 */
export function generateFlexibleDateCombinations(
  windowStart: string,
  windowEnd: string,
  nightsMin: number,
  nightsMax: number,
  batch = 0,
): DateCombination[] {
  if (!windowStart || !windowEnd || windowEnd < windowStart) return []
  const nights = nightsRange(nightsMin, nightsMax)
  const departuresPerNights = nights.map((n) => validDeparturesForNights(windowStart, windowEnd, n))
  const capacities = departuresPerNights.map((d) => d.length)
  const budget = distributeBudget(MAX_FLEXIBLE_DATE_COMBINATIONS, capacities)

  const combinations: DateCombination[] = []
  nights.forEach((n, i) => {
    const departures = departuresPerNights[i]
    const b = budget[i]
    if (departures.length === 0 || b === 0) return
    const indices = batch === 0 ? evenIndices(departures.length, b) : batchIndices(departures.length, b, batch)
    for (const idx of indices) {
      const departureDate = departures[idx]
      combinations.push({ departureDate, returnDate: addDays(departureDate, n), nights: n })
    }
  })

  return combinations.sort((a, b) => a.departureDate.localeCompare(b.departureDate))
}
