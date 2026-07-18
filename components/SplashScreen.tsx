'use client'

import { useEffect, useState } from 'react'

const HOLD_MS_BROWSER = 900
const FADE_MS_BROWSER = 450

const MIN_HOLD_MS_STANDALONE = 2600
const FADE_MS_STANDALONE = 500

/**
 * §Bugfix "Eigener Splash wird in der installierten Android-PWA übersprungen",
 * dritter Anlauf: die ersten beiden Versuche banden die Sichtdauer an eine
 * FEST GERATENE Zeitspanne ab Mount (1,35s, dann 3,2s) -- beide blieben laut
 * Nutzer-Test wirkungslos. Das deutet darauf hin, dass der tatsächliche
 * Seitenaufbau in `display-mode: standalone` (Supabase-Auth-Check in
 * proxy.ts + teils datenintensive Server Components, z. B. das Hauptdashboard
 * app/(app)/page.tsx mit mehreren parallelen Supabase-/Wetter-Abfragen)
 * länger dauert als jede bisher geratene Zahl -- Android hält seinen eigenen
 * Splash entsprechend länger, unser Overlay war da längst schon
 * ausgeblendet.
 *
 * Statt weiter eine Zahl zu raten, jetzt ein echtes Bereitschaftssignal:
 * `window.load` feuert erst, wenn das Dokument INKLUSIVE aller Ressourcen --
 * auch unser eigenes Splash-Bild -- tatsächlich fertig geladen ist. Die
 * Mindest-Sichtdauer (`MIN_HOLD_MS_STANDALONE`) zählt in Standalone daher erst
 * AB diesem Zeitpunkt, nicht ab Mount. `LOAD_WAIT_CAP_MS` verhindert, dass ein
 * hängender Request (load feuert pathologisch spät/nie) die Sichtdauer
 * unbegrenzt verzögert.
 *
 * Der Browser-Tab (bereits vom Nutzer bestätigt korrekt) bleibt unverändert
 * auf der schnellen, mount-basierten Logik.
 */
const LOAD_WAIT_CAP_MS = 4000

/**
 * §Bugfix "friert bei gescheiterter/zu langsamer Hydration ein": rein
 * CSS-getriebenes Notnetz, unabhängig vom JS-State oben -- blendet auch ganz
 * ohne je laufendes JS irgendwann aus. Bewusst über dem realistischen
 * JS-Worst-Case (LOAD_WAIT_CAP_MS + MIN_HOLD_MS_STANDALONE + FADE_MS_STANDALONE
 * = 7100ms), damit sie im Erfolgsfall nie sichtbar eingreift.
 */
const CSS_FALLBACK_MS = 8000
const CSS_FALLBACK_HOLD_PERCENT = 94

export function SplashScreen() {
  const [fading, setFading] = useState(false)
  const [fadeMs, setFadeMs] = useState(FADE_MS_BROWSER)
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    let fadeTimer: ReturnType<typeof setTimeout>
    let removeTimer: ReturnType<typeof setTimeout>

    if (!standalone) {
      setFadeMs(FADE_MS_BROWSER)
      fadeTimer = setTimeout(() => setFading(true), HOLD_MS_BROWSER)
      removeTimer = setTimeout(() => setRemoved(true), HOLD_MS_BROWSER + FADE_MS_BROWSER + 50)
      return () => {
        clearTimeout(fadeTimer)
        clearTimeout(removeTimer)
      }
    }

    setFadeMs(FADE_MS_STANDALONE)
    let started = false
    const startHold = () => {
      if (started) return
      started = true
      fadeTimer = setTimeout(() => setFading(true), MIN_HOLD_MS_STANDALONE)
      removeTimer = setTimeout(() => setRemoved(true), MIN_HOLD_MS_STANDALONE + FADE_MS_STANDALONE + 50)
    }

    if (document.readyState === 'complete') {
      startHold()
    } else {
      window.addEventListener('load', startHold, { once: true })
    }
    const capTimer = setTimeout(startHold, LOAD_WAIT_CAP_MS)

    return () => {
      window.removeEventListener('load', startHold)
      clearTimeout(capTimer)
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [])

  if (removed) return null

  return (
    <div
      aria-hidden="true"
      className="lumi-splash-overlay"
      style={
        fading
          ? { animation: 'none', transition: `opacity ${fadeMs}ms ease`, opacity: 0, pointerEvents: 'none' }
          : undefined
      }
    >
      <style>{`
        @keyframes lumi-splash-fallback {
          0% { opacity: 1; pointer-events: auto; }
          ${CSS_FALLBACK_HOLD_PERCENT}% { opacity: 1; pointer-events: auto; }
          ${Math.min(CSS_FALLBACK_HOLD_PERCENT + 1, 100)}% { pointer-events: none; }
          100% { opacity: 0; pointer-events: none; }
        }
        .lumi-splash-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #E8E3DA;
          animation: lumi-splash-fallback ${CSS_FALLBACK_MS}ms ease forwards;
        }
      `}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/splash/splash-1170x2532.jpg"
        alt=""
        fetchPriority="high"
        className="absolute inset-0 w-full h-full object-cover"
      />
    </div>
  )
}
