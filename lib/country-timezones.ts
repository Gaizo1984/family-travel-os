/**
 * §"Chronologische Sortierung inklusive Zeitzonen" (Journey-2.0-Leitplanke) --
 * pragmatische Lösung ohne neue Datenbankspalte: eine IANA-Zeitzone je
 * bereits vorhandenem `stages.country_code` (gleiches Muster wie
 * `COUNTRY_NAMES` in lib/geo-suggestions.ts). Löst den Alltagsfall (korrekte
 * Tagesgrenze am Reiseziel) ohne neue Datenmodellierung an Buchungen/Etappen.
 *
 * Bewusste Einschränkung (siehe Journey-2.0-Architekturplan): Länder mit
 * mehreren Zeitzonen (USA, Kanada, Brasilien, Mexiko, ...) bekommen genau
 * EINE repräsentative Zone (die touristisch relevanteste) -- exakte
 * Minutenkorrektheit für einen einzelnen Flug, der während des Flugs die
 * Datumsgrenze überquert, ist explizit nicht Teil von v1.
 */
export const COUNTRY_TIMEZONES: Record<string, string> = {
  CR: 'America/Costa_Rica', OM: 'Asia/Muscat', BR: 'America/Sao_Paulo', US: 'America/New_York', CH: 'Europe/Zurich',
  GB: 'Europe/London', ID: 'Asia/Jakarta', AE: 'Asia/Dubai',
  JP: 'Asia/Tokyo', TH: 'Asia/Bangkok', LK: 'Asia/Colombo', SC: 'Indian/Mahe', MX: 'America/Cancun',
  CA: 'America/Toronto', ZA: 'Africa/Johannesburg', AU: 'Australia/Sydney', IT: 'Europe/Rome', GR: 'Europe/Athens',
  ES: 'Europe/Madrid', PT: 'Europe/Lisbon', FR: 'Europe/Paris', DE: 'Europe/Berlin', AT: 'Europe/Vienna',
  MV: 'Indian/Maldives', VN: 'Asia/Ho_Chi_Minh', NZ: 'Pacific/Auckland', EG: 'Africa/Cairo', MA: 'Africa/Casablanca',
  TR: 'Europe/Istanbul', KE: 'Africa/Nairobi', TZ: 'Africa/Dar_es_Salaam', ME: 'Europe/Podgorica', MU: 'Indian/Mauritius',
}

/** Fällt auf die Familien-Heimatzeitzone zurück (lib/time.ts), wenn kein `country_code` bekannt ist. */
export const DEFAULT_TIMEZONE = 'Europe/Berlin'

export function resolveTimezone(countryCode: string | null | undefined): string {
  if (!countryCode) return DEFAULT_TIMEZONE
  return COUNTRY_TIMEZONES[countryCode] ?? DEFAULT_TIMEZONE
}
