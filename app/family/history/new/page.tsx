import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createPastTrip } from "@/lib/actions/past-trips";
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

export default async function NewPastTripPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: family } = await supabase.from("families").select("id").limit(1).single();
  const { data: persons } = await supabase.from("persons").select("id, name").eq("family_id", family?.id ?? "").order("name");

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
          Reise oder Land ergänzen
        </div>
        <h1 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Vergangene Reise erfassen
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.74rem" }}>
          Nur Land/Region und Jahr sind Pflicht — reicht auch, um einfach ein besuchtes Land zu ergänzen.
        </p>

        <form action={createPastTrip} encType="multipart/form-data">
          <input type="hidden" name="family_id" value={family?.id ?? ""} />

          <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && (
              <Banner variant="error">
                {error}
              </Banner>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label htmlFor="pt-country" style={LABEL_STYLE}>Land / Region *</label>
                <input id="pt-country" name="country_or_region" type="text" required placeholder="z. B. Sardinien" style={FIELD_STYLE} />
              </div>
              <div>
                <label htmlFor="pt-year" style={LABEL_STYLE}>Jahr *</label>
                <input id="pt-year" name="year" type="number" required min="1950" max={new Date().getFullYear() + 1} placeholder="z. B. 2024" style={FIELD_STYLE} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label htmlFor="pt-places" style={LABEL_STYLE}>Orte (optional)</label>
                <input id="pt-places" name="places" type="text" placeholder="z. B. Cagliari, Alghero" style={FIELD_STYLE} />
              </div>
              <div>
                <label htmlFor="pt-duration" style={LABEL_STYLE}>Reisedauer in Tagen (optional)</label>
                <input id="pt-duration" name="duration_days" type="number" min="1" style={FIELD_STYLE} />
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
              <textarea id="pt-note" name="note" rows={3} style={{ ...FIELD_STYLE, resize: "none" }} />
            </div>

            <div className="mb-8">
              <label htmlFor="pt-file" style={LABEL_STYLE}>Foto (optional)</label>
              <input
                id="pt-file" name="file" type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ ...FIELD_STYLE, padding: "10px 16px" }}
              />
              <p className="mt-2" style={{ color: "var(--muted)", fontSize: "0.65rem" }}>
                Erlaubt: JPEG, PNG oder WebP, maximal 10 MB.
              </p>
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
                Reise speichern
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
