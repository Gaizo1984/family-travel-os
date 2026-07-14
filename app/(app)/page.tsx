import Link from "next/link";
import { Map as MapIcon, Globe, Users } from "lucide-react";
import { formatDateDE } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { buildTravelWorld } from "@/lib/travel-world";
import { isTripPastEnd, isTripHistorical, tripCountdownDisplay } from "@/lib/trip-status";
import { deriveTripDateRange, tripDurationDays, TRIP_DATE_RANGE_OPEN_LABEL } from "@/lib/trip-dates";
import { resolveTripImage, getHighlightPhotoByTripId, type ResolvedTripImage } from "@/lib/trip-images";
import { SignedPhoto } from "@/components/SignedPhoto";

type PersonRow = { id: string; name: string; initials: string; color: string };
type TripRow = {
  id: string; slug: string; title: string; subtitle: string | null; status: string
  start_date: string | null; end_date: string | null
  gradient_from: string | null; gradient_to: string | null
  trip_members: Array<{ persons: PersonRow | null }>
  stages: Array<{ id: string; start_date: string | null; end_date: string | null }>
  bookings: Array<{ type: string; status: string; start_datetime: string | null; end_datetime: string | null }>
};

function HeroTrip({ trip, img }: { trip: TripRow; img: ResolvedTripImage | null }) {
  const range = deriveTripDateRange(trip, trip.bookings, trip.stages);
  const duration = tripDurationDays(range);
  const countdown = tripCountdownDisplay({ ...trip, start_date: range.startDate, end_date: range.endDate }, duration);
  const members = trip.trip_members.flatMap((tm) => (tm.persons ? [tm.persons] : []));

  return (
    <Link href={`/trips/${trip.slug}`} className="group relative block overflow-hidden rounded-xl" style={{ height: "340px" }}>
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

      <div className="absolute top-5 left-5 right-5 md:top-7 md:left-8 md:right-8">
        <span className="text-[10px] font-medium" style={{ color: "var(--accent)", letterSpacing: "0.24em", textTransform: "uppercase" }}>
          Nächste Reise
        </span>
        <h2
          className="font-light leading-tight mt-1.5"
          style={{ color: "#F0EBE3", letterSpacing: "-0.01em", fontSize: "clamp(1.7rem, 4.5vw, 2.7rem)" }}
        >
          {trip.title}
        </h2>
        {trip.subtitle && (
          <p className="text-[11px] md:text-xs mt-1.5" style={{ color: "#C9BFAE", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            {trip.subtitle}
          </p>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 px-5 pb-5 md:px-8 md:pb-7">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs" style={{ color: "#D8CFC0", letterSpacing: "0.02em", fontSize: "0.65rem" }}>
            {range.startDate ? formatDateDE(range.startDate) : TRIP_DATE_RANGE_OPEN_LABEL}
            {" · "}
            {duration ? `${duration} Tage` : "—"}
            {" · "}
            {trip.stages.length} Etappen
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex -space-x-1.5">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="w-6 h-6 rounded-full flex items-center justify-center font-medium"
                  style={{ background: "rgba(240,235,227,0.14)", color: "#F0EBE3", border: "1px solid rgba(240,235,227,0.22)", fontSize: "0.55rem", letterSpacing: "0.02em" }}
                >
                  {m.initials}
                </div>
              ))}
            </div>
            <div
              className="flex items-center gap-1.5 rounded-full"
              style={{ background: "rgba(196,154,90,0.14)", border: "1px solid rgba(196,154,90,0.3)", padding: "0.3rem 0.7rem" }}
            >
              <span className="font-medium" style={{ color: "var(--accent)", fontSize: "0.78rem" }}>{countdown.value}</span>
              <span style={{ color: "#C9BFAE", fontSize: "0.65rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {countdown.label}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatTile({
  value, label, Icon, href,
}: {
  value: string | number; label: string; href: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-5 py-4 transition-opacity hover:opacity-80"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", textDecoration: "none" }}
    >
      <Icon size={15} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0 }} />
      <div>
        <div className="text-2xl font-light leading-none mb-0.5" style={{ color: "var(--foreground)" }}>{value}</div>
        <div className="text-xs" style={{ color: "var(--muted)", letterSpacing: "0.04em", fontSize: "0.68rem" }}>{label}</div>
      </div>
    </Link>
  );
}

