import { BOOKING_TYPE_CONFIG } from '@/lib/bookings'
import type { BookingType } from '@/lib/supabase/types'
import type { HintContext, HintDraft, HintRule } from '../types'

/**
 * §"Fehlende Buchungsnummer oder fehlendes Dokument" (Nutzervorgabe):
 * beschränkt auf die drei Buchungstypen, bei denen eine Referenznummer/ein
 * Beleg tatsächlich üblich und wichtig ist (Flug/Hotel/Mietwagen) -- für
 * Aktivitäten/Restaurants o. Ä. wäre das reines Rauschen. Nur bestätigte
 * Buchungen zählen (eine noch offene Anfrage hat naturgemäß noch keine
 * Referenz).
 */
const RELEVANT_TYPES: BookingType[] = ['flight', 'accommodation', 'rental_car']

export const missingReferenceOrDocumentRule: HintRule = {
  type: 'missing_reference_or_document',
  evaluate(ctx: HintContext): HintDraft[] {
    const drafts: HintDraft[] = []

    for (const booking of ctx.bookings) {
      if (booking.status !== 'confirmed') continue
      if (!RELEVANT_TYPES.includes(booking.type)) continue

      const missingReference = !booking.booking_reference?.trim()
      const hasDocument = ctx.documents.some((d) => d.booking_id === booking.id)
      if (!missingReference && hasDocument) continue

      const config = BOOKING_TYPE_CONFIG[booking.type]
      const label = booking.title || config.label

      let reasoning: string
      if (missingReference && !hasDocument) {
        reasoning = `${label} hat weder eine Buchungsnummer noch ein hinterlegtes Dokument.`
      } else if (missingReference) {
        reasoning = `${label} hat noch keine Buchungsnummer hinterlegt.`
      } else {
        reasoning = `${label} hat noch kein Dokument (Bestätigung/Beleg) hinterlegt.`
      }

      drafts.push({
        hintType: 'missing_reference_or_document',
        priority: 'recommendation',
        title: `${config.label}: Angaben unvollständig`,
        reasoning,
        relevantAt: booking.start_datetime,
        actionLabel: 'Zur Buchung',
        actionHref: `/trips/${ctx.tripSlug}/bookings/${booking.id}`,
        bookingId: booking.id,
        documentId: null,
        journeyEventId: null,
        dedupeKey: `missing-data:${booking.id}`,
        contentHashInput: `${missingReference}:${hasDocument}`,
      })
    }

    return drafts
  },
}
