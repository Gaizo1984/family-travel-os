import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText, Trash2, Check, Ticket, Luggage } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_TYPE_CONFIG, BOOKING_STATUS_LABELS, PAYMENT_STATUS_LABELS, formatDateTimeDE } from "@/lib/bookings";
import { uploadBookingDocument, deleteBookingDocument, uploadBoardingPass, uploadBaggageTag } from "@/lib/actions/documents";
import { toggleBookingCancelled } from "@/lib/actions/bookings";
import { sortForBoardingPassViewer } from "@/lib/boarding-passes";
import type { BookingType, BookingStatus, PaymentStatus } from "@/lib/supabase/types";
import { Banner } from "@/components/Banner";
import { formatCurrencyDE } from "@/lib/demo-data";
import { getCachedSignedUrl } from "@/lib/signed-storage-url";

type BookingDetail = {
  id: string;
  trip_id: string;
  stage_id: string | null;
  type: BookingType;
  title: string;
  provider: string | null;
  booking_reference: string | null;
  status: BookingStatus;
  payment_status: PaymentStatus;
  amount: number | null;
  currency: string;
  start_datetime: string | null;
  end_datetime: string | null;
  notes: string | null;
  details: Record<string, string> | null;
  stages: { id: string; title: string } | null;
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

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; bookingId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, bookingId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title, trip_members ( persons ( id, name, initials ) )")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: booking } = await supabase
    .from("bookings")
    .select(`
      id, trip_id, stage_id, type, title, provider, booking_reference, status,
      payment_status, amount, currency, start_datetime, end_datetime, notes, details,
      stages ( id, title )
    `)
    .eq("id", bookingId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (!booking) notFound();
  const b = booking as unknown as BookingDetail;
  const config = BOOKING_TYPE_CONFIG[b.type];
  const Icon = config.icon;

  const { data: docsRaw } = await supabase
    .from("documents")
    .select("id, label, storage_path, doc_type, person_id")
    .eq("booking_id", b.id);

  const withSignedUrl = async (d: { id: string; label: string | null; storage_path: string; person_id: string | null }) => {
    const url = await getCachedSignedUrl("documents", d.storage_path);
    return { id: d.id, label: d.label ?? "Dokument", storage_path: d.storage_path, person_id: d.person_id, url };
  };

  const documents = await Promise.all((docsRaw ?? []).filter((d) => d.doc_type === "booking_document").map(withSignedUrl));
  const boardingPassDocs = await Promise.all((docsRaw ?? []).filter((d) => d.doc_type === "boarding_pass").map(withSignedUrl));
  const baggageTagDocs = await Promise.all((docsRaw ?? []).filter((d) => d.doc_type === "baggage_tag").map(withSignedUrl));

  const members = sortForBoardingPassViewer(
    (trip.trip_members as unknown as Array<{ persons: { id: string; name: string; initials: string } | null }>)
      .flatMap((tm) => (tm.persons ? [tm.persons] : []))
  );
  const boardingPassByPerson = new Map(boardingPassDocs.map((d) => [d.person_id, d]));

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

        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
              <span style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
                {config.label}
              </span>
            </div>
            <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.5rem", letterSpacing: "0.01em" }}>
              {b.title}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!config.visibleFields.status && (
              <form action={toggleBookingCancelled}>
                <input type="hidden" name="booking_id" value={b.id} />
                <input type="hidden" name="slug" value={trip.slug} />
                <input type="hidden" name="currently_cancelled" value={String(b.status === "cancelled")} />
                <button
                  type="submit"
                  style={{
                    fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase",
                    color: b.status === "cancelled" ? "var(--accent)" : "#B5624A",
                    border: b.status === "cancelled" ? "1px solid rgba(184,154,94,0.3)" : "1px solid rgba(181,98,74,0.35)",
                    padding: "8px 16px", borderRadius: "20px", background: "transparent", cursor: "pointer",
                  }}
                >
                  {b.status === "cancelled" ? "Stornierung aufheben" : "Als storniert markieren"}
                </button>
              </form>
            )}
            <Link
              href={`/trips/${trip.slug}/bookings/${b.id}/edit`}
              style={{
                fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent)",
                border: "1px solid rgba(184,154,94,0.3)", padding: "8px 16px", borderRadius: "20px", textDecoration: "none",
              }}
            >
              Bearbeiten
            </Link>
          </div>
        </div>

        <div
          className="rounded-xl p-6 mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
            <MetaItem label={config.startLabel} value={formatDateTimeDE(b.start_datetime)} />
            {config.showEnd && <MetaItem label={config.endLabel} value={formatDateTimeDE(b.end_datetime)} />}
            {config.providerLabel && <MetaItem label={config.providerLabel} value={b.provider ?? "—"} />}
            {/* §Punkt 8 "Kein sichtbarer Status": bei Flug/Hotel/Mietwagen bleibt der
                Status jetzt auch auf der Detailseite unsichtbar, nicht nur im Formular. */}
            {config.visibleFields.status && <MetaItem label="Buchungsstatus" value={BOOKING_STATUS_LABELS[b.status]} />}
            {config.visibleFields.paymentStatus && <MetaItem label="Zahlungsstatus" value={PAYMENT_STATUS_LABELS[b.payment_status]} />}
            <MetaItem label="Preis" value={b.amount !== null ? formatCurrencyDE(b.amount, b.currency) : "—"} />
            <MetaItem label="Buchungsnummer" value={b.booking_reference ?? "—"} />
            {b.stages && <MetaItem label="Etappe" value={b.stages.title} />}
          </div>

          {config.detailFields.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6" style={{ borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
              {config.detailFields.map((field) => (
                <MetaItem key={field.key} label={field.label} value={b.details?.[field.key] ?? "—"} />
              ))}
            </div>
          )}
        </div>

        {b.notes && (
          <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
              Notizen
            </div>
            <p className="leading-relaxed" style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              {b.notes}
            </p>
          </div>
        )}

        {b.type === "flight" && (
          <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                Boardingpässe
              </div>
              {boardingPassDocs.length > 0 && (
                <Link
                  href={`/trips/${trip.slug}/bookings/${b.id}/boarding-passes`}
                  style={{
                    fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)",
                    border: "1px solid rgba(184,154,94,0.3)", padding: "7px 14px", borderRadius: "20px", textDecoration: "none",
                  }}
                >
                  Alle Boardingpässe anzeigen
                </Link>
              )}
            </div>

            <div className="mb-4">
              {members.map((person) => {
                const doc = boardingPassByPerson.get(person.id);
                return (
                  <div key={person.id} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "var(--accent-subtle)", color: "var(--accent)", fontSize: "0.6rem", letterSpacing: "0.03em" }}
                    >
                      {person.initials}
                    </div>
                    <span className="flex-1 min-w-0" style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>{person.name}</span>
                    {doc ? (
                      <>
                        <span className="flex items-center gap-1" style={{ color: "#4C7A5D", fontSize: "0.7rem" }}>
                          <Check size={13} strokeWidth={1.8} /> Hinterlegt
                        </span>
                        <form action={deleteBookingDocument}>
                          <input type="hidden" name="document_id" value={doc.id} />
                          <input type="hidden" name="storage_path" value={doc.storage_path} />
                          <input type="hidden" name="slug" value={trip.slug} />
                          <input type="hidden" name="booking_id" value={b.id} />
                          <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex" }} aria-label="Boardingpass löschen">
                            <Trash2 size={13} strokeWidth={1.4} />
                          </button>
                        </form>
                      </>
                    ) : (
                      <span style={{ color: "#B5624A", fontSize: "0.7rem" }}>Fehlt</span>
                    )}
                  </div>
                );
              })}
            </div>

            <form action={uploadBoardingPass} encType="multipart/form-data" className="flex items-end gap-3 flex-wrap">
              <input type="hidden" name="trip_id" value={trip.id} />
              <input type="hidden" name="booking_id" value={b.id} />
              <input type="hidden" name="slug" value={trip.slug} />
              <div className="min-w-[140px]">
                <label htmlFor="bp-person" style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                  Person
                </label>
                <select
                  id="bp-person" name="person_id" required
                  style={{ width: "100%", padding: "9px 12px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300, outline: "none" }}
                >
                  {members.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <label htmlFor="bp-file" style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                  Datei
                </label>
                <input id="bp-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required style={{ width: "100%", fontSize: "0.75rem", color: "var(--muted)" }} />
              </div>
              <button
                type="submit"
                style={{ background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px", padding: "10px 18px", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                <Ticket size={12} strokeWidth={1.6} style={{ display: "inline", marginRight: "6px", verticalAlign: "-2px" }} />
                Hinzufügen
              </button>
            </form>
          </div>
        )}

        {b.type === "flight" && (
          <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                Gepäckbelege
              </div>
              {baggageTagDocs.length > 0 && (
                <Link
                  href={`/trips/${trip.slug}/bookings/${b.id}/baggage-tags`}
                  style={{
                    fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)",
                    border: "1px solid rgba(184,154,94,0.3)", padding: "7px 14px", borderRadius: "20px", textDecoration: "none",
                  }}
                >
                  Alle Gepäckbelege anzeigen
                </Link>
              )}
            </div>

            {baggageTagDocs.length > 0 ? (
              <div className="mb-4">
                {baggageTagDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                    <Luggage size={13} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    {doc.url ? (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate" style={{ color: "var(--foreground)", fontSize: "0.82rem", textDecoration: "none" }}>
                        {doc.label}
                      </a>
                    ) : (
                      <span className="flex-1 min-w-0 truncate" style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>{doc.label}</span>
                    )}
                    <form action={deleteBookingDocument}>
                      <input type="hidden" name="document_id" value={doc.id} />
                      <input type="hidden" name="storage_path" value={doc.storage_path} />
                      <input type="hidden" name="slug" value={trip.slug} />
                      <input type="hidden" name="booking_id" value={b.id} />
                      <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex" }} aria-label="Gepäckbeleg löschen">
                        <Trash2 size={13} strokeWidth={1.4} />
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                Noch keine Gepäckbelege hinterlegt.
              </p>
            )}

            <form action={uploadBaggageTag} encType="multipart/form-data" className="flex items-end gap-3 flex-wrap">
              <input type="hidden" name="trip_id" value={trip.id} />
              <input type="hidden" name="booking_id" value={b.id} />
              <input type="hidden" name="slug" value={trip.slug} />
              <div className="min-w-[140px]">
                <label htmlFor="bt-person" style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                  Person
                </label>
                <select
                  id="bt-person" name="person_id" required
                  style={{ width: "100%", padding: "9px 12px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300, outline: "none" }}
                >
                  {members.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="min-w-[140px]">
                <label htmlFor="bt-label" style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                  Gepäckstück
                </label>
                <input
                  id="bt-label" name="bag_label" type="text" placeholder="z. B. Koffer 1"
                  style={{ width: "100%", padding: "9px 12px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300, outline: "none" }}
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label htmlFor="bt-file" style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                  Datei
                </label>
                <input id="bt-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required style={{ width: "100%", fontSize: "0.75rem", color: "var(--muted)" }} />
              </div>
              <button
                type="submit"
                style={{ background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px", padding: "10px 18px", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Hinzufügen
              </button>
            </form>
          </div>
        )}

        <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
            Dokumente
          </div>

          {error && (
            <Banner variant="error" className="mb-4 px-4 py-3 rounded-lg">
              {error}
            </Banner>
          )}

          {documents.length > 0 ? (
            <div className="mb-4">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <FileText size={13} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0 }} />
                  {doc.url ? (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate" style={{ color: "var(--foreground)", fontSize: "0.82rem", textDecoration: "none" }}>
                      {doc.label}
                    </a>
                  ) : (
                    <span className="flex-1 min-w-0 truncate" style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>{doc.label}</span>
                  )}
                  <form action={deleteBookingDocument}>
                    <input type="hidden" name="document_id" value={doc.id} />
                    <input type="hidden" name="storage_path" value={doc.storage_path} />
                    <input type="hidden" name="slug" value={trip.slug} />
                    <input type="hidden" name="booking_id" value={b.id} />
                    <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex" }} aria-label="Dokument löschen">
                      <Trash2 size={13} strokeWidth={1.4} />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Noch keine Unterlagen zu dieser Buchung.
            </p>
          )}

          <form action={uploadBookingDocument} encType="multipart/form-data" className="flex items-end gap-3 flex-wrap">
            <input type="hidden" name="trip_id" value={trip.id} />
            <input type="hidden" name="booking_id" value={b.id} />
            <input type="hidden" name="slug" value={trip.slug} />
            <div className="flex-1 min-w-[160px]">
              <label htmlFor="doc-label" style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                Bezeichnung
              </label>
              <input
                id="doc-label" name="label" type="text" required placeholder="z. B. Flugticket"
                style={{ width: "100%", padding: "9px 12px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300, outline: "none" }}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label htmlFor="doc-file" style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                Datei
              </label>
              <input id="doc-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required style={{ width: "100%", fontSize: "0.75rem", color: "var(--muted)" }} />
            </div>
            <button
              type="submit"
              style={{ background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px", padding: "10px 18px", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Hinzufügen
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
