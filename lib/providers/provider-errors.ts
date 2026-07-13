type ProviderName = 'places' | 'routes'
type RequestType = 'geocode' | 'places_search' | 'place_lookup' | 'compute_route' | 'compute_route_matrix'

export class ProviderConfigError extends Error {
  constructor(public provider: ProviderName, public requestType: RequestType) {
    super(`${provider}:${requestType} config missing`)
  }
}

export class ProviderRequestError extends Error {
  constructor(public provider: ProviderName, public requestType: RequestType, public httpStatus: number, public googleErrorCode?: string) {
    super(`${provider}:${requestType} failed (${httpStatus}${googleErrorCode ? ` ${googleErrorCode}` : ''})`)
  }
}

/** Einziger Logging-Punkt für Provider-Fehler -- erzwingt das erlaubte Feld-Set (Provider/Request-Typ/HTTP-Status/Google-Fehlercode), niemals API-Keys, volle Responses oder Reisedaten. */
export function logProviderError(err: ProviderConfigError | ProviderRequestError): void {
  if (err instanceof ProviderConfigError) {
    console.error('[provider:config-missing]', { provider: err.provider, requestType: err.requestType })
  } else {
    console.error('[provider:request-failed]', { provider: err.provider, requestType: err.requestType, httpStatus: err.httpStatus, googleErrorCode: err.googleErrorCode })
  }
}

/** Liefert nur das kurze Google-Fehlerfeld (`error.status`, z. B. "PERMISSION_DENIED") aus einer fehlgeschlagenen Response -- nie den vollen Body loggen. */
export async function extractGoogleErrorCode(res: Response): Promise<string | undefined> {
  try {
    const data = await res.json()
    return typeof data?.error?.status === 'string' ? data.error.status : undefined
  } catch {
    return undefined
  }
}

/** Menschenlesbare Fehlermeldung für die Developer-Testkarten (`app/(app)/mehr/developer/*`) -- dort sind technische Details erwünscht, keine Nutzeransicht. */
export function describeProviderError(err: ProviderConfigError | ProviderRequestError): string {
  if (err instanceof ProviderConfigError) {
    return `${err.provider === 'places' ? 'Places/Geocoding' : 'Routes'}-API: Konfiguration fehlt (GOOGLE_PLACES_API_KEY, Aufruf ${err.requestType}).`
  }
  return `${err.provider === 'places' ? 'Places/Geocoding' : 'Routes'}-API-Fehler bei ${err.requestType}: HTTP ${err.httpStatus}${err.googleErrorCode ? ` (${err.googleErrorCode})` : ''}.`
}
