import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updatePastTrip, deletePastTrip } from "@/lib/actions/past-trips";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

export default async function EditPastTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ pastTripId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { pastTripId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: pastTrip } = await supabase
    .from("past_trips")
    .select("id, family_id, country_or_region, year, places, duration_days, note, photo_storage_path")
    .eq("id", pastTripId)
    .maybeSingle();

  if (!pastTrip) notFound();

  const { data: persons } = await supabase.from("persons").select("id, name").eq("family_id", pastTrip.family_id).order("name");
  const { data: travelers } = await supabase.from("past_trip_travelers").select("person_id").eq("past_trip_id", pastTripId);
  const travelerIds = new Set((travelers ?? []).map((t) => t.person_id));

  let photoUrl: string | null = null;
  if (pastTrip.photo_storage_path) {
    const { data: signed } = await supabase.storage.from("documents").createSignedUrl(pastTrip.photo_storage_path, 3600);
    photoUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/family/history"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Reisegeschichte
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Reise bearbeiten
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {pastTrip.country_or_region}
        </h1>

        <form action={updatePastTrip} encType="multipart/form-data">
          <input type="hidden" name="past_trip_id" value={pastTrip.id} />

          <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && (
              <div
                className="mb-6 px-4 py-3 rounded-lg"
                style={{ background: "rgba(181,98,74,0.12)", border: "1px solid rgba(181,98,74,0.3)", color: "#B5624A", fontSize: "0.75rem", letterSpacing: "0.02em" }}
              >
                {error}
              </div>
            )}

            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={pastTrip.country_or_region} className="rounded-lg w-full mb-5" style={{ maxHeight: 240, objectFit: "cover" }} />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label htmlFor="pt-country" style={LABEL_STYLE}>Land / Region *</label>
                <input id="pt-country" name="country_or_region" type="text" required defaultValue={pastTrip.country_or_region} style={FIELD_STYLE} />
              </div>
              <div>
                <label htmlFor="pt-year" style={LABEL_STYLE}>Jahr *</label>
                <input id="pt-year" name="year" type="number" required min="1950" max={new Date().getFullYear() + 1} defaultValue={pastTrip.year} style={FIELD_STYLE} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label htmlFor="pt-places" style={LABEL_STYLE}>Orte (optional)</label>
                <input id="pt-places" name="places" type="text" defaultValue={pastTrip.places ?? ""} style={FIELD_STYLE} />
              </div>
              <div>
                <label htmlFor="pt-duration" style={LABEL_STYLE}>Reisedauer in Tagen (optional)</label>
                <input id="pt-duration" name="duration_days" type="number" min="1" defaultValue={pastTrip.duration_days ?? ""} style={FIELD_STYLE} />
              </div>
            </div>

            {(persons ?? []).length > 0 && (
              <div className="mb-5">
                <div style={LABEL_STYLE}>Reisende</div>
                <div className="flex flex-wrap gap-3">
                  {(persons ?? []).map((p) => (
                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                      <input
                        type="checkbox" name="traveler_ids" value={p.id}
                        defaultChecked={travelerIds.has(p.id)}
                        style={{ accentColor: "var(--accent)", width: "14px", height: "14px", cursor: "pointer" }}
                      />
                      <span style={{ color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5">
              <label htmlFor="pt-note" style={LABEL_STYLE}>Notiz (optional)</label>
              <textarea id="pt-note" name="note" rows={3} defaultValue={pastTrip.note ?? ""} style={{ ...FIELD_STYLE, resize: "none" }} />
            </div>

            <div className="mb-8">
              <label htmlFor="pt-file" style={LABEL_STYLE}>
                {photoUrl ? "Neues Foto hochladen (ersetzt das vorhandene)" : "Foto (optional)"}
              </label>
              <input
                id="pt-file" name="file" type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ ...FIELD_STYLE, padding: "10px 16px" }}
              />
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <Link href="/family/history" style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
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
            Reise aus der Reisegeschichte entfernen{pastTrip.photo_storage_path ? " — Foto wird mitgelöscht" : ""}.
          </p>
          <form action={deletePastTrip}>
            <input type="hidden" name="past_trip_id" value={pastTrip.id} />
            <input type="hidden" name="photo_storage_path" value={pastTrip.photo_storage_path ?? ""} />
            <button
              type="submit"
              style={{
                background: "transparent", color: "#B5624A", border: "1px solid rgba(181,98,74,0.35)",
                borderRadius: "6px", padding: "9px 18px", fontSize: "0.62rem", letterSpacing: "0.14em",
                textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer",
                WebkitAppearance: "none", appearance: "none",
              }}
            >
              Reise löschen
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
