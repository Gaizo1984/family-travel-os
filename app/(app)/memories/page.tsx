import Link from "next/link";
import { ChevronLeft, Trash2, Users, Image as ImageIcon } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { LUMI_CORE_DOCUMENTS_BUCKET } from "@/lib/lumi-core-storage/paths";
import { getFamily } from "@/lib/family";
import { listHouseholdMembers } from "@/lib/household-members";
import { deleteMemoryPhoto, setCoverPhoto } from "@/lib/actions/memories";
import { deriveTripDateRange } from "@/lib/trip-dates";
import { getPhotoDisplayUrls, getPhotoDisplayUrl } from "@/lib/photo-thumbnails";
import { Banner } from "@/components/Banner";
import { SignedPhoto } from "@/components/SignedPhoto";
import { PhotoLightbox } from "@/components/PhotoLightbox";

type PhotoRow = {
  id: string; trip_id: string | null; past_trip_id: string | null; uploaded_by_household_member_id: string | null
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
 * §Bugfix "Reisegeschichte ist fehlgeleitet": führt jetzt auf die eigene
 * Detailansicht statt direkt auf die Bearbeiten-Seite.
 */
function LegacyPastTripTile({ entry, url }: { entry: LegacyPastTripPhoto; url: string | null }) {
  if (!url) return null;
  return (
    <Link
      href={`/family/history/${entry.id}`}
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
function PhotoCard({
  photo, url, resolvedPath, personName, returnTo, isCover,
}: { photo: PhotoRow; url: string | null; resolvedPath: string | null; personName: string | null; returnTo: string; isCover: boolean }) {
  if (!url) return null;
  return (
    <div className="relative rounded-lg overflow-hidden group mb-4 break-inside-avoid">
      <PhotoLightbox url={url} alt={photo.caption ?? ""}>
        <SignedPhoto storagePath={resolvedPath ?? photo.storage_path} initialUrl={url} alt={photo.caption ?? ""} loading="lazy" className="block w-full h-auto" />
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

type CutEntry = { photo: PhotoRow; url: string | null; resolvedPath: string | null };
type Cut = { key: string; year: number; sortKey: string; label: string; entries: CutEntry[] };

export default async function MemoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; year?: string }>;
}) {
  const { error, year: yearParam } = await searchParams;
  const lumiCore = await createLumiCoreClient();
  const { id: familyId } = await getFamily();
  const returnTo = "/memories";

  // §"Egress-Analyse 2026-07-16": diese Seite lud bisher die KOMPLETTE
  // Fotohistorie der Familie unpaginiert in voller Auflösung. Erster
  // Durchgang holt nur leichte Metadaten (kein storage_path) für ALLE Fotos,
  // um zu bestimmen, welchem Jahr jedes Foto zugeordnet ist -- signiert/lädt
  // aber NUR das ausgewählte Jahr wirklich. Andere Jahre werden nur noch als
  // kompakte Links gezeigt (Drilldown über die bestehende Yearbook-Seite).
  const [{ data: photoMetaRaw }, householdMembers, { data: tripsRaw }, { data: pastTripsRaw }] = await Promise.all([
    lumiCore
      .from("travel_memory_photos")
      .select("id, trip_id, past_trip_id, taken_at, created_at, is_selected")
      .eq("household_id", familyId),
    listHouseholdMembers(),
    lumiCore
      .from("travel_trips")
      .select("id, title, cover_photo_id, start_date, end_date")
      .eq("household_id", familyId),
    // §Bugfix "Fotos aus Travel Memory sind past_trips nicht zuordenbar":
    // ALLE past_trips der Familie werden geladen (nicht mehr nur die mit
    // eigenem photo_storage_path) -- auch eine Reise ohne eigenes Titelbild
    // kann jetzt über memory_photos.past_trip_id zugeordnete Galeriefotos haben.
    lumiCore.from("travel_past_trips").select("id, country_or_region, year, places, photo_storage_path").eq("household_id", familyId),
  ]);

  const trips = tripsRaw ?? [];
  const tripById = new Map(trips.map((t) => [t.id, t]));
  const coverPhotoIds = new Set(trips.flatMap((t) => (t.cover_photo_id ? [t.cover_photo_id] : [])));
  const pastTrips = pastTripsRaw ?? [];
  const pastTripById = new Map(pastTrips.map((pt) => [pt.id, pt]));

  // §Lumi-Core-Cutover: keine PostgREST-Embeddings zwischen travel_*-Tabellen
  // -- Etappen/Buchungen je Reise flach nachgeladen und per Map wieder
  // zugeordnet, statt eines verschachtelten `trips`-Selects (siehe
  // app/(app)/today/page.tsx::fetchTripsForToday für dasselbe Muster).
  const tripIds = trips.map((t) => t.id);
  const [{ data: stagesRaw }, { data: bookingsRaw }] = tripIds.length
    ? await Promise.all([
        lumiCore.from("travel_stages").select("trip_id, start_date, end_date").in("trip_id", tripIds),
        lumiCore.from("travel_bookings").select("trip_id, type, status, start_datetime, end_datetime").in("trip_id", tripIds),
      ])
    : [{ data: [] }, { data: [] }] as const;
  const stagesByTrip = new Map<string, { start_date: string | null; end_date: string | null }[]>();
  (stagesRaw ?? []).forEach((s) => stagesByTrip.set(s.trip_id, [...(stagesByTrip.get(s.trip_id) ?? []), { start_date: s.start_date, end_date: s.end_date }]));
  const bookingsByTrip = new Map<string, { type: string; status: string; start_datetime: string | null; end_datetime: string | null }[]>();
  (bookingsRaw ?? []).forEach((b) => bookingsByTrip.set(b.trip_id, [...(bookingsByTrip.get(b.trip_id) ?? []), { type: b.type, status: b.status, start_datetime: b.start_datetime, end_datetime: b.end_datetime }]));
  const tripRangeById = new Map(trips.map((t) => [t.id, deriveTripDateRange(t, bookingsByTrip.get(t.id) ?? [], stagesByTrip.get(t.id) ?? [])]));

  const allPhotoMeta = photoMetaRaw ?? [];
  const selectedPhotoMeta = allPhotoMeta.filter((p) => p.is_selected);
  const hiddenCount = allPhotoMeta.length - selectedPhotoMeta.length;
  const personNameById = new Map(householdMembers.map((p) => [p.id, p.name]));

  function yearOfPhoto(p: { trip_id: string | null; past_trip_id: string | null; taken_at: string | null; created_at: string }): number {
    const fallbackDate = (p.taken_at ?? p.created_at).slice(0, 10);
    if (p.trip_id) {
      const range = tripRangeById.get(p.trip_id);
      const sortKey = range?.startDate ?? fallbackDate;
      return new Date(sortKey + "T00:00:00Z").getUTCFullYear();
    }
    // §past_trips haben kein exaktes Datum, nur `year`.
    if (p.past_trip_id) return pastTripById.get(p.past_trip_id)?.year ?? new Date(fallbackDate).getUTCFullYear();
    return new Date(fallbackDate).getUTCFullYear();
  }

  const photoCountByYear = new Map<number, number>();
  for (const p of selectedPhotoMeta) {
    const y = yearOfPhoto(p);
    photoCountByYear.set(y, (photoCountByYear.get(y) ?? 0) + 1);
  }
  const legacyEntries = pastTrips.filter((p): p is typeof p & { photo_storage_path: string; year: number } => Boolean(p.photo_storage_path) && p.year != null);
  for (const p of legacyEntries) photoCountByYear.set(p.year, (photoCountByYear.get(p.year) ?? 0) + 1);

  const allYears = [...photoCountByYear.keys()].sort((a, b) => b - a);
  const selectedYear = yearParam && photoCountByYear.has(Number(yearParam)) ? Number(yearParam) : allYears[0];
  const otherYears = allYears.filter((y) => y !== selectedYear);

  const photoIdsInSelectedYear = selectedPhotoMeta.filter((p) => yearOfPhoto(p) === selectedYear).map((p) => p.id);
  const { data: photosRaw } = photoIdsInSelectedYear.length > 0
    ? await lumiCore
      .from("travel_memory_photos")
      .select("id, trip_id, past_trip_id, uploaded_by_household_member_id, storage_path, taken_at, caption, created_at, sort_order, is_selected, is_duplicate_of, quality_score")
      .in("id", photoIdsInSelectedYear)
      .order("taken_at", { ascending: false, nullsFirst: false })
    : { data: [] };

  const photos = (photosRaw ?? []) as PhotoRow[];
  // §"Karten-/Grid-Ansicht bekommt nur noch ein 400px-Vorschaubild statt des
  // vollen bis zu 2000px breiten Originals" -- Original bleibt exklusiv der
  // Lightbox (components/PhotoLightbox.tsx nutzt weiterhin `url`, das hier
  // bewusst ein Thumbnail ist; siehe Optimierungsplan Punkt 4 -- die Lightbox
  // selbst lädt separat das Original bei tatsächlichem Öffnen).
  const displayByPath = await getPhotoDisplayUrls(LUMI_CORE_DOCUMENTS_BUCKET, photos.map((p) => p.storage_path), "thumb400");

  // §"Neueste Bilder oben, mit einem Cut je Reise (z.B. 03/2025 Mauritius,
  // 07/2025 Malediven)": Fotos werden zuerst je Reise gruppiert (nicht mehr
  // nur nach Kalenderjahr) -- jede Reise wird ein eigener, mit Monat/Jahr und
  // Reisetitel beschrifteter Abschnitt. Fotos ohne Reise-Zuordnung bekommen
  // einen eigenen "Nicht zugeordnet"-Cut.
  const cuts = new Map<string, Cut>();
  for (const p of photos) {
    const resolved = displayByPath.get(p.storage_path) ?? null;
    const entry: CutEntry = { photo: p, url: resolved?.url ?? null, resolvedPath: resolved?.resolvedPath ?? null };
    const fallbackDate = (p.taken_at ?? p.created_at).slice(0, 10);
    if (p.trip_id) {
      const key = `trip-${p.trip_id}`;
      if (!cuts.has(key)) {
        const range = tripRangeById.get(p.trip_id);
        const sortKey = range?.startDate ?? fallbackDate;
        const trip = tripById.get(p.trip_id);
        cuts.set(key, {
          key, year: selectedYear, sortKey,
          label: `${monthYearLabel(sortKey)} · ${trip?.title ?? "Reise"}`,
          entries: [],
        });
      }
      cuts.get(key)!.entries.push(entry);
    } else if (p.past_trip_id) {
      // §Bugfix "Fotos aus Travel Memory sind past_trips nicht zuordenbar":
      // eigener Cut je manuell erfasster Reise, wie bei `trips` -- nur ohne
      // Monat (past_trips kennen kein exaktes Datum, nur `year`).
      const key = `past-trip-${p.past_trip_id}`;
      if (!cuts.has(key)) {
        const pastTrip = pastTripById.get(p.past_trip_id);
        cuts.set(key, {
          key, year: selectedYear, sortKey: `${pastTrip?.year ?? selectedYear}-01-01`,
          label: pastTrip ? `${pastTrip.year} · ${pastTrip.country_or_region}` : "Reisegeschichte",
          entries: [],
        });
      }
      cuts.get(key)!.entries.push(entry);
    } else {
      const key = `unassigned-${selectedYear}`;
      if (!cuts.has(key)) cuts.set(key, { key, year: selectedYear, sortKey: `${selectedYear}-01-01`, label: "Nicht zugeordnet", entries: [] });
      cuts.get(key)!.entries.push(entry);
    }
  }
  for (const cut of cuts.values()) {
    cut.entries.sort((a, b) => {
      if (a.photo.sort_order !== b.photo.sort_order) return a.photo.sort_order - b.photo.sort_order;
      return (b.photo.taken_at ?? b.photo.created_at).localeCompare(a.photo.taken_at ?? a.photo.created_at);
    });
  }
  const cutsInSelectedYear = [...cuts.values()].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const legacyInSelectedYear = legacyEntries.filter((p) => p.year === selectedYear);
  const legacyWithUrls = await Promise.all(
    legacyInSelectedYear.map(async (p) => {
      const resolved = await getPhotoDisplayUrl(LUMI_CORE_DOCUMENTS_BUCKET, p.photo_storage_path, "thumb400");
      return { entry: { id: p.id, country_or_region: p.country_or_region, places: p.places }, url: resolved?.url ?? null };
    }),
  );

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

        {allYears.length > 0 ? (
          <>
            <section className="mb-12">
              <div className="flex items-center justify-between mb-5">
                <Link href={`/memories/yearbook/${selectedYear}`} className="text-lg font-light" style={{ color: "var(--foreground)", textDecoration: "none" }}>
                  {selectedYear}
                </Link>
                <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{photoCountByYear.get(selectedYear) ?? 0} Fotos</span>
              </div>

              {cutsInSelectedYear.map((cut) => (
                <div key={cut.key} className="mb-8">
                  <div className="mb-3" style={{ color: "var(--muted)", fontSize: "0.66rem", letterSpacing: "0.06em" }}>
                    {cut.label}
                  </div>
                  <div className="columns-2 sm:columns-3 gap-4">
                    {cut.entries.map(({ photo, url, resolvedPath }) => (
                      <PhotoCard key={photo.id} photo={photo} url={url} resolvedPath={resolvedPath} personName={photo.uploaded_by_household_member_id ? personNameById.get(photo.uploaded_by_household_member_id) ?? null : null} returnTo={returnTo} isCover={coverPhotoIds.has(photo.id)} />
                    ))}
                  </div>
                </div>
              ))}

              {legacyWithUrls.length > 0 && (
                <div className="columns-2 sm:columns-3 gap-4">
                  {legacyWithUrls.map(({ entry, url }) => (
                    <LegacyPastTripTile key={entry.id} entry={entry} url={url} />
                  ))}
                </div>
              )}
            </section>

            {otherYears.length > 0 && (
              <section className="mb-8">
                <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>
                  Weitere Jahre
                </div>
                <div className="flex flex-wrap gap-2">
                  {otherYears.map((y) => (
                    <Link
                      key={y}
                      href={`/memories?year=${y}`}
                      className="rounded-lg px-4 py-2 transition-opacity hover:opacity-80"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none", color: "var(--foreground)", fontSize: "0.78rem" }}
                    >
                      {y} <span style={{ color: "var(--muted)", fontSize: "0.65rem" }}>({photoCountByYear.get(y)})</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
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
