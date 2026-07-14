import Link from "next/link";
import { Map as MapIcon, Globe, CalendarDays } from "lucide-react";
import { formatDateDE } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { restoreTrip } from "@/lib/actions/trips";
import { tripCountdownDisplay } from "@/lib/trip-status";
import { resolveTripImage, getHighlightPhotoByTripId, type ResolvedTripImage } from "@/lib/trip-images";
import { buildTravelWorld } from "@/lib/travel-world";
import { isTripHistorical, isTripCurrentlyRunning } from "@/lib/trip-status";
import { deriveTripDateRange, tripDurationDays, TRIP_DATE_RANGE_OPEN_LABEL } from "@/lib/trip-dates";
import { SignedPhoto } from "@/components/SignedPhoto";
import { PastTripsAccordion, type PastYearGroup } from "@/components/PastTripsAccordion";

const H_FG    = "#F0EBE3";
const H_MUTED = "#A89880";
const H_BORDER = "rgba(240,235,227,0.1)";

const FILTERS = [
  { key: "alle",       label: "Alle" },
  { key: "geplant",    label: "Geplant" },
  { key: "aktiv",      label: "Aktiv" },
  { key: "vergangen",  label: "Vergangen" },
  { key: "archiviert", label: "Archiviert" },
];

type PersonRow = { id: string; name: string; initials: string; color: string }
type TripRow = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  status: string
  start_date: string | null
  end_date: string | null
  cover_emoji: string | null
  gradient_from: string | null
  gradient_via: string | null
  gradient_to: string | null
  trip_members: Array<{ persons: PersonRow | null }>
  stages: Array<{ id: string; start_date: string | null; end_date: string | null }>
  bookings: Array<{ type: string; status: string; start_datetime: string | null; end_datetime: string | null }>
}

/**
 * §"Bei Reisen ist es immer noch falsch... die App muss am Datum erkennen,
 * dass die Reise abgeschlossen ist": nicht mehr auf den manuell gepflegten
 * status verlassen, sondern dieselbe datumsbasierte Einordnung wie
 * Dashboard/Familienseite/Reisegeschichte nutzen (lib/trip-status.ts) --
 * eine Reise mit vergangenem Enddatum gilt als erlebt, auch wenn ihr Status
 * nie manuell auf "completed" gesetzt wurde. Der Status wird jetzt IMMER auf
 * dem zentral abgeleiteten Zeitraum (lib/trip-dates.ts) berechnet, nicht auf
 * den ggf. leeren trips.start_date/end_date direkt -- eine Reise ganz ohne
 * manuelles Datum, aber mit Buchungen/Etappen, gilt so trotzdem korrekt als
 * laufend/vergangen.
 */
function tripWithDerivedDates(trip: TripRow): TripRow {
  const range = deriveTripDateRange(trip, trip.bookings, trip.stages);
  return { ...trip, start_date: range.startDate, end_date: range.endDate };
}

/** Reisen ohne ableitbares Datum ("Zeitraum noch offen") sortieren zuletzt statt das Ergebnis zufällig je nach DB-Reihenfolge zu belassen. */
function byDateAscending(a: TripRow, b: TripRow): number {
  if (!a.start_date && !b.start_date) return 0;
  if (!a.start_date) return 1;
  if (!b.start_date) return -1;
  return a.start_date.localeCompare(b.start_date);
}

/**
 * §Bugfix "Reisen ohne System geordnet -- bitte von jüngster zu ältester
 * Reise anordnen": Bevorstehende Reisen bleiben soonest-first (die nächste
 * anstehende Reise zuerst), erlebte Reisen werden explizit nach dem
 * abgeleiteten Zeitraum (lib/trip-dates.ts) neuste-zuerst sortiert -- vorher
 * übernahm hier stillschweigend die DB-Abfragereihenfolge (älteste zuerst).
 */
function applyFilter(trips: TripRow[], f: string): { planned: TripRow[]; past: TripRow[] } {
  const nonArchived = trips.filter((t) => t.status !== "archived").map(tripWithDerivedDates);
  const past     = nonArchived.filter((t) => isTripHistorical(t)).sort((a, b) => byDateAscending(b, a));
  const running  = nonArchived.filter((t) => !isTripHistorical(t) && isTripCurrentlyRunning(t)).sort(byDateAscending);
  const upcoming = nonArchived.filter((t) => !isTripHistorical(t) && !isTripCurrentlyRunning(t)).sort(byDateAscending);
  if (f === "aktiv")      return { planned: running, past: [] };
  if (f === "geplant")    return { planned: [...running, ...upcoming], past: [] };
  if (f === "vergangen")  return { planned: [], past };
  if (f === "archiviert") return { planned: [], past: [] };
  return { planned: [...running, ...upcoming], past };
}

