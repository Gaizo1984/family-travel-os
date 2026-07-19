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
 *
 * §CACHE_VERSION-Historie (Nutzervorgabe "Cache-Version sauber verwalten und
 * alte Caches entfernen"): bei JEDER inhaltlichen Änderung an diesem Skript
 * hier hochzählen -- das `activate`-Handling löscht dann automatisch alle
 * Caches einer älteren Version, sobald die App das nächste Mal online lädt.
 * v2: Fallback-Hinweisseite bei fehlgeschlagenen Kaltstart-Navigationen
 *     ergänzt (siehe offlineFallbackResponse) -- alte v1-Caches enthielten
 *     u. U. noch HTML/RSC-Stände von vor diversen Offline-Bugfixes
 *     (Entfernen-Button, Lesepfad-Fix) und wurden nur beim nächsten
 *     Online-Laden dieser Seiten neu befüllt, nie automatisch bereinigt.
 * v3: offlineFallbackResponse() war in v2 nur definiert, aber nie im
 *     fetch-Handler verdrahtet -- Navigationen zu "/" liefen dadurch
 *     weiterhin unkontrolliert durch (kein event.respondWith), der
 *     Kaltstart-Hänger am nativen Splash bestand unverändert fort. Jetzt
 *     tatsächlich als eigener Zweig ergänzt.
 * v4: Cache-Bedingung war auf isNavigation/isRscNavigation beschränkt --
 *     das Hintergrund-Priming in SaveTripOfflineButton.tsx (einfaches
 *     fetch(), weder "navigate" noch rsc-Header) wurde dadurch nie
 *     gecached, obwohl der Code das schon lange vorgab zu tun. Jetzt wird
 *     jeder GET-Request zu den beiden Offline-Reisen-Routen gecached.
 */

const CACHE_VERSION = 'v4'
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

/**
 * §Bugfix "Kaltstart im Flugmodus hängt am nativen Splash" (Nutzer-Feedback):
 * die App startet beim Öffnen über das Homescreen-Icon immer bei "/"
 * (manifest start_url) -- diese Seite war nie Teil dieses bewusst eng
 * begrenzten Caches (Nutzervorgabe: nur die beiden Offline-Reisen-Routen).
 * Ohne Verbindung schlägt die Navigation zu "/" dadurch fehl, und ohne
 * jede Antwort bleibt der native Android-Splash (App-Icon) unbegrenzt
 * stehen, weil es nie ein erstes Bild gibt. KEIN Caching von "/" oder
 * irgendeiner anderen Seite -- nur ein Sicherheitsnetz: schlägt eine
 * beliebige Top-Level-Navigation (echter Seitenaufruf, keine interne
 * Client-Navigation) mangels Verbindung fehl, liefert der Service Worker
 * diese winzige, hier direkt erzeugte Hinweisseite mit Link zu den
 * Offline-Reisen, statt den Request unbegrenzt hängen zu lassen.
 */
function offlineFallbackResponse() {
  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Lumi Travel · Offline</title>
<style>
  body { margin:0; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:#E8E3DA; color:#25211D; text-align:center; padding:32px; }
  a { display:inline-block; margin-top:6px; padding:12px 26px; background:#25211D; color:#F3EFE8; text-decoration:none; border-radius:8px; font-size:0.85rem; letter-spacing:0.04em; }
  p { color:#7C7063; font-size:0.85rem; line-height:1.6; max-width:320px; margin:0; }
  .eyebrow { font-size:0.6rem; letter-spacing:0.24em; text-transform:uppercase; color:#B89A5E; }
</style>
</head>
<body>
  <div class="eyebrow">Keine Verbindung</div>
  <p>Diese Seite braucht Internet. Eure offline gespeicherten Reisen sind trotzdem erreichbar.</p>
  <a href="/mehr/offline-reisen">Zu den Offline-Reisen</a>
</body>
</html>`
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
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

  // Nur Requests zu den beiden Offline-Reisen-Routen -- alles andere
  // (Supabase, andere Seiten, Bilder, Dokumente) bewusst unangetastet durchs
  // Netzwerk, kein event.respondWith().
  const isNavigation = request.mode === 'navigate'

  // §Bugfix "Kaltstart im Flugmodus hängt am nativen Splash": echte
  // Seitenaufrufe (kein RSC-Fetch innerhalb einer bereits laufenden App) zu
  // JEDER anderen Seite außer den beiden Offline-Reisen-Routen bleiben
  // unangetastet, solange sie online funktionieren -- nur wenn der
  // Netzwerk-Request wirklich fehlschlägt (offline), liefert der Service
  // Worker die oben erzeugte Hinweisseite statt gar keine Antwort. Kein
  // Caching von "/" oder anderen Seiten, keine Cache-First-Strategie.
  if (isNavigation && !isOfflineTripRoute(url.pathname)) {
    event.respondWith(fetch(request).catch(() => offlineFallbackResponse()))
    return
  }

  // §Bugfix "Für Offline speichern füllt den Seiten-Cache nie": das
  // Hintergrund-Priming in SaveTripOfflineButton.tsx ruft diese Routen per
  // einfachem fetch() auf -- das hat weder mode "navigate" noch den
  // rsc-Header, wurde also von der ursprünglichen Einschränkung auf
  // isNavigation/isRscNavigation nie erfasst und lief unkontrolliert (und
  // uncached) durchs Netzwerk. Da hier ohnehin schon strikt auf die beiden
  // Offline-Reisen-Pfade eingegrenzt ist, ist es sicher, jeden GET-Request
  // dorthin zu cachen -- nicht nur Navigationen/RSC-Fetches.
  if (!isOfflineTripRoute(url.pathname)) return

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
