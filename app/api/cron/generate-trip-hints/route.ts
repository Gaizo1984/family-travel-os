import { NextRequest, NextResponse } from 'next/server'
import { generateAllTripHints } from '@/lib/hint-generation'

export const maxDuration = 60

/**
 * §"Proaktiver Reiseassistent" (Nutzervorgabe): gleiches Schutzmuster wie
 * cleanup-caches/cleanup-content-sessions (CRON_SECRET-Bearer, keine
 * Öffnung ohne gesetztes Secret). Läuft täglich (siehe vercel.json) --
 * ursprünglich stündlich geplant, damit ein "Check-in öffnet in 2h"-Hinweis
 * nicht bis zu einen Zyklus lang veraltet ist, aber der Vercel-Hobby-Plan
 * erlaubt keine häufigeren Cron-Läufe. Ein zeitkritischer Hinweis kann
 * dadurch bis zu 24h alt sein, bevor er erscheint -- bekannte Einschränkung,
 * kein Bug. Bei einem Plan-Upgrade genügt eine Änderung des Schedule-Strings.
 */
export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    console.error('[cron:generate-trip-hints] CRON_SECRET ist nicht gesetzt -- Route bleibt gesperrt.')
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await generateAllTripHints()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[cron:generate-trip-hints] Lauf fehlgeschlagen', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
