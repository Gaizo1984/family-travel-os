import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Security Foundation 1A: einziger Einstiegspunkt für Supabase-Auth-E-Mail-
 * Links (aktuell ausschließlich Passwort-Reset, siehe requestPasswordReset
 * in lib/actions/auth.ts). Tauscht token_hash gegen eine echte Session
 * (verifyOtp) und leitet danach auf die Zielseite weiter -- bewusst als
 * eigener Auth-Callback von proxy.ts als öffentlich ausgenommen.
 */

/** Nur relative interne Pfade zulassen -- verhindert Open-Redirect über
 *  einen manipulierten "next"-Query-Parameter (z. B. "//evil.example",
 *  das der Browser als protokollrelative externe URL auflösen würde). */
function sanitizeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const safeNext = sanitizeNextPath(searchParams.get('next'))

  // §Callback wird aktuell ausschließlich für Passwort-Reset genutzt --
  // zur Laufzeit geprüft (nicht nur per TS-Cast angenommen). Jeder andere
  // oder manipulierte "type"-Wert läuft in den bestehenden Fehlerpfad.
  if (tokenHash && type === 'recovery') {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, request.url))
    }
  }

  const errorUrl = new URL('/login', request.url)
  errorUrl.searchParams.set('error', 'Der Link ist ungültig oder abgelaufen. Bitte erneut anfordern.')
  return NextResponse.redirect(errorUrl)
}
