import type { HintContext, HintDraft, HintPriority, HintRule } from '../types'

const MS_PER_HOUR = 3_600_000

/**
 * §"Knapper Umstieg" (Nutzervorgabe): gleiches Abgleichsmuster wie
 * detectFlightStopoverSuggestions (lib/flight-stopovers.ts) -- exakter,
 * fallgleicher Textvergleich von Ziel- und Abflugort zweier Flugbuchungen,
 * hier aber mit einer KURZEN statt langen Schwelle. Nur der Zwei-Flüge-
 * Lücken-Fall ist hier feststellbar: ein einzelner Flug mit
 * `layover_airport`-Feld kennt keinen eigenen Zeitstempel für die
 * Zwischenlandung (nur Gesamt-Abflug/-Ankunft), die Umstiegsdauer lässt
 * sich dort nicht ableiten -- bewusst nicht raten, dieser Fall bleibt außen vor.
 */
const TIGHT_LAYOVER_MAX_MINUTES = 90
const TIGHT_LAYOVER_CRITICAL_MINUTES = 60

function hoursBetween(startIso: string, endIso: string): number {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / MS_PER_HOUR
}

export const tightLayoverRule: HintRule = {
  type: 'tight_layover',
  evaluate(ctx: HintContext): HintDraft[] {
    const drafts: HintDraft[] = []

    const flights = ctx.bookings
      .filter((b) => b.type === 'flight' && b.start_datetime)
      .sort((a, b) => a.start_datetime!.localeCompare(b.start_datetime!))

    for (let i = 0; i < flights.length - 1; i++) {
      const arriving = flights[i]
      const departing = flights[i + 1]

      const arrivalLocation = arriving.details?.to?.trim()
      const departureLocation = departing.details?.from?.trim()
      if (!arrivalLocation || !departureLocation) continue
      if (arrivalLocation.toLowerCase() !== departureLocation.toLowerCase()) continue

      const arrivalTimestamp = arriving.end_datetime ?? arriving.start_datetime
      const departureTimestamp = departing.start_datetime
      if (!arrivalTimestamp || !departureTimestamp) continue
      if (new Date(departureTimestamp).getTime() < ctx.now.getTime()) continue

      const gapMinutes = Math.round(hoursBetween(arrivalTimestamp, departureTimestamp) * 60)
      if (gapMinutes <= 0 || gapMinutes > TIGHT_LAYOVER_MAX_MINUTES) continue

      const priority: HintPriority = gapMinutes <= TIGHT_LAYOVER_CRITICAL_MINUTES ? 'critical' : 'upcoming'

      drafts.push({
        hintType: 'tight_layover',
        priority,
        title: 'Knapper Umstieg',
        reasoning: `Nur ${gapMinutes} Min. Umstiegszeit in ${arrivalLocation}.`,
        relevantAt: arrivalTimestamp,
        actionLabel: 'Zur Buchung',
        actionHref: `/trips/${ctx.tripSlug}/bookings/${departing.id}`,
        bookingId: departing.id,
        documentId: null,
        journeyEventId: null,
        dedupeKey: `tight-layover:${arriving.id}:${departing.id}`,
        contentHashInput: `${arrivalTimestamp}:${departureTimestamp}`,
      })
    }

    return drafts
  },
}
