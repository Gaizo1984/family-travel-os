import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * FINALER LEGACY-CLEANUP: Travel hat kein eigenes Auth-Projekt mehr im
 * produktiven Pfad -- die vormals hier bestehende Passkey-Origin-Guard-
 * Logik (Hop1/Hop2-Return-to-Cookies, Travels eigener Session-Check als
 * Passkey-Fallback) ist komplett entfallen, nachdem der zentrale
 * Lumi-Core-Login inkl. Passkey produktiv bestätigt war. Einzige Prüfung
 * jetzt: Lumi-Core-Session vorhanden? Gleiches Muster wie
 * lumi-assistance/proxy.ts.
 */
const PUBLIC_PATHS = ['/login', '/auth/confirm']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

/**
 * §Bugfix "Cron-Routen wurden von der Login-Weiterleitung abgefangen":
 * Vercel Cron ruft `/api/cron/*` ohne Browser-Session auf (kein `user`) --
 * die Session-Weiterleitung unten hätte das mit 307 auf /login umgebogen,
 * BEVOR die route-eigene CRON_SECRET-Prüfung (app/api/cron/.../route.ts)
 * überhaupt lief. Cron-Routen sichern sich vollständig selbst (Bearer-
 * Header-Vergleich) -- andere `/api/*`-Routen bleiben hinter der Gate.
 */
function isCronPath(pathname: string): boolean {
  return pathname.startsWith('/api/cron/')
}

export async function proxy(request: NextRequest) {
  if (isCronPath(request.nextUrl.pathname)) return NextResponse.next()

  let response = NextResponse.next({ request })

  const lumiCore = createServerClient(
    process.env.NEXT_PUBLIC_LUMI_CORE_URL!,
    process.env.NEXT_PUBLIC_LUMI_CORE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )
  const { data: { user } } = await lumiCore.auth.getUser()

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirectResponse = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  return response
}

export const config = {
  matcher: [
    // §Bugfix "Service Worker wird auf /login umgeleitet" (Nutzervorgabe,
    // Offline-Reisen-Sprint): public/sw.js (siehe components/
    // ServiceWorkerRegistration.tsx) muss IMMER ohne Login erreichbar sein --
    // die periodische Aktualisierungsprüfung des Browsers läuft unabhängig
    // vom Session-Zustand, und eine Umleitung auf /login statt der echten
    // Datei lässt die Service-Worker-Registrierung fehlschlagen (falscher
    // Content-Type/Inhalt). Gleiches Ausschluss-Muster wie
    // manifest.webmanifest/icons/ direkt daneben.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw\\.js|icons/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)',
  ],
}
