import type { HintBookingRow, HintContext, HintDraft, HintPriority, HintRule } from '../types'

const MS_PER_MINUTE = 60_000
/** §Weniger als das gilt als unrealistisch knapp (Gepäck/Immigration/Weg zum Schalter). */
const MIN_REALISTIC_GAP_MINUTES = 30

function sameCalendarDay(aIso: string, bIso: string): boolean {
  return aIso.slice(0, 10) === bIso.slice(0, 10)
}

function locationsMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  const lowerA = a.trim().toLowerCase()
  const lowerB = b.trim().toLowerCase()
  return lowerA.length > 0 && lowerB.length > 0 && (lowerA.includes(lowerB) || lowerB.includes(lowerA))
}

/**
 * §"Mietwagenabholung passt zeitlich nicht zur Landung" (Nutzervorgabe):
 * keine FK zwischen Mietwagen- und Flugbuchung im Schema -- nur der
 * eindeutige Teilfall (gleiche Etappe ODER gleicher Tag + Ortsabgleich, GENAU
 * ein Kandidat) wird bewertet. Bei Mehrdeutigkeit wird bewusst KEIN Hinweis
 * erzeugt statt zu raten, welcher Flug gemeint ist.
 */
function findMatchingFlight(rentalCar: HintBookingRow, flights: HintBookingRow[]): HintBookingRow | null {
  const sameStage = rentalCar.stage_id
    ? flights.filter((f) => f.stage_id === rentalCar.stage_id)
    : []
  if (sameStage.length === 1) return sameStage[0]
  if (sameStage.length > 1) return null

  const candidates = flights.filter((f) => {
    if (!f.end_datetime || !rentalCar.start_datetime) return false
    if (!sameCalendarDay(f.end_datetime, rentalCar.start_datetime)) return false
    return locationsMatch(f.details?.to, rentalCar.details?.pickup_location)
  })
  return candidates.length === 1 ? candidates[0] : null
}

export const rentalCarVsFlightRule: HintRule = {
  type: 'rental_car_vs_flight',
  evaluate(ctx: HintContext): HintDraft[] {
    const drafts: HintDraft[] = []
    const flights = ctx.bookings.filter((b) => b.type === 'flight' && b.end_datetime)
    const rentalCars = ctx.bookings.filter((b) => b.type === 'rental_car' && b.start_datetime && b.status !== 'cancelled')

    for (const rentalCar of rentalCars) {
      if (new Date(rentalCar.start_datetime!).getTime() < ctx.now.getTime()) continue
      const flight = findMatchingFlight(rentalCar, flights)
      if (!flight?.end_datetime) continue

      const gapMinutes = Math.round((new Date(rentalCar.start_datetime!).getTime() - new Date(flight.end_datetime).getTime()) / MS_PER_MINUTE)
      if (gapMinutes >= MIN_REALISTIC_GAP_MINUTES) continue

      const priority: HintPriority = gapMinutes < 0 ? 'critical' : 'upcoming'
      const label = rentalCar.title || 'Mietwagen'

      drafts.push({
        hintType: 'rental_car_vs_flight',
        priority,
        title: 'Mietwagenabholung prüfen',
        reasoning: gapMinutes < 0
          ? `${label}: Abholung ist vor der Landung des zugehörigen Flugs geplant.`
          : `${label}: nur ${gapMinutes} Min. zwischen Landung und Abholung eingeplant.`,
        relevantAt: rentalCar.start_datetime,
        actionLabel: 'Zur Buchung',
        actionHref: `/trips/${ctx.tripSlug}/bookings/${rentalCar.id}`,
        bookingId: rentalCar.id,
        documentId: null,
        journeyEventId: null,
        dedupeKey: `rental-vs-flight:${rentalCar.id}:${flight.id}`,
        contentHashInput: `${rentalCar.start_datetime}:${flight.end_datetime}`,
      })
    }

    return drafts
  },
}
