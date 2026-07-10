import { createClient } from './supabase/server'

export type FlightStopoverSuggestion = {
  location: string
  startDate: string
  endDate: string
  incomingFlightId: string
  outgoingFlightId: string
}

function dateOnly(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null
}

function addDaysIso(date: string, delta: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

type FlightRow = {
  id: string
  start_datetime: string | null
  end_datetime: string | null
  details: Record<string, string> | null
}

type StageRow = { start_date: string | null; end_date: string | null }

/**
 * Erkennt Zwischenstopps mit nötiger Übernachtung zwischen zwei Flügen derselben
 * Reise: Flug A landet an einem Ort, Flug B startet später vom selben Ort — mit
 * mindestens einer vollen Nacht dazwischen — und es existiert noch keine Etappe,
 * die diesen Zeitraum abdeckt. Nur eindeutige Orts-Treffer (identischer Text in
 * "Zielflughafen" von A und "Abflughafen" von B) lösen einen Vorschlag aus, kein
 * Raten bei abweichenden Bezeichnungen.
 */
export async function detectFlightStopoverSuggestions(tripId: string): Promise<FlightStopoverSuggestion[]> {
  const supabase = await createClient()

  const [{ data: bookingsRaw }, { data: stagesRaw }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, type, status, start_datetime, end_datetime, details')
      .eq('trip_id', tripId)
      .eq('type', 'flight')
      .neq('status', 'cancelled'),
    supabase.from('stages').select('start_date, end_date').eq('trip_id', tripId),
  ])

  const flights = ((bookingsRaw ?? []) as FlightRow[])
    .filter((f) => f.start_datetime)
    .sort((a, b) => a.start_datetime!.localeCompare(b.start_datetime!))
  const stages = (stagesRaw ?? []) as StageRow[]

  const suggestions: FlightStopoverSuggestion[] = []

  for (let i = 0; i < flights.length - 1; i++) {
    const arriving = flights[i]
    const departing = flights[i + 1]

    const arrivalLocation = arriving.details?.to?.trim()
    const departureLocation = departing.details?.from?.trim()
    if (!arrivalLocation || !departureLocation) continue
    if (arrivalLocation.toLowerCase() !== departureLocation.toLowerCase()) continue

    const arrivalDate = dateOnly(arriving.end_datetime ?? arriving.start_datetime)
    const nextDepartureDate = dateOnly(departing.start_datetime)
    if (!arrivalDate || !nextDepartureDate) continue
    if (nextDepartureDate <= addDaysIso(arrivalDate, 1)) continue // Umsteigen am selben/nächsten Tag ohne Übernachtungslücke

    const alreadyCovered = stages.some(
      (s) => s.start_date && s.end_date && s.start_date <= arrivalDate && s.end_date >= nextDepartureDate,
    )
    if (alreadyCovered) continue

    suggestions.push({
      location: arrivalLocation,
      startDate: arrivalDate,
      endDate: nextDepartureDate,
      incomingFlightId: arriving.id,
      outgoingFlightId: departing.id,
    })
  }

  return suggestions
}
