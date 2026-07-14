import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateContentDraft, deleteContentDraft } from "@/lib/actions/content-ideas";
import {
  saveContentSessionDraftText, moveContentSessionDraftItem, removeContentSessionDraftItem,
  addContentSessionDraftItem, setContentSessionDraftCover, regenerateContentSessionDraftPart,
  deleteContentSessionDraft,
} from "@/lib/actions/content-sessions";
import { Banner } from "@/components/Banner";
import { SignedPhoto } from "@/components/SignedPhoto";
import { CopyTextButton } from "@/components/CopyTextButton";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};
const GHOST_BUTTON_STYLE: React.CSSProperties = {
  background: "transparent", color: "var(--muted)", border: "1px solid var(--border)",
  borderRadius: "6px", padding: "6px 10px", fontSize: "0.6rem", letterSpacing: "0.06em",
  cursor: "pointer", WebkitAppearance: "none", appearance: "none",
};

type DraftItem = { photo_id: string; text: string };
type QualityCheck = { rating: "stark" | "solide" | "verbesserungsfaehig"; summary: string; suggestions: string[] };
type ReelStructure = { scenes: DraftItem[]; outro?: string; hashtags?: string[]; caption?: string; hook?: string; music_direction?: string; quality_check?: QualityCheck | null };
type CarouselStructure = { slides: DraftItem[]; hashtags?: string[]; caption?: string; cover_photo_id?: string; cover_reasoning?: string; closing_note?: string; quality_check?: QualityCheck | null };
type StoryStructure = { slides: DraftItem[]; hashtags?: string[]; caption?: string; sticker_idea?: string; opening_note?: string; closing_note?: string; quality_check?: QualityCheck | null };
type CaptionStructure = { text: string; hashtags?: string[] };
type HotelContentStructure = {
  text: string; hashtags?: string[]
  family_perspective?: string; design_atmosphere?: string; food?: string; pool_or_beach?: string; factual_rating?: string
};

const DRAFT_TYPE_LABELS: Record<string, string> = {
  reel_plan: "Reel", carousel_plan: "Beitrag", story_plan: "Story", caption: "Caption",
  journal_review: "Reisejournal", day_recap: "Tagesrückblick", highlight: "Ausflug/Highlight", hotel_content: "Hotel-Content",
};

const QUALITY_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  stark: { bg: "rgba(107,143,113,0.14)", fg: "#6B8F71", label: "Stark" },
  solide: { bg: "rgba(181,150,74,0.14)", fg: "#B5964A", label: "Solide" },
  verbesserungsfaehig: { bg: "rgba(181,98,74,0.14)", fg: "#B5624A", label: "Verbesserungsfähig" },
};

