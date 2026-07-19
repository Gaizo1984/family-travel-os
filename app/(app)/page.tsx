import Link from "next/link";
import { Map as MapIcon, Globe, Users, CalendarDays } from "lucide-react";
import { formatDateDE } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { buildTravelWorldForFamilyAndPersons } from "@/lib/travel-world";
import { isTripPastEnd, tripCountdownDisplay } from "@/lib/trip-status";
import { deriveTripDateRange, tripDurationDays, TRIP_DATE_RANGE_OPEN_LABEL } from "@/lib/trip-dates";
import { resolveTripImage, getHighlightPhotoByTripId, type ResolvedTripImage } from "@/lib/trip-images";
import { computeTripReadiness, type ReadinessResult } from "@/lib/readiness";
import { SignedPhoto } from "@/components/SignedPhoto";
import { WorldMap } from "@/components/WorldMap";
import { WorldMapCarousel, type WorldMapPanel } from "@/components/WorldMapCarousel";
import { resolveCurrentLocation, nearbyStageGeocodeCandidates } from "@/lib/today";
import { getWeatherForLocation, describeWeatherCode, type WeatherResult } from "@/lib/weather";
import { COUNTRY_NAMES } from "@/lib/geo-suggestions";
import { todayIsoInFamilyTimezone } from "@/lib/time";
import type { StageInput, TimelineBooking } from "@/lib/journey";

type PersonRow = { id: string; name: string; initials: string; color: string };
type TripRow = {
  id: string; slug: string; title: string; subtitle: string | null; status: string
  start_date: string | null; end_date: string | null
  gradient_from: string | null; gradient_to: string | null
  trip_members: Array<{ persons: PersonRow | null }>
  stages: Array<{ id: string; start_date: string | null; end_date: string | null }>
  bookings: Array<{ type: string; status: string; start_datetime: string | null; end_datetime: string | null }>
};

/** §"ToDos analog Reisedashboard": gleiche Label-/Farblogik wie die Hero-Pille auf der Reise-Detailseite (app/(app)/trips/[id]/page.tsx). */
function readinessPill(readiness: ReadinessResult): { label: string; color: string } {
  if (readiness.status === "ready") return { label: "Reisebereit", color: "#4C7A5D" };
  const label = readiness.conflictCount > 0 && readiness.hintCount > 0
    ? `${readiness.conflictCount} ${readiness.conflictCount === 1 ? "ToDo" : "ToDos"} · ${readiness.hintCount} ${readiness.hintCount === 1 ? "Hinweis" : "Hinweise"}`
    : readiness.conflictCount > 0
      ? `${readiness.conflictCount} ${readiness.conflictCount === 1 ? "ToDo" : "ToDos"}`
      : `${readiness.hintCount} ${readiness.hintCount === 1 ? "Hinweis" : "Hinweise"}`;
  const color = readiness.status === "conflicts" ? "#B5624A" : "#B89A5E";
  return { label, color };
}

