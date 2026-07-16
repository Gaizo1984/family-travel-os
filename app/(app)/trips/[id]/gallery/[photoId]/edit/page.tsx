import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { updateMemoryPhoto, replaceMemoryPhoto, deleteMemoryPhoto, createMemoryUploadSlots } from "@/lib/actions/memories";
import { DirectPhotoUploadForm } from "@/components/DirectPhotoUploadForm";
import { Banner } from "@/components/Banner";
import { SignedPhoto } from "@/components/SignedPhoto";
import { getPhotoDisplayUrl } from "@/lib/photo-thumbnails";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

export default async function GalleryPhotoEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; photoId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, photoId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  const { data: trip } = await supabase.from("trips").select("id, slug, title").eq("slug", id).maybeSingle();
  if (!trip) notFound();

  const [{ data: photo }, { data: stagesRaw }] = await Promise.all([
    supabase.from("memory_photos").select("id, storage_path, caption, stage_id, trip_id").eq("id", photoId).maybeSingle(),
    supabase.from("stages").select("id, title").eq("trip_id", trip.id).order("sort_order", { ascending: true }),
  ]);
  if (!photo || photo.trip_id !== trip.id) notFound();

  const stages = stagesRaw ?? [];
  const resolvedPhoto = await getPhotoDisplayUrl("documents", photo.storage_path, "thumb800");
  const returnTo = `/trips/${trip.slug}/gallery`;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={returnTo}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Galerie
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Foto bearbeiten
        </div>

        {error && <Banner variant="error">{error}</Banner>}

        {resolvedPhoto && (
          <div className="relative rounded-xl overflow-hidden mb-6" style={{ aspectRatio: "4/3" }}>
            <SignedPhoto storagePath={resolvedPhoto.resolvedPath} initialUrl={resolvedPhoto.url} alt={photo.caption ?? ""} className="absolute inset-0 w-full h-full object-cover" />
          </div>
        )}

        <form action={updateMemoryPhoto} className="mb-6">
          <input type="hidden" name="photo_id" value={photo.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="mb-5">
              <label htmlFor="edit-caption" style={LABEL_STYLE}>Notiz</label>
              <input id="edit-caption" name="caption" type="text" defaultValue={photo.caption ?? ""} style={FIELD_STYLE} />
            </div>
            {stages.length > 0 && (
              <div className="mb-6">
                <label htmlFor="edit-stage" style={LABEL_STYLE}>Etappe</label>
                <select id="edit-stage" name="stage_id" defaultValue={photo.stage_id ?? ""} style={FIELD_STYLE}>
                  <option value="">— keine Zuordnung —</option>
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
            )}
            <div className="flex justify-end">
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

        <div className="mb-6">
          <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "10px" }}>
            Foto ersetzen
          </div>
          <DirectPhotoUploadForm action={replaceMemoryPhoto} createSlots={createMemoryUploadSlots} fileInputName="replacement_file">
            <input type="hidden" name="photo_id" value={photo.id} />
            <input type="hidden" name="family_id" value={familyId} />
            <input type="hidden" name="return_to" value={returnTo} />
            <div className="rounded-xl p-6 flex items-center gap-3 flex-wrap" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <input id="replacement_file" name="replacement_file" type="file" accept="image/jpeg,image/png,image/webp" style={{ ...FIELD_STYLE, flex: 1, minWidth: "200px" }} />
              <button
                type="submit"
                style={{
                  background: "transparent", color: "var(--accent)", border: "1px solid rgba(184,154,94,0.4)",
                  borderRadius: "6px", padding: "10px 18px", fontSize: "0.62rem", letterSpacing: "0.1em",
                  textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
                }}
              >
                Ersetzen
              </button>
            </div>
          </DirectPhotoUploadForm>
        </div>

        <form action={deleteMemoryPhoto} className="flex justify-end">
          <input type="hidden" name="photo_id" value={photo.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <button
            type="submit"
            style={{
              background: "transparent", color: "#B5624A", border: "1px solid rgba(181,98,74,0.35)",
              borderRadius: "6px", padding: "9px 16px", fontSize: "0.62rem", letterSpacing: "0.08em",
              textTransform: "uppercase", cursor: "pointer", WebkitAppearance: "none", appearance: "none",
            }}
          >
            Foto löschen
          </button>
        </form>

      </div>
    </div>
  );
}
