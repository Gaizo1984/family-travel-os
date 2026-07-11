import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { buildWorldStats } from "@/lib/world-stats";

export default async function YearbookPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);

  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  const [worldStats, { data: photosRaw }] = await Promise.all([
    buildWorldStats(familyId),
    supabase
      .from("memory_photos")
      .select("id, storage_path, caption, taken_at, created_at")
      .eq("family_id", familyId),
  ]);

  const photosOfYear = (photosRaw ?? []).filter(
    (p) => new Date(p.taken_at ?? p.created_at).getFullYear() === year,
  );
  const photosWithUrls = await Promise.all(
    photosOfYear.map(async (p) => {
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(p.storage_path, 3600);
      return { ...p, url: signed?.signedUrl ?? null };
    }),
  );

  const tripsOfYear = worldStats.trips.filter((t) => t.start_date && new Date(t.start_date).getFullYear() === year);
  const pastTripsOfYear = worldStats.pastTrips.filter((p) => p.year === year);

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl w-full mx-auto px-5 md:px-8 pb-24 pt-9">

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
              <span key={t.id} style={{ color: "var(--accent)", fontSize: "0.68rem", background: "rgba(184,154,94,0.1)", border: "1px solid rgba(184,154,94,0.25)", padding: "4px 12px", borderRadius: "20px" }}>
                {t.title}
              </span>
            ))}
            {pastTripsOfYear.map((p) => (
              <span key={p.id} style={{ color: "var(--muted)", fontSize: "0.68rem", background: "var(--surface)", border: "1px solid var(--border)", padding: "4px 12px", borderRadius: "20px" }}>
                {p.country_or_region}
              </span>
            ))}
          </div>
        )}

        {photosWithUrls.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photosWithUrls.map((p) => p.url && (
              <div key={p.id} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: "1/1" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? ""} className="absolute inset-0 w-full h-full object-cover" />
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