function HeroTrip({
  trip, img, readiness, weather,
}: {
  trip: TripRow; img: ResolvedTripImage | null; readiness: ReadinessResult | null
  /** §"Tageswetter auf dem Cover" (Nutzervorgabe) -- null, solange sich kein Standort geokodieren lässt. */
  weather: WeatherResult | null
}) {
  const range = deriveTripDateRange(trip, trip.bookings, trip.stages);
  const duration = tripDurationDays(range);
  const countdown = tripCountdownDisplay({ ...trip, start_date: range.startDate, end_date: range.endDate }, duration);
  const members = trip.trip_members.flatMap((tm) => (tm.persons ? [tm.persons] : []));
  const todo = readiness && readiness.status !== "ready" ? readinessPill(readiness) : null;
  const weatherInfo = weather ? describeWeatherCode(weather.currentCode) : null;
  const weatherPrecipitation = weather?.daily[0]?.precipitationProbability ?? null;

  return (
    <div className="group relative overflow-hidden rounded-xl" style={{ height: "340px" }}>
    <Link href={`/trips/${trip.slug}`} className="absolute inset-0 block">
      {img && (
        <SignedPhoto
          storagePath={img.storagePath}
          initialUrl={img.url}
          alt={trip.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ transformOrigin: "center center" }}
        />
      )}
      {/* Nur dezenter Verlauf für Lesbarkeit oben/unten -- die Bildmitte bleibt frei, damit das Foto trägt. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,9,7,0.55) 0%, rgba(10,9,7,0.08) 30%, rgba(10,9,7,0.05) 50%, rgba(10,9,7,0.88) 100%)",
        }}
      />

      <div className="absolute top-7 left-4 right-4 md:top-9 md:left-6 md:right-6" style={{ paddingRight: todo ? "130px" : undefined }}>
        <span className="text-[10px] font-medium" style={{ color: "var(--accent)", letterSpacing: "0.24em", textTransform: "uppercase" }}>
          Nächste Reise
        </span>
        <h2
          className="font-light leading-tight mt-1.5"
          style={{ color: "#F0EBE3", letterSpacing: "-0.01em", fontSize: "clamp(1.5rem, 3.8vw, 2.3rem)" }}
        >
          {trip.title}
        </h2>
        {trip.subtitle && (
          <p className="text-[11px] md:text-xs mt-1.5" style={{ color: "#C9BFAE", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            {trip.subtitle}
          </p>
        )}
        {weather && (
          <div className="flex items-center gap-1.5 mt-1.5" style={{ color: "#F0EBE3", fontSize: "0.78rem" }}>
            {weatherInfo && <weatherInfo.icon size={14} strokeWidth={1.6} />}
            {weather.currentTemp}°C
            {weather.rainStartsAt
              ? ` · Regen ab ${weather.rainStartsAt} Uhr`
              : weatherPrecipitation !== null ? ` · ${weatherPrecipitation}% Regen` : ""}
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 md:px-6 md:pb-6">
        <div className="flex items-center justify-between gap-1.5" style={{ flexWrap: "nowrap" }}>
          <div
            className="min-w-0 flex-1"
            style={{ color: "#D8CFC0", letterSpacing: "0.01em", fontSize: "0.6rem", whiteSpace: "nowrap", overflow: "hidden" }}
          >
            {range.startDate ? formatDateDE(range.startDate) : TRIP_DATE_RANGE_OPEN_LABEL}
            {" · "}
            {duration ? `${duration} Tage` : "—"}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex -space-x-1">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="w-5 h-5 rounded-full flex items-center justify-center font-medium shrink-0"
                  style={{ background: "rgba(240,235,227,0.14)", color: "#F0EBE3", border: "1px solid rgba(240,235,227,0.22)", fontSize: "0.48rem", letterSpacing: "0.01em" }}
                >
                  {m.initials}
                </div>
              ))}
            </div>
            <div
              className="flex items-center gap-1 rounded-full shrink-0"
              style={{ background: "rgba(196,154,90,0.14)", border: "1px solid rgba(196,154,90,0.3)", padding: "0.24rem 0.5rem", whiteSpace: "nowrap" }}
            >
              <span className="font-medium" style={{ color: "var(--accent)", fontSize: "0.7rem" }}>{countdown.value}</span>
              <span style={{ color: "#C9BFAE", fontSize: "0.58rem", letterSpacing: "0.02em", textTransform: "uppercase" }}>
                {countdown.label}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>

    {todo && (
      <Link
        href={`/trips/${trip.slug}/ready-to-travel`}
        className="absolute flex items-center gap-2 transition-opacity hover:opacity-80"
        style={{
          top: "20px", right: "20px", zIndex: 2,
          background: "rgba(10,9,7,0.82)", border: `1px solid ${todo.color}55`,
          padding: "5px 12px", borderRadius: "20px", textDecoration: "none",
        }}
      >
        <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: todo.color }} />
        <span style={{ fontSize: "0.64rem", letterSpacing: "0.04em", fontWeight: 500, color: "#F0EBE3" }}>
          {todo.label}
        </span>
      </Link>
    )}
    </div>
  );
}

/**
 * §"4 Felder statt untereinander, optisch schöner": kompaktes vertikales
 * Kachel-Format (Icon → Wert → Label) statt der breiten Einzeiler-Reihe --
 * gleiches Muster wie die Statistik-Kacheln auf /family/world, damit ein
 * 2×2-Raster (mobil) / 4er-Reihe (Desktop) sauber aufgeht.
 */
function StatTile({
  value, label, Icon, href,
}: {
  value: string | number; label: string; href?: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
}) {
  const content = (
    <>
      <Icon size={13} strokeWidth={1.4} style={{ color: "var(--accent)", marginBottom: "8px" }} />
      <div className="text-xl font-light leading-none mb-1 truncate" style={{ color: "var(--foreground)" }}>{value}</div>
      <div className="truncate" style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
    </>
  );
  const className = "block rounded-xl p-4";
  const style: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" };
  // §"Weltkarte liegt jetzt direkt darunter": das "Länder besucht"-Tile
  // braucht keinen Link mehr auf /family/world -- die volle Erfahrung
  // (Karte + Reisegeschichte) ist bereits Teil dieses Dashboards.
  if (!href) return <div className={className} style={style}>{content}</div>;
  return (
    <Link href={href} className={`${className} transition-opacity hover:opacity-80`} style={style}>
      {content}
    </Link>
  );
}

/** Gleiche Reisegeschichte-Timeline wie zuvor auf der Familienseite, jetzt hier -- einzige Datenquelle bleibt buildTravelWorld (lib/travel-world.ts). */
function TravelHistoryTimeline({ entries }: { entries: Array<{ key: string; year: number; label: string; isNext: boolean }> }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Noch keine Reisegeschichte erfasst.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl p-6 overflow-x-auto scroll-hide" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-start" style={{ width: "max-content", minWidth: "100%" }}>
        {entries.flatMap((h, idx) => [
          <div key={h.key} className="flex flex-col items-center" style={{ minWidth: "80px" }}>
            <div
              className="w-2.5 h-2.5 rounded-full mb-3"
              style={{
                background: h.isNext ? "var(--accent)" : "transparent",
                border: `1.5px solid ${h.isNext ? "var(--accent)" : "var(--muted)"}`,
                boxShadow: h.isNext ? "0 0 0 4px rgba(184,154,94,0.12)" : "none",
              }}
            />
            <div className="text-sm font-light text-center" style={{ color: h.isNext ? "var(--foreground)" : "var(--muted)" }}>
              {h.label}
            </div>
            <div className="text-center mt-1" style={{ color: h.isNext ? "var(--accent)" : "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.08em" }}>
              {h.isNext ? `${h.year} · Aktuelle Reise` : h.year}
            </div>
          </div>,
          idx < entries.length - 1 ? (
            <div key={`sep-${idx}`} className="flex-1" style={{ height: "1px", background: "var(--border)", marginTop: "5px", minWidth: "24px" }} />
          ) : null,
        ])}
      </div>
    </div>
  );
}

export default async function Dashboard() {
  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  // Highlightfoto-Query braucht nur familyId (keine Trip-IDs übergeben), hängt
  // also nicht von den Trips ab — direkt mit in dieselbe parallele Ladung.
  // §"Ladezeit-Performance, N+1 vermeiden" (Nutzervorgabe): die Gesamtfamilien-
  // Weltstatistik wandert bewusst in die zweite Promise.all weiter unten --
  // dort wird sie zusammen mit den Pro-Personen-Varianten aus EINER
  // gemeinsamen Rohdaten-Abfrage berechnet (buildTravelWorldForFamilyAndPersons),
  // statt wie zuvor je einen eigenen buildTravelWorld()-Aufruf (und damit
  // dieselben 3 Supabase-Abfragen) für die Gesamtfamilie UND jedes einzelne
  // Familienmitglied auszulösen.
  const [{ data: tripsRaw }, { data: personsRaw }, highlightPhotoByTripId] = await Promise.all([
    supabase
      .from("trips")
      .select(`
        id, slug, title, subtitle, status, start_date, end_date, gradient_from, gradient_to,
        trip_members ( persons ( id, name, initials, color ) ),
        stages ( id, start_date, end_date ),
        bookings ( type, status, start_datetime, end_datetime )
      `)
      .eq("family_id", familyId)
      .order("start_date", { ascending: true, nullsFirst: false }),
    supabase.from("persons").select("id, name, initials, color").eq("family_id", familyId).order("name"),
    getHighlightPhotoByTripId(supabase, familyId),
  ]);

  const trips = (tripsRaw ?? []) as unknown as TripRow[];
  const persons = personsRaw ?? [];
  // §"Reisezeitraum automatisch ableiten": Status/Sortierung nutzen den
  // zentral abgeleiteten Zeitraum (lib/trip-dates.ts), nicht die ggf. leeren
  // trips.start_date/end_date direkt -- sonst würde eine Reise ganz ohne
  // manuelles Datum, aber mit Buchungen/Etappen, hier fälschlich fehlen.
  const tripStatusInput = (t: TripRow) => {
    const range = deriveTripDateRange(t, t.bookings, t.stages);
    return { status: t.status, start_date: range.startDate, end_date: range.endDate };
  };
  // Nicht allein auf den (oft veralteten) Status verlassen: Eine Reise, deren
  // Enddatum bereits vergangen ist, darf nie als "Nächste Reise" erscheinen,
  // selbst wenn sie nie manuell auf "completed" gesetzt wurde.
  // §Bugfix "Hauptdashboard zeigt falsche nächste Reise" (Nutzer-Feedback):
  // die obige SQL-Abfrage sortiert nach der ROHEN trips.start_date-Spalte
  // (nullsFirst: false) -- eine Reise ganz ohne eigenes Datum, aber mit
  // datierten Etappen/Buchungen (wie hier `deriveTripDateRange` es auflöst),
  // rutschte dadurch ans Ende, obwohl sie chronologisch die nächste ist.
  // /today und /trips sortieren bereits korrekt nach dem abgeleiteten Zeitraum
  // -- hier fehlte exakt dieser zweite Sortierschritt nach der Filterung.
  const upcoming = trips
    .filter((t) => (t.status === "active" || t.status === "planned") && !isTripPastEnd(tripStatusInput(t)))
    .sort((a, b) => (tripStatusInput(a).start_date ?? "").localeCompare(tripStatusInput(b).start_date ?? ""));
  const nextTrip = upcoming[0] ?? trips[0];

  // Highlightfoto je Reise (falls die Familie eines markiert hat) — erste Stufe der Bildauflösung.
  const tripImageById = new Map(trips.map((t) => [t.id, resolveTripImage(t, highlightPhotoByTripId.get(t.id) ?? null)]));

  if (!nextTrip) {
    return (
      <div className="flex-1 flex flex-col">
        <header className="flex items-start justify-between gap-4 px-7 md:px-10 pt-9 pb-7">
          <div>
            <h1 className="text-lg font-light mb-1" style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}>Hallo!</h1>
            <p className="text-xs" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>Noch keine Reisen angelegt.</p>
          </div>
          <Link href="/trips/new" className="btn-neue-reise" style={{ flexShrink: 0 }}>+ Neue Reise</Link>
        </header>
      </div>
    );
  }

  // §"Tageswetter auf dem Cover der Reise" (Nutzervorgabe): die eingangs
  // geladenen Trip-Felder reichen für die Datumsableitung, aber nicht für die
  // Standort-Auflösung (resolveCurrentLocation braucht location/country_code
  // je Etappe) -- gezielter Zusatz-Query nur für die eine angezeigte Reise,
  // statt die Haupt-Query für alle Reisen unnötig zu vergrößern.
  const { data: nextTripDetailRaw } = await supabase
    .from("trips")
    .select(`
      stages ( id, title, location, start_date, end_date, nights, accommodation, sort_order, country_code ),
      bookings ( id, type, title, provider, status, start_datetime, end_datetime, stage_id, details )
    `)
    .eq("id", nextTrip.id)
    .maybeSingle();
  const nextTripStages = (nextTripDetailRaw?.stages ?? []) as StageInput[];
  const nextTripBookings = (nextTripDetailRaw?.bookings ?? []) as TimelineBooking[];
  const todayIso = todayIsoInFamilyTimezone();
  const currentLocation = resolveCurrentLocation(nextTrip, nextTripStages, nextTripBookings, todayIso);
  const countryName = currentLocation.countryCode ? COUNTRY_NAMES[currentLocation.countryCode] ?? null : null;
  const weatherCandidates = [
    { query: currentLocation.label, countryCode: currentLocation.countryCode },
    ...nearbyStageGeocodeCandidates(nextTripStages, currentLocation.label, currentLocation.countryCode, todayIso),
    ...(countryName && countryName !== currentLocation.label ? [{ query: countryName }] : []),
  ];

  // §"Weltkarte von Familie aufs Hauptdashboard": erst Gesamtkarte, danach
  // per Swipe/Dots eine Karte je Familienmitglied -- alle aus derselben
  // buildTravelWorld-Quelle wie /family/world, keine eigene Aggregation.
  // §"Ladezeit-Performance, N+1 vermeiden": EIN Aufruf statt (Anzahl Personen
  // + 1) einzelner buildTravelWorld()-Aufrufe -- siehe lib/travel-world.ts.
  const [{ family: worldStats, byPersonId: perPersonWorlds }, nextTripReadiness, nextTripWeather] = await Promise.all([
    buildTravelWorldForFamilyAndPersons(familyId, persons.map((p) => p.id)),
    computeTripReadiness(nextTrip.id),
    getWeatherForLocation(weatherCandidates),
  ]);
  const mapPanels: WorldMapPanel[] = [
    {
      key: "family",
      label: "Familie gesamt",
      initials: "Alle",
      color: null,
      href: "/family/world",
      node: <WorldMap visitedCodes={worldStats.countryCodes} />,
    },
    ...persons.map((p) => ({
      key: p.id,
      label: p.name,
      initials: p.initials,
      color: p.color,
      href: `/family/world?person=${p.id}`,
      node: <WorldMap visitedCodes={perPersonWorlds.get(p.id)!.countryCodes} />,
    })),
  ];

  // §Bugfix "zeigt nicht alle Reisen": zuvor pauschal auf die letzten 5
  // Timeline-Einträge gekappt, unabhängig von Jahr/Reisenden -- zeigt jetzt
  // alle Reisen ab 2021 mit mindestens 2 beteiligten Personen (Nutzervorgabe,
  // wörtlich), keine willkürliche Obergrenze mehr.
  const timelineEntries = worldStats.timeline
    .filter((e) => (e.year ?? 0) >= 2021 && e.travelerIds.length >= 2)
    .map((e) => ({ key: e.key, year: e.year ?? 0, label: e.title, isNext: e.isCurrent }));

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-start justify-between gap-4 px-7 md:px-10 pt-9 pb-7">
        <div style={{ minWidth: 0 }}>
          <h1 className="text-lg font-light mb-1" style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}>
            Hallo Sarah & Marcel
          </h1>
          <p className="text-xs" style={{ color: "var(--muted)", letterSpacing: "0.08em", fontSize: "0.7rem" }}>
            Eure Reisen. Eure Erinnerungen.
          </p>
        </div>
        <Link href="/trips/new" className="btn-neue-reise" style={{ flexShrink: 0 }}>+ Neue Reise</Link>
      </header>

      <div className="flex-1 px-5 md:px-8 pb-10 space-y-7">
        <HeroTrip trip={nextTrip} img={tripImageById.get(nextTrip.id) ?? null} readiness={nextTripReadiness} weather={nextTripWeather} />

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile value={worldStats.tripsCount} label="Reisen gesamt" Icon={MapIcon} href="/trips" />
          <StatTile value={worldStats.countryCodes.size} label="Länder besucht" Icon={Globe} />
          <StatTile value={worldStats.travelDays} label="Urlaubstage" Icon={CalendarDays} />
          <StatTile value={persons.length} label="Familienmitglieder" Icon={Users} href="/family" />
        </section>

        <section>
          <h2 className="text-xs font-medium mb-5" style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}>
            Unsere Welt
          </h2>
          <WorldMapCarousel panels={mapPanels} />
        </section>

        <section>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="text-xs font-medium" style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}>
              Unsere Reisegeschichte
            </h2>
            <Link href="/family/history" style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}>
              Alle ansehen →
            </Link>
          </div>
          <TravelHistoryTimeline entries={timelineEntries} />
        </section>
      </div>
    </div>
  );
}
