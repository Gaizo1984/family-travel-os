import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredCacheEntries } from '@/lib/cache-cleanup'

export const maxDuration = 60

/**
 * §"Abgelaufene Cacheeinträge automatisiert bereinigen" (Nutzervorgabe) --
 * gleiches Schutzmuster wie cleanup-content-sessions (CRON_SECRET-Bearer,
 * keine Öffnung ohne gesetztes Secret). Löscht ausschließlich in
 * lib/cache-cleanup.ts explizit gelistete, wiederbeschaffbare Cache-Tabellen
 * -- niemals family_memories/persons/past_trips/saved_flight_options.
 */
export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    console.error('[cron:cleanup-caches] CRON_SECRET ist nicht gesetzt -- Route bleibt gesperrt.')
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await cleanupExpiredCacheEntries()
    return NextResponse.json({ ok: true, deleted: result })
  } catch (e) {
    console.error('[cron:cleanup-caches] Lauf fehlgeschlagen', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
