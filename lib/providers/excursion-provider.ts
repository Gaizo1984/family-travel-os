export type ExcursionResult = {
  id: string
  title: string
  destination: string
  description: string
  priceIndicator: '€' | '€€' | '€€€'
}

export type ExcursionSearchParams = { destinationName?: string }

/**
 * Vierter Provider-Adapter (Leitlinie 3) — hält die Architektur für "Ausflüge"
 * offen, ohne dass diese Phase eine eigene, noch dünne Ausflugs-Datenbank
 * erzwingen muss. `CuratedExcursionProvider` liefert aktuell bewusst `null`
 * (keine kuratierten Daten vorhanden) statt erfundener, schwacher Inhalte —
 * eine spätere Implementierung (kuratiert oder live) muss nur diese Datei
 * ersetzen, Aufrufer bleiben unverändert.
 */
interface ExcursionProvider {
  search(params: ExcursionSearchParams): Promise<ExcursionResult[] | null>
}

async function curatedExcursionSearch(): Promise<ExcursionResult[] | null> {
  return null
}

const curatedExcursionProvider: ExcursionProvider = { search: curatedExcursionSearch }

/** Einziger Zuweisungspunkt für den aktiven Ausflug-Anbieter. */
const activeExcursionProvider: ExcursionProvider = curatedExcursionProvider

export async function searchExcursions(params: ExcursionSearchParams = {}): Promise<ExcursionResult[] | null> {
  return activeExcursionProvider.search(params)
}
