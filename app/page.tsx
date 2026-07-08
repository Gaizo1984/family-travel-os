import Link from "next/link";
import { Map, Globe, CalendarDays, Users } from "lucide-react";
import {
  TRIPS,
  FAMILY_MEMBERS,
  getDaysUntil,
  formatDateDE,
  getTripDuration,
  type Trip,
} from "@/lib/demo-data";

const TRIP_IMAGES: Record<string, string> = {
  "indonesien-2028":
    "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1920&q=80",
  "japan-2025":
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=900&q=80",
  "sardinien-2024":
    "https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=900&q=80",
};

const STATUS_LABEL: Record<Trip["status"], string> = {
  planned: "Geplant",
  active: "Aktiv",
  completed: "Abgeschlossen",
};

function HeroTrip({ trip }: { trip: Trip }) {
  const days = getDaysUntil(trip.startDate);
  const duration = getTripDuration(trip.startDate, trip.endDate);
  const imgUrl = TRIP_IMAGES[trip.id];

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group relative block overflow-hidden rounded-xl"
      style={{ height: "440px" }}
    >
      {/* Photo */}
      {imgUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgUrl}
          alt={trip.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ transformOrigin: "center center" }}
        />
      )}
      {/* Gradient overlay — darker at bottom for legibility */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(10,9,7,0.97) 0%, rgba(10,9,7,0.72) 42%, rgba(10,9,7,0.18) 100%)",
        }}
      />

      {/* Top label */}
      <div className="absolute top-6 left-7">
        <span
          className="text-xs font-medium"
          style={{ color: "var(--accent)", letterSpacing: "0.22em", textTransform: "uppercase" }}
        >
          Nächste Reise
        </span>
      </div>

      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 px-7 md:px-9 pb-7 md:pb-9">
        {/* Title & route */}
        <h2
          className="text-4xl md:text-5xl font-light leading-tight mb-2"
          style={{ color: "#F0EBE3", letterSpacing: "-0.01em" }}
        >
          {trip.title}
        </h2>
        <p
          className="text-xs mb-6"
          style={{ color: "#A89880", letterSpacing: "0.2em", textTransform: "uppercase" }}
        >
          {trip.subtitle}
        </p>

        {/* Thin separator */}
        <div className="mb-5" style={{ height: "1px", background: "rgba(240,235,227,0.12)" }} />

        {/* Meta row */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          {/* Left: date / duration / stages */}
          <div className="flex gap-7">
            {[
              { label: "Abflug", value: formatDateDE(trip.startDate) },
              { label: "Dauer", value: `${duration} Tage` },
              { label: "Etappen", value: String(trip.stages.length) },
            ].map(({ label, value }) => (
              <div key={label}>
                <div
                  className="text-xs mb-1"
                  style={{ color: "#A89880", letterSpacing: "0.14em", textTransform: "uppercase", fontSize: "0.65rem" }}
                >
                  {label}
                </div>
                <div className="text-sm font-light" style={{ color: "#F0EBE3" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Right: avatars + countdown */}
          <div className="flex items-center gap-5 shrink-0">
            <div className="flex -space-x-2">
              {trip.members.map((m) => (
                <div
                  key={m.id}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                  style={{
                    background: "rgba(240,235,227,0.12)",
                    color: "#F0EBE3",
                    border: "1px solid rgba(240,235,227,0.22)",
                    backdropFilter: "blur(6px)",
                    fontSize: "0.62rem",
                    letterSpacing: "0.04em",
                  }}
                >
                  {m.initials}
                </div>
              ))}
            </div>
            <div className="text-right">
              <div
                className="text-3xl font-light leading-none"
                style={{ color: "var(--accent)" }}
              >
                {days.toLocaleString("de-DE")}
              </div>
              <div
                className="text-xs mt-1"
                style={{ color: "#A89880", letterSpacing: "0.08em", fontSize: "0.65rem", textTransform: "uppercase" }}
              >
                Tage bis zur Abreise
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatTile({
  value,
  label,
  Icon,
}: {
  value: string | number;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
}) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}
    >
      <Icon size={15} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0 }} />
      <div>
        <div
          className="text-2xl font-light leading-none mb-0.5"
          style={{ color: "var(--foreground)" }}
        >
          {value}
        </div>
        <div
          className="text-xs"
          style={{ color: "var(--muted)", letterSpacing: "0.04em", fontSize: "0.68rem" }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

function TripCardElegant({ trip }: { trip: Trip }) {
  const duration = getTripDuration(trip.startDate, trip.endDate);
  const imgUrl = TRIP_IMAGES[trip.id];

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group relative block overflow-hidden rounded-xl"
      style={{ height: "270px" }}
    >
      {/* Photo or gradient fallback */}
      {imgUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgUrl}
          alt={trip.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ transformOrigin: "center center" }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${trip.gradientFrom}, ${trip.gradientTo})` }}
        />
      )}

      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(10,9,7,0.96) 0%, rgba(10,9,7,0.5) 55%, rgba(10,9,7,0.08) 100%)",
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 p-6 flex flex-col justify-between">
        {/* Top: status */}
        <div>
          <span
            className="text-xs"
            style={{ color: "#A89880", letterSpacing: "0.16em", textTransform: "uppercase", fontSize: "0.65rem" }}
          >
            {STATUS_LABEL[trip.status]}
          </span>
        </div>

        {/* Bottom: info */}
        <div>
          <div
            className="text-lg font-light mb-0.5"
            style={{ color: "#F0EBE3" }}
          >
            {trip.title}
          </div>
          <div
            className="text-xs mb-4"
            style={{ color: "#A89880", letterSpacing: "0.1em", textTransform: "uppercase", fontSize: "0.62rem" }}
          >
            {trip.subtitle}
          </div>
          <div
            className="text-xs pt-3"
            style={{
              color: "#A89880",
              borderTop: "1px solid rgba(240,235,227,0.12)",
              fontSize: "0.68rem",
              letterSpacing: "0.04em",
            }}
          >
            {formatDateDE(trip.startDate)} · {duration} Tage · {trip.stages.length} Etappen
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const nextTrip = TRIPS.find((t) => t.status === "planned") ?? TRIPS[0];
  const pastTrips = TRIPS.filter((t) => t.status === "completed");
  const totalDays = pastTrips.reduce((acc, t) => acc + getTripDuration(t.startDate, t.endDate), 0);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="flex items-start justify-between px-7 md:px-10 pt-9 pb-7">
        <div>
          <h1
            className="text-lg font-light mb-1"
            style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}
          >
            Hallo Sarah & Marcel
          </h1>
          <p
            className="text-xs"
            style={{ color: "var(--muted)", letterSpacing: "0.08em", fontSize: "0.7rem" }}
          >
            Eure Reisen. Eure Erinnerungen.
          </p>
        </div>
        <Link href="/plan" className="btn-neue-reise">+ Neue Reise</Link>
      </header>

      {/* Content */}
      <div className="flex-1 px-5 md:px-8 pb-10 space-y-7">
        {/* Hero */}
        <HeroTrip trip={nextTrip} />

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile value={TRIPS.length} label="Reisen gesamt" Icon={Map} />
          <StatTile value={6} label="Länder besucht" Icon={Globe} />
          <StatTile value={totalDays} label="Reisetage" Icon={CalendarDays} />
          <StatTile value={FAMILY_MEMBERS.length} label="Familienmitglieder" Icon={Users} />
        </section>

        {/* Past trips */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2
              className="text-xs font-medium"
              style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}
            >
              Vergangene Reisen
            </h2>
            <Link
              href="/trips"
              className="text-xs"
              style={{ color: "var(--accent)", letterSpacing: "0.06em", fontSize: "0.72rem" }}
            >
              Alle anzeigen →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pastTrips.map((trip) => (
              <TripCardElegant key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
