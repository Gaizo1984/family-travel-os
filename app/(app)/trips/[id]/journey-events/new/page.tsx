import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { createJourneyEvent } from "@/lib/actions/journey-events";
import { getNarrowTripDateRange } from "@/lib/documents";
import { getFamily } from "@/lib/family";
import { loadTripParticipantOptions } from "@/lib/trip-participants";
import { DaySelectField } from "@/components/DaySelectField";
import { TimeSelectField } from "@/components/TimeSelectField";
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

export default async function NewJourneyEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stage_id?: string; date?: string; return_to?: string; error?: string }>;
}) {
  const { id } = await params;
  const { stage_id, date, return_to, error } = await searchParams;

  const lumiCore = await createLumiCoreClient();
  const { data: trip } = await lumiCore
    .from("travel_trips")
    .select("id, slug, title, start_date, end_date")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: stages } = await lumiCore
    .from("travel_stages")
    .select("id, title")
    .eq("trip_id", trip.id)
    .order("sort_order");

  const cancelHref = return_to || `/trips/${trip.slug}`;

  // §"Teilnehmer auch bei Journey-Terminen auswählbar, standardmäßig alle
  // vorausgewählt" (Nutzervorgabe, wörtlich) -- gleiche Quelle/Vorbefüllung
  // wie bei Aktivitätsbuchungen (BookingForm.tsx).
  const { id: familyId } = await getFamily();
  const participants = await loadTripParticipantOptions(lumiCore, trip.id, familyId);

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
          Journey-Termin
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Termin oder Reservierung ergänzen
        </h1>

        <form action={createJourneyEvent} encType="multipart/form-data">
          <input type="hidden" name="trip_id" value={trip.id} />
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
              <input id="je-title" name="title" type="text" required placeholder="z. B. Dinner im Resort" style={FIELD_STYLE} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label htmlFor="je-category" style={LABEL_STYLE}>Kategorie</label>
                <select id="je-category" name="category" defaultValue="restaurant" style={FIELD_STYLE}>
                  {JOURNEY_EVENT_CATEGORY_ORDER.map((key) => (
                    <option key={key} value={key}>{JOURNEY_EVENT_CATEGORIES[key].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="je-status" style={LABEL_STYLE}>Status</label>
                <select id="je-status" name="status" defaultValue="idea" style={FIELD_STYLE}>
                  {JOURNEY_EVENT_STATUS_ORDER.map((key) => (
                    <option key={key} value={key}>{JOURNEY_EVENT_STATUS_LABELS[key]}</option>
                  ))}
                </select>
              </div>
            </div>

            {participants.length > 0 && (
              <div className="mb-5">
                <label style={LABEL_STYLE}>Teilnehmer</label>
                <div className="flex flex-wrap gap-2">
                  {participants.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer"
                      style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                    >
                      <input type="checkbox" name="participant_person_ids" value={p.id} defaultChecked />
                      <span
                        className="inline-flex items-center justify-center rounded-full"
                        style={{ width: "18px", height: "18px", background: p.color, color: "#fff", fontSize: "0.55rem" }}
                      >
                        {p.initials}
                      </span>
                      <span style={{ color: "var(--foreground)", fontSize: "0.78rem" }}>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DaySelectField label="Datum *" namePrefix="date" defaultIso={date ?? null} {...getNarrowTripDateRange(trip.start_date, trip.end_date, date ?? null)} />
              <TimeSelectField id="je-time" label="Uhrzeit (optional)" name="time" />
            </div>

            {(stages ?? []).length > 0 && (
              <div className="mb-5">
                <label htmlFor="je-stage" style={LABEL_STYLE}>Aufenthalt (optional)</label>
                <select id="je-stage" name="stage_id" defaultValue={stage_id ?? ""} style={FIELD_STYLE}>
                  <option value="">Keinem Aufenthalt zugeordnet</option>
                  {(stages ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-5">
              <label htmlFor="je-location" style={LABEL_STYLE}>Ort (optional)</label>
              <input id="je-location" name="location" type="text" placeholder="z. B. Beach Club" style={FIELD_STYLE} />
            </div>

            <div className="mb-8">
              <label htmlFor="je-notes" style={LABEL_STYLE}>Notiz (optional)</label>
              <textarea id="je-notes" name="notes" rows={3} style={{ ...FIELD_STYLE, resize: "none" }} />
            </div>

            {/* §"Journal-Terminen eigenen Dokumenten-Upload geben" (Nutzervorgabe): erst nach dem Speichern möglich (keine ID), wie im Buchungsformular. */}
            <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
              Belege oder Tickets kannst du nach dem Speichern hier hochladen.
            </p>

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
                Termin speichern
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
