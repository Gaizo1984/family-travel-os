import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateStage, deleteStage, setStageCoverPhoto, clearStageCoverPhoto } from "@/lib/actions/stages";
import { StageDateFields } from "../../StageDateFields";
import { Banner } from "@/components/Banner";
import { SignedPhoto } from "@/components/SignedPhoto";

type StageRow = {
  id: string
  title: string
  location: string | null
  start_date: string | null
  end_date: string | null
  nights: number | null
  accommodation: string | null
  notes: string | null
  cover_photo_id: string | null
  is_transit: boolean
}

export default async function EditStagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; stageId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, stageId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: stage } = await supabase
    .from("stages")
    .select("id, title, location, start_date, end_date, nights, accommodation, notes, cover_photo_id, is_transit")
    .eq("id", stageId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (!stage) notFound();
  const s = stage as StageRow;

  const [{ count: stageCount }, { data: photosRaw }] = await Promise.all([
    supabase.from("stages").select("id", { count: "exact", head: true }).eq("trip_id", trip.id),
    supabase
      .from("memory_photos")
      .select("id, storage_path, caption")
      .eq("trip_id", trip.id)
      .eq("is_selected", true)
      .order("taken_at", { ascending: false, nullsFirst: false })
      .limit(30),
  ]);

  const canDelete = (stageCount ?? 0) > 1;

  const galleryPhotos = await Promise.all(
    (photosRaw ?? []).map(async (p) => {
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(p.storage_path, 3600);
      return { id: p.id, storagePath: p.storage_path, caption: p.caption, url: signed?.signedUrl ?? null };
    }),
  );

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/trips/${trip.slug}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {trip.title}
        </Link>

        <div
          style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}
        >
          Etappe bearbeiten
        </div>
        <h1
          className="font-light mb-8"
          style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}
        >
          {s.title}
        </h1>

        <form action={updateStage}>
          <input type="hidden" name="stage_id" value={s.id} />
          <input type="hidden" name="slug" value={trip.slug} />

          <div
            className="rounded-xl p-8 mb-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {error && (
              <Banner variant="error">
                {error}
              </Banner>
            )}

            <div className="mb-5">
              <label
                htmlFor="stage-title"
                style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
              >
                Ziel *
              </label>
              <input
                id="stage-title"
                name="title"
                type="text"
                required
                defaultValue={s.title}
                placeholder="z. B. Dubai"
                style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.9rem", fontWeight: 300, outline: "none" }}
              />
            </div>

            <StageDateFields defaultStartDate={s.start_date ?? ""} defaultEndDate={s.end_date ?? ""} />

            <div className="mb-5">
              <label
                htmlFor="stage-accommodation"
                style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
              >
                Unterkunft
              </label>
              <input
                id="stage-accommodation"
                name="accommodation"
                type="text"
                defaultValue={s.accommodation ?? ""}
                style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.9rem", fontWeight: 300, outline: "none" }}
              />
            </div>

            <div className="mb-8">
              <label
                htmlFor="stage-notes"
                style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
              >
                Notizen
              </label>
              <textarea
                id="stage-notes"
                name="notes"
                rows={3}
                defaultValue={s.notes ?? ""}
                style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.85rem", fontWeight: 300, outline: "none", resize: "none" }}
              />
            </div>

            <label className="flex items-start gap-2.5 mb-8" style={{ cursor: "pointer" }}>
              <input type="checkbox" name="is_transit" value="true" defaultChecked={s.is_transit} style={{ marginTop: "3px" }} />
              <span style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>
                Nur Zwischenstopp -- zählt nicht als besuchtes Land in "Unsere Welt"
              </span>
            </label>

            <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <Link
                href={`/trips/${trip.slug}`}
                style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}
              >
                Abbrechen
              </Link>
              <button
                type="submit"
                style={{ background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px", padding: "11px 20px", fontSize: "0.65rem", letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none" }}
              >
                Änderungen speichern
              </button>
            </div>
          </div>
        </form>

        <div
          className="rounded-xl p-6 mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Etappenbild
            </div>
            {s.cover_photo_id && (
              <form action={clearStageCoverPhoto}>
                <input type="hidden" name="stage_id" value={s.id} />
                <input type="hidden" name="slug" value={trip.slug} />
                <button
                  type="submit"
                  style={{
                    fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)",
                    background: "transparent", border: "1px solid var(--border)", padding: "5px 12px",
                    borderRadius: "20px", cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  Automatisches Bild verwenden
                </button>
              </form>
            )}
          </div>
          {galleryPhotos.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {galleryPhotos.map((photo) => photo.url && (
                <div key={photo.id} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: "1/1" }}>
                  <SignedPhoto
                    storagePath={photo.storagePath} initialUrl={photo.url} alt={photo.caption ?? ""}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {s.cover_photo_id === photo.id ? (
                    <span
                      className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full"
                      style={{ width: "26px", height: "26px", background: "rgba(10,9,7,0.6)", backdropFilter: "blur(4px)" }}
                    >
                      <ImageIcon size={13} strokeWidth={1.8} fill="#F0EBE3" style={{ color: "#F0EBE3" }} />
                    </span>
                  ) : (
                    <form action={setStageCoverPhoto} className="absolute inset-0">
                      <input type="hidden" name="stage_id" value={s.id} />
                      <input type="hidden" name="photo_id" value={photo.id} />
                      <input type="hidden" name="slug" value={trip.slug} />
                      <button
                        type="submit"
                        aria-label="Als Etappenbild verwenden"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "none", border: "none", cursor: "pointer" }}
                      />
                    </form>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Noch keine Fotos dieser Reise in Travel Memory — sobald welche hochgeladen sind, könnt ihr hier eines für diese Etappe auswählen.
            </p>
          )}
        </div>

        <div
          className="rounded-xl p-6 flex items-center justify-between flex-wrap gap-3"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", maxWidth: "320px" }}>
            {canDelete
              ? "Diese Etappe endgültig aus der Reise entfernen."
              : "Die letzte Etappe einer Reise kann nicht gelöscht werden — jede Reise braucht mindestens eine."}
          </p>
          {canDelete && (
            <form action={deleteStage}>
              <input type="hidden" name="stage_id" value={s.id} />
              <input type="hidden" name="trip_id" value={trip.id} />
              <input type="hidden" name="slug" value={trip.slug} />
              <button
                type="submit"
                style={{ background: "transparent", color: "#B5624A", border: "1px solid rgba(181,98,74,0.35)", borderRadius: "6px", padding: "9px 18px", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none" }}
              >
                Etappe löschen
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
