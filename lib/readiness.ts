import { createClient } from './supabase/server'
import type { DocumentType } from './documents'
import { detectFlightStopoverSuggestions } from './flight-stopovers'
import { ensureTripDocumentRequirements } from './travel-requirements'
import { formatDateDE } from './demo-data'

export type ReadinessSeverity = 'conflict' | 'hint'
export type ReadinessTheme = 'documents' | 'entry' | 'insurance' | 'itinerary' | 'bookings'

export type ReadinessFinding = {
  severity: ReadinessSeverity
  theme: ReadinessTheme
  message: string
  href: string
}

export type ReadinessStatus = 'ready' | 'hints' | 'conflicts'

export type ReadinessResult = {
  findings: ReadinessFinding[]
  conflictCount: number
  hintCount: number
  status: ReadinessStatus
}

export const READINESS_THEME_LABELS: Record<ReadinessTheme, string> = {
  documents: 'Reisende & Dokumente',
  entry: 'Einreise',
  insurance: 'Versicherung',
  itinerary: 'Reiseverlauf',
  bookings: 'Buchungen',
}

const ENTRY_TYPES: DocumentType[] = ['visa', 'esta', 'eta', 'entry_permit']

function addDaysIso(date: string, delta: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

type StageRow = {
  id: string
  title: string
  start_date: string | null
  end_date: string | null
  nights: number | null
  accommodation: string | null
  sort_order: number
}

function sortStages(stages: StageRow[]): StageRow[] {
  return [...stages].sort((a, b) => {
    if (a.start_date && b.start_date) {
      const cmp = a.start_date.localeCompare(b.start_date)
      return cmp !== 0 ? cmp : a.sort_order - b.sort_order
    }
    if (a.start_date && !b.start_date) return -1
    if (!a.start_date && b.start_date) return 1
    return a.sort_order - b.sort_order
  })
}

/**
 * Berechnet die Reisebereitschaft ausschließlich aus vorhandenen Daten — keine
 * Persistenz, kein Doppelzustand. Fehlende optionale Daten (z. B. kein Visum
 * zugeordnet) werden bewusst NICHT gemeldet, da niemand automatisch weiß, ob
 * ein Einreisedokument für diese Reise nötig ist — nur ein VORHANDENES, das
 * abläuft, wird geprüft.
 */
export async function computeTripReadiness(tripId: string): Promise<ReadinessResult> {
  const supabase = await createClient()
  const findings: ReadinessFinding[] = []

  const { data: trip } = await supabase
    .from('trips')
    .select('id, slug, start_date, end_date')
    .eq('id', tripId)
    .maybeSingle()

  if (!trip || !trip.start_date || !trip.end_date) {
    return { findings: [], conflictCount: 0, hintCount: 0, status: 'ready' }
  }
  const slug = trip.slug
  const tripEnd = trip.end_date

  // §Performance: die folgenden Abfragen sind alle unabhängig voneinander
  // (keine hängt vom Ergebnis einer anderen ab, außer der Dokumente-Query, die
  // die Mitreisenden-IDs braucht) — parallel statt seriell laden.
  const [{ data: memberRows }, { data: assignedEntryDocsRaw }, { count: insuranceCount }, { data: stagesRaw }, { data: bookingsRaw }, stopoverSuggestions, travelRequirementStatuses] =
    await Promise.all([
      supabase.from('trip_members').select('persons ( id, name )').eq('trip_id', tripId),
      supabase.from('document_trips').select('documents ( id, person_id, doc_type, expires_at, label )').eq('trip_id', tripId),
      supabase.from('insurance_policy_trips').select('policy_id', { count: 'exact', head: true }).eq('trip_id', tripId),
      supabase.from('stages').select('id, title, start_date, end_date, nights, accommodation, sort_order').eq('trip_id', tripId),
      supabase.from('bookings').select('id, type, stage_id, status, start_datetime, end_datetime').eq('trip_id', tripId),
      detectFlightStopoverSuggestions(tripId),
      ensureTripDocumentRequirements(tripId),
    ])

  // ── Einreise: USA/Kanada als Ziel oder Transit (zentraler Travel-Requirement-
  // Service, siehe lib/travel-requirements.ts) — dieselbe Anforderungs-/
  // Gültigkeitslogik wie die Reisedokumente-Übersicht, kein zweiter Code-Pfad.
  for (const status of travelRequirementStatuses) {
    if (status.status !== 'missing') continue
    findings.push({
      severity: 'conflict', theme: 'entry',
      message: `${status.label} für ${status.personName} hinzufügen (USA/Kanada als Ziel oder Transit erkannt).`,
      href: `/family/${status.personId}/documents/new?type=${status.docType}&return_to=${encodeURIComponent(`/trips/${slug}/ready-to-travel`)}&assign_trip=${tripId}`,
    })
  }

  // ── Reisende & Dokumente: Reisepass je Mitreisendem ──
  const members = (memberRows ?? [])
    .flatMap((m) => (m.persons ? [m.persons as unknown as { id: string; name: string }] : []))
  const memberIds = members.map((m) => m.id)

  const { data: allDocs } = memberIds.length > 0
    ? await supabase.from('documents').select('id, person_id, doc_type, expires_at').in('person_id', memberIds)
    : { data: [] }

  const docsByPerson = new Map<string, Array<{ id: string; doc_type: DocumentType; expires_at: string | null }>>()
  for (const d of allDocs ?? []) {
    if (!d.person_id) continue
    const list = docsByPerson.get(d.person_id) ?? []
    list.push({ id: d.id, doc_type: d.doc_type as DocumentType, expires_at: d.expires_at })
    docsByPerson.set(d.person_id, list)
  }

  for (const member of members) {
    const docs = docsByPerson.get(member.id) ?? []
    const passport = docs.find((d) => d.doc_type === 'passport')
    if (!passport) {
      findings.push({
        severity: 'conflict', theme: 'documents',
        message: `${member.name} hat keinen Reisepass hinterlegt.`,
        href: `/family/${member.id}`,
      })
    } else if (passport.expires_at && passport.expires_at <= tripEnd) {
      findings.push({
        severity: 'conflict', theme: 'documents',
        message: `Reisepass von ${member.name} läuft vor oder während des Reiseendes ab.`,
        href: `/family/${member.id}/documents/${passport.id}`,
      })
    }
  }

  // ── Einreise: dieser Reise zugeordnete Visa/ESTA/eTA ──
  for (const row of assignedEntryDocsRaw ?? []) {
    const doc = row.documents as unknown as
      { id: string; person_id: string; doc_type: DocumentType; expires_at: string | null; label: string } | null
    if (!doc || !ENTRY_TYPES.includes(doc.doc_type)) continue
    if (doc.expires_at && doc.expires_at <= tripEnd) {
      findings.push({
        severity: 'conflict', theme: 'entry',
        message: `${doc.label} läuft vor oder während des Reiseendes ab.`,
        href: `/family/${doc.person_id}/documents/${doc.id}`,
      })
    }
  }

  // ── Versicherung ──
  if (!insuranceCount) {
    findings.push({
      severity: 'hint', theme: 'insurance',
      message: 'Keine zentrale Versicherung dieser Reise zugeordnet.',
      href: `/trips/${slug}/documents/insurance`,
    })
  }

  // ── Reiseverlauf: Etappen-Überschneidungen, Lücken, fehlende Unterkunft ──
  const stages = sortStages((stagesRaw ?? []) as StageRow[])
  const bookings = (bookingsRaw ?? []).filter((b) => b.status !== 'cancelled')

  for (let i = 0; i < stages.length; i++) {
    const s = stages[i]

    if ((s.nights ?? 0) >= 1 && !s.accommodation) {
      const hasAccommodationBooking = bookings.some((b) => b.type === 'accommodation' && b.stage_id === s.id)
      if (!hasAccommodationBooking) {
        findings.push({
          severity: 'hint', theme: 'itinerary',
          message: `Aufenthalt "${s.title}" hat noch keine Unterkunftsangabe.`,
          href: `/trips/${slug}/stages/${s.id}/edit`,
        })
      }
    }

    for (let j = i + 1; j < stages.length; j++) {
      const t = stages[j]
      // Ein gemeinsamer Grenztag (Checkout = Checkin am selben Tag) ist normales Reisen,
      // kein Konflikt — erst wenn eine Etappe echt vor Ende der vorherigen beginnt (mehr
      // als der geteilte Übergangstag), ist es eine echte Datumsüberschneidung.
      if (s.start_date && s.end_date && t.start_date && t.end_date && t.start_date < s.end_date && s.start_date < t.end_date) {
        findings.push({
          severity: 'conflict', theme: 'itinerary',
          message: `Aufenthalte "${s.title}" und "${t.title}" überschneiden sich zeitlich.`,
          href: `/trips/${slug}/stages/${s.id}`,
        })
      }
    }

    if (i > 0) {
      const prev = stages[i - 1]
      if (prev.end_date && s.start_date && s.start_date > addDaysIso(prev.end_date, 1)) {
        findings.push({
          severity: 'hint', theme: 'itinerary',
          message: `Lücke zwischen "${prev.title}" und "${s.title}" — Tage ohne zugeordnete Etappe.`,
          href: `/trips/${slug}/stages/new`,
        })
      }
    }
  }

  // ── Buchungen: Flüge vorhanden, überschneidende Flüge ──
  const flights = bookings.filter((b) => b.type === 'flight' && b.start_datetime)
  if (flights.length === 0) {
    findings.push({
      severity: 'hint', theme: 'bookings',
      message: 'Keine Flugbuchung für diese Reise hinterlegt.',
      href: `/trips/${slug}/bookings/category/flight`,
    })
  }
  for (let i = 0; i < flights.length; i++) {
    for (let j = i + 1; j < flights.length; j++) {
      const a = flights[i]
      const b = flights[j]
      const aEnd = a.end_datetime ?? a.start_datetime!
      const bEnd = b.end_datetime ?? b.start_datetime!
      if (a.start_datetime! <= bEnd && b.start_datetime! <= aEnd) {
        findings.push({
          severity: 'conflict', theme: 'bookings',
          message: 'Zwei Flugbuchungen überschneiden sich zeitlich.',
          href: `/trips/${slug}/bookings/${a.id}`,
        })
      }
    }
  }

  // ── Zwischenstopps mit nötiger Übernachtung, für die noch keine Etappe existiert ──
  for (const s of stopoverSuggestions) {
    findings.push({
      severity: 'hint', theme: 'itinerary',
      message: `Zwischenstopp mit Übernachtung erkannt: ${s.location}, ${formatDateDE(s.startDate)}–${formatDateDE(s.endDate)}. Als Etappe hinzufügen?`,
      href: `/trips/${slug}/stages/confirm-stopover?location=${encodeURIComponent(s.location)}&start=${s.startDate}&end=${s.endDate}`,
    })
  }

  const conflictCount = findings.filter((f) => f.severity === 'conflict').length
  const hintCount = findings.filter((f) => f.severity === 'hint').length
  const status: ReadinessStatus = conflictCount > 0 ? 'conflicts' : hintCount > 0 ? 'hints' : 'ready'

  return { findings, conflictCount, hintCount, status }
}
