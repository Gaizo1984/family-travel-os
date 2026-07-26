import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { startImageCheckProject } from "@/lib/actions/image-check";
import { isTripCurrentlyRunning, isTripPastEnd } from "@/lib/trip-status";
import { deriveTripDateRange } from "@/lib/trip-dates";
import { Banner } from "@/components/Banner";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

/**
 * §"Bild-Check": Einstieg -- bewusst nur Reise hier (Muster wie
 * content-studio/session/new), Foto-Upload und Analyse folgen erst auf der
 * Projektseite.
 */
export default async function NewImageCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { id: familyId } = await getFamily();
  const { data: tripsRaw } = await supabase
    .from("trips")
    .select(`
      id, title, start_date, end_date,
      stages ( start_date, end_date ),
      bookings ( type, status, start_datetime, end_datetime )
    `)
    .eq("family_id", familyId)
    .in("status", ["planned", "active", "completed"])
    .order("start_date", { ascending: false });

  const trips = tripsRaw ?? [];
  const todayIso = new Date().toISOString().slice(0, 10);
  const tripsWithRange = trips.map((t) => {
    const range = deriveTripDateRange(t, t.bookings, t.stages);
    return { id: t.id, start_date: range.startDate, end_date: range.endDate };
  });
  const defaultTrip =
    tripsWithRange.find((t) => isTripCurrentlyRunning({ status: "", start_date: t.start_date, end_date: t.end_date }, todayIso))
    ?? tripsWithRange
      .filter((t) => !isTripPastEnd({ status: "", start_date: t.start_date, end_date: t.end_date }, todayIso))
      .sort((a, b) => (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999"))[0]
    ?? null;
  const defaultTripId = defaultTrip?.id ?? "";

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/content-studio"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Content Studio
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Bild-Check
        </div>
        <h1 className="font-light mb-4" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Welche Reise?
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.6 }}>
          Bis zu 5 Fotos hochladen -- LUMI bewertet sie einzeln und im Vergleich zueinander. Die Bilder werden nur zur
          Analyse verwendet und automatisch nach 24 Stunden gelöscht -- nicht dauerhaft gespeichert.
        </p>

        <form action={startImageCheckProject}>
          <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && <Banner variant="error">{error}</Banner>}

            <div className="mb-8">
              <label htmlFor="ic-trip" style={LABEL_STYLE}>Reise *</label>
              <select id="ic-trip" name="trip_id" required defaultValue={defaultTripId} style={FIELD_STYLE}>
                <option value="">— auswählen —</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <Link href="/content-studio" style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
                Abbrechen
              </Link>
              <button
                type="submit"
                style={{
                  background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px",
                  padding: "11px 20px", fontSize: "0.65rem", letterSpacing: "0.16em", textTransform: "uppercase",
                  cursor: "pointer", whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
                }}
              >
                Weiter zum Foto-Upload →
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
