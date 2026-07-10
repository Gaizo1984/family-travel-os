/**
 * "Heute" muss sich auf den Kalendertag/die Uhrzeit der Familie beziehen
 * (Deutschland), nicht auf UTC. `new Date().toISOString()` liefert die
 * UTC-Repräsentation des aktuellen Moments — zwischen 22:00 und 23:59 UTC
 * (00:00–01:59 deutscher Sommerzeit) zeigt UTC noch den VORHERIGEN Kalendertag,
 * während es in Deutschland lokal bereits der nächste Tag ist. In diesem
 * täglichen ~2-Stunden-Fenster hätte ein gerade für "heute" eingetragener
 * Programmpunkt (Datum aus dem lokalen Datums-Picker) nicht zur UTC-"heute"
 * gepasst und wäre im Bereich "Heutiger Tag" scheinbar spurlos verschwunden.
 * Einzige Instanz für eine Einzelfamilien-App ohne Zeitzonen-Einstellung.
 */
const FAMILY_TIMEZONE = 'Europe/Berlin'

export function todayIsoInFamilyTimezone(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FAMILY_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function nowHHMMInFamilyTimezone(): string {
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: FAMILY_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('hour')}:${get('minute')}`
}
