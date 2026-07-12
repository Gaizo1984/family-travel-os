import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateDE } from "@/lib/demo-data";
import type { TimelineBooking, TimelineEvent, TimelineDay } from "@/lib/journey";
import { DayRow } from "../../../../JourneyDayRow";

const GERMAN_WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function addDays(date: string, delta: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function DayPlanPage({
  params,
}: {
  params: Promise<{ id: string; stageId: string; date: string }>;
}) {
  const { id, stageId, date } = await params;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: stage } = await supabase
    .from("stages")
    .select("id, title, location, start_date, end_date, nights, accommodation, sort_order")
    .eq("id", stageId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (!stage) notFound();
  if (stage.start_date && (date < stage.start_date || (stage.end_date && date > stage.end_date))) notFound();

  const { data: bookingsRaw } = await supabase
    .from("bookings")
    .select("id, type, title, provider, status, start_datetime, end_datetime")
    .eq("stage_id", stage.id)
    .gte("start_datetime", `${date}T00:00:00`)
    .lt("start_datetime", `${addDays(date, 1)}T00:00:00`);

  const { data: eventsRaw } = await supabase
    .from("journey_events")
    .select("id, date, time, category, title, location, status")
    .eq("stage_id", stage.id)
    .eq("date", date);

  const day: TimelineDay = {
    date,
    stage,
    isStageStart: stage.start_date === date,
    isStageEnd: stage.end_date === date,
    bookings: (bookingsRaw ?? []) as TimelineBooking[],
    events: (eventsRaw ?? []) as TimelineEvent[],
  };

  const prevDate = stage.start_date && date > stage.start_date ? addDays(date, -1) : null;
  const nextDate = stage.end_date && date < stage.end_date ? addDays(date, 1) : null;

  const weekday = GERMAN_WEEKDAYS[new Date(date + "T00:00:00Z").getUTCDay()];
  const isToday = date === todayIso();
  const isPast = date < todayIso();

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl w-full mx-auto px-5 md:px-8 pb-16">

        {/* ── Header ── */}
        <div className="pt-8 pb-9">
          <div
            className="flex items-center gap-2 mb-6"
            style={{ color: "var(--muted)", fontSize: "0.62rem", letterSpacing: "0.1em" }}
          >
            <Link href={`/trips/${trip.slug}`} style={{ color: "var(--muted)", textDecoration: "none" }}>
              {trip.title}
            </Link>
            <ChevronRight size={9} strokeWidth={1.5} />
            <Link href={`/trips/${trip.slug}/stages/${stage.id}`} style={{ color: "var(--muted)", textDecoration: "none" }}>
              {stage.title}
            </Link>
            <ChevronRight size={9} strokeWidth={1.5} />
            <span style={{ color: "var(--foreground)" }}>{formatDateDE(date)}</span>
          </div>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="text-2xl font-light mb-1"
                style={{ color: isPast ? "var(--muted)" : "var(--foreground)", letterSpacing: "0.01em" }}
              >
                {isToday ? "Heute" : formatDateDE(date)}
              </h1>
              <p style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.08em" }}>
                {weekday}
                {isToday && " · Heutiger Tag"}
                {day.isStageStart && " · Anreise"}
                {day.isStageEnd && !day.isStageStart && " · Abreise"}
              </p>
            </div>

            <div className="flex items-center gap-4" style={{ color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "0.06em" }}>
              {prevDate ? (
                <Link
                  href={`/trips/${trip.slug}/stages/${stage.id}/days/${prevDate}`}
                  className="flex items-center gap-1 transition-colors hover:text-foreground"
                  style={{ color: "var(--muted)", textDecoration: "none" }}
                >
                  <ChevronLeft size={11} strokeWidth={1.5} />
                  Vortag
                </Link>
              ) : <span />}
              <span
                style={{
                  padding: "3px 12px", borderRadius: "20px", border: "1px solid var(--border)",
                  fontSize: "0.58rem", letterSpacing: "0.14em", color: "var(--accent)",
                }}
              >
                {stage.location ?? stage.title}
              </span>
              {nextDate ? (
                <Link
                  href={`/trips/${trip.slug}/stages/${stage.id}/days/${nextDate}`}
                  className="flex items-center gap-1"
                  style={{ color: "var(--muted)", textDecoration: "none" }}
                >
                  Nächster Tag
                  <ChevronRight size={11} strokeWidth={1.5} />
                </Link>
              ) : <span />}
            </div>
          </div>
        </div>

        {/* ── Der Tag ── */}
        <section className="mb-14">
          <div
            className="rounded-xl px-6"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: isPast ? 0.75 : 1 }}
          >
            <DayRow day={day} slug={trip.slug} />
          </div>
        </section>

        <section>
          <Link
            href={`/trips/${trip.slug}/journey-events/new?stage_id=${stage.id}&date=${date}&return_to=${encodeURIComponent(`/trips/${trip.slug}/stages/${stage.id}/days/${date}`)}`}
            style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.08em", textDecoration: "none" }}
          >
            + Journey-Termin für diesen Tag →
          </Link>
        </section>

      </div>
    </div>
  );
}
