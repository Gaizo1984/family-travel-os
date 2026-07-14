/**
 * Deterministische Länder→ISO-3166-1-alpha-2-Zuordnung, zentral gehalten und
 * ohne externe Geocoding-/Länder-API — gleiches Muster wie
 * lib/currency-suggestions.ts. Schlüssel sind kleingeschriebene
 * Textfragmente, die in Reise-/Etappen-/Reisegeschichtetexten gesucht
 * werden. Ergebnis ist immer nur ein Vorschlag, nie automatisch gesetzt.
 */
/**
 * `weakKeywords` sind Zwischenstopp-/Flughafen-Städtenamen (z. B. "Atlanta"
 * für einen USA-Layover), die ein Land nur dann anzeigen sollen, wenn sie in
 * der eigenen Etappe stehen -- nicht, wenn sie zufällig irgendwo im
 * Reisetitel auftauchen. Sonst überschreibt ein im Titel erwähnter
 * Zwischenstopp (z. B. "Mexiko über Atlanta") das eigentliche Zielland der
 * Etappe, weil `usa` im Array vor `mexiko` steht (§Bugfix "Mexiko fehlt auf
 * der Karte").
 */
const COUNTRY_CODE_MAP: Array<{ keywords: string[]; weakKeywords?: string[]; code: string }> = [
  { keywords: ['costa rica'], code: 'CR' },
  { keywords: ['oman'], code: 'OM' },
  { keywords: ['brasilien', 'brazil'], code: 'BR' },
  { keywords: ['usa', 'vereinigte staaten', 'united states'], weakKeywords: ['atlanta'], code: 'US' },
  { keywords: ['schweiz', 'switzerland'], code: 'CH' },
  { keywords: ['vereinigtes königreich', 'united kingdom', 'großbritannien', 'england'], code: 'GB' },
  { keywords: ['indonesien', 'indonesia', 'bali', 'sumba'], code: 'ID' },
  { keywords: ['dubai', 'vereinigte arabische emirate', 'uae'], code: 'AE' },
  { keywords: ['japan'], code: 'JP' },
  { keywords: ['thailand'], code: 'TH' },
  { keywords: ['sri lanka'], code: 'LK' },
  { keywords: ['seychellen', 'seychelles'], code: 'SC' },
  { keywords: ['mexiko', 'mexico'], code: 'MX' },
  { keywords: ['kanada', 'canada'], weakKeywords: ['toronto'], code: 'CA' },
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
  { keywords: ['türkei', 'turkey', 'türkiye'], weakKeywords: ['istanbul'], code: 'TR' },
  { keywords: ['kenia', 'kenya'], code: 'KE' },
  { keywords: ['tansania', 'tanzania', 'sansibar', 'zanzibar'], code: 'TZ' },
  { keywords: ['montenegro'], code: 'ME' },
  { keywords: ['mauritius'], code: 'MU' },
]

/**
 * Sucht in einem beliebigen Text (Reisetitel, Etappe, Reisegeschichte-Notiz)
 * nach dem ersten passenden Länder-Schlüsselwort und gibt dessen ISO-Code
 * zurück. Reines Textmatching, kein Raten — Ergebnis bleibt immer editierbar.
 *
 * `includeWeak` (Default: true) steuert, ob `weakKeywords` (Zwischenstopp-
 * Städtenamen) mitzählen. Beim direkten Text der eigenen Etappe/Buchung soll
 * das gelten (eine Etappe, die wörtlich "Atlanta" heißt, ist ein USA-Layover);
 * beim Reisetitel-Fallback für eine ANDERE, eigentlich unbeschriftete Etappe
 * bewusst nicht -- siehe COUNTRY_CODE_MAP-Kommentar.
 */
export function suggestCountryCode(text: string | null | undefined, options?: { includeWeak?: boolean }): string | null {
  if (!text) return null
  const includeWeak = options?.includeWeak ?? true
  const lower = text.toLowerCase()
  for (const entry of COUNTRY_CODE_MAP) {
    const pool = includeWeak && entry.weakKeywords ? [...entry.keywords, ...entry.weakKeywords] : entry.keywords
    if (pool.some((kw) => lower.includes(kw))) return entry.code
  }
  return null
}

/** ISO-3166-1-alpha-2 → deutscher Anzeigename, für dieselben Länder wie COUNTRY_CODE_MAP. */
export const COUNTRY_NAMES: Record<string, string> = {
  CR: 'Costa Rica', OM: 'Oman', BR: 'Brasilien', US: 'USA', CH: 'Schweiz',
  GB: 'Vereinigtes Königreich', ID: 'Indonesien', AE: 'Vereinigte Arabische Emirate',
  JP: 'Japan', TH: 'Thailand', LK: 'Sri Lanka', SC: 'Seychellen', MX: 'Mexiko',
  CA: 'Kanada', ZA: 'Südafrika', AU: 'Australien', IT: 'Italien', GR: 'Griechenland',
  ES: 'Spanien', PT: 'Portugal', FR: 'Frankreich', DE: 'Deutschland', AT: 'Österreich',
  MV: 'Malediven', VN: 'Vietnam', NZ: 'Neuseeland', EG: 'Ägypten', MA: 'Marokko',
  TR: 'Türkei', KE: 'Kenia', TZ: 'Tansania', ME: 'Montenegro', MU: 'Mauritius',
}
