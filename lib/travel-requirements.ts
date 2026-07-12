import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from './supabase/server'
import type { DocumentType } from './documents'

/**
 * Zentrale, erweiterbare Travel Requirements Engine: die EINE Stelle, die
 * entscheidet, welche Anforderungen für eine Reise gelten, für wen, und ob
 * sie bereits erfüllt sind. Alle Verbraucher (Ready to Travel, Reise-
 * dokumente-Übersicht, Concierge über lib/readiness.ts) nutzen dieselbe
 * Engine — keine Insellösung je Bereich.
 *
 * Architektur: Regel-Registry statt einer wachsenden Einzelfunktion. Jede
 * Regel ist eine reine Funktion `(context) => TravelRequirement[]`, die
 * unabhängig von allen anderen Regeln entscheidet, ob/für wen sie zutrifft.
 * Ein gemeinsamer Kontext (einmal pro Reise geladen: Mitreisende, alle
 * Personendokumente, erkannte Länder-Wegpunkte) wird an jede Regel
 * durchgereicht, damit keine Regel ihre eigenen Datenbank-Abfragen
 * duplizieren muss.
 *
 * Erweiterbarkeit (Grundsatz "neue Anforderungstypen nur durch neue Regeln,
 * ohne bestehende UI/Datenmodelle anzufassen"): `RequirementCategory` deckt
 * bereits jetzt Dokumente/Gesundheit/Transport/Reise-Logistik ab. Für
 * dokumentbasierte Anforderungen (wie ESTA/eTA/Reisepass) reicht ein
 * einziger Aufruf von `createDocumentRequirementRule(...)` in
 * REGISTERED_RULES — kein neues Modul, keine UI-Änderung nötig, da Ready to
 * Travel/Dokumente-Übersicht generisch über `TravelRequirement[]` iterieren.
 * Für Gesundheit/Transport/Reise-Logistik gibt es aktuell bewusst noch KEINE
 * Regeln — dafür existiert noch kein Datenmodell (keine Impfnachweise,
 * kein Führerschein-Dokumenttyp, kein "Hotelbuchung erforderlich"-Konzept).
 * Eine künftige Regel dieser Art würde genauso über eine neue Fabrik-
 * Funktion (analog zu createDocumentRequirementRule) ergänzt.
 */

export type RequirementCategory = 'document' | 'health' | 'transport' | 'travel'
export type RequirementStatus = 'satisfied' | 'missing' | 'expiring_soon' | 'expired' | 'pending'
export type RequirementPriority = 'high' | 'medium' | 'low'

export type TravelRequirement = {
  type: string
  category: RequirementCategory
  label: string
  status: RequirementStatus
  priority: RequirementPriority
  personId: string | null
  personName: string | null
  reason: string
  actionLabel: string | null
  actionHref: string | null
  documentId: string | null
}

type PersonDoc = { id: string; doc_type: DocumentType; expires_at: string | null }

type RequirementContext = {
  tripId: string
  tripSlug: string
  tripEnd: string
  returnTo: string
  members: Array<{ id: string; name: string }>
  countryCodes: Set<string>
  documentsByPerson: Map<string, PersonDoc[]>
  supabase: SupabaseClient
}