function TripCardElegant({ trip, img }: { trip: TripRow; img: ResolvedTripImage | null }) {
  const range = deriveTripDateRange(trip, trip.bookings, trip.stages);
  const duration = tripDurationDays(range);

  return (
    <Link href={`/trips/${trip.slug}`} className="group relative block overflow-hidden rounded-xl" style={{ height: "190px" }}>
      {img ? (
        <SignedPhoto
          storagePath={img.storagePath}
          initialUrl={img.url}
          alt={trip.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ transformOrigin: "center center" }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${trip.gradient_from ?? "#1a1a1a"}, ${trip.gradient_to ?? "#333"})` }} />
      )}

      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(10,9,7,0.96) 0%, rgba(10,9,7,0.5) 55%, rgba(10,9,7,0.08) 100%)" }}
      />

      <div className="absolute inset-0 p-4 flex flex-col justify-between">
        <div>
          {/* §Bugfix "vergangene Reisen zeigen Geplant": TripCardElegant rendert
              ausschließlich bereits datumsbasiert als historisch erkannte Reisen
              (siehe pastTrips unten, isTripHistorical()) -- das rohe, oft
              veraltete DB-Feld trip.status (STATUS_LABEL) darf hier nie wieder
              zur Anzeige kommen, sonst zeigt eine nie manuell aktualisierte
              Reise weiterhin "Geplant". Label ist deshalb fest "Erlebt",
              konsistent mit app/(app)/trips/page.tsx. */}
          <span className="text-xs" style={{ color: "#A89880", letterSpacing: "0.16em", textTransform: "uppercase", fontSize: "0.6rem" }}>
            Erlebt
          </span>
        </div>

        <div>
          <div className="text-base font-light mb-0.5" style={{ color: "#F0EBE3" }}>{trip.title}</div>
          <div className="mb-2" style={{ color: "#A89880", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.58rem" }}>
            {trip.subtitle}
          </div>
          <div
            className="pt-2"
            style={{ color: "#A89880", borderTop: "1px solid rgba(240,235,227,0.12)", fontSize: "0.64rem", letterSpacing: "0.02em" }}
          >
            {range.startDate ? formatDateDE(range.startDate) : TRIP_DATE_RANGE_OPEN_LABEL} · {duration} Tage · {trip.stages.length} Etappen
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function Dashboard() {
  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  // Highlightfoto-Query braucht nur familyId (keine Trip-IDs übergeben), hängt
  // also nicht von den Trips ab — direkt mit in dieselbe parallele Ladung.
  const [{ data: tripsRaw }, { count: personsCount }, worldStats, highlightPhotoByTripId] = await Promise.all([
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
    supabase.from("persons").select("id", { count: "exact", head: true }).eq("family_id", familyId),
    buildTravelWorld({ familyId }),
    getHighlightPhotoByTripId(supabase, familyId),
  ]);

  const trips = (tripsRaw ?? []) as unknown as TripRow[];
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
  const upcoming = trips.filter((t) => (t.status === "active" || t.status === "planned") && !isTripPastEnd(tripStatusInput(t)));
  const nextTrip = upcoming[0] ?? trips[0];
  const pastTrips = trips.filter((t) => isTripHistorical(tripStatusInput(t)));

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
        <HeroTrip trip={nextTrip} img={tripImageById.get(nextTrip.id) ?? null} />

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatTile value={worldStats.tripsCount} label="Reisen gesamt" Icon={MapIcon} href="/trips" />
          <StatTile value={worldStats.countryCodes.size} label="Länder besucht" Icon={Globe} href="/family/world" />
          <StatTile value={personsCount ?? 0} label="Familienmitglieder" Icon={Users} href="/family" />
        </section>

        {pastTrips.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-medium" style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}>
                Vergangene Reisen
              </h2>
              <Link href="/trips" className="text-xs" style={{ color: "var(--accent)", letterSpacing: "0.06em", fontSize: "0.72rem" }}>
                Alle anzeigen →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pastTrips.map((trip) => (
                <TripCardElegant key={trip.id} trip={trip} img={tripImageById.get(trip.id) ?? null} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
