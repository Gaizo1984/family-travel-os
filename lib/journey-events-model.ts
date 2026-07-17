import type { BookingType } from './supabase/types'
import type { JourneyEventCategory as JourneyEventEntryCategory, JourneyEventStatus } from './journey-events'
import type { StageInput, TimelineBooking, TimelineEvent, TimelineDay } from './journey'
import { buildJourneyTimeline, expandBookingOccurrences } from './journey'
import type { ReadinessFinding } from './readiness'
import type { TripDateRange } from './trip-dates'
import type { DailyForecast } from './weather'
import { resolveTimezone } from './country-timezones'

/**
 * §"Journey 2.0 -- zentrale Normalisierungsschicht" (Nutzervorgabe, wörtlich:
 * "unterschiedliche Quellen in ein gemeinsames internes JourneyEvent-Modell
 * überführen"): baut NICHT auf einer zweiten, parallelen Timeline-Logik auf --
 * `buildJourneyTimeline` (lib/journey.ts) bleibt die einzige Stelle, die Tage
 * einer Etappe zuordnet und den Datumsbereich der Reise aufspannt. Diese Datei
 * übersetzt deren Ausgabe (plus drei bislang nicht eingebundene Quellen:
 * Travel-Memory-Fotos, Reisebereitschaft/offene Aufgaben, Wetter) in ein
 * gemeinsames Anzeige-Modell -- reine, synchrone Datenverarbeitung, kein
 * eigener Supabase-/Provider-Aufruf hier (siehe buildJourneyOverview-Doku
 * unten), exakt wie buildJourneyTimeline selbst.
 */

export type JourneyEventSource = 'booking' | 'journey_event' | 'memory_photo' | 'readiness'

/** Vereinigt Buchungstypen, Journey-Termin-Kategorien und die neu hinzukommenden Quellen -- eine einzige Kategorie-Achse für Icon-/Prioritäts-Auflösung statt getrennter Schalter je Quelle. */
export type JourneyEventCategory = BookingType | JourneyEventEntryCategory | 'photo' | 'checklist'

export type JourneyEventStatusUnified = 'confirmed' | 'planned' | 'idea' | 'missing' | 'info'

export type JourneyEventPriority = 'high' | 'normal' | 'low'

export type JourneyEvent = {
  id: string
  source: JourneyEventSource
  sourceId: string
  date: string
  time: string | null
  title: string
  subtitle: string | null
  category: JourneyEventCategory
  status: JourneyEventStatusUnified
  priority: JourneyEventPriority
  location: string | null
  stageId: string | null
  linkHref: string | null
  isEndOccurrence: boolean
}

export type MemoryPhotoInput = {
  id: string
  stage_id: string | null
  taken_at: string | null
  created_at: string
  caption: string | null
  storage_path: string
}

/** §"Ein Flug/Mietwagen/... erzeugt ggf. zwei Tages-Vorkommnisse" (bereits etablierte Regel, siehe lib/journey.ts::expandBookingOccurrences) -- hier eins zu eins auf JourneyEvent übertragen, keine zweite Expansions-Logik. */
const HIGH_PRIORITY_BOOKING_TYPES = new Set<BookingType>(['flight', 'transfer', 'train', 'ferry'])

/**
 * §Bugfix "Hotel-Eintrag fälschlich mit 'Fehlt' markiert": stornierte
 * Buchungen wurden bisher trotzdem angezeigt, nur mit `status:'missing'`
 * ("Fehlt") -- das ist nicht die etablierte Konvention. Überall sonst
 * (lib/today.ts::buildTodayTimelineItems, JourneyDayRow.tsx::renderDayItems)
 * werden stornierte Buchungen komplett aus der Anzeige gefiltert, nie mit
 * einem Fehler-Badge gezeigt. Für `accommodation`-Buchungen ist das Status-
 * Feld im Bearbeitungsformular zudem gar nicht sichtbar (siehe
 * BOOKING_TYPE_CONFIG.accommodation.visibleFields.status=false) -- ein
 * "Fehlt"-Badge wäre für den Nutzer ohnehin nicht behebbar gewesen.
 */
