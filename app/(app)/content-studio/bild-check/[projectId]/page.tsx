import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { LUMI_CORE_DOCUMENTS_BUCKET } from "@/lib/lumi-core-storage/paths";
import {
  createImageCheckUploadSlots, uploadImageCheckPhotos, runImageCheckAnalysis,
  adoptImageCheckPhotoToSession, adoptImageCheckPhotoToReel, markImageCheckPhotoForVacationPost,
} from "@/lib/actions/image-check";
import { deleteContentSessionPhotosNow, deleteContentSessionProject } from "@/lib/actions/content-sessions";
import { MAX_IMAGE_CHECK_PHOTOS } from "@/lib/content-session-limits";
import { MAX_VACATION_POST_PHOTOS } from "@/lib/vacation-post-curation";
import { getPhotoDisplayUrls } from "@/lib/photo-thumbnails";
import { DirectPhotoUploadForm } from "@/components/DirectPhotoUploadForm";
import { MultiPhotoFilePreview } from "@/components/MultiPhotoFilePreview";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";
import { Banner } from "@/components/Banner";
import { ImageCheckPanel } from "@/components/ImageCheckPanel";

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
 * §"Bild-Check": Foto-Upload (max. MAX_IMAGE_CHECK_PHOTOS) + Analyse-Panel.
 * Kein automatischer KI-Aufruf beim Laden -- ImageCheckPanel startet die
 * Analyse ausschließlich auf expliziten Klick.
 */
