/**
 * Deterministische Länder→ISO-3166-1-alpha-2-Zuordnung, zentral gehalten und
 * ohne externe Geocoding-/Länder-API — gleiches Muster wie
 * lib/currency-suggestions.ts. Schlüssel sind kleingeschriebene
 * Textfragmente, die in Reise-/Etappen-/Reisegeschichtetexten gesucht
 * werden. Ergebnis ist immer nur ein Vorschlag, nie automatisch gesetzt.
 */
const COUNTRY_CODE_MAP: Array<{ keywords: string[]; code: string }> = [
  { keywords: ['costa rica'], code: 'CR' },
  { keywords: ['oman'], code: 'OM' },
  { keywords: ['brasilien', 'brazil'], code: 'BR' },
  { keywords: ['usa', 'vereinigte staaten', 'united states'], code: 'US' },
  { keywords: ['schweiz', 'switzerland'], code: 'CH' },
  { keywords: ['vereinigtes königreich', 'united kingdom', 'großbritannien', 'england'], code: 'GB' },
  { keywords: ['indonesien', 'indonesia', 'bali', 'sumba'], code: 'ID' },
  { keywords: ['dubai', 'vereinigte arabische emirate', 'uae'], code: 'AE' },
  { keywords: ['japan'], code: 'JP' },
  { keywords: ['thailand'], code: 'TH' },
  { keywords: ['sri lanka'], code: 'LK' },
  { keywords: ['seychellen', 'seychelles'], code: 'SC' },
  { keywords: ['mexiko', 'mexico'], code: 'MX' },
  { keywords: ['kanada', 'canada'], code: 'CA' },
  { keywords: ['südafrika', 'south africa'], code: 'ZA' },
  { keywords: ['australien', 'australia'], code: 'AU' },
  { keywords: ['sardinien', 'sardinia', 'italien', 'italy'], code: 'IT' },
  { keywords: ['griechenland', 'greece'], code: 'GR' },
  { keywords: ['spanien', 'spain'], code: 'ES' },
  { keywords: ['portugal'], code: 'PT' },
  { keywords: ['frankreich', 'france'], code: 'FR' },
  { keywords: ['deutschland', 'germany'], code: 'DE' },
  { keywords: ['österreich', 'austria'], code: 'AT' },
  { keywords: ['malediven', 'maldives'], code: 'MV' },
  { keywords: ['vietnam'], code: 'VN' },
  { keywords: ['neuseeland', 'new zealand'], code: 'NZ' },
  { keywords: ['ägypten', 'egypt'], code: 'EG' },
  { keywords: ['marokko', 'morocco'], code: 'MA' },
  { keywords: ['türkei', 'turkey', 'türkiye'], code: 'TR' },
  { keywords: ['kenia', 'kenya'], code: 'KE' },
  { keywords: ['tansania', 'tanzania', 'sansibar', 'zanzibar'], code: 'TZ' },
]

/**
 * Sucht in einem beliebigen Text (Reisetitel, Etappe, Reisegeschichte-Notiz)
 * nach dem ersten passenden Länder-Schlüsselwort und gibt dessen ISO-Code
 * zurück. Reines Textmatching, kein Raten — Ergebnis bleibt immer editierbar.
 */
export function suggestCountryCode(text: string | null | undefined): string | null {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const entry of COUNTRY_CODE_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.code
  }
  return null
}
