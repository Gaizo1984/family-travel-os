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

export async function proxy(request: NextRequest) {
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
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)',
  ],
}
