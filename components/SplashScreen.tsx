'use client'

import { useEffect, useState } from 'react'
import { BASE_PATH } from '@/lib/base-path'

// Splash-Screen beim App-Start — nur im "standalone"-Modus (Homescreen-
// Icon), nicht bei jedem normalen Browser-Tab-Aufruf. Gleiches Muster wie
// lumi-assistance/lumi-launcher/depot-v3 components/SplashScreen.tsx.
//
// §Konsistente Lumi-Splash-Dauer + Einmal-pro-Sitzung (Nutzervorgabe, gilt
// identisch für Launcher/Assistance/Travel/Finance/Tax): 2.500ms gesamt --
// 300ms Fade-in, 1.900ms sichtbar, 300ms Fade-out. Ersetzt die vorherige,
// deutlich komplexere Logik (unterschiedliche Haltezeiten für Browser-Tab
// vs. Standalone, `window.load`-Gating, CSS-Fallback-Notnetz für hängende
// Hydration) -- diese war eine Reaktion auf eine feste GERATENE Wartezeit,
// die in der installierten PWA zu früh ablief. Mit der jetzt EINHEITLICH
// über die ganze Lumi-Familie vorgegebenen, festen 2.500ms-Dauer (explizite
// Nutzervorgabe: "keine künstliche zusätzliche Ladezeit über 2,5s hinaus")
// entfällt die Notwendigkeit für dieses Warten auf ein Bereitschaftssignal.
// Zusätzlich NEU: sessionStorage-Sperre -- fehlte hier bisher komplett,
// wodurch der Splash bei jeder erneuten Foreground-/Mount-Situation in der
// Standalone-App erneut erschien, nicht nur beim ersten Öffnen.
const SPLASH_SHOWN_KEY = 'lumi-travel-splash-shown'
const TOTAL_MS = 2500
const FADE_IN_MS = 300
const FADE_OUT_MS = 300
const FADE_IN_PCT = (FADE_IN_MS / TOTAL_MS) * 100
const FADE_OUT_START_PCT = ((TOTAL_MS - FADE_OUT_MS) / TOTAL_MS) * 100

export function SplashScreen() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (!isStandalone) return

    try {
      if (sessionStorage.getItem(SPLASH_SHOWN_KEY)) return
      sessionStorage.setItem(SPLASH_SHOWN_KEY, '1')
    } catch {
      // sessionStorage nicht verfügbar -- dann lieber zeigen als abstürzen.
    }

    setShow(true)
    const removeTimer = setTimeout(() => setShow(false), TOTAL_MS)
    return () => clearTimeout(removeTimer)
  }, [])

  if (!show) return null

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[999] overflow-hidden"
      style={{ background: '#E8E3DA', animation: `lumi-splash-fade ${TOTAL_MS}ms ease forwards` }}
    >
      <style>{`
        @keyframes lumi-splash-fade {
          0% { opacity: 0; }
          ${FADE_IN_PCT}% { opacity: 1; }
          ${FADE_OUT_START_PCT}% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${BASE_PATH}/splash/splash-travel.png`}
        alt=""
        fetchPriority="high"
        className="absolute inset-0 w-full h-full object-cover"
      />
    </div>
  )
}
