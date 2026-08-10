import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { PASSKEY_PENDING_LC_COOKIE, LUMI_CORE_GATE_PATH, TRAVEL_RETURN_TO_COOKIE } from './lib/passkey-lumi-core-gate'
import { BASE_PATH } from './lib/base-path'

/**
 * §"App-like Lumi Travel", Passkey-Origin-Guard: WebAuthn-Credentials sind
 * kryptographisch an die Browser-Origin gebunden, unter der sie registriert
 * wurden -- ein Passkey-Aufruf, der über den Multi-Zones-Proxy unter
 * lumi-launcher.vercel.app läuft, kann deshalb NIE zu einem unter
 * family-travel-os-xi.vercel.app registrierten Passkey passen (harte
 * Browser-Sicherheitsgrenze, keine Konfigurationsfrage). Betroffen sind nur
 * die beiden Seiten, die tatsächlich navigator.credentials.*-Aufrufe
 * auslösen (PasskeyLoginButton auf /login, PasskeyManager auf
 * /mehr/passkeys) -- alle anderen Routen (inkl. normales Lumi-Core-E-Mail/
 * Passwort-Login) sind nicht origin-sensitiv und bleiben unverändert über
 * den Proxy erreichbar. `pathname` ist hier bereits basePath-bereinigt
 * (Next.js normalisiert das für Proxy-Matching), daher Vergleich ohne
 * BASE_PATH-Präfix.
 *
 * Zwei-Hop-Redirect, weil Set-Cookie IMMER der Domain der aktuellen Antwort
 * zugeordnet wird, nie dem Redirect-Ziel: (1) diese Antwort läuft noch unter
 * der fremden Host (Lumi Launcher) -- der Rücksprungpfad kann hier nur als
 * Query-Param mitgegeben werden, ein hier gesetzter Cookie würde auf der
 * FALSCHEN Domain landen. (2) Erst die FOLGENDE Anfrage, die den Browser
 * tatsächlich zu Travels echter Domain navigiert, darf/kann den Cookie dort
 * korrekt setzen -- das übernimmt derselbe proxy() weiter unten, sobald er
 * auf der echten Domain mit `return_to` im Query-String läuft.
 *
 * §Preview-Testrunde: "Travels eigene Domain" ist NICHT immer die fixe
 * Production-URL -- ein Preview-Deployment dieser App läuft unter einer
 * eigenen, pro Deployment wechselnden Vercel-URL. Ohne dynamische Erkennung
 * würde der Guard während eines Preview-Tests fälschlich auf die Production-
 * Domain umleiten (falscher Passkey-Kontext, kaputter Testlauf). Vercel
 * setzt `VERCEL_ENV`/`VERCEL_URL` automatisch pro Deployment, ganz ohne
 * manuelle Env-Var-Pflege je Testrunde -- nur für den bekannten Production-
 * Fall bleibt die feste Domain hartkodiert (deckungsgleich mit der
 * Rollback-Anforderung).
 */
const TRAVEL_OWN_ORIGIN =
  process.env.VERCEL_ENV === 'production'
    ? 'https://family-travel-os-xi.vercel.app'
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3001'
const TRAVEL_OWN_HOSTS = [new URL(TRAVEL_OWN_ORIGIN).host, 'localhost:3001', '127.0.0.1:3001']
const RETURN_TO_COOKIE_MAX_AGE_SECONDS = 600

function isForeignHost(request: NextRequest): boolean {
  const effectiveHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  return !TRAVEL_OWN_HOSTS.includes(effectiveHost)
}

/** Externe URL zurück zur (fremden) Launcher-Origin, exakt die Seite, die ursprünglich angefragt wurde. */
function buildForeignOriginalUrl(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  return `${request.nextUrl.protocol}//${host}${BASE_PATH}${request.nextUrl.pathname}${request.nextUrl.search}`
}

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

  // ── Passkey-Origin-Guard, Hop 2: auf Travels eigener Domain angekommen,
  // `return_to` (von Hop 1 unten) in einen kurzlebigen, korrekt auf DIESER
  // Domain gesetzten Cookie übernehmen -- übersteht damit auch weitere
  // interne Redirects (/login -> /connect-lumi-core -> establishLumiCoreSession).
  const returnToParam = request.nextUrl.searchParams.get('return_to')
  if (!isForeignHost(request) && returnToParam) {
    response.cookies.set(TRAVEL_RETURN_TO_COOKIE, returnToParam, {
      maxAge: RETURN_TO_COOKIE_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
  }

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

    // Passkey-Origin-Guard: /mehr/passkeys registriert/verwaltet echtes
    // WebAuthn -- über eine fremde Host (Lumi Launcher) liefe das unter der
    // falschen Origin. Alle anderen Routen sind nicht betroffen.
    if (request.nextUrl.pathname === '/mehr/passkeys' && isForeignHost(request)) {
      const target = new URL(`${TRAVEL_OWN_ORIGIN}${BASE_PATH}/mehr/passkeys`)
      const redirectResponse = NextResponse.redirect(target)
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
      return redirectResponse
    }

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

  if (!travelUser) {
    // Passkey-Origin-Guard, Hop 1: unauthentifiziert + fremde Host (Lumi
    // Launcher) -- Travels eigenes Session-Cookie (sb-*) wird vom Browser
    // ohnehin nie fremdenübergreifend gesendet, `travelUser` ist hier also
    // immer leer, wenn wir tatsächlich über die fremde Host laufen. Absolut
    // zu Travels echter Domain schicken, damit ein Passkey-Login unter der
    // richtigen Origin läuft; `return_to` trägt die ursprüngliche
    // Launcher-Ziel-URL für den Rücksprung nach erfolgreichem Login.
    if (isForeignHost(request)) {
      const target = new URL(`${TRAVEL_OWN_ORIGIN}${BASE_PATH}/login`)
      target.searchParams.set('return_to', buildForeignOriginalUrl(request))
      const redirectResponse = NextResponse.redirect(target)
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
      return redirectResponse
    }
  }

  const url = request.nextUrl.clone()
  if (travelUser) {
    // Per Passkey bei Travel eingeloggt, aber (noch) keine Lumi-Core-
    // Sitzung -- zum Gate, NICHT zu /login (kein erneuter Login nötig).
    // Läuft laut obiger Cookie-Argumentation immer auf Travels eigener
    // Domain -- ein evtl. per Hop-2 gesetzter travel-return-to-Cookie
    // übersteht diesen internen Redirect unverändert.
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
