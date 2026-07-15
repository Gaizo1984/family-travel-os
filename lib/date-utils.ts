/**
 * Zentrale Datumsvergleiche für zukunftsgerichtete Felder (Reise-/Flug-/
 * Hoteldaten) — einzige Stelle, von `DateSelectFields`, Formularen und
 * Server Actions gleichermaßen genutzt, statt Datumsarithmetik mehrfach
 * zu duplizieren.
 */
export function isoToday(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export function isoMonthOffset(offsetMonths: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMonths)
  return d.toISOString().slice(0, 10)
}

/** true, wenn `a` (ISO yyyy-mm-dd) strikt vor `b` liegt. */
export function isBeforeIso(a: string, b: string): boolean {
  return a < b
}

/** true, wenn `iso` in der Vergangenheit liegt (vor dem heutigen Datum). */
export function isPastIso(iso: string): boolean {
  return isBeforeIso(iso, isoToday())
}
