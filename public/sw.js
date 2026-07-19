/**
 * §"Minimaler Service Worker: Offline-Reisen wirklich ohne Netzverbindung
 * ladbar machen" (Nutzervorgabe, kombinierter Fix-Sprint) -- bewusst eng
 * begrenzt:
 * - NUR /mehr/offline-reisen und /mehr/offline-reisen/<tripId> (App-Shell:
 *   HTML-Voll-Request UND RSC-Navigation) plus die dafür nötigen
 *   _next/static-Assets werden abgefangen.
 * - Keine Supabase-/API-/Bild-/Dokument-Requests, keine Cache-First-Strategie
 *   für normale App-Seiten -- ALLES andere läuft unangetastet durchs
 *   Netzwerk (kein `event.respondWith(...)`, der Service Worker mischt sich
 *   dort gar nicht ein).
 * - Die eigentlichen Reisedaten (Übersicht/Journey/Flüge & Hotels/Dokumente)
 *   kommen weiterhin ausschließlich aus IndexedDB (lib/offline-document-cache.ts)
 *   -- dieser Service Worker sorgt nur dafür, dass die Seiten-HÜLLE selbst
 *   ohne Netzverbindung überhaupt laden kann. Kein Fallback auf Demo-/
 *   Platzhalterdaten irgendwo -- fehlt ein Snapshot, zeigt die bereits
 *   bestehende Client-Logik weiterhin ehrlich "kein Offline-Stand
 *   gespeichert".
 */

const CACHE_VERSION = 'v1'
const CACHE_NAME = `lumi-offline-reisen-${CACHE_VERSION}`

const OFFLINE_TRIP_PATH_PREFIX = '/mehr/offline-reisen'

function isOfflineTripRoute(pathname) {
  return pathname === OFFLINE_TRIP_PATH_PREFIX || pathname.startsWith(`${OFFLINE_TRIP_PATH_PREFIX}/`)
}

/** RSC-Navigationen hängen einen wechselnden `_rsc`-Query-Parameter an -- ohne Entfernen gäbe es nie einen Cache-Treffer für eine zuvor besuchte Seite. */
function cacheKeyFor(request) {
  const url = new URL(request.url)
  url.searchParams.delete('_rsc')
  // HTML-Voll-Request und RSC-Request derselben Route müssen getrennte
  // Einträge sein (unterschiedlicher Content-Type: text/html vs. text/x-component).
  const isRsc = request.headers.get('rsc') === '1'
  url.searchParams.set('__sw_variant', isRsc ? 'rsc' : 'html')
  return url.toString()
}

self.addEventListener('install', () => {
  // Bewusst kein Vorab-Precaching -- vermeidet zusätzliche Netzwerklast beim
  // ersten Laden (siehe components/SplashScreen.tsx: die Standalone-
  // Haltezeit hängt am window.load-Event).
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key.startsWith('lumi-offline-reisen-') && key !== CACHE_NAME).map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return

  // §"nur App-Shell und notwendige _next/static-Assets für diese
  // Offline-Routen" (Nutzervorgabe) -- _next/static-Dateinamen sind
  // Content-Hash-basiert/unveränderlich, Cache-first ist hier sicher.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match(request)
        if (cached) return cached
        try {
          const response = await fetch(request)
          if (response.ok) cache.put(request, response.clone())
          return response
        } catch (err) {
          if (cached) return cached
          throw err
        }
      })(),
    )
    return
  }

  // Nur Navigations-/RSC-Requests zu den beiden Offline-Reisen-Routen --
  // alles andere (Supabase, andere Seiten, Bilder, Dokumente) bewusst
  // unangetastet durchs Netzwerk, kein event.respondWith().
  const isNavigation = request.mode === 'navigate'
  const isRscNavigation = request.headers.get('rsc') === '1'
  if (!(isNavigation || isRscNavigation) || !isOfflineTripRoute(url.pathname)) return

  // Network-first, Fallback auf Cache -- online immer der frische Stand
  // (inkl. neuer Deploys), offline der zuletzt erfolgreich geladene Stand.
  // §"bei Fehlern normale Online-App nicht beeinträchtigen": jeder Fehler
  // hier führt bestenfalls zu einem fehlenden Cache-Eintrag, nie zu einem
  // kaputten Request -- bei jedem unerwarteten Fehler wird einfach roh
  // weitergereicht.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      const key = cacheKeyFor(request)
      try {
        const response = await fetch(request)
        if (response.ok) {
          try {
            await cache.put(key, response.clone())
          } catch {
            // Cache-Schreibfehler (z. B. Speicherplatz) darf die Antwort selbst nie verhindern.
          }
        }
        return response
      } catch (err) {
        const cached = await cache.match(key)
        if (cached) return cached
        throw err
      }
    })(),
  )
})
