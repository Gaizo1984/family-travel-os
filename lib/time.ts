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

/**
 * §"Für die Tagesanzeige immer die Ortszeit (Zeit vor Ort), nicht die
 * deutsche Zeit" (Nutzervorgabe, Journey-Bugfix): verallgemeinerte Version
 * von `todayIsoInFamilyTimezone` für eine BELIEBIGE IANA-Zeitzone -- nutzt
 * dieselbe `Intl.DateTimeFormat`-Technik, damit z. B. die Journey (siehe
 * lib/journey-events-model.ts) "heute" je Tag anhand der Zeitzone DES
 * JEWEILIGEN Reiseziels bestimmen kann, statt immer Berlin anzunehmen.
 */
export function todayIsoInTimezone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function todayIsoInFamilyTimezone(): string {
  return todayIsoInTimezone(FAMILY_TIMEZONE)
}

/** Verallgemeinerte Version von `nowHHMMInFamilyTimezone` -- siehe `todayIsoInTimezone`-Kommentar. */
export function nowHHMMInTimezone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('hour')}:${get('minute')}`
}

export function nowHHMMInFamilyTimezone(): string {
  return nowHHMMInTimezone(FAMILY_TIMEZONE)
}
