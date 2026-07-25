import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { getPhotoDisplayUrls } from "@/lib/photo-thumbnails";
import { REEL_STYLE_LABELS } from "@/lib/ai-style-guidelines";
import { ReelTimelineEditor } from "@/components/ReelTimelineEditor";
import type { ReelStyleId } from "@/remotion/ReelTimelineComposition";
import type { ReelStoryboardStructure } from "@/lib/reel-storyboard-types";
import {
  reorderReelTimelineScene, removeReelTimelineScene, restoreReelTimelineScenes, updateReelTimelineScene,
  rebalanceReelTimelineDuration, regenerateReelSceneTextOverlay, updateReelMusicChoice,
  createReelMusicUploadSlot, uploadReelMusic, removeReelMusic,
} from "@/lib/actions/reel-timeline";

const STORAGE_BUCKET = "documents";
const VIDEO_SIGNED_URL_TTL_SECONDS = 600; // §"ausschließlich kurzlebige Signed URLs" (Nutzervorgabe) -- reicht für eine Bearbeitungssitzung, kein dauerhaft gültiger Link.

/**
 * §Content Studio 3.0, Sprint 4: bearbeitet das bestehende `video_reel`-
 * Storyboard "im selben Draft" (Nutzervorgabe) -- kein eigener neuer Draft,
 * keine neue Tabelle. Diese Seite ist reine Server-seitige Ladefunktion
 * (Ownership-Prüfung + Medien-Signierung), die eigentliche Interaktion lebt
 * in components/ReelTimelineEditor.tsx.
 */
export default async function ReelTimelinePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  const { data: project } = await supabase
    .from("content_projects")
    .select("id, trip_id, reel_style, reel_duration_seconds")
    .eq("id", projectId).eq("family_id", familyId).eq("project_type", "reel")
    .maybeSingle();
  if (!project) notFound();

  const { data: draft } = await supabase
    .from("content_drafts")
    .select("id, structure")
    .eq("project_id", projectId).eq("draft_type", "video_reel")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!draft) redirect(`/content-studio/reel/${projectId}/media?error=${encodeURIComponent("Bitte zuerst ein Storyboard erstellen.")}`);

  const structure = draft.structure as unknown as ReelStoryboardStructure;
  const reelDurationSeconds = (project.reel_duration_seconds ?? 30) as 15 | 30 | 60;
  const reelStyle = (project.reel_style ?? "family_memory") as ReelStyleId;

  const photoIds = structure.scenes.filter((s) => s.source_type === "photo").map((s) => s.source_id);
  const videoIds = structure.scenes.filter((s) => s.source_type === "video").map((s) => s.source_id);

  const [{ data: photoRowsRaw }, { data: videoRowsRaw }] = await Promise.all([
    photoIds.length > 0
      ? supabase.from("memory_photos").select("id, storage_path").in("id", photoIds)
      : Promise.resolve({ data: [] as { id: string; storage_path: string }[] }),
    videoIds.length > 0
      ? supabase.from("memory_videos").select("id, storage_path, thumbnail_storage_path").in("id", videoIds)
      : Promise.resolve({ data: [] as { id: string; storage_path: string; thumbnail_storage_path: string | null }[] }),
  ]);
  const photoRows = photoRowsRaw ?? [];
  const videoRows = videoRowsRaw ?? [];

  const [thumb400ByPath, thumb800ByPath] = await Promise.all([
    getPhotoDisplayUrls(STORAGE_BUCKET, photoRows.map((p) => p.storage_path), "thumb400"),
    getPhotoDisplayUrls(STORAGE_BUCKET, photoRows.map((p) => p.storage_path), "thumb800"),
  ]);

  const videoEntries = await Promise.all(videoRows.map(async (v) => {
    const [playback, poster] = await Promise.all([
      supabase.storage.from(STORAGE_BUCKET).createSignedUrl(v.storage_path, VIDEO_SIGNED_URL_TTL_SECONDS),
      v.thumbnail_storage_path
        ? supabase.storage.from(STORAGE_BUCKET).createSignedUrl(v.thumbnail_storage_path, VIDEO_SIGNED_URL_TTL_SECONDS)
        : Promise.resolve({ data: null }),
    ]);
    return { id: v.id, playbackUrl: playback.data?.signedUrl ?? "", displayUrl: poster.data?.signedUrl ?? null };
  }));
  const videoById = new Map(videoEntries.map((v) => [v.id, v]));

  const mediaByKey: Record<string, { displayUrl: string | null; playbackUrl: string }> = {};
  for (const p of photoRows) {
    mediaByKey[`photo:${p.id}`] = {
      displayUrl: thumb400ByPath.get(p.storage_path)?.url ?? null,
      playbackUrl: thumb800ByPath.get(p.storage_path)?.url ?? thumb400ByPath.get(p.storage_path)?.url ?? "",
    };
  }
  for (const v of videoRows) {
    const entry = videoById.get(v.id);
    mediaByKey[`video:${v.id}`] = { displayUrl: entry?.displayUrl ?? null, playbackUrl: entry?.playbackUrl ?? "" };
  }

  let initialMusicPreviewUrl: string | null = null;
  if (structure.music_source === "custom" && structure.music_storage_path) {
    const { data: signed } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(structure.music_storage_path, VIDEO_SIGNED_URL_TTL_SECONDS);
    initialMusicPreviewUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-lg w-full mx-auto px-5 md:px-8 pb-24 pt-9">
        <Link
          href={`/content-studio/reel/${projectId}/media`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Medienauswahl
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Timeline · {REEL_STYLE_LABELS[reelStyle] ?? reelStyle} · {reelDurationSeconds}s
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {structure.hook || "Reel-Timeline"}
        </h1>

        <ReelTimelineEditor
          projectId={projectId}
          reelDurationSeconds={reelDurationSeconds}
          reelStyle={reelStyle}
          initialStructure={structure}
          mediaByKey={mediaByKey}
          initialMusicPreviewUrl={initialMusicPreviewUrl}
          actions={{
            reorder: reorderReelTimelineScene,
            remove: removeReelTimelineScene,
            restore: restoreReelTimelineScenes,
            update: updateReelTimelineScene,
            rebalance: rebalanceReelTimelineDuration,
            regenerateText: regenerateReelSceneTextOverlay,
            updateMusic: updateReelMusicChoice,
            createMusicSlot: createReelMusicUploadSlot,
            uploadMusic: uploadReelMusic,
            removeMusic: removeReelMusic,
          }}
        />

        <div className="mt-8 flex justify-center">
          <Link
            href={`/content-studio/reel/${projectId}/render`}
            style={{
              background: "var(--accent)", color: "var(--surface)", borderRadius: "999px",
              padding: "12px 24px", fontSize: "0.78rem", textDecoration: "none",
            }}
          >
            Weiter zum Rendern
          </Link>
        </div>
      </div>
    </div>
  );
}
