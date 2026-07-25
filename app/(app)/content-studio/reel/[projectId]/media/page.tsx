import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Video, Plus, Minus, ArrowUp, ArrowDown, Clock, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import {
  createReelVideoUploadSlots, uploadReelVideos,
  addReelMediaItem, removeReelMediaItem, reorderReelMediaItem,
  createReelThumbnailUploadSlots, saveReelVideoThumbnail, deleteReelVideo,
} from "@/lib/actions/content-reel-media";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { generateReelStoryboard } from "@/lib/actions/reel-storyboard";
import { reelMediaLimitFor, ALLOWED_REEL_VIDEO_MIME_TYPES } from "@/lib/reel-media-limits";
import { REEL_STYLE_LABELS } from "@/lib/ai-style-guidelines";
import { getPhotoDisplayUrls } from "@/lib/photo-thumbnails";
import { SignedPhoto } from "@/components/SignedPhoto";
import { DirectVideoUploadForm } from "@/components/DirectVideoUploadForm";
import { GenerateReelStoryboardButton } from "@/components/GenerateReelStoryboardButton";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";
import { Banner } from "@/components/Banner";

type ReelStoryboardScene = {
  source_type: "photo" | "video"; source_id: string; duration_seconds: number
  transition: string; camera_motion: string; text_overlay: string; video_start_seconds: number | null
};
type ReelStoryboardStructure = {
  hook: string; outro: string; music_direction: string; caption: string; hashtags: string[]
  reasoning: string; scenes: ReelStoryboardScene[]
  quality_check: { rating: string; summary: string; suggestions: string[] } | null
};

const ICON_BUTTON_STYLE: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", display: "flex", padding: "8px", margin: "-4px",
};

type MediaTile = {
  key: string;
  sourceType: "photo" | "video";
  sourceId: string;
  thumbUrl: string | null;
  resolvedPath: string | null;
  itemId: string | null; // gesetzt, wenn bereits ausgewählt (content_reel_media_items.id)
  orderPosition: number | null; // 1-basiert, nur wenn ausgewählt
};

/**
 * §Content Studio 3.0, Sprint 2: Medienauswahl aus vorhandenen
 * `memory_photos`/`memory_videos` -- reine Auswahl/Reihenfolge, keine
 * KI-Analyse/Storyboard/Timeline/Rendering. Video-Upload nur sichtbar, wenn
 * die Reise noch KEINE `memory_videos` hat (Nutzervorgabe, wörtlich).
 */
