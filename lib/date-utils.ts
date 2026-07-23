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

/** ISO-Datum um `days` verschieben (negativ = zurück) -- Berechnung über UTC-Mittag, damit keine lokale Zeitzone einen Tag verschluckt/verdoppelt. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Jedes Datum von `startIso` bis `endIso` (beide inklusive) -- für kurze, bekannte Zeiträume (z. B. Reise ± ein paar Tage), keine unbegrenzten Bereiche. */
export function enumerateIsoDates(startIso: string, endIso: string): string[] {
  const dates: string[] = []
  let cur = startIso
  while (cur <= endIso) {
    dates.push(cur)
    cur = addDaysIso(cur, 1)
  }
  return dates
}

/** Deutsches Kurz-Wochentag + Tag + Monat, z. B. "Mo., 21. Juli" -- für kompakte Tagesauswahl-Listen (siehe components/DaySelectField.tsx). */
export function formatIsoWithWeekday(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'long', timeZone: 'UTC' })
}

/** true, wenn `a` (ISO yyyy-mm-dd) strikt vor `b` liegt. */
export function isBeforeIso(a: string, b: string): boolean {
  return a < b
}

/** true, wenn `iso` in der Vergangenheit liegt (vor dem heutigen Datum). */
export function isPastIso(iso: string): boolean {
  return isBeforeIso(iso, isoToday())
}
