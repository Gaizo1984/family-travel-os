'use client'

import { useEffect } from 'react'

/**
 * §"Offline-Reisen wirklich ohne Netzverbindung ladbar machen" (Nutzervorgabe):
 * registriert public/sw.js -- bewusst NUR in Production (Nutzervorgabe: "Service
 * Worker nur in Production registrieren", vermeidet veraltete Caches während
 * `next dev`) und erst NACH dem `window.load`-Event, damit die Registrierung
 * selbst nicht mit dem initialen Seitenaufbau konkurriert (siehe
 * components/SplashScreen.tsx: die Standalone-Haltezeit hängt ebenfalls an
 * `window.load`).
 *
 * §"Bei Fehlern normale Online-App nicht beeinträchtigen" (Nutzervorgabe):
 * jeder Fehler hier wird abgefangen und nur geloggt -- eine fehlgeschlagene
 * Registrierung darf die App niemals blockieren, sie verhält sich dann exakt
 * wie zuvor ganz ohne Service Worker.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      // §Bugfix "Service-Worker-Update erreicht das installierte App-Icon
      // nicht zuverlässig": statt auf Chromes eigenen (bei manchen
      // Standalone-PWAs unzuverlässigen) Byte-Vergleich von /sw.js zu
      // vertrauen, ist die Registrierungs-URL pro Deploy eindeutig --
      // jeder neue Build ist damit aus Browsersicht unmissverständlich
      // eine neue Datei, die sofort installiert wird.
      const swUrl = `/sw.js?v=${process.env.NEXT_PUBLIC_SW_BUILD_ID ?? 'dev'}`
      navigator.serviceWorker.register(swUrl, { scope: '/', updateViaCache: 'none' }).catch((err) => {
        console.warn('[sw] Registrierung fehlgeschlagen -- Offline-Reisen funktioniert dann nur online.', err)
      })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, []);

  return null;
}