export default async function ReelMediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string; uploaded?: string; storyboard?: string }>;
}) {
  const { projectId } = await params;
  const { error, uploaded, storyboard } = await searchParams;

  const supabase = await createClient();
  const { id: familyId } = await getFamily();
  const returnTo = `/content-studio/reel/${projectId}/media`;

  const { data: project } = await supabase
    .from("content_projects")
    .select("id, title, trip_id, project_type, reel_style, reel_duration_seconds, trips(title)")
    .eq("id", projectId)
    .eq("project_type", "reel")
    .maybeSingle();
  if (!project || !project.trip_id) notFound();

  const [{ data: photosRaw }, { data: videosRaw }, { data: itemsRaw }, { data: draftRaw }] = await Promise.all([
    supabase
      .from("memory_photos")
      .select("id, storage_path, caption")
      .eq("trip_id", project.trip_id)
      .eq("is_selected", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("memory_videos")
      .select("id, storage_path, thumbnail_storage_path, duration_seconds, caption, created_at")
      .eq("trip_id", project.trip_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("content_reel_media_items")
      .select("id, source_type, source_id, sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("content_drafts")
      .select("id, structure, created_at")
      .eq("project_id", projectId)
      .eq("draft_type", "video_reel")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const storyboardDraft = draftRaw ? { id: draftRaw.id, structure: draftRaw.structure as unknown as ReelStoryboardStructure } : null;

  const photos = photosRaw ?? [];
  const videos = videosRaw ?? [];
  const selectedItems = itemsRaw ?? [];
  const itemBySourceId = new Map(selectedItems.map((it) => [`${it.source_type}:${it.source_id}`, it]));
  const orderPositionById = new Map(selectedItems.map((it, idx) => [it.id, idx + 1]));

  const photoThumbs = await getPhotoDisplayUrls("documents", photos.map((p) => p.storage_path), "thumb400");

  const availableTiles: MediaTile[] = [
    ...photos.map((p) => {
      const match = itemBySourceId.get(`photo:${p.id}`);
      const thumb = photoThumbs.get(p.storage_path);
      return {
        key: `photo:${p.id}`, sourceType: "photo" as const, sourceId: p.id,
        thumbUrl: thumb?.url ?? null, resolvedPath: thumb?.resolvedPath ?? p.storage_path,
        itemId: match?.id ?? null, orderPosition: match ? orderPositionById.get(match.id) ?? null : null,
      };
    }),
    ...videos.map((v) => {
      const match = itemBySourceId.get(`video:${v.id}`);
      return {
        key: `video:${v.id}`, sourceType: "video" as const, sourceId: v.id,
        thumbUrl: null, resolvedPath: null,
        itemId: match?.id ?? null, orderPosition: match ? orderPositionById.get(match.id) ?? null : null,
      };
    }),
  ];

  const selectedTiles = availableTiles
    .filter((t) => t.orderPosition !== null)
    .sort((a, b) => (a.orderPosition ?? 0) - (b.orderPosition ?? 0));

  const limit = reelMediaLimitFor(project.reel_duration_seconds ?? 30);
  const selectedCount = selectedTiles.length;
  const showVideoUpload = videos.length === 0;

  // §Content Studio 3.0, Sprint 3: nur für AUSGEWÄHLTE Videos ohne Standbild
  // wird eine kurzlebige Signed-URL des Rohvideos erzeugt -- ausschließlich
  // zur clientseitigen Standbild-Erzeugung (GenerateReelStoryboardButton),
  // niemals zur Wiedergabe/Weitergabe.
  const selectedVideosWithoutThumbnail = selectedTiles.filter((t) => {
    if (t.sourceType !== "video") return false;
    const v = videos.find((vv) => vv.id === t.sourceId);
    return !!v && !v.thumbnail_storage_path;
  });
  const videosNeedingThumbnail = (
    await Promise.all(
      selectedVideosWithoutThumbnail.map(async (t) => {
        const v = videos.find((vv) => vv.id === t.sourceId);
        if (!v) return null;
        const { data: signed } = await supabase.storage.from("documents").createSignedUrl(v.storage_path, 300);
        return signed?.signedUrl ? { videoId: v.id, signedUrl: signed.signedUrl } : null;
      })
    )
  ).filter((x): x is { videoId: string; signedUrl: string } => x !== null);

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-5xl w-full mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/content-studio"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Content Studio
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Reel · {REEL_STYLE_LABELS[project.reel_style ?? ""] ?? project.reel_style} · {project.reel_duration_seconds}s
        </div>
        <h1 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {(project.trips as unknown as { title: string } | null)?.title ?? project.title}
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
          {selectedCount} von {limit.min}–{limit.max} Medien ausgewählt
        </p>

        {uploaded && <Banner variant="success">{uploaded} Video(s) gespeichert.</Banner>}
        {error && <Banner variant="error">{error}</Banner>}

        {selectedCount > 0 && (
          <section className="mb-10">
            <h2 className="mb-4" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Ausgewählt · Reihenfolge
            </h2>
            <div className="flex flex-col gap-2">
              {selectedTiles.map((tile, idx) => (
                <div
                  key={tile.key}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <span style={{ color: "var(--accent)", fontSize: "0.7rem", width: "20px", flexShrink: 0 }}>{idx + 1}.</span>
                  <div className="relative rounded-lg overflow-hidden" style={{ width: 56, height: 56, flexShrink: 0, background: "var(--background)" }}>
                    {tile.sourceType === "photo" && tile.thumbUrl ? (
                      <SignedPhoto storagePath={tile.resolvedPath!} initialUrl={tile.thumbUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video size={18} strokeWidth={1.5} style={{ color: "var(--muted)" }} />
                      </div>
                    )}
                  </div>
                  <span className="flex-1" style={{ color: "var(--muted)", fontSize: "0.68rem" }}>
                    {tile.sourceType === "photo" ? "Foto" : "Video"}
                  </span>
                  <form action={reorderReelMediaItem}>
                    <input type="hidden" name="item_id" value={tile.itemId!} />
                    <input type="hidden" name="project_id" value={projectId} />
                    <input type="hidden" name="direction" value="up" />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <button type="submit" aria-label="Nach oben" disabled={idx === 0} style={{ ...ICON_BUTTON_STYLE, opacity: idx === 0 ? 0.3 : 1 }}>
                      <ArrowUp size={14} strokeWidth={1.8} style={{ color: "var(--foreground)" }} />
                    </button>
                  </form>
                  <form action={reorderReelMediaItem}>
                    <input type="hidden" name="item_id" value={tile.itemId!} />
                    <input type="hidden" name="project_id" value={projectId} />
                    <input type="hidden" name="direction" value="down" />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <button type="submit" aria-label="Nach unten" disabled={idx === selectedTiles.length - 1} style={{ ...ICON_BUTTON_STYLE, opacity: idx === selectedTiles.length - 1 ? 0.3 : 1 }}>
                      <ArrowDown size={14} strokeWidth={1.8} style={{ color: "var(--foreground)" }} />
                    </button>
                  </form>
                  <form action={removeReelMediaItem}>
                    <input type="hidden" name="item_id" value={tile.itemId!} />
                    <input type="hidden" name="project_id" value={projectId} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <button type="submit" aria-label="Entfernen" style={ICON_BUTTON_STYLE}>
                      <Minus size={14} strokeWidth={1.8} style={{ color: "#B5624A" }} />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        )}

        {showVideoUpload && (
          <section className="mb-10">
            <h2 className="mb-4" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Kurze Videos hinzufügen
            </h2>
            <DirectVideoUploadForm action={uploadReelVideos} createSlots={createReelVideoUploadSlots} fileInputName="video_files">
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="return_to" value={returnTo} />
              <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.72rem", lineHeight: 1.5 }}>
                  Nur sichtbar, solange diese Reise noch keine gespeicherten Videos hat. Max. 20 Sekunden und 50 MB je Clip,
                  Format MP4/MOV/WebM.
                </p>
                <input
                  type="file" id="reel-video-files" name="video_files" multiple
                  accept={ALLOWED_REEL_VIDEO_MIME_TYPES.join(",")}
                  style={{ width: "100%", fontSize: "0.78rem", color: "var(--foreground)" }}
                />
                <div className="mt-4">
                  <SubmitButtonWithProgress label="Videos speichern" pendingLabel="Videos werden gespeichert …" />
                </div>
              </div>
            </DirectVideoUploadForm>
          </section>
        )}

        <section>
          <h2 className="mb-4" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Vorhandene Fotos &amp; Videos
          </h2>
          {availableTiles.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Noch keine Fotos oder Videos für diese Reise gespeichert.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {availableTiles.map((tile) => {
                const isSelected = tile.orderPosition !== null;
                const atMax = !isSelected && selectedCount >= limit.max;
                return (
                  <div key={tile.key} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: "1/1" }}>
                    {tile.sourceType === "photo" && tile.thumbUrl ? (
                      <SignedPhoto storagePath={tile.resolvedPath!} initialUrl={tile.thumbUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "var(--surface)" }}>
                        <Video size={22} strokeWidth={1.5} style={{ color: "var(--muted)" }} />
                      </div>
                    )}
                    {tile.sourceType === "video" && (
                      <form action={deleteReelVideo.bind(null, tile.sourceId, returnTo)} className="absolute top-1.5 left-1.5 z-10">
                        <ConfirmSubmitButton
                          label="🗑"
                          confirmMessage="Dieses Video endgültig löschen? Es wird aus Storage, aus allen Reel-Auswahllisten und aus jedem Storyboard entfernt, das es verwendet (die betroffene Szene fällt weg, die Gesamtdauer wird automatisch ausgeglichen)."
                          style={{ ...ICON_BUTTON_STYLE, padding: "4px", background: "rgba(10,9,7,0.55)", borderRadius: "999px", fontSize: "0.7rem", lineHeight: 1 }}
                        />
                      </form>
                    )}
                    <div
                      className="absolute inset-0 flex items-end justify-end p-1.5"
                      style={{ background: isSelected ? "rgba(184,154,94,0.28)" : "linear-gradient(to top, rgba(10,9,7,0.55) 0%, transparent 40%)" }}
                    >
                      {isSelected ? (
                        <div className="flex items-center gap-1">
                          <span
                            style={{
                              background: "var(--accent)", color: "var(--surface)", borderRadius: "999px",
                              width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "0.62rem",
                            }}
                          >
                            {tile.orderPosition}
                          </span>
                          <form action={removeReelMediaItem}>
                            <input type="hidden" name="item_id" value={tile.itemId!} />
                            <input type="hidden" name="project_id" value={projectId} />
                            <input type="hidden" name="return_to" value={returnTo} />
                            <button type="submit" aria-label="Entfernen" style={{ ...ICON_BUTTON_STYLE, padding: "4px", margin: 0 }}>
                              <Minus size={14} strokeWidth={2} style={{ color: "#F0EBE3" }} />
                            </button>
                          </form>
                        </div>
                      ) : (
                        <form action={addReelMediaItem}>
                          <input type="hidden" name="project_id" value={projectId} />
                          <input type="hidden" name="source_type" value={tile.sourceType} />
                          <input type="hidden" name="source_id" value={tile.sourceId} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <button
                            type="submit" aria-label="Auswählen" disabled={atMax}
                            style={{ ...ICON_BUTTON_STYLE, padding: "4px", margin: 0, opacity: atMax ? 0.35 : 1 }}
                          >
                            <Plus size={16} strokeWidth={2} style={{ color: "#F0EBE3" }} />
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {selectedCount < limit.min && (
          <p className="mt-6 flex items-center gap-2" style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
            <Clock size={13} strokeWidth={1.6} />
            Noch {limit.min - selectedCount} Medien bis zum Minimum für {project.reel_duration_seconds}s.
          </p>
        )}

        <section className="mt-10 pt-8" style={{ borderTop: "1px solid var(--border)" }}>
          <h2 className="mb-1" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            KI-Storyboard
          </h2>
          <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.72rem", lineHeight: 1.5 }}>
            Wählt Szenen aus den oben ausgewählten Medien, ordnet sie und schreibt Hook, Texte und Musikrichtung.
            Noch keine Timeline oder gerendertes Video -- nur der Plan.
          </p>

          {storyboard === "1" && <Banner variant="success">Storyboard erstellt.</Banner>}

          <GenerateReelStoryboardButton
            action={generateReelStoryboard}
            projectId={projectId}
            returnTo={returnTo}
            videosNeedingThumbnail={videosNeedingThumbnail}
            createThumbnailSlots={createReelThumbnailUploadSlots}
            saveThumbnail={saveReelVideoThumbnail}
            disabled={selectedCount < limit.min}
            label={storyboardDraft ? "Storyboard neu erstellen" : "Storyboard erstellen"}
          />

          {storyboardDraft && (
            <div className="mt-6 rounded-xl p-5 flex flex-col gap-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
                  <span style={{ color: "var(--accent)", fontSize: "0.62rem", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                    Aktuelles Storyboard
                  </span>
                </div>
                <Link
                  href={`/content-studio/reel/${projectId}/timeline`}
                  style={{
                    background: "var(--accent)", color: "var(--surface)", borderRadius: "999px",
                    padding: "6px 14px", fontSize: "0.68rem", textDecoration: "none",
                  }}
                >
                  Zur Timeline
                </Link>
              </div>

              <div>
                <p style={{ color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Hook</p>
                <p style={{ color: "var(--foreground)", fontSize: "0.82rem", lineHeight: 1.5 }}>{storyboardDraft.structure.hook}</p>
              </div>

              <div className="flex flex-col gap-2">
                <p style={{ color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Szenen ({storyboardDraft.structure.scenes.length})
                </p>
                {storyboardDraft.structure.scenes.map((scene, idx) => (
                  <div key={`${scene.source_type}-${scene.source_id}-${idx}`} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: "var(--background)" }}>
                    <span style={{ color: "var(--accent)", fontSize: "0.7rem", width: "18px", flexShrink: 0 }}>{idx + 1}.</span>
                    <div className="flex-1">
                      <p style={{ color: "var(--foreground)", fontSize: "0.76rem" }}>
                        {scene.source_type === "photo" ? "Foto" : "Video"} · {scene.duration_seconds}s · {scene.transition} · {scene.camera_motion}
                        {scene.video_start_seconds != null ? ` · ab ${scene.video_start_seconds}s` : ""}
                      </p>
                      {scene.text_overlay && (
                        <p style={{ color: "var(--muted)", fontSize: "0.74rem", marginTop: "2px" }}>„{scene.text_overlay}“</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <p style={{ color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Outro</p>
                <p style={{ color: "var(--foreground)", fontSize: "0.82rem", lineHeight: 1.5 }}>{storyboardDraft.structure.outro}</p>
              </div>

              <div>
                <p style={{ color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Musikrichtung</p>
                <p style={{ color: "var(--foreground)", fontSize: "0.82rem", lineHeight: 1.5 }}>{storyboardDraft.structure.music_direction}</p>
              </div>

              <div>
                <p style={{ color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Caption</p>
                <p style={{ color: "var(--foreground)", fontSize: "0.82rem", lineHeight: 1.5 }}>{storyboardDraft.structure.caption}</p>
                {storyboardDraft.structure.hashtags?.length > 0 && (
                  <p style={{ color: "var(--muted)", fontSize: "0.74rem", marginTop: "4px" }}>{storyboardDraft.structure.hashtags.map((h) => `#${h}`).join(" ")}</p>
                )}
              </div>

              <div>
                <p style={{ color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Begründung</p>
                <p style={{ color: "var(--muted)", fontSize: "0.76rem", lineHeight: 1.5 }}>{storyboardDraft.structure.reasoning}</p>
              </div>

              {storyboardDraft.structure.quality_check && (
                <div>
                  <p style={{ color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>
                    Qualitäts-Check · {storyboardDraft.structure.quality_check.rating}
                  </p>
                  <p style={{ color: "var(--muted)", fontSize: "0.76rem", lineHeight: 1.5 }}>{storyboardDraft.structure.quality_check.summary}</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
