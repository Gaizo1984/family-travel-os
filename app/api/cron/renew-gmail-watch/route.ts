import { NextRequest, NextResponse } from 'next/server'
import { renewGmailWatch } from '@/lib/gmail/gmail-watch'

/**
 * §Reise-Postfach, Implementierungsschritt "Daily Renewal" (Nutzervorgabe,
 * wörtlich): Gmail-Watches laufen laut Google spätestens nach 7 Tagen ab --
 * ein täglicher Lauf lässt reichlich Sicherheitsabstand. Gleiches
 * Schutzmuster wie die übrigen /api/cron/*-Routen (CRON_SECRET-Bearer,
 * s. cleanup-caches/route.ts) -- proxy.ts nimmt /api/cron/* bereits
 * pauschal von der Session-Pflicht aus (isCronPath), keine Änderung dort
 * nötig.
 */
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    console.error('[cron:renew-gmail-watch] CRON_SECRET ist nicht gesetzt -- Route bleibt gesperrt.')
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const { historyId, expiration } = await renewGmailWatch()
    const expiresAt = new Date(Number(expiration)).toISOString()
    // §Vorgabe ("Ablaufdatum/historyId sauber loggen, aber keine Secrets"):
    // beides unkritische Zustandswerte des Postfachs, keine Zugangsdaten.
    console.log('[cron:renew-gmail-watch] Watch erfolgreich erneuert', { historyId, expiresAt })
    return NextResponse.json({ ok: true, historyId, expiresAt })
  } catch (e) {
    console.error('[cron:renew-gmail-watch] Lauf fehlgeschlagen', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
