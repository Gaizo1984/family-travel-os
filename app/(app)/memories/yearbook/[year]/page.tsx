import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { buildTravelWorld } from "@/lib/travel-world";
import { getPhotoDisplayUrls } from "@/lib/photo-thumbnails";
import { SignedPhoto } from "@/components/SignedPhoto";
import { PhotoLightbox } from "@/components/PhotoLightbox";

export default async function YearbookPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);

  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  // §"Egress-Analyse 2026-07-16": lud bisher ALLE Fotos der Familie (inkl.
  // storage_path) und filterte erst in JS aufs Jahr -- ein leichter
  // Metadaten-Pass (kein storage_path) bestimmt hier zuerst nur die IDs des
  // gewünschten Jahres, ein zweiter, gefilterter Pass lädt dafür die vollen
  // Zeilen.
  const [worldStats, { data: photoMetaRaw }] = await Promise.all([
    buildTravelWorld({ familyId }),
    supabase
      .from("memory_photos")
      .select("id, taken_at, created_at")
      .eq("family_id", familyId),
  ]);

  const photoIdsOfYear = (photoMetaRaw ?? [])
    .filter((p) => new Date(p.taken_at ?? p.created_at).getFullYear() === year)
    .map((p) => p.id);

  const { data: photosRaw } = photoIdsOfYear.length > 0
    ? await supabase
      .from("memory_photos")
      .select("id, storage_path, caption, taken_at, created_at")
      .in("id", photoIdsOfYear)
    : { data: [] };

  const photosOfYear = photosRaw ?? [];
  // §"Karten-/Grid-Ansicht bekommt nur noch ein Vorschaubild statt des vollen
  // Originals" -- Lightbox lädt weiterhin das Original separat beim Öffnen.
  const displayByPath = await getPhotoDisplayUrls("documents", photosOfYear.map((p) => p.storage_path), "thumb400");
  const photosWithUrls = photosOfYear.map((p) => {
    const resolved = displayByPath.get(p.storage_path) ?? null;
    return { ...p, url: resolved?.url ?? null, resolvedPath: resolved?.resolvedPath ?? p.storage_path };
  });

  const tripsOfYear = worldStats.timeline.filter((e) => e.kind === "trip" && e.year === year);
  const pastTripsOfYear = worldStats.timeline.filter((e) => e.kind === "past_trip" && e.year === year);

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-5xl w-full mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/memories"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Travel Memory
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Jahresrückblick
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.8rem", letterSpacing: "-0.01em" }}>
          {year}
        </h1>

        {(tripsOfYear.length > 0 || pastTripsOfYear.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-8">
            {tripsOfYear.map((t) => (
              <span key={t.key} style={{ color: "var(--accent)", fontSize: "0.68rem", background: "rgba(184,154,94,0.1)", border: "1px solid rgba(184,154,94,0.25)", padding: "4px 12px", borderRadius: "20px" }}>
                {t.title}
              </span>
            ))}
            {pastTripsOfYear.map((p) => (
              <span key={p.key} style={{ color: "var(--muted)", fontSize: "0.68rem", background: "var(--surface)", border: "1px solid var(--border)", padding: "4px 12px", borderRadius: "20px" }}>
                {p.title}
              </span>
            ))}
          </div>
        )}

        {photosWithUrls.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {photosWithUrls.map((p) => p.url && (
              <div key={p.id} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: "1/1" }}>
                <PhotoLightbox url={p.url} alt={p.caption ?? ""}>
                  <SignedPhoto storagePath={p.resolvedPath} initialUrl={p.url} alt={p.caption ?? ""} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                </PhotoLightbox>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
            Für {year} sind noch keine Fotos hinterlegt.
          </p>
        )}
      </div>
    </div>
  );
}
