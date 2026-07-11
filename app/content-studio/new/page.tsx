import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { generateContentIdeas } from "@/lib/actions/content-idea-generation";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

export default async function NewContentIdeaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: family } = await supabase.from("families").select("id").limit(1).single();
  const { data: trips } = await supabase
    .from("trips")
    .select("id, title")
    .eq("family_id", family?.id ?? "")
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
          Content-Idee erstellen
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Woraus soll Content entstehen?
        </h1>

        <form action={generateContentIdeas} encType="multipart/form-data">
          <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && (
              <div
                className="mb-6 px-4 py-3 rounded-lg"
                style={{ background: "rgba(181,98,74,0.12)", border: "1px solid rgba(181,98,74,0.3)", color: "#B5624A", fontSize: "0.75rem", letterSpacing: "0.02em" }}
              >
                {error}
              </div>
            )}

            <div className="mb-5">
              <label htmlFor="ci-trip" style={LABEL_STYLE}>Reise *</label>
              <select id="ci-trip" name="trip_id" required style={FIELD_STYLE}>
                <option value="">— auswählen —</option>
                {(trips ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            <div className="mb-5">
              <label htmlFor="ci-goal" style={LABEL_STYLE}>Content-Ziel</label>
              <select id="ci-goal" name="content_goal" style={FIELD_STYLE}>
                <option value="">— egal, KI schlägt vor —</option>
                <option value="reel">Reel</option>
                <option value="carousel">Carousel</option>
                <option value="story">Story-Serie</option>
                <option value="caption">Einzelner Feed-Post</option>
              </select>
            </div>

            <div className="mb-5">
              <label htmlFor="ci-context" style={LABEL_STYLE}>Kurzer Kontext (optional)</label>
              <textarea
                id="ci-context" name="context_text" rows={3}
                placeholder="z. B. Wir waren gerade im Wüstencamp, die Kinder fanden die Sternennacht am besten"
                style={{ ...FIELD_STYLE, resize: "none" }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label htmlFor="ci-language" style={LABEL_STYLE}>Sprache</label>
                <select id="ci-language" name="content_language" defaultValue="de" style={FIELD_STYLE}>
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label htmlFor="ci-style" style={LABEL_STYLE}>Stil</label>
                <select id="ci-style" name="content_style" defaultValue="" style={FIELD_STYLE}>
                  <option value="">— egal, KI wählt passend —</option>
                  <option value="luxury">Luxury</option>
                  <option value="family">Family</option>
                  <option value="adventure">Adventure</option>
                  <option value="emotional">Emotional</option>
                </select>
              </div>
            </div>

            <div className="mb-8">
              <label htmlFor="ci-files" style={LABEL_STYLE}>Fotos (optional, 5–20 empfohlen)</label>
              <input
                id="ci-files" name="files" type="file" multiple
                accept="image/jpeg,image/png,image/webp"
                style={{ ...FIELD_STYLE, padding: "10px 16px" }}
              />
              <p className="mt-2" style={{ color: "var(--muted)", fontSize: "0.65rem" }}>
                Die KI erkennt Dubletten automatisch, bewertet die Bildqualität und wählt die besten Motive aus.
                Erlaubt: JPEG, PNG, WebP, maximal 10 MB pro Foto.
              </p>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <Link href="/content-studio" style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
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
                Ideen entwickeln →
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