type RequirementRule = {
  type: string
  category: RequirementCategory
  evaluate(ctx: RequirementContext): TravelRequirement[] | Promise<TravelRequirement[]>
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

/**
 * Sammelt einmal pro Reise alles, was Regeln brauchen könnten: vollständige
 * Route (Etappen-Länder + jeder Flug-Abflug-/Ziel-/Zwischenstopp-Ort — Ziel-
 * UND Transitpunkte zählen gleichermaßen, da z. B. die USA auch bei einem
 * reinen Umsteigeflug ohne Übernachtung eine Einreise-/ESTA-Pflicht auslösen
 * können), alle Personendokumente der Mitreisenden (nicht nur Einreise-
 * dokumente — auch für z. B. die Reisepass-Regel wiederverwendbar).
 */
async function buildRequirementContext(tripId: string, returnTo?: string): Promise<RequirementContext | null> {
  const supabase = await createClient()
  const { data: trip } = await supabase.from('trips').select('slug, end_date').eq('id', tripId).maybeSingle()
  if (!trip?.end_date) return null

  const [{ data: memberRows }, { data: stagesRaw }, { data: flightsRaw }] = await Promise.all([
    supabase.from('trip_members').select('persons ( id, name )').eq('trip_id', tripId),
    supabase.from('stages').select('country_code').eq('trip_id', tripId),
    supabase.from('bookings').select('details').eq('trip_id', tripId).eq('type', 'flight').neq('status', 'cancelled'),
  ])

  const members = (memberRows ?? [])
    .flatMap((m) => (m.persons ? [m.persons as unknown as { id: string; name: string }] : []))

  const countryCodes = new Set<string>()
  for (const s of (stagesRaw ?? []) as Array<{ country_code: string | null }>) {
    if (s.country_code) countryCodes.add(s.country_code)
  }
  for (const f of (flightsRaw ?? []) as Array<{ details: Record<string, string> | null }>) {
    for (const field of ['from', 'to', 'layover_airport'] as const) {
      const code = resolveWaypointCountry(f.details?.[field])
      if (code) countryCodes.add(code)
    }
  }

  const memberIds = members.map((m) => m.id)
  const { data: docsRaw } = memberIds.length > 0
    ? await supabase.from('documents').select('id, person_id, doc_type, expires_at').in('person_id', memberIds)
    : { data: [] }

  const documentsByPerson = new Map<string, PersonDoc[]>()
  for (const d of (docsRaw ?? []) as Array<{ id: string; person_id: string | null; doc_type: DocumentType; expires_at: string | null }>) {
    if (!d.person_id) continue
    const list = documentsByPerson.get(d.person_id) ?? []
    list.push({ id: d.id, doc_type: d.doc_type, expires_at: d.expires_at })
    documentsByPerson.set(d.person_id, list)
  }

  return {
    tripId, tripSlug: trip.slug, tripEnd: trip.end_date,
    returnTo: returnTo ?? `/trips/${trip.slug}/documents`,
    members, countryCodes, documentsByPerson, supabase,
  }
}

/**
 * Fabrik für dokumentbasierte Anforderungen (Reisepass, ESTA, eTA, künftig
 * z. B. Visa) — strukturell identisch: "hat diese Person ein gültiges
 * Dokument vom Typ X, das mindestens bis Reiseende reicht" + optional
 * automatische, idempotente document_trips-Verknüpfung. Eine neue Regel
 * dieser Art ist ein einziger weiterer Aufruf, keine neue Datei.
 */
function createDocumentRequirementRule(opts: {
  type: string
  docType: DocumentType
  label: string
  priority: RequirementPriority
  /** Entscheidet, ob diese Anforderung für die Reise überhaupt gilt (z. B. nur bei USA in der Route). `true` = gilt immer (z. B. Reisepass). */
  appliesTo: (ctx: RequirementContext) => boolean
  /** Reisepass ist keine reisespezifische Zuordnung (kein document_trips-Bezug); ESTA/eTA sind es. */
  autoLink: boolean
}): RequirementRule {
  return {
    type: opts.type,
    category: 'document',
    async evaluate(ctx) {
      if (!opts.appliesTo(ctx)) return []

      const results: TravelRequirement[] = []
      const toLink: Array<{ document_id: string; trip_id: string }> = []

      for (const member of ctx.members) {
        const docsOfType = (ctx.documentsByPerson.get(member.id) ?? []).filter((d) => d.doc_type === opts.docType)

        // Unter allen gültigen (bis mind. Reiseende reichenden) Dokumenten dieses
        // Typs das am längsten gültige wählen — deterministisch, kein Raten.
        const validForTrip = docsOfType
          .filter((d) => d.expires_at && d.expires_at >= ctx.tripEnd)
          .sort((a, b) => (b.expires_at! > a.expires_at! ? 1 : -1))[0]

        if (validForTrip) {
          if (opts.autoLink) toLink.push({ document_id: validForTrip.id, trip_id: ctx.tripId })
          results.push({
            type: opts.type, category: 'document', label: opts.label, status: 'satisfied', priority: opts.priority,
            personId: member.id, personName: member.name,
            reason: `${opts.label} von ${member.name} ist bis mindestens Reiseende gültig.`,
            actionLabel: null, actionHref: null, documentId: validForTrip.id,
          })
          continue
        }

        // Kein gültiges Dokument für DIESE Reise -- unterscheiden, ob gar keins
        // existiert ("hinzufügen") oder eins existiert, das nur nicht bis
        // Reiseende reicht ("erneuern"), analog zum Auftragsbeispiel
        // Reisepass/ExpiresSoon mit Aktion "Pass erneuern".
        const mostRecentExpiring = [...docsOfType].sort((a, b) => {
          if (!a.expires_at) return 1
          if (!b.expires_at) return -1
          return b.expires_at > a.expires_at ? 1 : -1
        })[0]
        const hasAnyDocOfType = Boolean(mostRecentExpiring)

        results.push({
          type: opts.type, category: 'document', label: opts.label,
          status: hasAnyDocOfType ? 'expired' : 'missing', priority: opts.priority,
          personId: member.id, personName: member.name,
          reason: hasAnyDocOfType
            ? `${opts.label} von ${member.name} läuft vor oder während des Reiseendes ab.`
            : `${member.name} hat kein/e gültige/n ${opts.label} hinterlegt.`,
          actionLabel: hasAnyDocOfType ? `${opts.label} erneuern` : `${opts.label} hinzufügen`,
          actionHref: hasAnyDocOfType
            ? `/family/${member.id}/documents/${mostRecentExpiring!.id}`
            : `/family/${member.id}/documents/new?type=${opts.docType}&return_to=${encodeURIComponent(ctx.returnTo)}&assign_trip=${ctx.tripId}`,
          documentId: null,
        })
      }

      if (opts.autoLink && toLink.length > 0) {
        // document_trips hat einen Composite-Primary-Key (document_id, trip_id)
        // -- ein rohes insert() wäre bei wiederholten Aufrufen (Route ändert
        // sich, Seite wird neu geladen) nicht idempotent. upsert() mit
        // ignoreDuplicates ist die korrekte, tatsächlich idempotente Operation.
        await ctx.supabase.from('document_trips').upsert(toLink, { onConflict: 'document_id,trip_id', ignoreDuplicates: true })
      }

      return results
    },
  }
}

const passportRule = createDocumentRequirementRule({
  type: 'passport', docType: 'passport', label: 'Reisepass', priority: 'high',
  appliesTo: () => true, autoLink: false,
})
const estaRule = createDocumentRequirementRule({
  type: 'esta', docType: 'esta', label: 'ESTA', priority: 'high',
  appliesTo: (ctx) => ctx.countryCodes.has('US'), autoLink: true,
})
const etaRule = createDocumentRequirementRule({
  type: 'eta', docType: 'eta', label: 'eTA', priority: 'high',
  appliesTo: (ctx) => ctx.countryCodes.has('CA'), autoLink: true,
})

const REGISTERED_RULES: RequirementRule[] = [passportRule, estaRule, etaRule]

/**
 * Einziger Einstiegspunkt der Engine: wertet alle registrierten Regeln für
 * eine Reise aus und liefert eine normalisierte, flache Liste zurück. Ready
 * to Travel (lib/readiness.ts) und die Reisedokumente-Übersicht
 * (app/(app)/trips/[id]/documents/page.tsx) rufen beide diese eine Funktion
 * auf -- Concierge (lib/concierge.ts) nutzt bereits lib/readiness.ts und
 * profitiert dadurch automatisch, ohne selbst geändert zu werden.
 *
 * `returnTo` steuert, wohin ein "Dokument hinzufügen"-Flow nach dem
 * Speichern zurückführt (Default: die Reisedokumente-Übersicht selbst).
 */
export async function computeTripRequirements(tripId: string, returnTo?: string): Promise<TravelRequirement[]> {
  const ctx = await buildRequirementContext(tripId, returnTo)
  if (!ctx) return []

  const results = await Promise.all(REGISTERED_RULES.map((rule) => rule.evaluate(ctx)))
  return results.flat()
}