function QualityBadge({ qc }: { qc?: QualityCheck | null }) {
  if (!qc) return null;
  const style = QUALITY_STYLE[qc.rating] ?? QUALITY_STYLE.solide;
  return (
    <div className="mb-6 rounded-lg p-4" style={{ background: style.bg, border: `1px solid ${style.fg}33` }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ background: style.fg, color: "#fff", fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase", borderRadius: "999px", padding: "3px 10px" }}>
          {style.label}
        </span>
      </div>
      <p style={{ color: "var(--foreground)", fontSize: "0.76rem", lineHeight: 1.5 }}>{qc.summary}</p>
      {qc.suggestions?.length > 0 && (
        <ul className="mt-2 space-y-1" style={{ color: "var(--muted)", fontSize: "0.72rem", lineHeight: 1.5, paddingLeft: "16px" }}>
          {qc.suggestions.map((s, i) => <li key={i} style={{ listStyle: "disc" }}>{s}</li>)}
        </ul>
      )}
    </div>
  );
}

function RegenerateButtons({ draftId, field, label }: { draftId: string; field: string; label: string }) {
  return (
    <form action={regenerateContentSessionDraftPart} className="inline">
      <input type="hidden" name="draft_id" value={draftId} />
      <input type="hidden" name="field" value={field} />
      <button type="submit" style={GHOST_BUTTON_STYLE}>{label}</button>
    </form>
  );
}

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

  const itemsKey = draft.draft_type === "reel_plan" ? "scenes" : (draft.draft_type === "carousel_plan" || draft.draft_type === "story_plan") ? "slides" : null;
  // §"Funktionslose letzte Maske ersetzen": die reichhaltige Bild-Vorschau
  // (Cover, Reihenfolge, Titelbild wechseln, Regenerieren) gibt es nur für
  // Content-Session-Entwürfe -- Ideen-basierte reel_plan/carousel_plan/
  // story_plan-Drafts (aus der älteren "Content-Idee"-Strecke) haben keine
  // verknüpften Fotos und bleiben beim einfachen Text-Editor.
  const useRichEditor = isSessionDraft && itemsKey !== null;

  if (!useRichEditor) {
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
              {error && <Banner variant="error">{error}</Banner>}

              {draft.draft_type === "reel_plan" && (
                <>
                  <label style={LABEL_STYLE}>Szenen</label>
                  {((draft.structure as ReelStructure).scenes?.length ? (draft.structure as ReelStructure).scenes : [{ text: "", photo_id: "" }]).map((s, i) => (
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
                <Link href={backHref} style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
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

          <form action={deleteContentDraft} className="flex justify-end">
            <input type="hidden" name="draft_id" value={draft.id} />
            <input type="hidden" name="return_to" value={backHref} />
            <button
              type="submit"
              style={{
                background: "transparent", color: "#B5624A", border: "1px solid rgba(181,98,74,0.35)",
                borderRadius: "6px", padding: "9px 16px", fontSize: "0.62rem", letterSpacing: "0.08em",
                textTransform: "uppercase", cursor: "pointer", WebkitAppearance: "none", appearance: "none",
              }}
            >
              Entwurf löschen
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Reichhaltige Content-Vorschau (Beitrag/Story/Reel) ──
  const structure = draft.structure as CarouselStructure & StoryStructure & ReelStructure;
  const items: DraftItem[] = (itemsKey === "scenes" ? structure.scenes : structure.slides) ?? [];

  const { data: projectPhotosRaw } = await supabase
    .from("content_project_photos")
    .select("id, storage_path")
    .eq("project_id", draft.project_id)
    .is("is_duplicate_of", null)
    .order("created_at", { ascending: true });
  const projectPhotos = projectPhotosRaw ?? [];

  const urlById = new Map<string, string>();
  await Promise.all(projectPhotos.map(async (p) => {
    const { data: signed } = await supabase.storage.from("documents").createSignedUrl(p.storage_path, 3600);
    if (signed?.signedUrl) urlById.set(p.id, signed.signedUrl);
  }));

  const isCarousel = draft.draft_type === "carousel_plan";
  const isStory = draft.draft_type === "story_plan";
  const isReel = draft.draft_type === "reel_plan";
  const unselectedPhotos = projectPhotos.filter((p) => !items.some((i) => i.photo_id === p.id));
  const canAddMore = !isCarousel || items.length < 7;

  const coverPhotoId = isCarousel ? (structure.cover_photo_id || items[0]?.photo_id) : null;

  const fullText = [
    isReel ? structure.hook : null,
    structure.caption,
    (structure.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "),
  ].filter(Boolean).join("\n\n");

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={backHref}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Session
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          {DRAFT_TYPE_LABELS[draft.draft_type] ?? draft.draft_type}
        </div>
        <h1 className="font-light mb-6" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Content-Vorschau
        </h1>

        {error && <Banner variant="error">{error}</Banner>}

        <QualityBadge qc={structure.quality_check} />

        {isCarousel && coverPhotoId && urlById.get(coverPhotoId) && (
          <div className="mb-6">
            <label style={LABEL_STYLE}>Titelbild</label>
            <div className="relative rounded-xl overflow-hidden mb-2" style={{ aspectRatio: "4/5", maxWidth: "280px" }}>
              <SignedPhoto storagePath={null} initialUrl={urlById.get(coverPhotoId)!} alt="" className="absolute inset-0 w-full h-full object-cover" loading="eager" />
            </div>
            {structure.cover_reasoning && <p style={{ color: "var(--muted)", fontSize: "0.7rem", lineHeight: 1.5 }}>{structure.cover_reasoning}</p>}
          </div>
        )}

        <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <span style={LABEL_STYLE}>{isReel ? "Szenenreihenfolge" : "Bilder"} ({items.length})</span>
            <RegenerateButtons draftId={draft.id} field="full" label="Komplett neu generieren" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
            {items.map((item, i) => (
              <div key={`${item.photo_id}-${i}`} className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <div className="relative" style={{ aspectRatio: "1/1" }}>
                  {urlById.get(item.photo_id) ? (
                    <SignedPhoto storagePath={null} initialUrl={urlById.get(item.photo_id)!} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "var(--background)", color: "var(--muted)", fontSize: "0.6rem", padding: "8px", textAlign: "center" }}>
                      Bild nicht mehr verfügbar
                    </div>
                  )}
                  <span className="absolute top-1 left-1 rounded" style={{ background: "rgba(10,9,7,0.6)", color: "#F0EBE3", fontSize: "0.55rem", padding: "1px 6px" }}>{i + 1}</span>
                </div>
                <div className="flex items-center justify-between gap-1 p-1.5">
                  <form action={moveContentSessionDraftItem}>
                    <input type="hidden" name="draft_id" value={draft.id} />
                    <input type="hidden" name="index" value={i} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" disabled={i === 0} style={{ ...GHOST_BUTTON_STYLE, padding: "3px 6px", opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                  </form>
                  <form action={moveContentSessionDraftItem}>
                    <input type="hidden" name="draft_id" value={draft.id} />
                    <input type="hidden" name="index" value={i} />
                    <input type="hidden" name="direction" value="down" />
                    <button type="submit" disabled={i === items.length - 1} style={{ ...GHOST_BUTTON_STYLE, padding: "3px 6px", opacity: i === items.length - 1 ? 0.4 : 1 }}>↓</button>
                  </form>
                  {isCarousel && item.photo_id !== coverPhotoId && (
                    <form action={setContentSessionDraftCover}>
                      <input type="hidden" name="draft_id" value={draft.id} />
                      <input type="hidden" name="photo_id" value={item.photo_id} />
                      <button type="submit" style={{ ...GHOST_BUTTON_STYLE, padding: "3px 6px" }} title="Als Titelbild setzen">★</button>
                    </form>
                  )}
                  <form action={removeContentSessionDraftItem}>
                    <input type="hidden" name="draft_id" value={draft.id} />
                    <input type="hidden" name="index" value={i} />
                    <button type="submit" style={{ ...GHOST_BUTTON_STYLE, padding: "3px 6px", color: "#B5624A" }}>✕</button>
                  </form>
                </div>
              </div>
            ))}
          </div>

          {canAddMore && unselectedPhotos.length > 0 && (
            <details className="mt-3">
              <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: "0.68rem" }}>Weiteres Bild hinzufügen ({unselectedPhotos.length} verfügbar)</summary>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                {unselectedPhotos.map((p) => (
                  <form key={p.id} action={addContentSessionDraftItem} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: "1/1" }}>
                    <input type="hidden" name="draft_id" value={draft.id} />
                    <input type="hidden" name="photo_id" value={p.id} />
                    {urlById.get(p.id) && (
                      <SignedPhoto storagePath={null} initialUrl={urlById.get(p.id)!} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                    )}
                    <button type="submit" className="absolute inset-0 w-full h-full" style={{ background: "rgba(10,9,7,0.15)", border: "none", cursor: "pointer" }} title="Hinzufügen" />
                  </form>
                ))}
              </div>
            </details>
          )}
        </div>

        <form action={saveContentSessionDraftText}>
          <input type="hidden" name="draft_id" value={draft.id} />

          <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && <Banner variant="error">{error}</Banner>}

            {isReel && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="draft-hook" style={LABEL_STYLE}>Hook</label>
                  <RegenerateButtons draftId={draft.id} field="hook" label="Hook neu" />
                </div>
                <input id="draft-hook" name="hook" type="text" defaultValue={structure.hook ?? ""} style={{ ...FIELD_STYLE, marginBottom: "16px" }} />
              </>
            )}

            <label style={LABEL_STYLE}>{isReel ? "Text je Szene" : "Text je Bild"}</label>
            {items.map((item, i) => (
              <div key={`${item.photo_id}-${i}`} className="flex items-center gap-2 mb-2">
                <span style={{ color: "var(--muted)", fontSize: "0.65rem", width: "16px" }}>{i + 1}.</span>
                <input type="hidden" name="item_photo_id" value={item.photo_id} />
                <input name="item_text" type="text" defaultValue={item.text} style={{ ...FIELD_STYLE, flex: 1 }} />
              </div>
            ))}

            {isStory && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 mb-2">
                <div>
                  <label htmlFor="draft-opening" style={LABEL_STYLE}>Einstieg</label>
                  <input id="draft-opening" name="opening_note" type="text" defaultValue={structure.opening_note ?? ""} style={FIELD_STYLE} />
                </div>
                <div>
                  <label htmlFor="draft-sticker" style={LABEL_STYLE}>Sticker/Interaktions-Idee</label>
                  <input id="draft-sticker" name="sticker_idea" type="text" defaultValue={structure.sticker_idea ?? ""} style={FIELD_STYLE} />
                </div>
              </div>
            )}

            {isReel && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 mb-2">
                <div>
                  <label htmlFor="draft-music" style={LABEL_STYLE}>Musikrichtung</label>
                  <input id="draft-music" name="music_direction" type="text" defaultValue={structure.music_direction ?? ""} style={FIELD_STYLE} />
                </div>
                <div>
                  <label htmlFor="draft-outro" style={LABEL_STYLE}>Outro</label>
                  <input id="draft-outro" name="outro" type="text" defaultValue={structure.outro ?? ""} style={FIELD_STYLE} />
                </div>
              </div>
            )}

            {(isCarousel || isStory) && (
              <div className="mt-4 mb-2">
                <label htmlFor="draft-closing" style={LABEL_STYLE}>Abschluss</label>
                <input id="draft-closing" name="closing_note" type="text" defaultValue={structure.closing_note ?? ""} style={FIELD_STYLE} />
              </div>
            )}

            <div className="flex items-center justify-between mt-6 mb-2">
              <label htmlFor="draft-caption" style={LABEL_STYLE}>Caption (direkt unter {DRAFT_TYPE_LABELS[draft.draft_type]})</label>
              <RegenerateButtons draftId={draft.id} field="caption" label="Caption neu" />
            </div>
            <textarea id="draft-caption" name="caption" rows={5} defaultValue={structure.caption ?? ""} style={{ ...FIELD_STYLE, resize: "none", marginBottom: "16px" }} />

            <div className="flex items-center justify-between mb-2">
              <label htmlFor="draft-hashtags" style={LABEL_STYLE}>Hashtags (kommagetrennt, direkt unter der Caption)</label>
              <RegenerateButtons draftId={draft.id} field="hashtags" label="Hashtags neu" />
            </div>
            <input id="draft-hashtags" name="hashtags" type="text" defaultValue={(structure.hashtags ?? []).join(", ")} style={{ ...FIELD_STYLE, marginBottom: "20px" }} />

            <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <CopyTextButton text={fullText} />
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

        <form action={deleteContentSessionDraft} className="flex justify-end">
          <input type="hidden" name="draft_id" value={draft.id} />
          <input type="hidden" name="project_id" value={draft.project_id} />
          <button type="submit" style={{ ...GHOST_BUTTON_STYLE, color: "#B5624A" }}>Entwurf löschen</button>
        </form>
      </div>
    </div>
  );
}
