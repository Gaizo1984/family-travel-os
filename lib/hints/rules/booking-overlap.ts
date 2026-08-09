import { BOOKING_TYPE_CONFIG, splitDateTime, hasRealTime } from '@/lib/bookings'
import type { BookingType } from '@/lib/supabase/types'
import { findOverlappingPairs, type IntervalItem } from '../overlap'
import type { HintContext, HintDraft, HintRule } from '../types'

/**
 * §"Buchung überschneidet sich mit einem anderen Termin" (Nutzervorgabe):
 * Unterkunft/Versicherung/Sonstiges bewusst ausgeschlossen -- die spannen
 * per Natur den ganzen Aufenthalt/die ganze Reise auf und "enthalten"
 * dadurch fast jeden anderen Termin, ohne ein echter Konflikt zu sein.
 * Nur Buchungen mit tatsächlich eingegebener Uhrzeit zählen (hasRealTime) --
 * sonst würde der 00:00-Platzhalter mehrerer Buchungen ohne echte Uhrzeit
 * fälschlich als gleichzeitig gelten.
 */
const RELEVANT_TYPES: BookingType[] = ['flight', 'transfer', 'rental_car', 'activity', 'restaurant', 'train', 'ferry']

export const bookingOverlapRule: HintRule = {
  type: 'booking_overlap',
  evaluate(ctx: HintContext): HintDraft[] {
    const items: IntervalItem[] = []

    for (const booking of ctx.bookings) {
      if (!RELEVANT_TYPES.includes(booking.type) || !booking.start_datetime) continue
      if (!hasRealTime(splitDateTime(booking.start_datetime).time)) continue
      const end = booking.end_datetime ?? booking.start_datetime
      items.push({
        id: `booking:${booking.id}`,
        label: booking.title || BOOKING_TYPE_CONFIG[booking.type].label,
        href: `/trips/${ctx.tripSlug}/bookings/${booking.id}`,
        start: booking.start_datetime,
        end,
        participantIds: booking.participant_household_member_ids,
      })
    }

    for (const event of ctx.journeyEvents) {
      if (!hasRealTime(event.time)) continue
      if (event.status === 'idea') continue
      const iso = `${event.date}T${event.time}:00`
      items.push({
        id: `event:${event.id}`,
        label: event.title,
        href: `/trips/${ctx.tripSlug}/journey-events/${event.id}/edit`,
        start: iso,
        end: iso,
        participantIds: event.participant_household_member_ids,
      })
    }

    const drafts: HintDraft[] = []
    for (const [a, b] of findOverlappingPairs(items)) {
      // §Zukünftig statt vergangen -- eine bereits verstrichene Überschneidung ist kein aktueller Hinweis mehr.
      if (new Date(a.start).getTime() < ctx.now.getTime() && new Date(b.start).getTime() < ctx.now.getTime()) continue

      // §Referenz zeigt auf den ersten Termin der Paarung -- die trip_hints-Zeile
      // kennt nur eine booking_id/journey_event_id-Spalte, beide Titel stehen
      // aber bereits vollständig im Fließtext (reasoning) unten.
      const [aSource, aRefId] = a.id.split(':')
      drafts.push({
        hintType: 'booking_overlap',
        priority: 'critical',
        title: 'Termine überschneiden sich',
        reasoning: `"${a.label}" und "${b.label}" überschneiden sich zeitlich.`,
        relevantAt: a.start <= b.start ? a.start : b.start,
        actionLabel: 'Zur Buchung',
        actionHref: a.href,
        bookingId: aSource === 'booking' ? aRefId : null,
        documentId: null,
        journeyEventId: aSource === 'event' ? aRefId : null,
        dedupeKey: `overlap:${[a.id, b.id].sort().join(':')}`,
        contentHashInput: `${a.start}:${a.end}:${b.start}:${b.end}`,
      })
    }

    return drafts
  },
}
