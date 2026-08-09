import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { PASSKEY_PENDING_LC_COOKIE, LUMI_CORE_GATE_PATH } from './lib/passkey-lumi-core-gate'

/**
 * FINALER CUTOVER: primäre Session-Prüfung ist jetzt Lumi Core (`lc-*`-
 * Cookies), nicht mehr Travel. Travels eigene Session (`sb-*`) wird nur
 * noch für den Passkey-Sonderfall geprüft (Lumi Core hat kein eigenes
 * Passkey/WebAuthn) -- ein per Passkey eingeloggter Nutzer landet auf dem
 * Lumi-Core-Gate statt auf /login, weil er sich ja bereits erfolgreich
 * (nur eben gegen Travel) authentifiziert hat.
 * Bewusst ohne Business-Logik/Datenbankzugriffe -- nur Auth-Tokenprüfung.
 */
const PUBLIC_PATHS = ['/login', '/auth/confirm', LUMI_CORE_GATE_PATH]
const LC_COOKIE_PREFIX = 'lc-'

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

  // ── Primär: Lumi-Core-Session (lc-*-Cookies) ──────────────────────────
  const lumiCore = createServerClient(
    process.env.NEXT_PUBLIC_LUMI_CORE_URL!,
    process.env.NEXT_PUBLIC_LUMI_CORE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies
            .getAll()
            .filter((cookie) => cookie.name.startsWith(LC_COOKIE_PREFIX))
            .map((cookie) => ({ name: cookie.name.slice(LC_COOKIE_PREFIX.length), value: cookie.value }))
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(`${LC_COOKIE_PREFIX}${name}`, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(`${LC_COOKIE_PREFIX}${name}`, value, options))
        },
      },
    },
  )
  const { data: { user: lumiCoreUser } } = await lumiCore.auth.getUser()

  if (lumiCoreUser) {
    // Vollständig authentifiziert -- ein evtl. noch vorhandener
    // Passkey-Marker ist jetzt gegenstandslos, aufräumen.
    if (request.cookies.get(PASSKEY_PENDING_LC_COOKIE)) response.cookies.delete(PASSKEY_PENDING_LC_COOKIE)
    return response
  }

  if (isPublicPath(request.nextUrl.pathname)) return response

  // ── Kein Lumi-Core-Login: Sonderfall Passkey (nur gegen Travel) ───────
  const travel = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().filter((cookie) => !cookie.name.startsWith(LC_COOKIE_PREFIX))
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )
  const { data: { user: travelUser } } = await travel.auth.getUser()

  const url = request.nextUrl.clone()
  if (travelUser) {
    // Per Passkey bei Travel eingeloggt, aber (noch) keine Lumi-Core-
    // Sitzung -- zum Gate, NICHT zu /login (kein erneuter Login nötig).
    url.pathname = LUMI_CORE_GATE_PATH
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
  } else {
    url.pathname = '/login'
  }
  const redirectResponse = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
  return redirectResponse
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
