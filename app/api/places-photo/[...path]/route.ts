/**
 * §Sicherheitsvorgabe: GOOGLE_PLACES_API_KEY darf nie clientseitig erscheinen.
 * Ein Places-Foto lässt sich nur mit dem Key laden -- ein `<img src>` mit der
 * Google-URL direkt würde den Key im Browser/Netzwerk-Tab offenlegen. Dieser
 * Proxy holt die Bilddaten stattdessen serverseitig und streamt nur die
 * Bytes an den Browser zurück; die URL, die der Client sieht, enthält nie
 * den Key.
 *
 * §"Phase A"-Sofortmaßnahme: bisher rief jeder Aufruf -- auch für dasselbe
 * Foto in derselben Breite -- die Google Places Photo API frisch auf
 * (`cache: 'no-store'`), obwohl Fluid Compute Funktionsinstanzen zwischen
 * Requests wiederverwendet. Ein kurzlebiger In-Memory-Cache pro
 * Instanz spart wiederholte Google-Aufrufe für dieselbe Foto-Referenz +
 * Breite, ohne je ein falsches Bild dauerhaft auszuliefern: der Cache-Key
 * enthält den vollständigen Fotopfad UND `maxWidthPx`, Einträge laufen nach
 * `CACHE_TTL_MS` ab (deckt sich mit dem Browser-`Cache-Control`), und
 * Fehlerantworten werden nie gecacht.
 */
type CachedPhoto = { body: ArrayBuffer; contentType: string; expiresAt: number }
const CACHE_TTL_MS = 60 * 60 * 1000 // 1h -- identisch zum Cache-Control an den Browser
const MAX_CACHE_ENTRIES = 200 // Deckelt den Speicherverbrauch der Instanz; älteste Einträge weichen zuerst
const photoCache = new Map<string, CachedPhoto>()

function cacheKeyFor(photoName: string, maxWidthPx: string): string {
  return `${photoName}?maxWidthPx=${maxWidthPx}`
}

function getFreshFromCache(key: string): CachedPhoto | null {
  const entry = photoCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    photoCache.delete(key)
    return null
  }
  return entry
}

function storeInCache(key: string, entry: CachedPhoto): void {
  if (!photoCache.has(key) && photoCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = photoCache.keys().next().value
    if (oldestKey !== undefined) photoCache.delete(oldestKey)
  }
  photoCache.set(key, entry)
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return new Response('Places-Foto nicht verfügbar', { status: 503 })

  const { path } = await params
  const photoName = path.join('/')
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(photoName)) {
    return new Response('Ungültige Foto-Referenz', { status: 400 })
  }

  const maxWidthPx = new URL(request.url).searchParams.get('maxWidthPx') ?? '400'
  const cacheKey = cacheKeyFor(photoName, maxWidthPx)

  const cached = getFreshFromCache(cacheKey)
  if (cached) {
    return new Response(cached.body, {
      status: 200,
      headers: { 'Content-Type': cached.contentType, 'Cache-Control': 'private, max-age=3600' },
    })
  }

  try {
    const googleUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${encodeURIComponent(maxWidthPx)}&key=${apiKey}`
    const res = await fetch(googleUrl, { cache: 'no-store' })
    if (!res.ok || !res.body) return new Response('Foto konnte nicht geladen werden', { status: 502 })

    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const body = await res.arrayBuffer()
    storeInCache(cacheKey, { body, contentType, expiresAt: Date.now() + CACHE_TTL_MS })

    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=3600' },
    })
  } catch {
    return new Response('Foto konnte nicht geladen werden', { status: 502 })
  }
}
