import { createClient } from './supabase/server'
import type { DocumentType } from './documents'

/**
 * Zentraler, erweiterbarer Travel-Requirement-Service: ermittelt, welche
 * Einreisedokumente eine Reise anhand ihrer VOLLSTÄNDIGEN Route (Etappen +
 * Flugbuchungen inkl. Zwischenstopps) erfordert, und verknüpft automatisch
 * bereits vorhandene, gültige Personendokumente über die bestehende
 * document_trips-M:N-Beziehung — nie Kopien, nie doppelte Datensätze.
 *
 * Bewusst als eigenständiges Modul (nicht in lib/readiness.ts oder einzelne
 * Seiten eingebaut): lib/readiness.ts und die Reisedokumente-Übersicht
 * (app/(app)/trips/[id]/documents/page.tsx) rufen beide dieselben Funktionen
 * hier auf, damit Anforderungs-/Gültigkeitslogik nie auseinanderlaufen kann.
 *
 * Struktur ist bewusst auf weitere Länder/Dokumenttypen (Visa etc.)
 * erweiterbar: WAYPOINT_REQUIREMENTS bräuchte dafür nur einen weiteren
 * Eintrag, computeTripTravelRequirements/ensureTripDocumentRequirements
 * müssten nicht angepasst werden.
 */

export type TravelRequirementType = 'esta' | 'eta'

export type TravelRequirement = {
  type: TravelRequirementType
  docType: DocumentType
  countryCode: 'US' | 'CA'
  reason: string
}

/** Länder, für die dieser Sprint eine automatische Anforderung kennt → benötigter Dokumenttyp. */
const WAYPOINT_REQUIREMENTS: Record<'US' | 'CA', { type: TravelRequirementType; docType: DocumentType; label: string }> = {
  US: { type: 'esta', docType: 'esta', label: 'ESTA' },
  CA: { type: 'eta', docType: 'eta', label: 'eTA' },
}

/**
 * Kuratierte, deterministische Zuordnung großer US-/kanadischer Flughäfen und
 * Städte zu ihrem Land — gleiches Muster wie lib/geo-suggestions.ts
 * (Textfragment-Suche, keine externe Geocoding-API). Flugbuchungs-Freitext
 * (details.from/to/layover_airport) nutzt sowohl IATA-Codes ("ATL") als auch
 * Städtenamen ("Atlanta") — beide Formen werden erfasst. Kurze, mit anderen
 * Wörtern kollidierende Codes (z. B. "SAN", "LAS") sind bewusst NICHT als
 * eigenständiges Schlüsselwort aufgenommen, nur die vollen Städtenamen.
 */
const US_CA_WAYPOINT_MAP: Array<{ keywords: string[]; code: 'US' | 'CA' }> = [
  { keywords: ['atlanta', 'atl'], code: 'US' },
  { keywords: ['new york', 'newark', 'jfk', 'lga', 'ewr'], code: 'US' },
  { keywords: ['los angeles', 'lax'], code: 'US' },
  { keywords: ['chicago', 'ord'], code: 'US' },
  { keywords: ['dallas', 'dfw'], code: 'US' },
  { keywords: ['denver', 'den'], code: 'US' },
  { keywords: ['san francisco', 'sfo'], code: 'US' },
  { keywords: ['seattle', 'sea'], code: 'US' },
  { keywords: ['miami', 'mia'], code: 'US' },
  { keywords: ['houston', 'iah'], code: 'US' },
  { keywords: ['boston', 'bos'], code: 'US' },
  { keywords: ['las vegas'], code: 'US' },
  { keywords: ['orlando', 'mco'], code: 'US' },
  { keywords: ['charlotte', 'clt'], code: 'US' },
  { keywords: ['phoenix', 'phx'], code: 'US' },
  { keywords: ['philadelphia', 'phl'], code: 'US' },
  { keywords: ['washington', 'dulles', 'iad', 'dca'], code: 'US' },
  { keywords: ['detroit', 'dtw'], code: 'US' },
  { keywords: ['minneapolis', 'msp'], code: 'US' },
  { keywords: ['honolulu', 'hnl', 'hawaii'], code: 'US' },
  { keywords: ['san diego'], code: 'US' },
  { keywords: ['usa', 'vereinigte staaten', 'united states'], code: 'US' },
  { keywords: ['toronto', 'yyz'], code: 'CA' },
  { keywords: ['vancouver', 'yvr'], code: 'CA' },
  { keywords: ['montreal', 'yul'], code: 'CA' },
  { keywords: ['calgary', 'yyc'], code: 'CA' },
  { keywords: ['ottawa', 'yow'], code: 'CA' },
  { keywords: ['edmonton', 'yeg'], code: 'CA' },
  { keywords: ['winnipeg', 'ywg'], code: 'CA' },
  { keywords: ['halifax', 'yhz'], code: 'CA' },
  { keywords: ['kanada', 'canada'], code: 'CA' },
]

export function resolveWaypointCountry(text: string | null | undefined): 'US' | 'CA' | null {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const entry of US_CA_WAYPOINT_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.code
  }
  return null
}

type FlightRow = { details: Record<string, string> | null }
type StageRow = { country_code: string | null }