/** Gruppiert erlebte Reisen (echte Trips + manuell erfasste past_trips) je Jahr für das Akkordeon, neuestes Jahr zuerst. */
function groupPastTripsByYear(trips: TripRow[], legacy: LegacyPastTripRow[]): { year: number | null; trips: TripRow[]; legacy: LegacyPastTripRow[] }[] {
  const map = new Map<number | null, { year: number | null; trips: TripRow[]; legacy: LegacyPastTripRow[] }>();
  const ensure = (year: number | null) => {
    let g = map.get(year);
    if (!g) { g = { year, trips: [], legacy: [] }; map.set(year, g); }
    return g;
  };
  trips.forEach((t) => {
    const year = t.start_date ? new Date(t.start_date).getFullYear() : null;
    ensure(year).trips.push(t);
  });
  legacy.forEach((p) => ensure(p.year).legacy.push(p));
  return [...map.values()].sort((a, b) => {
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    return b.year - a.year;
  });
}

function PlannedCard({ trip, img }: { trip: TripRow; img: ResolvedTripImage | null }) {
  const range = deriveTripDateRange(trip, trip.bookings, trip.stages);
  const duration = tripDurationDays(range);
  const countdown = tripCountdownDisplay({ ...trip, start_date: range.startDate, end_date: range.endDate }, duration);
  const members = trip.trip_members.flatMap(tm => tm.persons ? [tm.persons] : []);
  const stageCount = trip.stages.length;

  return (
    <Link
      href={`/trips/${trip.slug}`}
      className="group relative block overflow-hidden rounded-xl"
      style={{ height: "420px" }}
    >
      {img ? (
        <SignedPhoto
          storagePath={img.storagePath}
          initialUrl={img.url}
          alt={trip.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ transformOrigin: "center" }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${trip.gradient_from ?? "#1a1a1a"}, ${trip.gradient_to ?? "#333"})`,
          }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(10,9,7,0.97) 0%, rgba(10,9,7,0.7) 42%, rgba(10,9,7,0.15) 100%)",
        }}
      />

      <div className="absolute top-6 left-7">
        <span style={{ color: "#C8A96E", fontSize: "0.6rem", letterSpacing: "0.22em", textTransform: "uppercase" }}>
          {isTripCurrentlyRunning({ ...trip, start_date: range.startDate, end_date: range.endDate }) ? "Aktive Reise" : "In Planung"}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 px-7 md:px-9 pb-7 md:pb-9">
        <h3
          className="text-4xl md:text-5xl font-light leading-tight mb-2"
          style={{ color: H_FG, letterSpacing: "-0.01em" }}
        >
          {trip.title}
        </h3>
        <p className="text-xs mb-6" style={{ color: H_MUTED, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          {trip.subtitle}
        </p>

        <div className="mb-5" style={{ height: "1px", background: H_BORDER }} />

        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="flex gap-7">
            {[
              { label: "Abflug",   value: range.startDate ? formatDateDE(range.startDate) : TRIP_DATE_RANGE_OPEN_LABEL },
              { label: "Dauer",    value: duration ? `${duration} Tage` : "—" },
              { label: "Etappen",  value: stageCount > 0 ? String(stageCount) : "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ color: H_MUTED, fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "4px" }}>
                  {label}
                </div>
                <div className="text-sm font-light" style={{ color: H_FG }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-5 shrink-0">
            <div className="flex -space-x-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(240,235,227,0.1)",
                    color: H_FG,
                    border: "1px solid rgba(240,235,227,0.2)",
                    backdropFilter: "blur(6px)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.04em",
                  }}
                >
                  {m.initials}
                </div>
              ))}
            </div>
            <div className="text-right">
              <div className="text-3xl font-light leading-none" style={{ color: "#C8A96E" }}>
                {countdown.value}
              </div>
              <div style={{ color: H_MUTED, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "3px" }}>
                {countdown.label}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PastCard({ trip, img }: { trip: TripRow; img: ResolvedTripImage | null }) {
  const range = deriveTripDateRange(trip, trip.bookings, trip.stages);
  const duration = tripDurationDays(range);
  const members = trip.trip_members.flatMap(tm => tm.persons ? [tm.persons] : []);

  return (
    <Link
      href={`/trips/${trip.slug}`}
      className="group relative block overflow-hidden rounded-xl"
      style={{ height: "320px" }}
    >
      {img ? (
        <SignedPhoto
          storagePath={img.storagePath}
          initialUrl={img.url}
          alt={trip.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ transformOrigin: "center" }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${trip.gradient_from ?? "#1a1a1a"}, ${trip.gradient_to ?? "#333"})`,
          }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(10,9,7,0.96) 0%, rgba(10,9,7,0.48) 55%, rgba(10,9,7,0.06) 100%)",
        }}
      />

      <div className="absolute top-5 left-6">
        <span style={{ color: H_MUTED, fontSize: "0.58rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Erlebt
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-6">
        <h3 className="text-2xl font-light mb-1" style={{ color: H_FG, letterSpacing: "0.01em" }}>
          {trip.title}
        </h3>
        <p className="text-xs mb-5" style={{ color: H_MUTED, letterSpacing: "0.14em", textTransform: "uppercase", fontSize: "0.62rem" }}>
          {trip.subtitle}
        </p>

        <div style={{ height: "1px", background: H_BORDER, marginBottom: "14px" }} />

        <div className="flex items-end justify-between">
          <div className="flex gap-6">
            <div>
              <div style={{ color: H_MUTED, fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "3px" }}>
                Zeitraum
              </div>
              <div style={{ color: H_FG, fontSize: "0.75rem", fontWeight: 300 }}>
                {range.startDate ? formatDateDE(range.startDate) : TRIP_DATE_RANGE_OPEN_LABEL}
              </div>
            </div>
            <div>
              <div style={{ color: H_MUTED, fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "3px" }}>
                Dauer
              </div>
              <div style={{ color: H_FG, fontSize: "0.75rem", fontWeight: 300 }}>
                {duration ? `${duration} Tage` : "—"}
              </div>
            </div>
          </div>
          <div className="flex -space-x-1.5">
            {members.map((m) => (
              <div
                key={m.id}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(240,235,227,0.09)",
                  color: H_FG,
                  border: "1px solid rgba(240,235,227,0.18)",
                  backdropFilter: "blur(4px)",
                  fontSize: "0.55rem",
                }}
              >
                {m.initials}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

type LegacyPastTripRow = {
  id: string
  country_or_region: string
  year: number
  places: string | null
  duration_days: number | null
  photo_storage_path: string | null
}

/**
 * §Punkt 6 "Reisehistorie-Konsistenz": manuell erfasste vergangene Reisen
 * (past_trips) müssen hier genauso auftauchen wie in Unsere Welt/Timeline
 * (lib/travel-world.ts, family/history/page.tsx) -- gleiche Kartenoptik wie
 * PastCard, aber auf die schlankere past_trips-Datenform zugeschnitten
 * (kein Slug/keine Etappen, Link führt auf die Bearbeiten-Seite statt auf
 * eine Reisedetailseite, die für diese Einträge nicht existiert).
 */
function LegacyPastCard({ entry, url, members }: { entry: LegacyPastTripRow; url: string | null; members: PersonRow[] }) {
  const subtitle = [entry.places, entry.duration_days ? `${entry.duration_days} Tage` : null].filter(Boolean).join(" · ") || `${entry.year}`;

  return (
    <Link
      href={`/family/history/${entry.id}/edit`}
      className="group relative block overflow-hidden rounded-xl"
      style={{ height: "320px" }}
    >
      {url ? (
        <SignedPhoto
          storagePath={entry.photo_storage_path}
          initialUrl={url}
          alt={entry.country_or_region}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ transformOrigin: "center" }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1a1a1a, #333)" }} />
      )}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(10,9,7,0.96) 0%, rgba(10,9,7,0.48) 55%, rgba(10,9,7,0.06) 100%)" }}
      />

      <div className="absolute top-5 left-6">
        <span style={{ color: H_MUTED, fontSize: "0.58rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Erlebt · {entry.year}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-6">
        <h3 className="text-2xl font-light mb-1" style={{ color: H_FG, letterSpacing: "0.01em" }}>
          {entry.country_or_region}
        </h3>
        <p className="text-xs mb-5" style={{ color: H_MUTED, letterSpacing: "0.14em", textTransform: "uppercase", fontSize: "0.62rem" }}>
          {subtitle}
        </p>

        <div style={{ height: "1px", background: H_BORDER, marginBottom: "14px" }} />

        <div className="flex items-end justify-between">
          <div style={{ color: H_MUTED, fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Manuell erfasst
          </div>
          <div className="flex -space-x-1.5">
            {members.map((m) => (
              <div
                key={m.id}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(240,235,227,0.09)", color: H_FG,
                  border: "1px solid rgba(240,235,227,0.18)", backdropFilter: "blur(4px)", fontSize: "0.55rem",
                }}
              >
                {m.initials}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f = "alle" } = await searchParams;

  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  const [{ data }, highlightPhotoByTripId, worldStats, { data: pastTripsRaw }, { data: pastTravelersRaw }] = await Promise.all([
    supabase
      .from("trips")
      .select(`
        id, slug, title, subtitle, status,
        start_date, end_date, cover_emoji,
        gradient_from, gradient_via, gradient_to,
        trip_members ( persons ( id, name, initials, color ) ),
        stages ( id, start_date, end_date ),
        bookings ( type, status, start_datetime, end_datetime )
      `)
      .order("start_date", { ascending: true, nullsFirst: false }),
    getHighlightPhotoByTripId(supabase, familyId),
    // §Punkt 6: dieselbe Reisebilanz-Quelle wie "Unsere Welt" (/family/world)
    // statt einer eigenen, hier abweichenden Berechnung.
    buildTravelWorld({ familyId }),
    supabase
      .from("past_trips")
      .select("id, country_or_region, year, places, duration_days, photo_storage_path")
      .eq("family_id", familyId)
      .order("year", { ascending: false }),
    supabase.from("past_trip_travelers").select("past_trip_id, persons ( id, name, initials, color )"),
  ]);

  const trips = (data ?? []) as unknown as TripRow[];
  const tripImageById = new Map(trips.map((t) => [t.id, resolveTripImage(t, highlightPhotoByTripId.get(t.id) ?? null)]));
  const { planned, past: pastAllYears } = applyFilter(trips, f);

  const archivedTrips = trips.filter((t) => t.status === "archived");

  // §Punkt 6 "Reisehistorie-Konsistenz": manuell erfasste vergangene Reisen
  // (past_trips) erscheinen hier wie überall sonst (Timeline, Unsere Welt),
  // statt nur in trips zu suchen.
  const pastTripsAllYears = (pastTripsRaw ?? []) as LegacyPastTripRow[];
  // Legacy-Einträge nur bei "alle"/"vergangen" mit anzeigen (wie zuvor).
  const legacyForDisplay = (f === "alle" || f === "vergangen") ? pastTripsAllYears : [];

  const travelersByPastTrip = new Map<string, PersonRow[]>();
  (pastTravelersRaw ?? []).forEach((row) => {
    const person = row.persons as unknown as PersonRow | null;
    if (!person) return;
    const list = travelersByPastTrip.get(row.past_trip_id) ?? [];
    list.push(person);
    travelersByPastTrip.set(row.past_trip_id, list);
  });
  const pastTripPhotoUrlById = new Map<string, string>();
  await Promise.all(legacyForDisplay.map(async (p) => {
    if (!p.photo_storage_path) return;
    const { data: signed } = await supabase.storage.from("documents").createSignedUrl(p.photo_storage_path, 3600);
    if (signed?.signedUrl) pastTripPhotoUrlById.set(p.id, signed.signedUrl);
  }));

  const pastYearGroups: PastYearGroup[] = groupPastTripsByYear(pastAllYears, legacyForDisplay).map((g) => ({
    year: g.year,
    count: g.trips.length + g.legacy.length,
    node: (
      <>
        {g.trips.map((trip) => (
          <PastCard key={trip.id} trip={trip} img={tripImageById.get(trip.id) ?? null} />
        ))}
        {g.legacy.map((entry) => (
          <LegacyPastCard
            key={entry.id}
            entry={entry}
            url={pastTripPhotoUrlById.get(entry.id) ?? null}
            members={travelersByPastTrip.get(entry.id) ?? []}
          />
        ))}
      </>
    ),
  }));

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 px-5 md:px-8 pb-14 max-w-4xl w-full mx-auto">

        <header className="flex items-start justify-between flex-wrap gap-4 pt-9 pb-7">
          <div>
            <h1 className="text-2xl font-light mb-1" style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}>
              Unsere Reisen
            </h1>
            <p className="text-xs" style={{ color: "var(--muted)", letterSpacing: "0.08em", fontSize: "0.7rem" }}>
              Geplant, erlebt und unvergessen.
            </p>
          </div>
          <div className="flex items-center flex-wrap gap-4">
            <Link
              href="/plan"
              style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.08em", textDecoration: "none" }}
            >
              Reiseidee entwickeln
            </Link>
            <Link href="/trips/new" className="btn-neue-reise">+ Reise anlegen</Link>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-11" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "18px" }}>
          {FILTERS.map(({ key, label }) => {
            const isActive = f === key;
            return (
              <Link
                key={key}
                href={key === "alle" ? "/trips" : `/trips?f=${key}`}
                style={{
                  fontSize: "0.72rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: isActive ? "var(--foreground)" : "var(--muted)",
                  borderBottom: isActive ? `1px solid var(--accent)` : "1px solid transparent",
                  paddingBottom: "6px",
                  textDecoration: "none",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {planned.length > 0 && (
          <section className="mb-12">
            <div className="mb-5" style={{ color: "var(--accent)", fontSize: "0.6rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
              Geplant
            </div>
            <div className="space-y-4">
              {planned.map((trip) => (
                <PlannedCard key={trip.id} trip={trip} img={tripImageById.get(trip.id) ?? null} />
              ))}
            </div>
          </section>
        )}

        {pastYearGroups.length > 0 && (
          <section className="mb-14">
            <div className="mb-5" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
              Erlebt
            </div>
            <PastTripsAccordion groups={pastYearGroups} />
          </section>
        )}

        {f === "archiviert" && (
          <section className="mb-14">
            <div className="mb-5" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
              Archiviert
            </div>
            {archivedTrips.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {archivedTrips.map((trip) => (
                  <div key={trip.id} className="relative">
                    <PastCard trip={trip} img={tripImageById.get(trip.id) ?? null} />
                    <div className="absolute top-4 right-4 flex items-center gap-2" style={{ zIndex: 5 }}>
                      <form action={restoreTrip}>
                        <input type="hidden" name="trip_id" value={trip.id} />
                        <button
                          type="submit"
                          style={{
                            fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase",
                            color: "#F0EBE3", background: "rgba(184,154,94,0.28)",
                            border: "1px solid rgba(184,154,94,0.4)", padding: "5px 12px",
                            borderRadius: "20px", backdropFilter: "blur(4px)", cursor: "pointer",
                          }}
                        >
                          Wiederherstellen
                        </button>
                      </form>
                      <Link
                        href={`/trips/${trip.slug}/delete`}
                        style={{
                          fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase",
                          color: "#F0EBE3", background: "rgba(181,98,74,0.3)",
                          border: "1px solid rgba(181,98,74,0.45)", padding: "5px 12px",
                          borderRadius: "20px", backdropFilter: "blur(4px)", textDecoration: "none",
                        }}
                      >
                        Endgültig löschen
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                Keine archivierten Reisen.
              </p>
            )}
          </section>
        )}

        {(f === "alle" || f === "vergangen") && (
          <section>
            <div className="mb-8" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.24em", textTransform: "uppercase", borderTop: "1px solid var(--border)", paddingTop: "48px" }}>
              Eure Reisebilanz
            </div>
            <div className="flex gap-12 md:gap-20">
              {[
                { Icon: MapIcon,      value: worldStats.tripsCount,          label: "Reisen" },
                { Icon: Globe,        value: worldStats.countryCodes.size,   label: "Länder" },
                { Icon: CalendarDays, value: worldStats.travelDays,          label: "Reisetage" },
              ].map(({ Icon, value, label }) => (
                <div key={label} className="flex items-center gap-4">
                  <Icon size={13} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0 }} />
                  <div>
                    <div className="text-4xl font-light leading-none mb-1" style={{ color: "var(--foreground)" }}>
                      {value}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                      {label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
