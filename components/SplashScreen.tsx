'use client'

import { useEffect, useState } from 'react'

const SPLASH_DURATION_MS = 2200
const FADE_DURATION_MS = 500

/**
 * Eigener In-App-Splash direkt nach dem schnellen nativen OS-Start: zeigt das
 * freigegebene Marken-Motiv (dasselbe wie die apple-touch-startup-image-PNGs,
 * damit der Übergang nahtlos wirkt) für ~2,2s, blendet dann weich aus. Kein
 * Ladebalken/Spinner — die dahinterliegende Seite ist als Server Component
 * ohnehin bereits parallel am Laden/Rendern. Rein Client-State: Next.js'
 * Root-Layout wird bei clientseitiger Navigation nicht neu gemountet, der
 * Overlay erscheint also nur beim echten Laden/Öffnen der App.
 */
export function SplashScreen() {
  const [mounted, setMounted] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), SPLASH_DURATION_MS)
    const removeTimer = setTimeout(() => setMounted(false), SPLASH_DURATION_MS + FADE_DURATION_MS)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [])

  if (!mounted) return null

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_DURATION_MS}ms ease`,
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/splash/splash-1170x2532.png"
        alt=""
        fetchPriority="high"
        className="absolute inset-0 w-full h-full object-cover"
      />
    </div>
  )
}
