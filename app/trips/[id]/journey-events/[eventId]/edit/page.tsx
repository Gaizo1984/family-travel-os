import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateJourneyEvent, deleteJourneyEvent } from "@/lib/actions/journey-events";
import { getTripDateFieldRange } from "@/lib/documents";
import { DateSelectFields } from "@/app/family/DateSelectFields";
import { Banner } from "@/components/Banner";
import {
  JOURNEY_EVENT_CATEGORY_ORDER, JOURNEY_EVENT_CATEGORIES,
  JOURNEY_EVENT_STATUS_ORDER, JOURNEY_EVENT_STATUS_LABELS,
} from "@/lib/journey-events";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

export default async function EditJourneyEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; eventId: string }>;
  searchParams: Promise<{ return_to?: string; error?: string }>;
}) {
  const { id, eventId } = await params;
  const { return_to, error } = await searchParams;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title, start_date, end_date")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: event } = await supabase
    .from("journey_events")
    .select("id, trip_id, stage_id, date, time, category, title, location, notes, status")
    .eq("id", eventId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (!event) notFound();

  const { data: stages } = await supabase
    .from("stages")
    .select("id, title")
    .eq("trip_id", trip.id)
    .order("sort_order");

  const cancelHref = return_to || `/trips/${trip.slug}`;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={cancelHref}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {trip.title}
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Journey-Termin bearbeiten
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {event.title}
        </h1>

        <form action={updateJourneyEvent} encType="multipart/form-data">
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="slug" value={trip.slug} />
          {return_to && <input type="hidden" name="return_to" value={return_to} />}

          <div
            className="rounded-xl p-8"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {error && (
              <Banner variant="error">
                {error}
              </Banner>
            )}

            <div className="mb-5">
              <label htmlFor="je-title" style={LABEL_STYLE}>Titel *</label>
              <input id="je-title" name="title" type="text" required defaultValue={event.title} style={FIELD_STYLE} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label htmlFor="je-category" style={LABEL_STYLE}>Kategorie</label>
                <select id="je-category" name="category" defaultValue={event.category} style={FIELD_STYLE}>
                  {JOURNEY_EVENT_CATEGORY_ORDER.map((key) => (
                    <option key={key} value={key}>{JOURNEY_EVENT_CATEGORIES[key].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="je-status" style={LABEL_STYLE}>Status</label>
                <select id="je-status" name="status" defaultValue={event.status} style={FIELD_STYLE}>
                  {JOURNEY_EVENT_STATUS_ORDER.map((key) => (
                    <option key={key} value={key}>{JOURNEY_EVENT_STATUS_LABELS[key]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DateSelectFields label="Datum *" namePrefix="date" defaultIso={event.date} range={getTripDateFieldRange(trip.start_date, trip.end_date)} />
              <div className="mb-5">
                <label htmlFor="je-time" style={LABEL_STYLE}>Uhrzeit (optional)</label>
                <input id="je-time" name="time" type="time" defaultValue={event.time ?? ""} style={FIELD_STYLE} />
              </div>
            </div>

            {(stages ?? []).length > 0 && (
              <div className="mb-5">
                <label htmlFor="je-stage" style={LABEL_STYLE}>Aufenthalt (optional)</label>
                <select id="je-stage" name="stage_id" defaultValue={event.stage_id ?? ""} style={FIELD_STYLE}>
                  <option value="">Keinem Aufenthalt zugeordnet</option>
                  {(stages ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-5">
              <label htmlFor="je-location" style={LABEL_STYLE}>Ort (optional)</label>
              <input id="je-location" name="location" type="text" defaultValue={event.location ?? ""} style={FIELD_STYLE} />
            </div>

            <div className="mb-8">
              <label htmlFor="je-notes" style={LABEL_STYLE}>Notiz (optional)</label>
              <textarea id="je-notes" name="notes" rows={3} defaultValue={event.notes ?? ""} style={{ ...FIELD_STYLE, resize: "none" }} />
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <Link href={cancelHref} style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
                Abbrechen
              </Link>
              <button
                type="submit"
                style={{
                  background: "var(--foreground)", color: "var(--surface)", border: "none",
                  borderRadius: "6px", padding: "11px 20px", fontSize: "0.65rem",
                  letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer",
                  whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
                }}
              >
                Änderungen speichern
              </button>
            </div>
          </div>
        </form>

        <div
          className="rounded-xl p-6 mt-6 flex items-center justify-between flex-wrap gap-3"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
            Journey-Termin entfernen (keine Buchung, keine weiteren Auswirkungen).
          </p>
          <form action={deleteJourneyEvent}>
            <input type="hidden" name="event_id" value={event.id} />
            <input type="hidden" name="slug" value={trip.slug} />
            {return_to && <input type="hidden" name="return_to" value={return_to} />}
            <button
              type="submit"
              style={{
                background: "transparent", color: "#B5624A", border: "1px solid rgba(181,98,74,0.35)",
                borderRadius: "6px", padding: "9px 18px", fontSize: "0.62rem", letterSpacing: "0.14em",
                textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer",
                WebkitAppearance: "none", appearance: "none",
              }}
            >
              Termin löschen
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