export function bookingsToJourneyEvents(
  bookings: TimelineBooking[],
  slug: string,
): JourneyEvent[] {
  const activeBookings = bookings.filter((b) => b.status !== 'cancelled')
  return expandBookingOccurrences(activeBookings).map(({ date, booking }) => ({
    id: `booking-${booking.id}-${date}`,
    source: 'booking',
    sourceId: booking.id,
    date,
    time: booking.start_datetime?.slice(11, 16) ?? null,
    title: booking.isEndOccurrence ? booking.title : (booking.provider ? `${booking.provider} · ${booking.title}` : booking.title),
    subtitle: booking.provider,
    category: booking.type,
    status: 'confirmed',
    priority: HIGH_PRIORITY_BOOKING_TYPES.has(booking.type) ? 'high' : 'normal',
    location: null,
    stageId: booking.stage_id ?? null,
    linkHref: `/trips/${slug}/bookings/${booking.id}`,
    isEndOccurrence: booking.isEndOccurrence ?? false,
  }))
}

function journeyEventStatusToUnified(status: JourneyEventStatus): JourneyEventStatusUnified {
  return status === 'idea' ? 'idea' : status === 'reserved' ? 'confirmed' : 'planned'
}

export function journeyEventEntriesToJourneyEvents(events: TimelineEvent[], slug: string): JourneyEvent[] {
  return events.map((e) => ({
    id: `event-${e.id}`,
    source: 'journey_event',
    sourceId: e.id,
    date: e.date,
    time: e.time,
    title: e.title,
    subtitle: null,
    category: e.category,
    status: journeyEventStatusToUnified(e.status),
    priority: 'normal',
    location: e.location,
    stageId: null,
    linkHref: `/trips/${slug}/journey-events/${e.id}/edit`,
    isEndOccurrence: false,
  }))
}

/** §"Travel Memory automatisch in die Journey einsortieren" (Nutzervorgabe): nutzt die bereits vorhandenen Spalten trip_id/stage_id/taken_at auf memory_photos -- keine neue Spalte, keine neue Verknüpfung. */
export function memoryPhotosToJourneyEvents(photos: MemoryPhotoInput[]): JourneyEvent[] {
  return photos.map((p) => ({
    id: `photo-${p.id}`,
    source: 'memory_photo',
    sourceId: p.id,
    date: (p.taken_at ?? p.created_at).slice(0, 10),
    time: null,
    title: p.caption ?? 'Foto',
    subtitle: null,
    category: 'photo',
    status: 'confirmed',
    priority: 'low',
    location: null,
    stageId: p.stage_id,
    linkHref: '/memories',
    isEndOccurrence: false,
  }))
}

/**
 * §"Offene Aufgaben und fehlende Angaben" (Nutzervorgabe): mappt die bereits
 * bestehende Reisebereitschafts-Prüfung (lib/readiness.ts::computeTripReadiness,
 * keine neue Regel-Engine) auf das gemeinsame Modell. Findings haben keinen
 * eigenen Tagesbezug -- landen deshalb ausschließlich im "Vor der
 * Reise"-Bucket (siehe buildJourneyOverview), nicht in der Tages-Timeline.
 */
export function readinessToJourneyEvents(findings: ReadinessFinding[], fallbackDate: string): JourneyEvent[] {
  return findings.map((f, i) => ({
    id: `readiness-${i}-${f.theme}`,
    source: 'readiness',
    sourceId: `${f.theme}-${i}`,
    date: fallbackDate,
    time: null,
    title: f.message,
    subtitle: null,
    category: 'checklist',
    status: f.severity === 'conflict' ? 'missing' : 'info',
    priority: f.severity === 'conflict' ? 'high' : 'normal',
    location: null,
    stageId: null,
    linkHref: f.href,
    isEndOccurrence: false,
  }))
}

export type JourneyDayBucket = {
  date: string
  stage: StageInput | null
  isStageStart: boolean
  isStageEnd: boolean
  isPast: boolean
  isToday: boolean
  events: JourneyEvent[]
  photos: JourneyEvent[]
  weather: DailyForecast | null
  /** §"Chronologische Sortierung inklusive Zeitzonen": aus stage.country_code abgeleitete IANA-Zone dieses Tages (siehe lib/country-timezones.ts) -- Alltagsfall gelöst, keine minutengenaue Cross-Timezone-Umrechnung für einzelne Flugsegmente (v1-Einschränkung, siehe Architekturplan). */
  timeZone: string
}

export type JourneyPhase = 'before' | 'today' | 'during' | 'after'

export type JourneyOverview = {
  phase: JourneyPhase
  beforeChecklist: JourneyEvent[]
  days: JourneyDayBucket[]
  afterMemories: JourneyEvent[]
}

