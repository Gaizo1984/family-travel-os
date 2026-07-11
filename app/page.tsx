import Link from "next/link";
import { Map as MapIcon, Globe, Users } from "lucide-react";
import { formatDateDE, getTripDuration } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { buildWorldStats } from "@/lib/world-stats";
import { isTripPastEnd, isTripHistorical, tripCountdownDisplay } from "@/lib/trip-status";
import { resolveTripImage, getHighlightPhotoByTripId } from "@/lib/trip-images";

const STATUS_LABEL: Record<string, string> = {
  planned: "Geplant",
  active: "Aktiv",
  completed: "Abgeschlossen",
};

type PersonRow = { id: string; name: string; initials: string; color: string };
type TripRow = {
  id: string; slug: string; title: string; subtitle: string | null; status: string
  start_date: string | null; end_date: string | null
  gradient_from: string | null; gradient_to: string | null
  trip_members: Array<{ persons: PersonRow | null }>
  stages: Array<{ id: string }>
};

function HeroTrip({ trip, imgUrl }: { trip: TripRow; imgUrl: string | null }) {
  const duration = trip.start_date && trip.end_date ? getTripDuration(trip.start_date, trip.end_date) : 0;
  const countdown = tripCountdownDisplay(trip, duration);
  const members = trip.trip_members.flatMap((tm) => (tm.persons ? [tm.persons] : []));

  return (
    <Link href={`/trips/${trip.slug}`} className="group relative block overflow-hidden rounded-xl" style={{ height: "440px" }}>
      {imgUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgUrl}
          alt={trip.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ transformOrigin: "center center" }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(10,9,7,0.97) 0%, rgba(10,9,7,0.72) 42%, rgba(10,9,7,0.18) 100%)" }}
      />

      <div className="absolute top-6 left-7">
        <span className="text-xs font-medium" style={{ color: "var(--accent)", letterSpacing: "0.22em", textTransform: "uppercase" }}>
          Nächste Reise
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 px-7 md:px-9 pb-7 md:pb-9">
        <h2 className="text-4xl md:text-5xl font-light leading-tight mb-2" style={{ color: "#F0EBE3", letterSpacing: "-0.01em" }}>
          {trip.title}
        </h2>
        <p className="text-xs mb-6" style={{ color: "#A89880", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          {trip.subtitle}
        </p>

        <div className="mb-5" style={{ height: "1px", background: "rgba(240,235,227,0.12)" }} />

        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="flex gap-7">
            {[
              { label: "Abflug", value: trip.start_date ? formatDateDE(trip.start_date) : "—" },
              { label: "Dauer", value: duration ? `${duration} Tage` : "—" },
              { label: "Etappen", value: String(trip.stages.length) },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-xs mb-1" style={{ color: "#A89880", letterSpacing: "0.14em", textTransform: "uppercase", fontSize: "0.65rem" }}>
                  {label}
                </div>
                <div className="text-sm font-light" style={{ color: "#F0EBE3" }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-5 shrink-0">
            <div className="flex -space-x-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                  style={{ background: "rgba(240,235,227,0.12)", color: "#F0EBE3", border: "1px solid rgba(240,235,227,0.22)", backdropFilter: "blur(6px)", fontSize: "0.62rem", letterSpacing: "0.04em" }}
                >
                  {m.initials}
                </div>
              ))}
            </div>
            <div className="text-right">
              <div className="text-3xl font-light leading-none" style={{ color: "var(--accent)" }}>
                {countdown.value}
              </div>
              <div className="text-xs mt-1" style={{ color: "#A89880", letterSpacing: "0.08em", fontSize: "0.65rem", textTransform: "uppercase" }}>
                {countdown.label}
              </div>
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

function TripCardElegant({ trip, imgUrl }: { trip: TripRow; imgUrl: string | null }) {
  const duration = trip.start_date && trip.end_date ? getTripDuration(trip.start_date, trip.end_date) : 0;

  return (
    <Link href={`/trips/${trip.slug}`} className="group relative block overflow-hidden rounded-xl" style={{ height: "190px" }}>
      {imgUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgUrl}
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
          <span className="text-xs" style={{ color: "#A89880", letterSpacing: "0.16em", textTransform: "uppercase", fontSize: "0.6rem" }}>
            {STATUS_LABEL[trip.status] ?? trip.status}
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
            {trip.start_date ? formatDateDE(trip.start_date) : "—"} · {duration} Tage · {trip.stages.length} Etappen
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: family } = await supabase.from("families").select("id").limit(1).single();
  const familyId = family?.id ?? "";

  const [{ data: tripsRaw }, { count: personsCount }, worldStats] = await Promise.all([
    supabase
      .from("trips")
      .select(`
        id, slug, title, subtitle, status, start_date, end_date, gradient_from, gradient_to,
        trip_members ( persons ( id, name, initials, color ) ),
        stages ( id )
      `)
      .eq("family_id", familyId)
      .order("start_date", { ascending: true, nullsFirst: false }),
    supabase.from("persons").select("id", { count: "exact", head: true }).eq("family_id", familyId),
    buildWorldStats(familyId),
  ]);

  const trips = (tripsRaw ?? []) as unknown as TripRow[];
  // Nicht allein auf den (oft veralteten) Status verlassen: Eine Reise, deren
  // Enddatum bereits vergangen ist, darf nie als "Nächste Reise" erscheinen,
  // selbst wenn sie nie manuell auf "completed" gesetzt wurde.
  const upcoming = trips.filter((t) => (t.status === "active" || t.status === "planned") && !isTripPastEnd(t));
  const nextTrip = upcoming[0] ?? trips[0];
  const pastTrips = trips.filter((t) => isTripHistorical(t));

  // Highlightfoto je Reise (falls die Familie eines markiert hat) — erste Stufe der Bildauflösung.
  const highlightPhotoByTripId = await getHighlightPhotoByTripId(supabase, familyId);
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
        <HeroTrip trip={nextTrip} imgUrl={tripImageById.get(nextTrip.id) ?? null} />

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatTile value={worldStats.tripsCount} label="Reisen gesamt" Icon={MapIcon} href="/trips" />
          <StatTile value={worldStats.countryCodes.size} label="Länder besucht" Icon={Globe} href="/family#unsere-welt" />
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
                <TripCardElegant key={trip.id} trip={trip} imgUrl={tripImageById.get(trip.id) ?? null} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
