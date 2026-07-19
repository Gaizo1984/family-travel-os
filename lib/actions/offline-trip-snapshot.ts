'use server'

import { createClient } from '@/lib/supabase/server'
import { sortStagesChronologically, buildJourneyTimeline } from '@/lib/journey'
import type { StageInput, TimelineBooking, TimelineEvent, TimelineDay } from '@/lib/journey'
import { sortBookingsChronologically, formatDateTimeDE } from '@/lib/bookings'
import { deriveTripDateRange, tripDurationDays, TRIP_DATE_RANGE_OPEN_LABEL } from '@/lib/trip-dates'
import { formatDateDE } from '@/lib/demo-data'
import type { BookingType, BookingStatus } from '@/lib/supabase/types'
import type { JourneyEventCategory, JourneyEventStatus } from '@/lib/journey-events'
import type { OfflineTripSnapshot } from '@/lib/offline-document-cache'
import { sortForBoardingPassViewer } from '@/lib/boarding-passes'
import { getCachedSignedUrl } from '@/lib/signed-storage-url'

type StageRow = {
  id: string; title: string; location: string | null; nights: number | null
  start_date: string | null; end_date: string | null; accommodation: string | null
  sort_order: number; country_code: string | null
}
type BookingRow = {
  id: string; type: BookingType; title: string; provider: string | null; status: BookingStatus
  start_datetime: string | null; end_datetime: string | null; stage_id: string | null
  details: Record<string, string> | null; created_at: string
  booking_reference: string | null
}
type JourneyEventRow = {
  id: string; stage_id: string | null; date: string; time: string | null
  category: JourneyEventCategory; title: string; location: string | null; status: JourneyEventStatus
}

/**
 * §"Offline-Bereich" (Nutzervorgabe, kombinierter Fix-Sprint): liefert genau
 * die Daten, die `components/SaveTripOfflineButton.tsx` client-seitig per
 * `saveTripSnapshot` in IndexedDB schreibt -- bewusst schlank (Text-/JSON-
 * Daten, keine Bilder in dieser Phase). Journey wird über die bestehende,
 * bereits im Rest der App genutzte `buildJourneyTimeline` vorberechnet, statt
 * die rohen Stages/Bookings/Events zu speichern -- beim späteren Offline-Lesen
 * ist dadurch keinerlei Neuberechnung nötig.
 */
export async function fetchOfflineTripSnapshotData(tripId: string): Promise<OfflineTripSnapshot | null> {
  const supabase = await createClient()
  const { data: trip } = await supabase
    .from('trips')
    .select(`
      id, slug, title, subtitle, status, start_date, end_date,
      stages ( id, title, location, nights, start_date, end_date, accommodation, sort_order, country_code ),
      bookings ( id, type, title, provider, status, start_datetime, end_datetime, stage_id, details, created_at, booking_reference ),
      journey_events ( id, stage_id, date, time, category, title, location, status )
    `)
    .eq('id', tripId)
    .maybeSingle()

  if (!trip) return null

  const stages = sortStagesChronologically((trip.stages ?? []) as StageRow[]) as StageInput[]
  const bookings = sortBookingsChronologically((trip.bookings ?? []) as BookingRow[]) as TimelineBooking[]
  const events = (trip.journey_events ?? []) as unknown as TimelineEvent[]
  const range = deriveTripDateRange(trip, trip.bookings as BookingRow[], trip.stages as StageRow[])
  const duration = tripDurationDays(range)

  const timeline = buildJourneyTimeline({ start_date: range.startDate, end_date: range.endDate }, stages, bookings, events)
  const allDays: TimelineDay[] = timeline.flatMap((seg) => (seg.kind === 'stay' ? seg.days : [seg.day]))

  const journeyDays = allDays.map((d) => ({
    date: d.date,
    dateLabel: formatDateDE(d.date),
    stageLabel: d.stage ? (d.stage.location ?? d.stage.title) : null,
    items: [
      ...d.bookings.map((b) => ({ time: formatDateTimeDE(b.start_datetime).split(' · ')[1] ?? null, title: b.title, subtitle: b.provider, category: b.type as string })),
      ...d.events.map((e) => ({ time: e.time, title: e.title, subtitle: e.location, category: e.category as string })),
    ],
  }))

  const flightsAndHotels = (trip.bookings as BookingRow[])
    .filter((b) => (b.type === 'flight' || b.type === 'accommodation') && b.status !== 'cancelled')
    .map((b) => ({
      id: b.id,
      type: b.type as 'flight' | 'accommodation',
      title: b.title,
      provider: b.provider,
      startLabel: formatDateTimeDE(b.start_datetime) === '—' ? null : formatDateTimeDE(b.start_datetime),
      endLabel: formatDateTimeDE(b.end_datetime) === '—' ? null : formatDateTimeDE(b.end_datetime),
      reference: b.booking_reference,
    }))

  const statusLabel = trip.status === 'active' ? 'Läuft gerade' : trip.status === 'completed' ? 'Abgeschlossen' : trip.status === 'archived' ? 'Archiviert' : 'Geplant'
  const dateRangeLabel = range.startDate
    ? `${formatDateDE(range.startDate)}${range.endDate ? ` – ${formatDateDE(range.endDate)}` : ''}${duration ? ` · ${duration} Tage` : ''}`
    : TRIP_DATE_RANGE_OPEN_LABEL

  return {
    tripId: trip.id,
    slug: trip.slug,
    title: trip.title,
    subtitle: trip.subtitle,
    dateRangeLabel,
    statusLabel,
    journeyDays,
    flightsAndHotels,
    cachedAt: new Date().toISOString(),
  }
}

