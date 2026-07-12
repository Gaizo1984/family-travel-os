import Link from "next/link";
import { Map as MapIcon, Globe, CalendarDays } from "lucide-react";
import { formatDateDE, getTripDuration } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { restoreTrip } from "@/lib/actions/trips";
import { tripCountdownDisplay } from "@/lib/trip-status";
import { resolveTripImage, getHighlightPhotoByTripId, type ResolvedTripImage } from "@/lib/trip-images";
import { SignedPhoto } from "@/components/SignedPhoto";

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
  stages: Array<{ id: string }>
}

function applyFilter(trips: TripRow[], f: string): { planned: TripRow[]; past: TripRow[] } {
  const active  = trips.filter((t) => t.status === "active");
  const planned = trips.filter((t) => t.status === "planned");
  const past    = trips.filter((t) => t.status === "completed");
  if (f === "aktiv")      return { planned: active, past: [] };
  if (f === "geplant")    return { planned: [...active, ...planned], past: [] };
  if (f === "vergangen")  return { planned: [], past };
  if (f === "archiviert") return { planned: [], past: [] };
  return { planned: [...active, ...planned], past };
}

function PlannedCard({ trip, img }: { trip: TripRow; img: ResolvedTripImage | null }) {
  const duration = trip.start_date && trip.end_date
    ? getTripDuration(trip.start_date, trip.end_date) : 0;
  const countdown = tripCountdownDisplay(trip, duration);
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
          {trip.status === "active" ? "Aktive Reise" : "In Planung"}
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
              { label: "Abflug",   value: trip.start_date ? formatDateDE(trip.start_date) : "—" },
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
  const duration = trip.start_date && trip.end_date
    ? getTripDuration(trip.start_date, trip.end_date) : 0;
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
                {trip.start_date ? formatDateDE(trip.start_date) : "—"}
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

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f = "alle" } = await searchParams;

  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  const [{ data }, highlightPhotoByTripId] = await Promise.all([
    supabase
      .from("trips")
      .select(`
        id, slug, title, subtitle, status,
        start_date, end_date, cover_emoji,
        gradient_from, gradient_via, gradient_to,
        trip_members ( persons ( id, name, initials, color ) ),
        stages ( id )
      `)
      .order("start_date", { ascending: true, nullsFirst: false }),
    getHighlightPhotoByTripId(supabase, familyId),
  ]);

  const trips = (data ?? []) as unknown as TripRow[];
  const tripImageById = new Map(trips.map((t) => [t.id, resolveTripImage(t, highlightPhotoByTripId.get(t.id) ?? null)]));
  const { planned, past } = applyFilter(trips, f);

  const visibleTrips  = trips.filter((t) => t.status !== "archived");
  const archivedTrips = trips.filter((t) => t.status === "archived");

  const completedTrips = trips.filter((t) => t.status === "completed");
  const totalDays = completedTrips.reduce((acc, t) =>
    t.start_date && t.end_date
      ? acc + getTripDuration(t.start_date, t.end_date)
      : acc,
    0
  );

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

        {past.length > 0 && (
          <section className="mb-14">
            <div className="mb-5" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
              Erlebt
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {past.map((trip) => (
                <PastCard key={trip.id} trip={trip} img={tripImageById.get(trip.id) ?? null} />
              ))}
            </div>
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
                { Icon: MapIcon,     value: visibleTrips.length, label: "Reisen" },
                { Icon: Globe,       value: 6,            label: "Länder" },
                { Icon: CalendarDays, value: totalDays,   label: "Reisetage" },
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