function sortEventsWithinDay(events: JourneyEvent[]): JourneyEvent[] {
  return [...events].sort((a, b) => {
    // Flug immer vor Hotel-Check-in am selben Tag, außer als End-Vorkommnis (Check-out schließt vor dem Rückflug ab) --
    // §Bugfix "Springhill-Hotel-Check-in erscheint vor dem Abflug, Check-out
    // nach statt vor dem Rückflug": die aus JourneyDayRow.tsx übernommene
    // Regel war invertiert. Korrekt: ein Check-out (End-Vorkommnis) schließt
    // IMMER vor einem Flug ab (man reist ab, dann geht's zum Flughafen); ein
    // Check-in folgt IMMER auf einen Flug (man landet, dann checkt man ein).
    if (a.category === 'flight' && b.category === 'accommodation') return b.isEndOccurrence ? 1 : -1
    if (a.category === 'accommodation' && b.category === 'flight') return a.isEndOccurrence ? -1 : 1
    return (a.time ?? '99:99').localeCompare(b.time ?? '99:99')
  })
}

/**
 * §"Zentrale Normalisierungsschicht, keine parallele Timeline-/Today-Logik"
 * (Nutzervorgabe, wörtlich): reine, synchrone Zusammenführung bereits
 * geladener Daten -- ruft bewusst KEINE Supabase-/Wetter-Abfrage selbst auf
 * (Trennung wie bei buildJourneyTimeline: die aufrufende Seite lädt, diese
 * Funktion verarbeitet nur). `weatherByDate` wird von der aufrufenden Seite
 * für maximal die nächsten 5 Tage befüllt (Open-Meteo-Fenster, siehe
 * lib/weather.ts) -- alle anderen Tage bleiben bewusst ohne Wetter.
 */
export function buildJourneyOverview(params: {
  trip: { start_date: string | null; end_date: string | null }
  slug: string
  stages: StageInput[]
  bookings: TimelineBooking[]
  events: TimelineEvent[]
  photos: MemoryPhotoInput[]
  readinessFindings: ReadinessFinding[]
  weatherByDate: Map<string, DailyForecast>
  tripDateRange: TripDateRange
  todayIso: string
}): JourneyOverview {
  const { trip, slug, stages, bookings, events, photos, readinessFindings, weatherByDate, tripDateRange, todayIso } = params

  const segments = buildJourneyTimeline(trip, stages, bookings, events)

  const bookingEvents = bookingsToJourneyEvents(bookings, slug)
  const journeyEventEvents = journeyEventEntriesToJourneyEvents(events, slug)
  const photoEvents = memoryPhotosToJourneyEvents(photos)

  const eventsByDate = new Map<string, JourneyEvent[]>()
  for (const e of [...bookingEvents, ...journeyEventEvents]) {
    const list = eventsByDate.get(e.date) ?? []
    list.push(e)
    eventsByDate.set(e.date, list)
  }
  const photosByDate = new Map<string, JourneyEvent[]>()
  for (const p of photoEvents) {
    const list = photosByDate.get(p.date) ?? []
    list.push(p)
    photosByDate.set(p.date, list)
  }

  const days: JourneyDayBucket[] = []
  for (const segment of segments) {
    const timelineDays: TimelineDay[] = segment.kind === 'stay' ? segment.days : [segment.day]
    for (const day of timelineDays) {
      days.push({
        date: day.date,
        stage: day.stage,
        isStageStart: day.isStageStart,
        isStageEnd: day.isStageEnd,
        isPast: day.date < todayIso,
        isToday: day.date === todayIso,
        events: sortEventsWithinDay(eventsByDate.get(day.date) ?? []),
        photos: photosByDate.get(day.date) ?? [],
        weather: weatherByDate.get(day.date) ?? null,
        timeZone: resolveTimezone(day.stage?.country_code),
      })
    }
  }

  // §"Vor der Reise": offene Aufgaben/fehlende Angaben haben keinen
  // Tagesbezug -- landen gebündelt vor Reisebeginn, nicht in der Tagesliste.
  const beforeChecklist = readinessToJourneyEvents(readinessFindings, tripDateRange.startDate ?? todayIso)

  // §"Nach der Reise": alle Fotos der ganzen Reise, unabhängig vom Tag --
  // Tages-Zuordnung bleibt zusätzlich in days[].photos für die Timeline-Ansicht erhalten.
  const afterMemories = photoEvents

  let phase: JourneyPhase = 'during'
  if (tripDateRange.startDate && todayIso < tripDateRange.startDate) phase = 'before'
  else if (tripDateRange.endDate && todayIso > tripDateRange.endDate) phase = 'after'
  else if (days.some((d) => d.isToday)) phase = 'today'

  return { phase, beforeChecklist, days, afterMemories }
}
