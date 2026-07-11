import { EXCURSIONS } from '@/lib/data/excursion-knowledge'
import type { PriceIndicator } from '@/lib/data/hotel-knowledge'

export type ExcursionResult = {
  id: string
  title: string
  destination: string
  description: string
  priceIndicator: PriceIndicator
  mood: string
  photo: string
}

export type ExcursionSearchParams = { destinationName?: string }

/**
 * Vierter Provider-Adapter (Leitlinie 3), jetzt mit kuratierten Daten befüllt
 * — Interface/Zuweisungspunkt-Struktur bleibt exakt wie zuvor, nur der
 * Rumpf von `curatedExcursionSearch` wurde ersetzt. Eine spätere Live-API
 * braucht weiterhin nur eine neue Implementierung dieses Interfaces.
 */
interface ExcursionProvider {
  search(params: ExcursionSearchParams): Promise<ExcursionResult[] | null>
}

async function curatedExcursionSearch(params: ExcursionSearchParams): Promise<ExcursionResult[] | null> {
  let results = EXCURSIONS.map((e, i) => ({
    id: `curated-excursion-${i}`,
    title: e.name,
    destination: e.destination,
    description: e.description,
    priceIndicator: e.priceIndicator,
    mood: e.mood,
    photo: e.photo,
  }))

  if (params.destinationName) {
    const needle = params.destinationName.toLowerCase()
    const filtered = results.filter((r) => r.destination.toLowerCase().includes(needle) || needle.includes(r.destination.toLowerCase()))
    if (filtered.length > 0) results = filtered
  }

  return results
}

const curatedExcursionProvider: ExcursionProvider = { search: curatedExcursionSearch }

/** Einziger Zuweisungspunkt für den aktiven Ausflug-Anbieter. */
const activeExcursionProvider: ExcursionProvider = curatedExcursionProvider

export async function searchExcursions(params: ExcursionSearchParams = {}): Promise<ExcursionResult[] | null> {
  return activeExcursionProvider.search(params)
}
