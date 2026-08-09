import type { SupabaseClient } from '@supabase/supabase-js'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import type { LumiCoreDatabase } from '@/lib/supabase/lumi-core-types'
import { formatDateDE } from '@/lib/demo-data'

/**
 * Fasst die realen Reisedaten (Etappen, Buchungen, Journey-Termine) zu einem
 * kurzen Fließtext zusammen — dient KI-Flows als einzige Faktengrundlage
 * (z. B. Content-Ideen), damit nie über die Reise hinaus erfundene Fakten
 * in einen Prompt gelangen.
 *
 * FINALER CUTOVER: `supabaseOverride` ist jetzt wieder wirksam -- ein
 * sitzungsloser Cron-Aufrufer (z. B. lib/trip-debrief-generation.ts) übergibt
 * den neuen Lumi-Core-Service-Role-Client (lib/supabase/lumi-core-service.ts),
 * ein normaler Seitenaufruf lässt den Parameter weg und bekommt den
 * cookie-basierten `createLumiCoreClient()`.
 */
export async function buildTripDigest(tripId: string, lumiCoreOverride?: SupabaseClient<LumiCoreDatabase>): Promise<string> {
  const lumiCore = lumiCoreOverride ?? await createLumiCoreClient()

  const [{ data: trip }, { data: stages }, { data: bookings }, { data: events }] = await Promise.all([
    lumiCore.from('travel_trips').select('title, subtitle, start_date, end_date').eq('id', tripId).maybeSingle(),
    lumiCore.from('travel_stages').select('title, location, start_date, end_date, accommodation').eq('trip_id', tripId).order('sort_order'),
    lumiCore.from('travel_bookings').select('type, title, provider').eq('trip_id', tripId).neq('status', 'cancelled'),
    lumiCore.from('travel_journey_events').select('category, title, location').eq('trip_id', tripId),
  ])

  const lines: string[] = []

  if (trip) {
    const dates = trip.start_date && trip.end_date ? `${formatDateDE(trip.start_date)} – ${formatDateDE(trip.end_date)}` : ''
    lines.push(`Reise: ${trip.title}${trip.subtitle ? ` (${trip.subtitle})` : ''}${dates ? `, ${dates}` : ''}.`)
  }

  if (stages && stages.length > 0) {
    const stageText = stages.map((s) => `${s.title}${s.accommodation ? ` (${s.accommodation})` : ''}`).join(', ')
    lines.push(`Etappen: ${stageText}.`)
  }

  if (bookings && bookings.length > 0) {
    const bookingText = bookings.map((b) => `${b.type}${b.provider ? `: ${b.provider}` : ''}`).join(', ')
    lines.push(`Buchungen: ${bookingText}.`)
  }

  if (events && events.length > 0) {
    const eventText = events.map((e) => `${e.title} (${e.category})`).join(', ')
    lines.push(`Aktivitäten/Termine: ${eventText}.`)
  }

  return lines.join(' ')
}
