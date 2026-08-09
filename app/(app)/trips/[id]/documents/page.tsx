import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, BadgeCheck } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { DOCUMENT_TYPE_CONFIG } from "@/lib/documents";
import type { DocumentType } from "@/lib/documents";
import { unassignPolicyFromTrip } from "@/lib/actions/insurance";
import { computeTripRequirements } from "@/lib/travel-requirements";
import { BOOKING_TYPE_CONFIG } from "@/lib/bookings";
import type { BookingType } from "@/lib/supabase/types";
import { listHouseholdMembers, deriveInitials } from "@/lib/household-members";

type PersonRow = { id: string; name: string; initials: string; color: string };
type EntryDoc = { id: string; doc_type: DocumentType; label: string; person_id: string };
type Policy = { id: string; label: string; provider: string | null };

const ENTRY_DOC_TYPES: DocumentType[] = ["visa", "esta", "eta", "entry_permit"];

export default async function TripDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const lumiCore = await createLumiCoreClient();
  const { data: trip } = await lumiCore
    .from("travel_trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  // §Lumi-Core-Cutover: `trip_members`/`persons` gibt es in Lumi Core nicht
  // mehr -- flache travel_trip_members-Abfrage + listHouseholdMembers(),
  // Initialen werden abgeleitet (household_members hat kein initials-Feld).
  const { data: tripMemberRows } = await lumiCore.from("travel_trip_members").select("household_member_id").eq("trip_id", trip.id);
  const allHouseholdMembers = await listHouseholdMembers();
  const householdMemberById = new Map(allHouseholdMembers.map((m) => [m.id, m]));
  const members: PersonRow[] = (tripMemberRows ?? [])
    .map((tm) => householdMemberById.get(tm.household_member_id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .map((m) => ({ id: m.id, name: m.name, initials: deriveInitials(m.name), color: m.color }));

  const memberIds = members.map((m) => m.id);
  const returnTo = `/trips/${trip.slug}/documents`;

  // §Performance-Audit: die vier folgenden Abfragen sind bis auf eine
  // Ausnahme unabhängig voneinander (nur trip.id/memberIds nötig) und laufen
  // deshalb parallel statt seriell. Einzige echte Abhängigkeit:
  // document_trips (weiter unten) muss NACH computeTripRequirements laufen,
  // da dessen Auto-Verknüpfung (Upsert) hier gelesen wird — bleibt deshalb
  // bewusst außerhalb dieses Promise.all.
  // §Lumi-Core-Cutover: keine PostgREST-Embeddings -- insurance_policy_trips
  // und die booking_document-Abfrage liefern nur noch IDs, die zugehörigen
  // Versicherungen/Buchungen/Journal-Termine werden weiter unten flach
  // nachgeladen und per Map reassembliert.
  const [{ data: passportsRaw }, , { data: policyTripRows }, { data: bookingDocRowsRaw }] = await Promise.all([
    memberIds.length > 0
      ? lumiCore.from("travel_documents").select("id, household_member_id").eq("doc_type", "passport").in("household_member_id", memberIds)
      : Promise.resolve({ data: [] as { id: string; household_member_id: string | null }[] }),
    // §Travel Requirements Engine (lib/travel-requirements.ts): verknüpft
    // automatisch bereits vorhandene, gültige ESTA/eTA-Dokumente mit dieser
    // Reise (idempotent), bevor unten die zugeordneten Dokumente geladen
    // werden — dieselbe Engine wie in lib/readiness.ts, kein zweiter
    // Code-Pfad für "was ist zugeordnet/gültig".
    computeTripRequirements(trip.id),
    // Zentrale Versicherungen, die dieser Reise zugeordnet sind.
    lumiCore.from("travel_insurance_policy_trips").select("policy_id").eq("trip_id", trip.id),
    // Buchungsunterlagen (§11 Dokumenten-Hub): dieselbe Datei, die auf der
    // jeweiligen Buchungs- ODER Journal-Termin-Seite hochgeladen wurde — hier
    // nur referenziert, kein zweiter Upload. `doc_type='booking_document'`
    // deckt beide Quellen ab (siehe uploadBookingDocument/
    // uploadJourneyEventDocument, lib/actions/documents.ts).
    lumiCore.from("travel_documents")
      .select("id, label, booking_id, journey_event_id")
      .eq("trip_id", trip.id).eq("doc_type", "booking_document"),
  ]);

  const passportByPerson = new Map<string, string>();
  for (const p of passportsRaw ?? []) {
    if (p.household_member_id && !passportByPerson.has(p.household_member_id)) passportByPerson.set(p.household_member_id, p.id);
  }

  // Versicherungen aus den policy_id-Verknüpfungen flach nachladen.
  const policyIds = Array.from(new Set((policyTripRows ?? []).map((r) => r.policy_id)));
  const { data: policyRows } = policyIds.length > 0
    ? await lumiCore.from("travel_insurance_policies").select("id, label, provider").in("id", policyIds)
    : { data: [] as { id: string; label: string; provider: string | null }[] };
  const assignedPolicies: Policy[] = policyRows ?? [];

  // Visa/ESTA/eTA, die dieser Reise über document_trips zugeordnet sind.
  const { data: documentTripRows } = await lumiCore.from("travel_document_trips").select("document_id").eq("trip_id", trip.id);
  const entryDocumentIds = (documentTripRows ?? []).map((r) => r.document_id);
  const { data: entryDocsRaw } = entryDocumentIds.length > 0
    ? await lumiCore.from("travel_documents").select("id, doc_type, label, household_member_id").in("id", entryDocumentIds)
    : { data: [] as { id: string; doc_type: string; label: string | null; household_member_id: string | null }[] };

  const entryDocsByPerson = new Map<string, EntryDoc[]>();
  for (const doc of entryDocsRaw ?? []) {
    if (!ENTRY_DOC_TYPES.includes(doc.doc_type as DocumentType) || !doc.household_member_id) continue;
    const entry: EntryDoc = { id: doc.id, doc_type: doc.doc_type as DocumentType, label: doc.label ?? "Dokument", person_id: doc.household_member_id };
    const list = entryDocsByPerson.get(entry.person_id) ?? [];
    list.push(entry);
    entryDocsByPerson.set(entry.person_id, list);
  }

  type TripDocumentRow =
    | { id: string; label: string; kind: "booking"; href: string; bookingType: BookingType; subtitle: string }
    | { id: string; label: string; kind: "journey_event"; href: string; subtitle: string };

  const bookingDocRows = bookingDocRowsRaw ?? [];
  const bookingIds = Array.from(new Set(bookingDocRows.map((r) => r.booking_id).filter((v): v is string => Boolean(v))));
  const journeyEventIds = Array.from(new Set(bookingDocRows.map((r) => r.journey_event_id).filter((v): v is string => Boolean(v))));

  const [{ data: bookingsForDocsRaw }, { data: journeyEventsForDocsRaw }] = await Promise.all([
    bookingIds.length > 0
      ? lumiCore.from("travel_bookings").select("id, title, type").in("id", bookingIds)
      : Promise.resolve({ data: [] as { id: string; title: string; type: string }[] }),
    journeyEventIds.length > 0
      ? lumiCore.from("travel_journey_events").select("id, title, category").in("id", journeyEventIds)
      : Promise.resolve({ data: [] as { id: string; title: string; category: string }[] }),
  ]);
  const bookingForDocsById = new Map((bookingsForDocsRaw ?? []).map((b) => [b.id, b]));
  const journeyEventForDocsById = new Map((journeyEventsForDocsRaw ?? []).map((e) => [e.id, e]));

  const bookingDocuments: TripDocumentRow[] = bookingDocRows
    .map((row): TripDocumentRow | null => {
      const booking = row.booking_id ? bookingForDocsById.get(row.booking_id) ?? null : null;
      if (booking) {
        const config = BOOKING_TYPE_CONFIG[booking.type as BookingType];
        return {
          id: row.id, label: row.label ?? "Dokument", kind: "booking",
          href: `/trips/${trip.slug}/bookings/${booking.id}`,
          bookingType: booking.type as BookingType, subtitle: `${config?.label ?? booking.type} · ${booking.title}`,
        };
      }
      const journeyEvent = row.journey_event_id ? journeyEventForDocsById.get(row.journey_event_id) ?? null : null;
      if (journeyEvent) {
        return {
          id: row.id, label: row.label ?? "Dokument", kind: "journey_event",
          href: `/trips/${trip.slug}/journey-events/${journeyEvent.id}/edit`,
          subtitle: `Journal · ${journeyEvent.title}`,
        };
      }
      return null;
    })
    .filter((d): d is TripDocumentRow => d !== null);

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/trips/${trip.slug}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {trip.title}
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Dokumente
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Reisedokumente der Mitreisenden
        </h1>

        {/* Buchungsunterlagen: Flugtickets, Hotel-Voucher, Mietwagenunterlagen, ... — je Buchung, nicht je Person */}
        <section className="mb-10">
          <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
            Buchungsunterlagen
          </div>
          {bookingDocuments.length > 0 ? (
            <div className="space-y-2">
              {bookingDocuments.map((doc) => {
                const Icon = doc.kind === "booking" ? BOOKING_TYPE_CONFIG[doc.bookingType]?.icon : BadgeCheck;
                return (
                  <Link
                    key={doc.id}
                    href={doc.href}
                    className="flex items-center gap-4 p-4 rounded-xl"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
                  >
                    {Icon && <Icon size={16} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{doc.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
                        {doc.subtitle}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Noch keine Buchungsunterlagen — hochgeladen wird direkt auf der jeweiligen Buchungsseite.
            </p>
          )}
        </section>

        {members.length > 0 ? (
          <>
            {/* Reisepässe */}
            <section className="mb-10">
              <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
                Reisepässe
              </div>
              <div className="space-y-2">
                {members.map((person) => {
                  const documentId = passportByPerson.get(person.id);
                  return (
                    <div
                      key={person.id}
                      className="flex items-center gap-4 p-4 rounded-xl"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "var(--accent-subtle)", color: "var(--accent)", fontSize: "0.65rem", letterSpacing: "0.04em" }}
                      >
                        {person.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{person.name}</div>
                        <div
                          className="text-xs mt-0.5 flex items-center gap-1.5"
                          style={{ color: documentId ? "var(--muted)" : "#B5624A", fontSize: "0.7rem" }}
                        >
                          {documentId && <BadgeCheck size={12} strokeWidth={1.5} />}
                          {documentId ? "Reisepass hinterlegt" : "Reisepass fehlt"}
                        </div>
                      </div>
                      <Link
                        href={documentId
                          ? `/family/${person.id}/documents/${documentId}`
                          : `/family/${person.id}/documents/new?type=passport&return_to=${encodeURIComponent(returnTo)}`}
                        style={{
                          fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)",
                          border: "1px solid rgba(184,154,94,0.3)", padding: "7px 14px", borderRadius: "20px",
                          textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
                        }}
                      >
                        {documentId ? "Ansehen" : "Ergänzen"}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Visa & Einreise */}
            <section className="mb-10">
              <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
                Visa & Einreise
              </div>
              <div className="space-y-2">
                {members.map((person) => {
                  const docs = entryDocsByPerson.get(person.id) ?? [];
                  return (
                    <div
                      key={person.id}
                      className="p-4 rounded-xl"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-4 mb-2">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: "var(--accent-subtle)", color: "var(--accent)", fontSize: "0.65rem", letterSpacing: "0.04em" }}
                        >
                          {person.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{person.name}</div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
                            {docs.length > 0 ? `${docs.length} hinterlegt` : "Keine Einreisedokumente zugeordnet"}
                          </div>
                        </div>
                        <Link
                          href={`/family/${person.id}/documents/new?type=visa&return_to=${encodeURIComponent(returnTo)}&assign_trip=${trip.id}`}
                          style={{
                            fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)",
                            border: "1px solid rgba(184,154,94,0.3)", padding: "7px 14px", borderRadius: "20px",
                            textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
                          }}
                        >
                          + Hinzufügen
                        </Link>
                      </div>
                      {docs.length > 0 && (
                        <div className="flex flex-wrap gap-2" style={{ paddingLeft: "52px" }}>
                          {docs.map((doc) => (
                            <Link
                              key={doc.id}
                              href={`/family/${person.id}/documents/${doc.id}`}
                              style={{
                                fontSize: "0.68rem", color: "var(--foreground)", background: "var(--background)",
                                border: "1px solid var(--border)", padding: "4px 10px", borderRadius: "20px", textDecoration: "none",
                              }}
                            >
                              {DOCUMENT_TYPE_CONFIG[doc.doc_type].label}: {doc.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Versicherung */}
            <section>
              <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
                Versicherung
              </div>
              {assignedPolicies.length > 0 && (
                <div className="space-y-2 mb-4">
                  {assignedPolicies.map((policy) => (
                    <div
                      key={policy.id}
                      className="flex items-center justify-between gap-3 p-4 rounded-xl"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <Link
                        href={`/family/insurance/${policy.id}`}
                        className="min-w-0"
                        style={{ textDecoration: "none" }}
                      >
                        <div className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{policy.label}</div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
                          {policy.provider ?? "—"} · Versicherung hinterlegt
                        </div>
                      </Link>
                      <form action={unassignPolicyFromTrip}>
                        <input type="hidden" name="policy_id" value={policy.id} />
                        <input type="hidden" name="trip_id" value={trip.id} />
                        <input type="hidden" name="return_to" value={returnTo} />
                        <button
                          type="submit"
                          style={{
                            fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#B5624A",
                            background: "transparent", border: "1px solid rgba(181,98,74,0.3)", padding: "5px 12px",
                            borderRadius: "20px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                          }}
                        >
                          Entfernen
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
              {assignedPolicies.length === 0 && (
                <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                  Noch keine Versicherung zugeordnet.
                </p>
              )}
              <Link
                href={`/trips/${trip.slug}/documents/insurance`}
                style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.08em", textDecoration: "none" }}
              >
                {assignedPolicies.length > 0 ? "+ Weitere Versicherung zuordnen →" : "Bestehende Versicherung übernehmen →"}
              </Link>
            </section>
          </>
        ) : (
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Für diese Reise sind noch keine Mitreisenden ausgewählt.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
