import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { formatDateDE } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { buildStageDays } from "@/lib/journey";
import type { TimelineBooking, TimelineEvent } from "@/lib/journey";
import { DayRow } from "../../JourneyDayRow";

const H_FG = "#F0EBE3";
const H_MUTED = "#A89880";

const STAGE_IMAGES = [
  "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1476673160081-cf065607f449?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1592364395653-83e648b20cc2?auto=format&fit=crop&w=1600&q=80",
];

function hashIndex(id: string, mod: number): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % mod;
  return h;
}

type StageDetail = {
  id: string;
  trip_id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  nights: number | null;
  accommodation: string | null;
  notes: string | null;
};

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px" }}
      >
        {label}
      </div>
      <div className="text-sm font-light" style={{ color: "var(--foreground)" }}>{value}</div>
    </div>
  );
}

export default async function StageDetailPage({
  params,
}: {
  params: Promise<{ id: string; stageId: string }>;
}) {
  const { id, stageId } = await params;

  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: stage } = await supabase
    .from("stages")
    .select("id, trip_id, title, location, start_date, end_date, nights, accommodation, notes, sort_order")
    .eq("id", stageId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (!stage) notFound();
  const s = stage as StageDetail & { location: string | null; sort_order: number };

  const { data: stageBookings } = await supabase
    .from("bookings")
    .select("id, type, title, provider, status, start_datetime, end_datetime")
    .eq("stage_id", s.id);

  const { data: stageEvents } = await supabase
    .from("journey_events")
    .select("id, date, time, category, title, location, status")
    .eq("stage_id", s.id);

  const days = buildStageDays(
    s,
    (stageBookings ?? []) as TimelineBooking[],
    (stageEvents ?? []) as TimelineEvent[],
  );

  const heroImage = STAGE_IMAGES[hashIndex(s.id, STAGE_IMAGES.length)];
  const dateRange = s.start_date
    ? s.end_date && s.end_date !== s.start_date
      ? `${formatDateDE(s.start_date)} – ${formatDateDE(s.end_date)}`
      : formatDateDE(s.start_date)
    : "—";
  const returnTo = `/trips/${trip.slug}/stages/${s.id}`;

  return (
    <div className="flex-1 flex flex-col">

      {/* ── HERO ── */}
      <div className="relative shrink-0" style={{ height: 360 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroImage} alt={s.title} className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(10,9,7,0.97) 0%, rgba(10,9,7,0.55) 45%, rgba(10,9,7,0.12) 100%)" }}
        />

        <div className="absolute top-6 left-7">
          <Link
            href={`/trips/${trip.slug}`}
            className="flex items-center gap-2 transition-opacity hover:opacity-70"
            style={{ color: "rgba(240,235,227,0.5)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none" }}
          >
            <ChevronLeft size={13} strokeWidth={1.5} />
            {trip.title}
          </Link>
        </div>

        <div className="absolute top-5 right-7">
          <Link
            href={`/trips/${trip.slug}/stages/${s.id}/edit`}
            style={{
              fontSize: "0.58rem", letterSpacing: "0.18em", textTransform: "uppercase",
              color: "#C8A96E", background: "rgba(184,154,94,0.14)", border: "1px solid rgba(184,154,94,0.2)",
              padding: "5px 12px", borderRadius: "20px", textDecoration: "none",
            }}
          >
            Bearbeiten
          </Link>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-7 md:px-10 pb-8 md:pb-10">
          <h1
            className="text-4xl md:text-5xl font-light leading-tight mb-2"
            style={{ color: H_FG, letterSpacing: "-0.01em" }}
          >
            {s.title}
          </h1>
          <p className="text-sm font-light" style={{ color: H_MUTED, letterSpacing: "0.04em" }}>
            {dateRange}
            {s.nights !== null ? ` · ${s.nights} ${s.nights === 1 ? "Nacht" : "Nächte"}` : ""}
          </p>
        </div>
      </div>

      {/* ── DETAILS ── */}
      <div className="flex-1" style={{ background: "var(--background)" }}>
        <div className="max-w-3xl mx-auto px-5 md:px-10 py-10 space-y-10">

          <section>
            <div
              className="rounded-xl p-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <MetaItem label="Von" value={s.start_date ? formatDateDE(s.start_date) : "—"} />
                <MetaItem label="Bis" value={s.end_date ? formatDateDE(s.end_date) : "—"} />
                <MetaItem label="Nächte" value={s.nights !== null ? String(s.nights) : "—"} />
                <MetaItem label="Unterkunft" value={s.accommodation ?? "—"} />
              </div>
            </div>
          </section>

          {s.notes && (
            <section>
              <div
                style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}
              >
                Notizen
              </div>
              <div
                className="rounded-xl p-6"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <p className="leading-relaxed" style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  {s.notes}
                </p>
              </div>
            </section>
          )}

          {days.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                  Tage in diesem Aufenthalt
                </div>
                <Link
                  href={`/trips/${trip.slug}/journey-events/new?stage_id=${s.id}&return_to=${encodeURIComponent(returnTo)}`}
                  style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}
                >
                  + Journey-Termin
                </Link>
              </div>
              <div
                className="rounded-xl px-6"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                {days.map((day) => (
                  <DayRow
                    key={day.date}
                    day={day}
                    slug={trip.slug}
                    dayHref={`/trips/${trip.slug}/stages/${s.id}/days/${day.date}`}
                  />
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
