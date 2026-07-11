import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { analyzePhotos } from "@/lib/actions/photo-analysis-generation";
import { MultiPhotoFilePreview } from "@/components/MultiPhotoFilePreview";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";
import { Banner } from "@/components/Banner";

// §Bilder analysieren macht bei mehreren Fotos 2 KI-Calls (Kategorisierung +
// Inhalte-Generierung) — kann das Standard-Timeout überschreiten.
export const maxDuration = 60;

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

export default async function AnalyzePhotosPage({
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
          Premium
        </div>
        <h1 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Bilder analysieren
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.5 }}>
          Die KI analysiert eure Urlaubsfotos und erstellt automatisch hochwertige Inhalte.
        </p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-8" style={{ color: "var(--muted)", fontSize: "0.66rem", letterSpacing: "0.04em" }}>
          <span>1 Fotos auswählen</span>
          <span style={{ color: "var(--border)" }}>·</span>
          <span>2 KI analysiert</span>
          <span style={{ color: "var(--border)" }}>·</span>
          <span>3 Ergebnisse</span>
        </div>

        <form action={analyzePhotos} encType="multipart/form-data">
          <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && <Banner variant="error">{error}</Banner>}

            <div className="mb-5">
              <label htmlFor="pa-trip" style={LABEL_STYLE}>Reise *</label>
              <select id="pa-trip" name="trip_id" required style={FIELD_STYLE}>
                <option value="">— auswählen —</option>
                {(trips ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            <div className="mb-8">
              <label htmlFor="pa-files" style={LABEL_STYLE}>Fotos</label>
              <MultiPhotoFilePreview inputId="pa-files" inputName="files" fieldStyle={FIELD_STYLE} />
              <p className="mt-2" style={{ color: "var(--muted)", fontSize: "0.65rem" }}>
                Die KI erkennt automatisch bestes Familienfoto, emotionalstes Bild, Landschaft, Drohnenfoto,
                luxuriösestes Bild, Titelbild sowie Story-, Reel- und Album-Motive — und erstellt daraus
                Caption, Hashtags, Hook, Story-Aufbau, Reel-Reihenfolge, Musikvorschläge, Fotobuch-Kapitel und Reisetagebuch.
                Erlaubt: JPEG, PNG, WebP, maximal 10 MB pro Foto.
              </p>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <Link href="/content-studio" style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
                Abbrechen
              </Link>
              <SubmitButtonWithProgress label="Bilder analysieren →" pendingLabel="Bilder werden analysiert …" />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