export default async function ImageCheckProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string; uploaded?: string }>;
}) {
  const { projectId } = await params;
  const { error, uploaded } = await searchParams;

  const lumiCore = await createLumiCoreClient();
  const { data: project } = await lumiCore
    .from("travel_content_projects")
    .select("id, title, trip_id, status")
    .eq("id", projectId)
    .eq("project_type", "image_check")
    .maybeSingle();

  if (!project) notFound();

  // §Lumi-Core-Cutover: kein PostgREST-Embedding für `trips(title)` --
  // flache Zusatzabfrage statt verschachteltem Select.
  const { data: tripForTitle } = project.trip_id
    ? await lumiCore.from("travel_trips").select("title").eq("id", project.trip_id).maybeSingle()
    : { data: null };

  const { data: photosRaw } = await lumiCore
    .from("travel_content_project_photos")
    .select("id, storage_path")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  const photos = photosRaw ?? [];
  const displayByPath = await getPhotoDisplayUrls(LUMI_CORE_DOCUMENTS_BUCKET, photos.map((p) => p.storage_path), "thumb400");
  const photosWithUrls = photos
    .map((p) => ({ id: p.id, url: displayByPath.get(p.storage_path)?.url ?? null }))
    .filter((p): p is { id: string; url: string } => p.url !== null);

  const tripTitle = tripForTitle?.title ?? project.title;
  const hasPhotos = photos.length > 0;

  // §"Alle vorgemerkten Bilder werden reisebezogen gesammelt" (Nutzervorgabe):
  // Status/Sperre gilt über ALLE image_check-Projekte dieser Reise, nicht nur
  // dieses eine -- mehrere Bild-Check-Durchgänge sammeln in denselben Pool.
  let markedCount = 0;
  let alreadyMarkedPhotoIds = new Set<string>();
  if (project.trip_id) {
    const { data: sisterProjectRows } = await lumiCore
      .from("travel_content_projects").select("id").eq("trip_id", project.trip_id).eq("project_type", "image_check");
    const projectIds = (sisterProjectRows ?? []).map((p) => p.id);
    const { data: markedRows } = projectIds.length > 0
      ? await lumiCore.from("travel_content_project_photos").select("id, project_id").in("project_id", projectIds).not("vacation_post_marked_at", "is", null)
      : { data: [] };
    markedCount = markedRows?.length ?? 0;
    alreadyMarkedPhotoIds = new Set((markedRows ?? []).filter((r) => r.project_id === projectId).map((r) => r.id));
  }

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <div className="flex items-center justify-between mb-8 flex-wrap gap-2">
          <Link
            href="/content-studio"
            className="flex items-center gap-2 transition-opacity hover:opacity-70"
            style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
          >
            <ChevronLeft size={13} strokeWidth={1.5} />
            Content Studio
          </Link>
          <form action={deleteContentSessionProject}>
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="return_to" value="/content-studio" />
            <button
              type="submit"
              style={{
                background: "transparent", color: "#B5624A", border: "1px solid rgba(181,98,74,0.35)",
                borderRadius: "6px", padding: "6px 12px", fontSize: "0.6rem", letterSpacing: "0.08em",
                textTransform: "uppercase", cursor: "pointer", WebkitAppearance: "none", appearance: "none",
              }}
            >
              Projekt löschen
            </button>
          </form>
        </div>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Bild-Check
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {tripTitle}
        </h1>

        {error && <Banner variant="error">{error}</Banner>}
        {uploaded && (
          <p className="mb-6" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
            {uploaded} Foto{uploaded === "1" ? "" : "s"} hochgeladen.
          </p>
        )}

        <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <span style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Fotos {hasPhotos ? `(${photos.length}/${MAX_IMAGE_CHECK_PHOTOS})` : ""}
            </span>
            {hasPhotos && (
              <form action={deleteContentSessionPhotosNow}>
                <input type="hidden" name="project_id" value={projectId} />
                <button
                  type="submit"
                  style={{
                    background: "transparent", color: "#B5624A", border: "1px solid rgba(181,98,74,0.35)",
                    borderRadius: "6px", padding: "6px 12px", fontSize: "0.6rem", letterSpacing: "0.08em",
                    textTransform: "uppercase", cursor: "pointer", WebkitAppearance: "none", appearance: "none",
                  }}
                >
                  Bilder jetzt löschen
                </button>
              </form>
            )}
          </div>

          <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.72rem", lineHeight: 1.5 }}>
            Maximal {MAX_IMAGE_CHECK_PHOTOS} Fotos, nur zur Analyse -- automatische Löschung nach 24 Stunden.
          </p>

          {photos.length < MAX_IMAGE_CHECK_PHOTOS ? (
            <DirectPhotoUploadForm action={uploadImageCheckPhotos} createSlots={createImageCheckUploadSlots} fileInputName="files">
              <input type="hidden" name="project_id" value={projectId} />
              <label htmlFor="ic-files" style={LABEL_STYLE}>
                Fotos hinzufügen (bis zu {MAX_IMAGE_CHECK_PHOTOS - photos.length} weitere möglich)
              </label>
              <MultiPhotoFilePreview inputId="ic-files" inputName="files" fieldStyle={FIELD_STYLE} />
              <div className="mt-4 flex justify-end">
                <SubmitButtonWithProgress label="Hochladen" pendingLabel="Fotos werden hochgeladen …" />
              </div>
            </DirectPhotoUploadForm>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
              Limit von {MAX_IMAGE_CHECK_PHOTOS} Fotos erreicht.
            </p>
          )}
        </div>

        {project.trip_id && markedCount > 0 && (
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2 rounded-xl p-4" style={{ background: "rgba(184,154,94,0.08)", border: "1px solid rgba(184,154,94,0.25)" }}>
            <span style={{ color: "var(--foreground)", fontSize: "0.76rem" }}>
              {markedCount} von maximal {MAX_VACATION_POST_PHOTOS} Bildern für {tripTitle} vorgemerkt
            </span>
            <Link href={`/content-studio/urlaubsbeitrag/${project.trip_id}`} style={{ color: "var(--accent)", fontSize: "0.72rem", textDecoration: "none" }}>
              Auswahl ansehen →
            </Link>
          </div>
        )}

        {hasPhotos && (
          <ImageCheckPanel
            projectId={projectId}
            photos={photosWithUrls}
            runAnalysis={runImageCheckAnalysis}
            adoptToSession={adoptImageCheckPhotoToSession}
            adoptToReel={adoptImageCheckPhotoToReel}
            markForVacationPost={markImageCheckPhotoForVacationPost}
            hasTrip={Boolean(project.trip_id)}
            alreadyMarkedPhotoIds={alreadyMarkedPhotoIds}
          />
        )}
      </div>
    </div>
  );
}
