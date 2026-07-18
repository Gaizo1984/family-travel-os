'use client'

import { useEffect, useState } from 'react'

const HOLD_MS_BROWSER = 900
const FADE_MS_BROWSER = 450

const HOLD_MS_STANDALONE = 2700
const FADE_MS_STANDALONE = 500

/**
 * §Bugfix "Eigener Splash wird in der installierten Android-PWA übersprungen":
 * Android zeigt beim App-Start zuerst seinen nativen Splash und blendet ihn
 * erst aus, wenn diese Seite ihren ersten Paint liefert -- das dauert in
 * `display-mode: standalone` durch den serverseitigen Supabase-Auth-Check
 * (proxy.ts, läuft VOR jeder Response) und den JS-Boot spürbar länger als im
 * normalen Browser-Tab. Ein erster Versuch, das rein per
 * `@media (display-mode: standalone) { @keyframes ... }` zu lösen (nur CSS,
 * keine JS-Erkennung), blieb auf dem Testgerät wirkungslos -- vermutlich ein
 * Edge-Case, wie genau Android-Chrome media-query-gescopte @keyframes-
 * Overrides für ein bereits laufendes `animation`-Shorthand auflöst. Jetzt
 * stattdessen `window.matchMedia('(display-mode: standalone)')` (JS, nach
 * Mount) -- deutlich robuster/etablierter für genau diese Erkennung.
 *
 * Damit das NICHT die alte §Bugfix-Eigenschaft "friert bei gescheiterter/zu
 * langsamer Hydration ein" reproduziert: die eigentliche Sichtbarkeits-Uhr
 * (`fading`/`removed`) ist zwar jetzt JS-getrieben, aber die Standard-CSS-
 * Klasse (ohne Inline-Style-Override) trägt zusätzlich eine unabhängige,
 * grosszügig lange reine CSS-Animation (`CSS_FALLBACK_MS`) als Notnetz --
 * blendet auch ganz ohne JE laufendes JS irgendwann aus. Läuft Hydration
 * normal durch, übernimmt der `useEffect` unten via `animation: 'none'`
 * lange bevor dieses Notnetz greifen würde.
 */
const CSS_FALLBACK_MS = 6000
const CSS_FALLBACK_HOLD_PERCENT = 92

export function SplashScreen() {
  const [fading, setFading] = useState(false)
  const [fadeMs, setFadeMs] = useState(FADE_MS_BROWSER)
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    const hold = standalone ? HOLD_MS_STANDALONE : HOLD_MS_BROWSER
    const fade = standalone ? FADE_MS_STANDALONE : FADE_MS_BROWSER
    setFadeMs(fade)
    const fadeTimer = setTimeout(() => setFading(true), hold)
    const removeTimer = setTimeout(() => setRemoved(true), hold + fade + 50)
    return () => {
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
