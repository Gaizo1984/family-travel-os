import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Star, Trash2, Image as ImageIcon, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import {
  uploadMemoryPhotos, createMemoryUploadSlots, deleteMemoryPhoto, toggleMemoryHighlight,
  setCoverPhoto, reorderMemoryPhoto,
} from "@/lib/actions/memories";
import { MAX_SELECTED_PHOTOS_PER_TRIP } from "@/lib/memory-limits";
import { MultiPhotoFilePreview } from "@/components/MultiPhotoFilePreview";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";
import { DirectPhotoUploadForm } from "@/components/DirectPhotoUploadForm";
import { Banner } from "@/components/Banner";
import { SignedPhoto } from "@/components/SignedPhoto";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};
const ICON_BUTTON_STYLE: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", display: "flex", padding: "8px", margin: "-4px",
};

type PhotoRow = {
  id: string; storage_path: string; caption: string | null; taken_at: string | null
  is_highlight: boolean; stage_id: string | null; uploaded_by_person_id: string | null
};

export default async function TripGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; uploaded?: string }>;
}) {
  const { id } = await params;
  const { error, uploaded } = await searchParams;

  const supabase = await createClient();
  const { id: familyId } = await getFamily();
  const returnTo = `/trips/${id}/gallery`;

  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title, cover_photo_id")
    .eq("slug", id)
    .maybeSingle();
  if (!trip) notFound();

  const [{ data: photosRaw }, { count: hiddenCount }, { data: stagesRaw }, { data: personsRaw }] = await Promise.all([
    supabase
      .from("memory_photos")
      .select("id, storage_path, caption, taken_at, is_highlight, stage_id, uploaded_by_person_id")
      .eq("trip_id", trip.id)
      .eq("is_selected", true)
      .order("sort_order", { ascending: true })
      .order("taken_at", { ascending: false, nullsFirst: false }),
    supabase.from("memory_photos").select("id", { count: "exact", head: true }).eq("trip_id", trip.id).eq("is_selected", false),
    supabase.from("stages").select("id, title, location").eq("trip_id", trip.id).order("sort_order", { ascending: true }),
    supabase.from("persons").select("id, name").eq("family_id", familyId),
  ]);

  const photos = (photosRaw ?? []) as PhotoRow[];
  const stages = stagesRaw ?? [];
  const persons = personsRaw ?? [];
  const stageById = new Map(stages.map((s) => [s.id, s.title]));
  const personNameById = new Map(persons.map((p) => [p.id, p.name]));

  const photosWithUrls = await Promise.all(
    photos.map(async (p) => {
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(p.storage_path, 3600);
      return { photo: p, url: signed?.signedUrl ?? null };
    }),
  );

  const lightboxPhotos: LightboxPhoto[] = photosWithUrls
    .filter((p): p is typeof p & { url: string } => Boolean(p.url))
    .map((p) => ({ url: p.url, alt: p.photo.caption ?? "" }));

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-5xl w-full mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/trips/${trip.slug}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {trip.title}
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Galerie
        </div>
        <h1 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {trip.title}
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
          {photos.length} von {MAX_SELECTED_PHOTOS_PER_TRIP} Erinnerungen
        </p>

        {uploaded && <Banner variant="success">{uploaded} Foto(s) gespeichert.</Banner>}
        {error && <Banner variant="error">{error}</Banner>}

        {/* ── Upload ── */}
        <section className="mb-10">
          <DirectPhotoUploadForm action={uploadMemoryPhotos} createSlots={createMemoryUploadSlots} fileInputName="files">
            <input type="hidden" name="family_id" value={familyId} />
            <input type="hidden" name="trip_id" value={trip.id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {stages.length > 0 && (
                  <div>
                    <label htmlFor="gal-stage" style={LABEL_STYLE}>Etappe (optional)</label>
                    <select id="gal-stage" name="stage_id" style={FIELD_STYLE}>
                      <option value="">— keine Zuordnung —</option>
                      {stages.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label htmlFor="gal-caption" style={LABEL_STYLE}>Notiz (optional)</label>
                  <input id="gal-caption" name="caption" type="text" style={FIELD_STYLE} />
                </div>
              </div>
              <div className="mb-4">
                <label htmlFor="gal-files" style={LABEL_STYLE}>Fotos</label>
                <MultiPhotoFilePreview inputId="gal-files" inputName="files" fieldStyle={FIELD_STYLE} />
              </div>
              <label className="flex items-center gap-2 mb-5" style={{ cursor: "pointer" }}>
                <input type="checkbox" name="mark_as_cover" />
                <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Erstes Foto als Titelbild dieser Reise markieren</span>
              </label>
              <SubmitButtonWithProgress label="Fotos speichern" pendingLabel="Fotos werden gespeichert …" />
            </div>
          </DirectPhotoUploadForm>
        </section>

        {/* ── Galerie-Grid ── */}
        {photosWithUrls.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {photosWithUrls.map(({ photo, url }, idx) => {
              if (!url) return null;
              const isCover = trip.cover_photo_id === photo.id;
              const lightboxIndex = lightboxPhotos.findIndex((p) => p.url === url);
              return (
                <div key={photo.id} className="relative rounded-lg overflow-hidden group" style={{ aspectRatio: "1/1" }}>
                  <PhotoLightbox url={url} alt={photo.caption ?? ""} photos={lightboxPhotos} index={lightboxIndex}>
                    <SignedPhoto storagePath={photo.storage_path} initialUrl={url} alt={photo.caption ?? ""} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                  </PhotoLightbox>
                  <div
                    className="absolute inset-0 flex flex-col justify-between p-2"
                    style={{ background: "linear-gradient(to bottom, rgba(10,9,7,0.5) 0%, transparent 30%, transparent 65%, rgba(10,9,7,0.75) 100%)", pointerEvents: "none", zIndex: 2 }}
                  >
                    <div className="flex items-center justify-end gap-0.5" style={{ pointerEvents: "auto" }}>
                      {!isCover && (
                        <form action={setCoverPhoto}>
                          <input type="hidden" name="photo_id" value={photo.id} />
                          <input type="hidden" name="trip_id" value={trip.id} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <button type="submit" aria-label="Als Titelbild verwenden" style={ICON_BUTTON_STYLE}>
                            <ImageIcon size={13} strokeWidth={1.8} style={{ color: "#F0EBE3" }} />
                          </button>
                        </form>
                      )}
                      {isCover && (
                        <span aria-label="Aktuelles Titelbild" style={ICON_BUTTON_STYLE}>
                          <ImageIcon size={13} strokeWidth={1.8} fill="#F0EBE3" style={{ color: "#F0EBE3" }} />
                        </span>
                      )}
                      <form action={toggleMemoryHighlight}>
                        <input type="hidden" name="photo_id" value={photo.id} />
                        <input type="hidden" name="next_value" value={(!photo.is_highlight).toString()} />
                        <input type="hidden" name="return_to" value={returnTo} />
                        <button type="submit" aria-label="Highlight" style={ICON_BUTTON_STYLE}>
                          <Star size={13} strokeWidth={1.8} fill={photo.is_highlight ? "#F0EBE3" : "none"} style={{ color: "#F0EBE3" }} />
                        </button>
                      </form>
                      <Link href={`/trips/${trip.slug}/gallery/${photo.id}/edit`} aria-label="Bearbeiten" style={ICON_BUTTON_STYLE}>
                        <Pencil size={13} strokeWidth={1.8} style={{ color: "#F0EBE3" }} />
                      </Link>
                      <form action={deleteMemoryPhoto}>
                        <input type="hidden" name="photo_id" value={photo.id} />
                        <input type="hidden" name="return_to" value={returnTo} />
                        <button type="submit" aria-label="Löschen" style={ICON_BUTTON_STYLE}>
                          <Trash2 size={13} strokeWidth={1.8} style={{ color: "#F0EBE3" }} />
                        </button>
                      </form>
                    </div>

                    <div className="flex items-end justify-between" style={{ pointerEvents: "auto" }}>
                      <div style={{ color: "#F0EBE3", fontSize: "0.6rem", lineHeight: 1.3, maxWidth: "70%" }}>
                        {photo.caption}
                        {photo.stage_id && stageById.has(photo.stage_id) && (
                          <div style={{ color: "#C9A96E", fontSize: "0.56rem" }}>{stageById.get(photo.stage_id)}</div>
                        )}
                        {photo.uploaded_by_person_id && personNameById.has(photo.uploaded_by_person_id) && (
                          <div style={{ color: "#C9A96E", fontSize: "0.56rem" }}>{personNameById.get(photo.uploaded_by_person_id)}</div>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <form action={reorderMemoryPhoto}>
                          <input type="hidden" name="photo_id" value={photo.id} />
                          <input type="hidden" name="trip_id" value={trip.id} />
                          <input type="hidden" name="direction" value="up" />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <button type="submit" aria-label="Nach oben" disabled={idx === 0} style={{ ...ICON_BUTTON_STYLE, opacity: idx === 0 ? 0.35 : 1 }}>
                            <ArrowUp size={13} strokeWidth={1.8} style={{ color: "#F0EBE3" }} />
                          </button>
                        </form>
                        <form action={reorderMemoryPhoto}>
                          <input type="hidden" name="photo_id" value={photo.id} />
                          <input type="hidden" name="trip_id" value={trip.id} />
                          <input type="hidden" name="direction" value="down" />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <button type="submit" aria-label="Nach unten" disabled={idx === photosWithUrls.length - 1} style={{ ...ICON_BUTTON_STYLE, opacity: idx === photosWithUrls.length - 1 ? 0.35 : 1 }}>
                            <ArrowDown size={13} strokeWidth={1.8} style={{ color: "#F0EBE3" }} />
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Noch keine Erinnerungen gespeichert.
            </p>
            <Link href="/content-studio" style={{ color: "var(--accent)", fontSize: "0.75rem", textDecoration: "none" }}>
              Aus Content Studio ausgewählte Bilder übernehmen →
            </Link>
          </div>
        )}

        {!!hiddenCount && (
          <p className="mt-6" style={{ color: "var(--muted)", fontSize: "0.68rem", fontStyle: "italic" }}>
            {hiddenCount} weitere hochgeladene {hiddenCount === 1 ? "Foto ist" : "Fotos sind"} (Dubletten oder außerhalb der besten {MAX_SELECTED_PHOTOS_PER_TRIP}) hier ausgeblendet, aber nicht gelöscht.
          </p>
        )}
      </div>
    </div>
  );
}
