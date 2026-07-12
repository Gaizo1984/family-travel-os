'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/** Bottom-Nav-Routen (app/(app)/layout.tsx MOBILE_NAV) — beim App-Start werden die
 *  jeweils anderen im Hintergrund vorab geladen, damit der erste Wechsel
 *  zwischen den Haupt-Tabs sofort reagiert. */
const MAIN_NAV_ROUTES = ['/', '/trips', '/today', '/content-studio', '/mehr']

/**
 * Rein client-seitig, kein UI-Output. `router.prefetch()` lädt RSC-Payload +
 * (bei statischen Segmenten) das gerenderte Ergebnis im Hintergrund — läuft
 * einmal beim ersten Laden/Öffnen der App (Layout wird bei clientseitiger
 * Navigation nicht neu gemountet, daher kein wiederholtes Prefetch pro Klick).
 */
export function RoutePrefetcher() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    for (const href of MAIN_NAV_ROUTES) {
      if (href !== pathname) router.prefetch(href)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
