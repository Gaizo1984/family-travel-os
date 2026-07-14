import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { startContentSession } from "@/lib/actions/content-sessions";
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
 * §"Content Studio 2.0": Einstieg für eine neue Content-Session -- bewusst
 * NUR Reise (+ optional Datum) hier, Bilder/Content-Art/Sprache/Tonalität
 * folgen erst danach auf der Session-Seite (Ablauf: Reise -> Bilder ->
 * Content-Art -> Tonalität -> Content erstellen).
 */
export default async function NewContentSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { id: familyId } = await getFamily();
  const { data: trips } = await supabase
    .from("trips")
    .select("id, title")
    .eq("family_id", familyId)
    .in("status", ["planned", "active", "completed"])
    .order("start_date", { ascending: false });

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
          Neue Content-Session
        </div>
        <h1 className="font-light mb-4" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Welche Reise?
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.6 }}>
          Die Bilder im nächsten Schritt dienen nur zur Content-Erstellung und werden automatisch nach
          24 Stunden gelöscht -- nicht dauerhaft als Reisealbum gespeichert.
        </p>

        <form action={startContentSession}>
          <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && <Banner variant="error">{error}</Banner>}

            <div className="mb-5">
              <label htmlFor="cs-trip" style={LABEL_STYLE}>Reise *</label>
              <select id="cs-trip" name="trip_id" required style={FIELD_STYLE}>
                <option value="">— auswählen —</option>
                {(trips ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            <div className="mb-8">
              <label htmlFor="cs-date" style={LABEL_STYLE}>Reisetag (optional)</label>
              <input id="cs-date" name="content_date" type="date" style={FIELD_STYLE} />
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
                Weiter zum Bild-Upload →
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
