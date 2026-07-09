import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_TYPE_CONFIG } from "@/lib/documents";
import type { DocumentType } from "@/lib/documents";

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

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select(`
      id, slug, title,
      trip_members ( persons ( id, name, initials, color ) )
    `)
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const members = (trip.trip_members as unknown as Array<{ persons: PersonRow | null }>)
    .flatMap((tm) => (tm.persons ? [tm.persons] : []));

  const memberIds = members.map((m) => m.id);
  const returnTo = `/trips/${trip.slug}/documents`;

  const { data: passports } = memberIds.length > 0
    ? await supabase
        .from("documents")
        .select("id, person_id")
        .eq("doc_type", "passport")
        .in("person_id", memberIds)
    : { data: [] };

  const passportByPerson = new Map<string, string>();
  for (const p of passports ?? []) {
    if (p.person_id && !passportByPerson.has(p.person_id)) passportByPerson.set(p.person_id, p.id);
  }

  // Visa/ESTA/eTA, die dieser Reise über document_trips zugeordnet sind.
  const { data: entryDocRows } = await supabase
    .from("document_trips")
    .select("documents ( id, doc_type, label, person_id )")
    .eq("trip_id", trip.id);

  const entryDocsByPerson = new Map<string, EntryDoc[]>();
  for (const row of entryDocRows ?? []) {
    const doc = row.documents as unknown as EntryDoc | null;
    if (!doc || !ENTRY_DOC_TYPES.includes(doc.doc_type)) continue;
    const list = entryDocsByPerson.get(doc.person_id) ?? [];
    list.push(doc);
    entryDocsByPerson.set(doc.person_id, list);
  }

  // Zentrale Versicherungen, die dieser Reise zugeordnet sind.
  const { data: policyRows } = await supabase
    .from("insurance_policy_trips")
    .select("insurance_policies ( id, label, provider )")
    .eq("trip_id", trip.id);

  const assignedPolicies = (policyRows ?? [])
    .map((r) => r.insurance_policies as unknown as Policy | null)
    .filter((p): p is Policy => p !== null);

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
              {assignedPolicies.length > 0 ? (
                <div className="space-y-2">
                  {assignedPolicies.map((policy) => (
                    <Link
                      key={policy.id}
                      href={`/family/insurance/${policy.id}`}
                      className="flex items-center justify-between gap-3 p-4 rounded-xl transition-colors"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
                    >
                      <div>
                        <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{policy.label}</div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
                          {policy.provider ?? "—"} · Versicherung hinterlegt
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                    Noch keine Versicherung zugeordnet.
                  </p>
                  <Link
                    href={`/trips/${trip.slug}/documents/insurance`}
                    style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.08em", textDecoration: "none" }}
                  >
                    Versicherung zuordnen →
                  </Link>
                </div>
              )}
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
