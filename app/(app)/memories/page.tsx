import Link from "next/link";
import { ChevronLeft, Trash2, Users, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { deleteMemoryPhoto, setCoverPhoto } from "@/lib/actions/memories";
import { deriveTripDateRange } from "@/lib/trip-dates";
import { Banner } from "@/components/Banner";
import { SignedPhoto } from "@/components/SignedPhoto";
import { PhotoLightbox } from "@/components/PhotoLightbox";

type PhotoRow = {
  id: string; trip_id: string | null; uploaded_by_person_id: string | null
  storage_path: string; taken_at: string | null; caption: string | null
  created_at: string; sort_order: number
  is_selected: boolean; is_duplicate_of: string | null; quality_score: number | null
};

type LegacyPastTripPhoto = { id: string; country_or_region: string; places: string | null };

/**
 * §Punkt 6 "Reisehistorie-Konsistenz": manuell erfasste vergangene Reisen
 * (past_trips) haben nur ein einzelnes Foto und kein Highlight-/Titelbild-/
 * Lösch-Konzept (im Gegensatz zu memory_photos) — echte Verschmelzung der
 * Fotomodelle wäre eine Schema-Änderung über diesen Sprint hinaus. Deshalb
 * hier bewusst eine schlanke, nicht-interaktive Kachel statt PhotoCard,
 * damit vergangene Reisen in der Galerie sichtbar sind, ohne Funktionen
 * vorzutäuschen (Highlight/Löschen/Titelbild), die es für sie nicht gibt.
 */
function LegacyPastTripTile({ entry, url }: { entry: LegacyPastTripPhoto; url: string | null }) {
  if (!url) return null;
  return (
    <Link
      href={`/family/history/${entry.id}/edit`}
      className="relative block rounded-lg overflow-hidden mb-4 break-inside-avoid"
      style={{ aspectRatio: "1/1" }}
    >
      <SignedPhoto storagePath={null} initialUrl={url} alt={entry.country_or_region} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      <div
        className="absolute inset-0 flex flex-col justify-end p-2"
        style={{ background: "linear-gradient(to bottom, transparent 50%, rgba(10,9,7,0.75) 100%)" }}
      >
        <div style={{ color: "#F0EBE3", fontSize: "0.62rem", lineHeight: 1.3 }}>
          {entry.country_or_region}
          {entry.places && <div style={{ color: "#C9A96E", fontSize: "0.58rem" }}>{entry.places}</div>}
        </div>
      </div>
    </Link>
  );
}

/**
 * §"Nichts wird abgeschnitten oder verdreht (hoch, quer, 9:16, 4:3 etc.)":
 * die Kachel erzwingt KEIN festes Seitenverhältnis mehr (kein `aspectRatio` +
 * `object-fit: cover`) -- das Bild fließt in seiner echten Größe (`w-full
 * h-auto`), das Seitenverhältnis bleibt dadurch exakt erhalten. Das
 * umschließende Grid nutzt CSS-Columns (Masonry-Technik) statt eines
 * gleichmäßigen Rasters, da unterschiedlich hohe Kacheln sonst Lücken reißen.
 */
function PhotoCard({ photo, url, personName, returnTo, isCover }: { photo: PhotoRow; url: string | null; personName: string | null; returnTo: string; isCover: boolean }) {
  if (!url) return null;
  return (
    <div className="relative rounded-lg overflow-hidden group mb-4 break-inside-avoid">
      <PhotoLightbox url={url} alt={photo.caption ?? ""}>
        <SignedPhoto storagePath={photo.storage_path} initialUrl={url} alt={photo.caption ?? ""} loading="lazy" className="block w-full h-auto" />
      </PhotoLightbox>
      <div
        className="absolute inset-0 flex flex-col justify-between p-2"
        style={{ background: "linear-gradient(to bottom, rgba(10,9,7,0.5) 0%, transparent 30%, transparent 70%, rgba(10,9,7,0.7) 100%)", pointerEvents: "none", zIndex: 2 }}
      >
        <div className="flex items-center justify-end gap-1" style={{ pointerEvents: "auto" }}>
          {photo.trip_id && !isCover && (
            <form action={setCoverPhoto}>
              <input type="hidden" name="photo_id" value={photo.id} />
              <input type="hidden" name="trip_id" value={photo.trip_id} />
              <input type="hidden" name="return_to" value={returnTo} />
              <button type="submit" aria-label="Als Titelbild verwenden" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "10px", margin: "-6px" }}>
                <ImageIcon size={14} strokeWidth={1.8} style={{ color: "#F0EBE3" }} />
              </button>
            </form>
          )}
          {isCover && (
            <span aria-label="Aktuelles Titelbild" style={{ display: "flex", padding: "10px", margin: "-6px" }}>
              <ImageIcon size={14} strokeWidth={1.8} fill="#F0EBE3" style={{ color: "#F0EBE3" }} />
            </span>
          )}
          <form action={deleteMemoryPhoto}>
            <input type="hidden" name="photo_id" value={photo.id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <button type="submit" aria-label="Löschen" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "10px", margin: "-6px" }}>
              <Trash2 size={13} strokeWidth={1.8} style={{ color: "#F0EBE3" }} />
            </button>
          </form>
        </div>
        {(photo.caption || personName) && (
          <div style={{ color: "#F0EBE3", fontSize: "0.62rem", lineHeight: 1.3 }}>
            {photo.caption}
            {personName && <div style={{ color: "#C9A96E", fontSize: "0.58rem" }}>{personName}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function monthYearLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

type CutEntry = { photo: PhotoRow; url: string | null };
type Cut = { key: string; year: number; sortKey: string; label: string; entries: CutEntry[] };

export default async function MemoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { id: familyId } = await getFamily();
  const returnTo = "/memories";

  const [{ data: photosRaw }, { data: personsRaw }, { data: tripsRaw }, { data: pastTripsRaw }] = await Promise.all([
    supabase
      .from("memory_photos")
      .select("id, trip_id, uploaded_by_person_id, storage_path, taken_at, caption, created_at, sort_order, is_selected, is_duplicate_of, quality_score")
      .eq("family_id", familyId)
      .order("taken_at", { ascending: false, nullsFirst: false }),
    supabase.from("persons").select("id, name").eq("family_id", familyId),
    supabase
      .from("trips")
      .select(`
        id, title, cover_photo_id, start_date, end_date,
        stages ( start_date, end_date ),
        bookings ( type, status, start_datetime, end_datetime )
      `)
      .eq("family_id", familyId),
    supabase.from("past_trips").select("id, country_or_region, year, places, photo_storage_path").eq("family_id", familyId).not("photo_storage_path", "is", null),
  ]);

  const trips = tripsRaw ?? [];
  const tripById = new Map(trips.map((t) => [t.id, t]));
  const tripRangeById = new Map(trips.map((t) => [t.id, deriveTripDateRange(t, t.bookings, t.stages)]));
  const coverPhotoIds = new Set(trips.flatMap((t) => (t.cover_photo_id ? [t.cover_photo_id] : [])));

  const allPhotos = (photosRaw ?? []) as PhotoRow[];
  // §"Maximal 25 Erinnerungsbilder je Reise": nicht ausgewählte Fotos (Dubletten
  // oder außerhalb der KI-Auswahl) werden hier ausgeblendet, aber nie gelöscht.
  const photos = allPhotos.filter((p) => p.is_selected);
  const hiddenCount = allPhotos.length - photos.length;
  const persons = personsRaw ?? [];
  const personNameById = new Map(persons.map((p) => [p.id, p.name]));

  const photosWithUrls = await Promise.all(
    photos.map(async (p) => {
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(p.storage_path, 3600);
      return { photo: p, url: signed?.signedUrl ?? null };
    }),
  );

  // §"Neueste Bilder oben, mit einem Cut je Reise (z.B. 03/2025 Mauritius,
  // 07/2025 Malediven)": Fotos werden zuerst je Reise gruppiert (nicht mehr
  // nur nach Kalenderjahr) -- jede Reise wird ein eigener, mit Monat/Jahr und
  // Reisetitel beschrifteter Abschnitt. Die Sortierung nutzt denselben
  // abgeleiteten Reisezeitraum wie überall sonst (lib/trip-dates.ts). Fotos
  // ohne Reise-Zuordnung bekommen einen eigenen "Nicht zugeordnet"-Cut je Jahr.
  const cuts = new Map<string, Cut>();
  for (const entry of photosWithUrls) {
    const p = entry.photo;
    const fallbackDate = (p.taken_at ?? p.created_at).slice(0, 10);
    if (p.trip_id) {
      const key = `trip-${p.trip_id}`;
      if (!cuts.has(key)) {
        const range = tripRangeById.get(p.trip_id);
        const sortKey = range?.startDate ?? fallbackDate;
        const trip = tripById.get(p.trip_id);
        cuts.set(key, {
          key, year: new Date(sortKey + "T00:00:00Z").getUTCFullYear(), sortKey,
          label: `${monthYearLabel(sortKey)} · ${trip?.title ?? "Reise"}`,
          entries: [],
        });
      }
      cuts.get(key)!.entries.push(entry);
    } else {
      const year = new Date(fallbackDate).getUTCFullYear();
      const key = `unassigned-${year}`;
      if (!cuts.has(key)) cuts.set(key, { key, year, sortKey: `${year}-01-01`, label: "Nicht zugeordnet", entries: [] });
      cuts.get(key)!.entries.push(entry);
    }
  }
  for (const cut of cuts.values()) {
    cut.entries.sort((a, b) => {
      if (a.photo.sort_order !== b.photo.sort_order) return a.photo.sort_order - b.photo.sort_order;
      return (b.photo.taken_at ?? b.photo.created_at).localeCompare(a.photo.taken_at ?? a.photo.created_at);
    });
  }

  const legacyByYear = new Map<number, { entry: LegacyPastTripPhoto; url: string | null }[]>();
  const legacyWithUrls = await Promise.all(
    (pastTripsRaw ?? [])
      .filter((p): p is typeof p & { photo_storage_path: string } => Boolean(p.photo_storage_path))
      .map(async (p) => {
        const { data: signed } = await supabase.storage.from("documents").createSignedUrl(p.photo_storage_path, 3600);
        return { year: p.year, entry: { id: p.id, country_or_region: p.country_or_region, places: p.places }, url: signed?.signedUrl ?? null };
      }),
  );
  for (const { year, entry, url } of legacyWithUrls) {
    if (!legacyByYear.has(year)) legacyByYear.set(year, []);
    legacyByYear.get(year)!.push({ entry, url });
  }

  const years = [...new Set([...cuts.values()].map((c) => c.year).concat([...legacyByYear.keys()]))].sort((a, b) => b - a);

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-5xl w-full mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/"
          className="flex items-center gap-2 mb-6 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Übersicht
        </Link>

        <header className="mb-8">
          <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
            Travel Memory
          </div>
          <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.6rem", letterSpacing: "-0.01em" }}>
            Eure gemeinsame Reisegalerie
          </h1>
          <p className="mt-2 mb-2" style={{ color: "var(--muted)", fontSize: "0.76rem", lineHeight: 1.5 }}>
            Fotos hochladen, bearbeiten oder als Titelbild markieren geht direkt über die Galerie der jeweiligen Reise.
          </p>
          <Link href="/memories/unzugeordnet" style={{ color: "var(--accent)", fontSize: "0.72rem", textDecoration: "none" }}>
            Nicht zugeordnete Erinnerungen →
          </Link>
        </header>

        {error && <Banner variant="error">{error}</Banner>}

        {/* ── Neueste zuerst, je Jahr in Reise-Abschnitte ("Cuts") unterteilt ── */}
        {years.length > 0 ? (
          years.map((year) => {
            const cutsInYear = [...cuts.values()].filter((c) => c.year === year).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
            const yearLegacy = legacyByYear.get(year) ?? [];
            const yearPhotoCount = cutsInYear.reduce((sum, c) => sum + c.entries.length, 0);
            return (
              <section key={year} className="mb-12">
                <div className="flex items-center justify-between mb-5">
                  <Link href={`/memories/yearbook/${year}`} className="text-lg font-light" style={{ color: "var(--foreground)", textDecoration: "none" }}>
                    {year}
                  </Link>
                  <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{yearPhotoCount} Fotos</span>
                </div>

                {cutsInYear.map((cut) => (
                  <div key={cut.key} className="mb-8">
                    <div className="mb-3" style={{ color: "var(--muted)", fontSize: "0.66rem", letterSpacing: "0.06em" }}>
                      {cut.label}
                    </div>
                    <div className="columns-2 sm:columns-3 gap-4">
                      {cut.entries.map(({ photo, url }) => (
                        <PhotoCard key={photo.id} photo={photo} url={url} personName={photo.uploaded_by_person_id ? personNameById.get(photo.uploaded_by_person_id) ?? null : null} returnTo={returnTo} isCover={coverPhotoIds.has(photo.id)} />
                      ))}
                    </div>
                  </div>
                ))}

                {yearLegacy.length > 0 && (
                  <div className="columns-2 sm:columns-3 gap-4">
                    {yearLegacy.map(({ entry, url }) => (
                      <LegacyPastTripTile key={entry.id} entry={entry} url={url} />
                    ))}
                  </div>
                )}
              </section>
            );
          })
        ) : (
          <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
            Noch keine Erinnerungsfotos vorhanden — Fotos lassen sich direkt über die Galerie der jeweiligen Reise hinzufügen.
          </p>
        )}

        <div className="flex items-center gap-2 mt-4">
          <Users size={12} strokeWidth={1.6} style={{ color: "var(--muted)" }} />
          <p style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
            Persönliche Ansichten je Familienmitglied unter{" "}
            <Link href="/family" style={{ color: "var(--accent)" }}>Familie → Profil → Erinnerungen</Link>.
          </p>
        </div>

        {hiddenCount > 0 && (
          <p className="mt-2" style={{ color: "var(--muted)", fontSize: "0.68rem", fontStyle: "italic" }}>
            {hiddenCount} weitere hochgeladene {hiddenCount === 1 ? "Foto ist" : "Fotos sind"} (Dubletten oder außerhalb der besten Auswahl je Reise) hier ausgeblendet, aber nicht gelöscht.
          </p>
        )}
      </div>
    </div>
  );
}
