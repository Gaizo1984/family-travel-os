import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateContentDraft } from "@/lib/actions/content-ideas";
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

type ReelStructure = { scenes: { text: string }[]; outro?: string; hashtags?: string[] };
type CarouselStructure = { slides: { text: string }[]; hashtags?: string[] };
type CaptionStructure = { text: string; hashtags?: string[] };
type HotelContentStructure = {
  text: string; hashtags?: string[]
  family_perspective?: string; design_atmosphere?: string; food?: string; pool_or_beach?: string; factual_rating?: string
};

const DRAFT_TYPE_LABELS: Record<string, string> = {
  reel_plan: "Reel-Plan", carousel_plan: "Carousel-Plan", story_plan: "Story-Plan", caption: "Caption",
  journal_review: "Reisejournal", day_recap: "Tagesrückblick", highlight: "Ausflug/Highlight", hotel_content: "Hotel-Content",
};

export default async function ContentDraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ draftId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { draftId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: draft } = await supabase
    .from("content_drafts")
    .select("id, project_id, draft_type, structure, visibility, scheduled_at, notes, instagram_ready, content_projects(project_type)")
    .eq("id", draftId)
    .maybeSingle();

  if (!draft) notFound();

  // §Content-Session-Entwürfe führen zurück auf die reichhaltigere
  // Session-Seite (Fotos/Ablauf/Als-Erinnerung-behalten) statt auf die
  // generische Projekt-Übersicht der älteren Ideen-/Analyse-Flows.
  const isSessionDraft = (draft.content_projects as unknown as { project_type: string } | null)?.project_type === "session";
  const backHref = isSessionDraft ? `/content-studio/session/${draft.project_id}` : `/content-studio/projects/${draft.project_id}`;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={backHref}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Projekt
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          {DRAFT_TYPE_LABELS[draft.draft_type] ?? draft.draft_type}
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {draft.notes ?? "Content bearbeiten"}
        </h1>

        <form action={updateContentDraft}>
          <input type="hidden" name="draft_id" value={draft.id} />
          <input type="hidden" name="draft_type" value={draft.draft_type} />

          <div className="rounded-xl p-8 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && (
              <Banner variant="error">
                {error}
              </Banner>
            )}

            {draft.draft_type === "reel_plan" && (
              <>
                <label style={LABEL_STYLE}>Szenen</label>
                {((draft.structure as ReelStructure).scenes?.length ? (draft.structure as ReelStructure).scenes : [{ text: "" }]).map((s, i) => (
                  <input key={i} name="scene_text" type="text" defaultValue={s.text} placeholder={`Szene ${i + 1}`} style={{ ...FIELD_STYLE, marginBottom: "10px" }} />
                ))}
                <label htmlFor="draft-outro" style={LABEL_STYLE}>Outro</label>
                <input id="draft-outro" name="outro" type="text" defaultValue={(draft.structure as ReelStructure).outro ?? ""} style={{ ...FIELD_STYLE, marginBottom: "16px" }} />
              </>
            )}

            {(draft.draft_type === "carousel_plan" || draft.draft_type === "story_plan") && (
              <>
                <label style={LABEL_STYLE}>Slides</label>
                {(draft.structure as CarouselStructure).slides?.map((s, i) => (
                  <input key={i} name="slide_text" type="text" defaultValue={s.text} style={{ ...FIELD_STYLE, marginBottom: "10px" }} />
                ))}
              </>
            )}

            {(draft.draft_type === "caption" || draft.draft_type === "journal_review" || draft.draft_type === "day_recap" || draft.draft_type === "highlight" || draft.draft_type === "hotel_content") && (
              <>
                <label htmlFor="draft-caption" style={LABEL_STYLE}>Text</label>
                <textarea
                  id="draft-caption" name="caption_text" rows={6}
                  defaultValue={(draft.structure as CaptionStructure).text ?? ""}
                  style={{ ...FIELD_STYLE, resize: "none", marginBottom: "16px" }}
                />
              </>
            )}

            {draft.draft_type === "hotel_content" && (
              <div className="mb-6 space-y-1.5" style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>
                <p><strong style={{ color: "var(--foreground)", fontWeight: 400 }}>Familienperspektive:</strong> {(draft.structure as HotelContentStructure).family_perspective}</p>
                <p><strong style={{ color: "var(--foreground)", fontWeight: 400 }}>Design &amp; Atmosphäre:</strong> {(draft.structure as HotelContentStructure).design_atmosphere}</p>
                <p><strong style={{ color: "var(--foreground)", fontWeight: 400 }}>Essen:</strong> {(draft.structure as HotelContentStructure).food}</p>
                <p><strong style={{ color: "var(--foreground)", fontWeight: 400 }}>Pool/Strand:</strong> {(draft.structure as HotelContentStructure).pool_or_beach}</p>
                <p><strong style={{ color: "var(--foreground)", fontWeight: 400 }}>Sachliche Bewertung:</strong> {(draft.structure as HotelContentStructure).factual_rating}</p>
              </div>
            )}

            <label htmlFor="draft-hashtags" style={LABEL_STYLE}>Hashtags (kommagetrennt)</label>
            <input
              id="draft-hashtags" name="hashtags" type="text"
              defaultValue={((draft.structure as { hashtags?: string[] }).hashtags ?? []).join(", ")}
              style={{ ...FIELD_STYLE, marginBottom: "20px" }}
            />

            <details>
              <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: "0.68rem", letterSpacing: "0.04em", marginBottom: "12px" }}>
                Zeitplan &amp; Sichtbarkeit
              </summary>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="draft-scheduled" style={LABEL_STYLE}>Geplanter Zeitpunkt</label>
                  <input id="draft-scheduled" name="scheduled_at" type="datetime-local" defaultValue={draft.scheduled_at ?? ""} style={FIELD_STYLE} />
                </div>
                <div>
                  <label htmlFor="draft-visibility" style={LABEL_STYLE}>Sichtbarkeit</label>
                  <select id="draft-visibility" name="visibility" defaultValue={draft.visibility} style={FIELD_STYLE}>
                    <option value="private">Privat</option>
                    <option value="family">Familie</option>
                    <option value="public">Öffentlich</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 mt-4" style={{ cursor: "pointer" }}>
                <input type="checkbox" name="instagram_ready" defaultChecked={draft.instagram_ready} />
                <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Für Instagram vorbereitet (noch keine Veröffentlichung)</span>
              </label>
            </details>

            <div className="mt-6 mb-2">
              <label htmlFor="draft-notes" style={LABEL_STYLE}>Notizen</label>
              <textarea id="draft-notes" name="notes" rows={2} defaultValue={draft.notes ?? ""} style={{ ...FIELD_STYLE, resize: "none" }} />
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3 mt-6" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <Link href={`/content-studio/projects/${draft.project_id}`} style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
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