export type OfflineCacheableDocument = {
  documentId: string
  url: string | null
  fileName: string
  mimeType: string
  isPdf: boolean
  docType: 'boarding_pass' | 'baggage_tag'
  label: string
  referenceDateIso: string
}

/**
 * §"cached zusätzlich alle vorhandenen Boardingpässe/Gepäckbelege dieser Reise
 * in einem Rutsch" (Plan, Abschnitt 1): liefert nur die Metadaten + Signed
 * URLs -- das eigentliche Herunterladen/Cachen passiert client-seitig in
 * `components/SaveTripOfflineButton.tsx` (IndexedDB ist Browser-only). ESTA/
 * ETA sind hier bewusst nicht enthalten, die brauchen weiterhin den
 * expliziten Zustimmungsschritt pro Dokument (siehe OfflineDocumentViewer,
 * policy: 'sensitive').
 */
export async function fetchTripDocumentsForOfflineCache(tripId: string): Promise<OfflineCacheableDocument[]> {
  const supabase = await createClient()
  const { data: booking } = await supabase.from('bookings').select('id, start_datetime, end_datetime').eq('trip_id', tripId).eq('type', 'flight')

  const { data: docsRaw } = await supabase
    .from('documents')
    .select('id, label, storage_path, doc_type, booking_id, person_id, persons ( id, name )')
    .eq('trip_id', tripId)
    .in('doc_type', ['boarding_pass', 'baggage_tag'])

  const bookingById = new Map((booking ?? []).map((b) => [b.id, b]))

  const results = await Promise.all(
    (docsRaw ?? []).map(async (d) => {
      const url = await getCachedSignedUrl('documents', d.storage_path)
      const isPdf = d.storage_path.toLowerCase().endsWith('.pdf')
      const person = d.persons as unknown as { id: string; name: string } | null
      const relatedBooking = d.booking_id ? bookingById.get(d.booking_id) : null
      const referenceDateIso = relatedBooking?.end_datetime ?? relatedBooking?.start_datetime ?? new Date().toISOString()
      const docType = d.doc_type as 'boarding_pass' | 'baggage_tag'
      const label = d.label ?? (docType === 'boarding_pass' ? 'Boardingpass' : 'Gepäckbeleg')
      return {
        documentId: d.id, url, fileName: `${docType}-${d.id}${isPdf ? '.pdf' : ''}`,
        mimeType: isPdf ? 'application/pdf' : 'image/jpeg', isPdf, docType, label, referenceDateIso,
        name: person?.name ?? '',
      }
    }),
  )

  return sortForBoardingPassViewer(results).map(({ name: _name, ...r }) => r)
}
