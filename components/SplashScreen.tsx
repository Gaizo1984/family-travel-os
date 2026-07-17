'use client'

import { useEffect, useState } from 'react'

const HOLD_MS = 900
const FADE_MS = 450
const TOTAL_MS = HOLD_MS + FADE_MS
const HOLD_PERCENT = Math.round((HOLD_MS / TOTAL_MS) * 100)

/**
 * §Bugfix "Splashscreen bleibt hängen, man sieht die volle Zeit nur das
 * Logo": die vorherige Version blendete ausschließlich über einen
 * `useEffect`-`setTimeout` aus -- das serverseitig gerenderte HTML zeigt
 * das Overlay aber standardmäßig voll sichtbar UND klickblockierend
 * (`mounted=true, fading=false` sind die React-Default-Werte vor jeder
 * Hydration). Läuft die Hydration auf einem echten Handy langsam an
 * (großes JS-Bundle über Mobilfunk) oder überhaupt nicht durch (jeder
 * andere Hydration-Fehler auf der Seite), feuert der Timer nie -- der
 * Nutzer sieht dauerhaft ein eingefrorenes, nicht klickbares Logo, exakt
 * das gemeldete Verhalten. Die Ausblendung läuft jetzt über eine reine
 * CSS-Animation (inline `<style>`, kein styled-jsx), die der Browser beim
 * HTML-Parsing sofort ausführt -- unabhängig davon, ob/wann React
 * hydriert. Der verbleibende `useEffect` entfernt den (dann bereits
 * unsichtbaren) Knoten nur noch der Sauberkeit halber aus dem DOM.
 * Gleichzeitig Gesamtdauer von 2,7s auf 1,35s verkürzt.
 *
 * §Bugfix "Splashscreen lädt auf dem Handy weiterhin nicht": die PNG-Datei
 * war mit 4,8 MB unkomprimiert (Foto als verlustfreies PNG) -- auf
 * Mobilfunk konnte das Bild oft nicht rechtzeitig laden, bevor die
 * CSS-Animation bereits durchgelaufen war. Jetzt als optimiertes JPEG
 * (~240 KB statt 4,8 MB). Zusätzlich `background` auf der Marken-Hintergrund-
 * farbe, damit auch im kurzen Ladefenster kein weißer/transparenter Blitz
 * sichtbar ist.
 */
export function SplashScreen() {
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setRemoved(true), TOTAL_MS + 100)
    return () => clearTimeout(timer)
  }, [])

  if (removed) return null

  return (
    <div aria-hidden="true" className="lumi-splash-overlay">
      <style>{`
        @keyframes lumi-splash-fade {
          0% { opacity: 1; pointer-events: auto; }
          ${HOLD_PERCENT}% { opacity: 1; pointer-events: auto; }
          ${Math.min(HOLD_PERCENT + 1, 100)}% { pointer-events: none; }
          100% { opacity: 0; pointer-events: none; }
        }
        .lumi-splash-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #E8E3DA;
          animation: lumi-splash-fade ${TOTAL_MS}ms ease forwards;
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
