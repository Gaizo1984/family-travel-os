import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { LUMI_CORE_DOCUMENTS_BUCKET } from "@/lib/lumi-core-storage/paths";
import { getHouseholdMemberById } from "@/lib/household-members";
import { getFamily } from "@/lib/family";
import {
  DOCUMENT_TYPE_CONFIG, DOCUMENT_VALIDITY_LABELS, DOCUMENT_VALIDITY_COLORS,
  getDocumentValidity, formatExpiresAt,
} from "@/lib/documents";
import type { DocumentType, DocumentDetails } from "@/lib/documents";
import { assignDocumentToTrip, unassignDocumentFromTrip } from "@/lib/actions/documents";
import { Banner } from "@/components/Banner";
import { getCachedSignedUrl } from "@/lib/signed-storage-url";
import { OfflineDocumentViewer } from "@/components/OfflineDocumentViewer";

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

  const lumiCore = await createLumiCoreClient();
  // §ID-Space: /family/[personId] ist die echte household_member_id.
  const householdMemberId = personId;

  const member = await getHouseholdMemberById(householdMemberId);
  if (!member) notFound();
  const person = { id: personId, name: member.name };

  const { data: document } = await lumiCore
    .from("travel_documents")
    .select("id, doc_type, label, expires_at, notes, details, storage_path")
    .eq("id", documentId)
    .eq("household_member_id", householdMemberId)
    .maybeSingle();

  if (!document || !document.storage_path) notFound();
  const doc = document as unknown as DocumentDetail;
  const config = DOCUMENT_TYPE_CONFIG[doc.doc_type];
  const Icon = config.icon;
  const details = doc.details ?? {};

  const signedDocUrl = await getCachedSignedUrl(LUMI_CORE_DOCUMENTS_BUCKET, doc.storage_path);

  const isImage = /\.(jpe?g|png|webp)$/i.test(doc.storage_path);
  const isPdf = doc.storage_path.toLowerCase().endsWith(".pdf");
  const validity = getDocumentValidity(doc);
  // §"nur ESTA/ETA, sonst keine Offline-Funktion" (Nutzervorgabe, Frag-LUMI-Offline-Sprint):
  // Reisepass/Personalausweis/Visum/Einreiseerlaubnis bleiben bewusst reine Online-Anzeige.
  const isOfflineEligible = doc.doc_type === "esta" || doc.doc_type === "eta";

  const isInsurance = doc.doc_type === "insurance";

  // §Lumi-Core-Cutover: keine PostgREST-Embeddings zwischen travel_*-Tabellen --
  // flache Parallelabfrage (travel_document_trips -> travel_trips) statt
  // verschachtelter Selects, exakt wie lib/travel-world.ts::fetchTravelWorldRawData.
  const { id: familyId } = await getFamily();
  const [{ data: assignedTripLinks }, { data: allTripsRaw }] = isInsurance
    ? [{ data: [] }, { data: [] }]
    : await Promise.all([
        lumiCore.from("travel_document_trips").select("trip_id").eq("document_id", doc.id),
        lumiCore.from("travel_trips").select("id, slug, title").eq("household_id", familyId).order("start_date", { ascending: false }),
      ]);

  const allTripsById = new Map((allTripsRaw ?? []).map((t) => [t.id, t]));
  const assignedTrips = (assignedTripLinks ?? [])
    .map((r) => allTripsById.get(r.trip_id) ?? null)
    .filter((t): t is { id: string; slug: string; title: string } => t !== null);

  const assignedTripIds = new Set(assignedTrips.map((t) => t.id));

  const availableTrips = (allTripsRaw ?? []).filter((t) => !assignedTripIds.has(t.id));

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
          <Banner variant="error">
            {error}
          </Banner>
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
            {doc.doc_type === "esta" && (
              <>
                <MetaItem label="Vorname" value={details.first_name ?? "—"} />
                <MetaItem label="Nachname" value={details.last_name ?? "—"} />
                <MetaItem label="Geburtsdatum" value={formatExpiresAt(details.birth_date ?? null)} />
                <MetaItem label="Zielland" value={details.issuing_country ?? "—"} />
                <MetaItem label="Application Number" value={details.passport_number ?? "—"} />
                <MetaItem label="Passnummer" value={details.related_passport_number ?? "—"} />
              </>
            )}
            {config.isEntryDocumentType && doc.doc_type !== "esta" && (
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
          {isOfflineEligible ? (
            <div className="rounded-lg p-6 flex justify-center" style={{ background: "#1a1714" }}>
              <OfflineDocumentViewer
                documentId={doc.id}
                sourceUrl={signedDocUrl}
                fileName={`${doc.doc_type}-${doc.label}${isPdf ? ".pdf" : ""}`}
                mimeType={isPdf ? "application/pdf" : "image/jpeg"}
                isPdf={isPdf}
                referenceDateIso={doc.expires_at ?? new Date().toISOString()}
                altText={doc.label}
                policy="sensitive"
                tripId={assignedTrips[0]?.id ?? null}
                docType={doc.doc_type as "esta" | "eta"}
                label={doc.label}
              />
            </div>
          ) : signedDocUrl ? (
            isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedDocUrl}
                alt={doc.label}
                className="rounded-lg w-full"
                style={{ maxHeight: 480, objectFit: "contain", background: "var(--background)" }}
              />
            ) : (
              <a
                href={signedDocUrl}
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