/**
 * Sammelt alle Routenpunkte einer Reise (Etappen-Länder + jeder Flug-
 * Abflug-/Ziel-/Zwischenstopp-Ort) und leitet daraus die benötigten
 * Einreisedokumente ab — Ziel- UND Transitpunkte zählen gleichermaßen, da
 * z. B. die USA auch bei einem reinen Umsteigeflug ohne Übernachtung eine
 * Einreise-/ESTA-Pflicht auslösen (echte Grenzkontrolle bei Umsteigen).
 */
export async function computeTripTravelRequirements(tripId: string): Promise<TravelRequirement[]> {
  const supabase = await createClient()

  const [{ data: stagesRaw }, { data: flightsRaw }] = await Promise.all([
    supabase.from('stages').select('country_code').eq('trip_id', tripId),
    supabase.from('bookings').select('details').eq('trip_id', tripId).eq('type', 'flight').neq('status', 'cancelled'),
  ])

  const countryCodes = new Set<'US' | 'CA'>()

  for (const s of (stagesRaw ?? []) as StageRow[]) {
    if (s.country_code === 'US' || s.country_code === 'CA') countryCodes.add(s.country_code)
  }

  for (const f of (flightsRaw ?? []) as FlightRow[]) {
    for (const field of ['from', 'to', 'layover_airport'] as const) {
      const code = resolveWaypointCountry(f.details?.[field])
      if (code) countryCodes.add(code)
    }
  }

  return Array.from(countryCodes).map((code) => {
    const req = WAYPOINT_REQUIREMENTS[code]
    return {
      type: req.type,
      docType: req.docType,
      countryCode: code,
      reason: `${req.label} erforderlich (USA/Kanada als Ziel oder Transit erkannt)`,
    }
  })
}

export type PersonRequirementStatus = {
  personId: string
  personName: string
  type: TravelRequirementType
  docType: DocumentType
  label: string
  status: 'satisfied' | 'missing'
  documentId: string | null
}

/**
 * Prüft je Anforderung × Mitreisendem, ob ein gültiges, personenbezogenes
 * Dokument existiert, und verknüpft es idempotent über document_trips mit
 * der Reise. document_trips hat einen Composite-Primary-Key
 * (document_id, trip_id) — ein rohes insert() würde bei wiederholten
 * Aufrufen (Route ändert sich, Seite wird neu geladen) mit einem
 * Duplicate-Key-Fehler scheitern. upsert() mit ignoreDuplicates ist daher
 * die korrekte, tatsächlich idempotente Operation: mehrfache Aufrufe
 * erzeugen nie eine zweite Zeile.
 */
export async function ensureTripDocumentRequirements(tripId: string): Promise<PersonRequirementStatus[]> {
  const requirements = await computeTripTravelRequirements(tripId)
  if (requirements.length === 0) return []

  const supabase = await createClient()
  const { data: trip } = await supabase.from('trips').select('end_date').eq('id', tripId).maybeSingle()
  const tripEnd = trip?.end_date
  if (!tripEnd) return []

  const { data: memberRows } = await supabase
    .from('trip_members')
    .select('persons ( id, name )')
    .eq('trip_id', tripId)
  const members = (memberRows ?? [])
    .flatMap((m) => (m.persons ? [m.persons as unknown as { id: string; name: string }] : []))
  if (members.length === 0) return []

  const memberIds = members.map((m) => m.id)
  const docTypes = Array.from(new Set(requirements.map((r) => r.docType)))

  const { data: candidateDocsRaw } = await supabase
    .from('documents')
    .select('id, person_id, doc_type, expires_at')
    .in('person_id', memberIds)
    .in('doc_type', docTypes)

  type CandidateDoc = { id: string; person_id: string; doc_type: DocumentType; expires_at: string | null }
  const candidateDocs = (candidateDocsRaw ?? []) as CandidateDoc[]

  const statuses: PersonRequirementStatus[] = []
  const toLink: Array<{ document_id: string; trip_id: string }> = []

  for (const requirement of requirements) {
    for (const member of members) {
      // Unter allen gültigen (bis mind. Reiseende reichenden) Dokumenten dieses Typs
      // für diese Person das am längsten gültige wählen — deterministisch, kein Raten.
      const valid = candidateDocs
        .filter((d) => d.person_id === member.id && d.doc_type === requirement.docType && d.expires_at && d.expires_at >= tripEnd)
        .sort((a, b) => (b.expires_at! > a.expires_at! ? 1 : -1))[0]

      if (valid) {
        toLink.push({ document_id: valid.id, trip_id: tripId })
        statuses.push({
          personId: member.id, personName: member.name, type: requirement.type, docType: requirement.docType,
          label: WAYPOINT_REQUIREMENTS[requirement.countryCode].label, status: 'satisfied', documentId: valid.id,
        })
      } else {
        statuses.push({
          personId: member.id, personName: member.name, type: requirement.type, docType: requirement.docType,
          label: WAYPOINT_REQUIREMENTS[requirement.countryCode].label, status: 'missing', documentId: null,
        })
      }
    }
  }

  if (toLink.length > 0) {
    await supabase.from('document_trips').upsert(toLink, { onConflict: 'document_id,trip_id', ignoreDuplicates: true })
  }

  return statuses
}
