import type { HintContext, HintDraft, HintPriority, HintRule } from '../types'

const MS_PER_HOUR = 3_600_000

/**
 * §"Online-Check-in öffnet bald" (Nutzervorgabe): Airlines öffnen den
 * Online-Check-in unterschiedlich (meist 24-48h vor Abflug) -- ohne
 * airline-spezifische Daten wird bewusst der verbreitetste Wert (24h)
 * als einzige Annahme verwendet, klar als Näherung kommuniziert
 * ("meist ab 24h vorher"), nie als exakte Zusicherung.
 */
const CHECKIN_OPENS_BEFORE_HOURS = 24
const LOOKAHEAD_HOURS = 48

export const checkinOpensSoonRule: HintRule = {
  type: 'checkin_opens_soon',
  evaluate(ctx: HintContext): HintDraft[] {
    const drafts: HintDraft[] = []

    for (const booking of ctx.bookings) {
      if (booking.type !== 'flight' || booking.status !== 'confirmed' || !booking.start_datetime) continue
      // §Nur Hinflug/erster Abschnitt -- ein Rückflug bekommt seinen eigenen Hinweis über seine eigene Buchung.
      const departure = new Date(booking.start_datetime)
      const hoursUntilDeparture = (departure.getTime() - ctx.now.getTime()) / MS_PER_HOUR
      if (hoursUntilDeparture < 0 || hoursUntilDeparture > LOOKAHEAD_HOURS) continue

      const hoursUntilCheckin = hoursUntilDeparture - CHECKIN_OPENS_BEFORE_HOURS
      const checkinAlreadyOpen = hoursUntilCheckin <= 0
      const priority: HintPriority = checkinAlreadyOpen ? 'critical' : 'upcoming'

      const route = booking.details?.from && booking.details?.to ? ` ${booking.details.from}–${booking.details.to}` : ''
      const label = booking.title || `Flug${route}`

      drafts.push({
        hintType: 'checkin_opens_soon',
        priority,
        title: checkinAlreadyOpen ? 'Online-Check-in bereits möglich' : 'Online-Check-in öffnet bald',
        reasoning: checkinAlreadyOpen
          ? `${label}: Online-Check-in ist meist bereits möglich (Abflug in ${Math.round(hoursUntilDeparture)} Std.).`
          : `${label}: Online-Check-in öffnet meist in ca. ${Math.round(hoursUntilCheckin)} Std.`,
        relevantAt: booking.start_datetime,
        actionLabel: 'Zur Buchung',
        actionHref: `/trips/${ctx.tripSlug}/bookings/${booking.id}`,
        bookingId: booking.id,
        documentId: null,
        journeyEventId: null,
        dedupeKey: `checkin:${booking.id}`,
        contentHashInput: `${booking.start_datetime}`,
      })
    }

    return drafts
  },
}
