import type { SupabaseClient } from '@supabase/supabase-js'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { formatDateDE } from '@/lib/demo-data'

/**
 * Fasst die realen Reisedaten (Etappen, Buchungen, Journey-Termine) zu einem
 * kurzen Fließtext zusammen — dient KI-Flows als einzige Faktengrundlage
 * (z. B. Content-Ideen), damit nie über die Reise hinaus erfundene Fakten
 * in einen Prompt gelangen.
 *
 * FINALER CUTOVER, bekannte Lücke: alle vier Abfragen laufen jetzt gegen
 * Lumi Core (`createLumiCoreClient()`, cookie-basiert). `supabaseOverride`
 * existierte, damit ein sitzungsloser Cron-Aufrufer (z. B. der Urlaubsbeitrag-
 * Kurations-Cron in trip-debrief-generation.ts) einen Service-Role-Client
 * übergeben konnte -- das griff bisher für die Travel-Abfragen. Es gibt noch
 * KEINEN Lumi-Core-Service-Role-Client, daher hat `supabaseOverride` fuer
 * diese Funktion aktuell KEINE Wirkung mehr: ein Cron-Aufruf bekommt über den
 * cookie-losen `lumiCore`-Client leere Ergebnisse. Bewusst nicht selbst
 * gelöst (gleiche Kategorie wie lib/hint-generation.ts) -- Parameter bleibt
 * aus Kompatibilitätsgründen erhalten, bis ein Lumi-Core-Service-Role-Client
 * eingeführt wird.
 */
export async function buildTripDigest(tripId: string, supabaseOverride?: SupabaseClient): Promise<string> {
  void supabaseOverride
  const lumiCore = await createLumiCoreClient()

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
