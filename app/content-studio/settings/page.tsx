import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateContentStylePreference } from "@/lib/actions/family-content-style";
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

type ContentStylePreference = {
  tone?: string[]; voice_description?: string | null
  hashtag_style?: string; default_visibility?: string; avoid?: string[]
};

export default async function ContentStudioSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: family } = await supabase.from("families").select("id, content_style_preference").limit(1).single();
  const style = (family?.content_style_preference ?? {}) as ContentStylePreference;

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
          Euer Stil
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Content-Einstellungen
        </h1>

        <form action={updateContentStylePreference}>
          <input type="hidden" name="family_id" value={family?.id ?? ""} />
          <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && (
              <Banner variant="error">
                {error}
              </Banner>
            )}

            <div className="mb-5">
              <label htmlFor="cs-tone" style={LABEL_STYLE}>Ton (kommagetrennt)</label>
              <input id="cs-tone" name="tone" type="text" defaultValue={(style.tone ?? []).join(", ")} placeholder="z. B. warmherzig, ehrlich, unaufgeregt" style={FIELD_STYLE} />
            </div>

            <div className="mb-5">
              <label htmlFor="cs-voice" style={LABEL_STYLE}>Stimme / Beschreibung</label>
              <textarea id="cs-voice" name="voice_description" rows={3} defaultValue={style.voice_description ?? ""} style={{ ...FIELD_STYLE, resize: "none" }} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label htmlFor="cs-hashtag" style={LABEL_STYLE}>Hashtag-Stil</label>
                <select id="cs-hashtag" name="hashtag_style" defaultValue={style.hashtag_style ?? "minimal"} style={FIELD_STYLE}>
                  <option value="minimal">Minimal</option>
                  <option value="discovery">Discovery (viele Hashtags)</option>
                  <option value="niche">Nischig</option>
                </select>
              </div>
              <div>
                <label htmlFor="cs-visibility" style={LABEL_STYLE}>Standard-Sichtbarkeit</label>
                <select id="cs-visibility" name="default_visibility" defaultValue={style.default_visibility ?? "private"} style={FIELD_STYLE}>
                  <option value="private">Privat</option>
                  <option value="family">Familie</option>
                  <option value="public">Öffentlich</option>
                </select>
              </div>
            </div>

            <div className="mb-8">
              <label htmlFor="cs-avoid" style={LABEL_STYLE}>Zu vermeiden (kommagetrennt)</label>
              <input id="cs-avoid" name="avoid" type="text" defaultValue={(style.avoid ?? []).join(", ")} placeholder="z. B. Gesichter der Kinder, genaue Standorte in Echtzeit" style={FIELD_STYLE} />
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
                Speichern
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
