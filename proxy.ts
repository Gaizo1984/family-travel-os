import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Security Foundation 1A: aktualisiert die Supabase-Session-Cookies pro
 * Request und sichert alle Routen außer /login und dem Auth-Callback.
 * Bewusst ohne Business-Logik/Datenbankzugriffe -- nur Supabase-Auth-
 * Tokenprüfung (kein Zugriff auf App-Tabellen wie persons/families).
 * Diese Datei heißt in dieser Next.js-Version "proxy.ts", nicht
 * "middleware.ts" (middleware ist umbenannt/deprecated).
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
 * überhaupt lief. Betraf vermutlich auch den bereits bestehenden
 * cleanup-content-sessions-Cron. Cron-Routen sichern sich vollständig
 * selbst (Bearer-Header-Vergleich) -- andere `/api/*`-Routen (z. B.
 * places-photo) bleiben bewusst weiterhin hinter der Session-Gate.
 */
function isCronPath(pathname: string): boolean {
  return pathname.startsWith('/api/cron/')
}

export async function proxy(request: NextRequest) {
  if (isCronPath(request.nextUrl.pathname)) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // auth.getUser() (nicht getSession()) prüft das Token aktiv gegen Supabase
  // und erneuert es bei Bedarf -- das IST die Cookie-Aktualisierung.
  const { data: { user } } = await supabase.auth.getUser()

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
