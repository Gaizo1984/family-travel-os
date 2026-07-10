/**
 * Deterministische Länder→Währung-Zuordnung, zentral gehalten und ohne externe
 * Geocoding-/Länder-API. Schlüssel sind kleingeschriebene Textfragmente, die in
 * Reise-/Etappentexten gesucht werden — keine Fuzzy-Logik, kein Raten.
 */
const COUNTRY_CURRENCY_MAP: Array<{ keywords: string[]; currencies: string[] }> = [
  { keywords: ['costa rica'], currencies: ['CRC', 'USD'] },
  { keywords: ['oman'], currencies: ['OMR'] },
  { keywords: ['brasilien', 'brazil'], currencies: ['BRL'] },
  { keywords: ['usa', 'vereinigte staaten', 'united states'], currencies: ['USD'] },
  { keywords: ['schweiz', 'switzerland'], currencies: ['CHF'] },
  { keywords: ['vereinigtes königreich', 'united kingdom', 'großbritannien', 'england'], currencies: ['GBP'] },
  { keywords: ['indonesien', 'indonesia', 'bali', 'sumba'], currencies: ['IDR'] },
  { keywords: ['dubai', 'vereinigte arabische emirate', 'uae'], currencies: ['AED'] },
  { keywords: ['japan'], currencies: ['JPY'] },
  { keywords: ['thailand'], currencies: ['THB'] },
  { keywords: ['sri lanka'], currencies: ['LKR'] },
  { keywords: ['seychellen', 'seychelles'], currencies: ['SCR'] },
  { keywords: ['mexiko', 'mexico'], currencies: ['MXN'] },
  { keywords: ['kanada', 'canada'], currencies: ['CAD'] },
  { keywords: ['südafrika', 'south africa'], currencies: ['ZAR'] },
  { keywords: ['australien', 'australia'], currencies: ['AUD'] },
]

type TripLike = { title: string | null; subtitle: string | null }
type StageLike = { title: string | null; location: string | null }

/**
 * Leitet passende Fremdwährungen aus vorhandenen Reise-/Etappentexten ab.
 * Durchsucht Reisetitel/-untertitel sowie alle Etappentitel/-orte als einen
 * zusammengeführten Text — deckt sowohl Reisen ab, deren Etappen keinen
 * Ländernamen enthalten (z. B. Costa Rica: nur "Guanacaste"/"Atlanta"), als
 * auch Mehrländer-Reisen (z. B. Indonesien-Reise mit Dubai-Zwischenstopp).
 * Gibt eindeutige Treffer zurück, ohne die bereits als Reisewährung geführte
 * Währung zu wiederholen.
 */
export function suggestTripCurrencies(
  trip: TripLike,
  stages: StageLike[],
  excludeCurrency?: string,
): string[] {
  const combinedText = [
    trip.title, trip.subtitle,
    ...stages.flatMap((s) => [s.title, s.location]),
  ].filter(Boolean).join(' ').toLowerCase()

  const suggestions: string[] = []
  for (const entry of COUNTRY_CURRENCY_MAP) {
    if (entry.keywords.some((kw) => combinedText.includes(kw))) {
      for (const currency of entry.currencies) {
        if (currency !== excludeCurrency && !suggestions.includes(currency)) {
          suggestions.push(currency)
        }
      }
    }
  }
  return suggestions
}
