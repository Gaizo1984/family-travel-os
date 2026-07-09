import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  DOCUMENT_TYPE_CONFIG, DOCUMENT_VALIDITY_LABELS, DOCUMENT_VALIDITY_COLORS,
  getDocumentValidity, formatExpiresAt,
} from "@/lib/documents";
import type { DocumentType, DocumentDetails } from "@/lib/documents";
import { assignDocumentToTrip, unassignDocumentFromTrip } from "@/lib/actions/documents";

type DocumentDetail = {
  id: string;
  doc_type: DocumentType;
  label: string;
  expires_at: string | null;
  notes: string | null;
  details: DocumentDetails | null;
  storage_path: string;
};

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px" }}>
        {label}
      </div>
      <div className="text-sm font-light" style={{ color: "var(--foreground)" }}>{value}</div>
    </div>
  );
}

export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string; documentId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { personId, documentId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: person } = await supabase
    .from("persons")
    .select("id, name, family_id")
    .eq("id", personId)
    .maybeSingle();

  if (!person) notFound();

  const { data: document } = await supabase
    .from("documents")
    .select("id, doc_type, label, expires_at, notes, details, storage_path")
    .eq("id", documentId)
    .eq("person_id", person.id)
    .maybeSingle();

  if (!document) notFound();
  const doc = document as unknown as DocumentDetail;
  const config = DOCUMENT_TYPE_CONFIG[doc.doc_type];
  const Icon = config.icon;
  const details = doc.details ?? {};

  const { data: signedUrlData } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 3600);

  const isImage = /\.(jpe?g|png|webp)$/i.test(doc.storage_path);
  const validity = getDocumentValidity(doc);

  const isInsurance = doc.doc_type === "insurance";

  const { data: assignedTripsRaw } = isInsurance
    ? { data: [] }
    : await supabase
        .from("document_trips")
        .select("trip_id, trips ( id, slug, title )")
        .eq("document_id", doc.id);

  const assignedTrips = (assignedTripsRaw ?? [])
    .map((r) => r.trips as unknown as { id: string; slug: string; title: string } | null)
    .filter((t): t is { id: string; slug: string; title: string } => t !== null);

  const assignedTripIds = new Set(assignedTrips.map((t) => t.id));

  const { data: allTrips } = isInsurance
    ? { data: [] }
    : await supabase.from("trips").select("id, title").order("start_date", { ascending: false });

  const availableTrips = (allTrips ?? []).filter((t) => !assignedTripIds.has(t.id));

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/family/${person.id}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {person.name}
        </Link>

        {error && (
          <div
            className="mb-6 px-4 py-3 rounded-lg"
            style={{ background: "rgba(181,98,74,0.12)", border: "1px solid rgba(181,98,74,0.3)", color: "#B5624A", fontSize: "0.75rem", letterSpacing: "0.02em" }}
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
                {config.label}
              </span>
              {validity && (
                <span style={{ color: DOCUMENT_VALIDITY_COLORS[validity], fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  · {DOCUMENT_VALIDITY_LABELS[validity]}
                </span>
              )}
              {details.source === "extracted" && (
                <span style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  · 🤖 Automatisch ausgelesen
                </span>
              )}
            </div>
            <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.5rem", letterSpacing: "0.01em" }}>
              {doc.label}
            </h1>
          </div>
          <Link
            href={`/family/${person.id}/documents/${doc.id}/edit`}
            style={{
              fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent)",
              border: "1px solid rgba(184,154,94,0.3)", padding: "8px 16px", borderRadius: "20px", textDecoration: "none",
            }}
          >
            Bearbeiten
          </Link>
        </div>

        <div
          className="rounded-xl p-6 mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {config.isIdentityType && (
              <>
                <MetaItem label="Vorname" value={details.first_name ?? "—"} />
                <MetaItem label="Nachname" value={details.last_name ?? "—"} />
                <MetaItem label="Geburtsdatum" value={formatExpiresAt(details.birth_date ?? null)} />
                <MetaItem label="Geschlecht" value={details.gender ?? "—"} />
                <MetaItem label="Nationalität" value={details.nationality ?? "—"} />
                <MetaItem label="Geburtsort" value={details.birth_place ?? "—"} />
                <MetaItem label={config.numberLabel} value={details.passport_number ?? "—"} />
                <MetaItem label="Ausstellungsland" value={details.issuing_country ?? "—"} />
                <MetaItem label="Ausstellungsdatum" value={formatExpiresAt(details.issue_date ?? null)} />
              </>
            )}
            {config.isEntryDocumentType && (
              <>
                <MetaItem label="Land / Zielgebiet" value={details.issuing_country ?? "—"} />
                <MetaItem label={config.numberLabel} value={details.passport_number ?? "—"} />
                <MetaItem label="Referenzierte Passnummer" value={details.related_passport_number ?? "—"} />
                <MetaItem label="Gültig ab" value={formatExpiresAt(details.valid_from ?? null)} />
                <MetaItem label="Genehmigungsdatum" value={formatExpiresAt(details.issue_date ?? null)} />
              </>
            )}
            <MetaItem label="Ablaufdatum" value={formatExpiresAt(doc.expires_at)} />
          </div>
        </div>

        {doc.notes && (
          <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
              Notizen
            </div>
            <p className="leading-relaxed" style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              {doc.notes}
            </p>
          </div>
        )}

        <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
            Hinterlegte Datei
          </div>
          {signedUrlData?.signedUrl ? (
            isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedUrlData.signedUrl}
                alt={doc.label}
                className="rounded-lg w-full"
                style={{ maxHeight: 480, objectFit: "contain", background: "var(--background)" }}
              />
            ) : (
              <a
                href={signedUrlData.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent)", fontSize: "0.8rem", textDecoration: "none" }}
              >
                PDF öffnen →
              </a>
            )
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Datei konnte nicht geladen werden.
            </p>
          )}
        </div>

        {!isInsurance && (
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
              Zugeordnete Reisen
            </div>

            {assignedTrips.length > 0 ? (
              <div className="space-y-2 mb-5">
                {assignedTrips.map((trip) => (
                  <div
                    key={trip.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg"
                    style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                  >
                    <Link
                      href={`/trips/${trip.slug}`}
                      className="min-w-0 truncate"
                      style={{ color: "var(--foreground)", fontSize: "0.82rem", textDecoration: "none" }}
                    >
                      {trip.title}
                    </Link>
                    <form action={unassignDocumentFromTrip}>
                      <input type="hidden" name="document_id" value={doc.id} />
                      <input type="hidden" name="person_id" value={person.id} />
                      <input type="hidden" name="trip_id" value={trip.id} />
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
            ) : (
              <p className="mb-5" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                Noch keiner Reise zugeordnet.
              </p>
            )}

            {availableTrips.length > 0 && (
              <form action={assignDocumentToTrip} className="flex items-center gap-2 flex-wrap" style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
                <input type="hidden" name="document_id" value={doc.id} />
                <input type="hidden" name="person_id" value={person.id} />
                <select
                  name="trip_id"
                  required
                  style={{
                    flex: "1 1 200px", padding: "10px 14px", background: "var(--background)",
                    border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
                    fontSize: "0.82rem", outline: "none",
                  }}
                >
                  <option value="">Reise wählen…</option>
                  {availableTrips.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  style={{
                    fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)",
                    background: "transparent", border: "1px solid rgba(184,154,94,0.3)", padding: "10px 16px",
                    borderRadius: "8px", cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  Zuordnen
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
