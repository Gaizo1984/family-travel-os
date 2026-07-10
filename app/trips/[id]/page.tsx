import Link from "next/link";
import { notFound } from "next/navigation";
import { Plane, BedDouble, Compass, FileText, MoreHorizontal, ChevronLeft, ChevronRight, Wallet, Route } from "lucide-react";
import { formatDateDE, getTripDuration } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import { sortBookingsChronologically, BOOKING_CATEGORIES } from "@/lib/bookings";
import type { BookingType, BookingStatus } from "@/lib/supabase/types";
import { BookingRowItem } from "./bookings/BookingRowItem";
import { DayRow } from "./JourneyDayRow";
import {
  sortStagesChronologically, buildJourneyTimeline, buildRouteChips,
  type TimelineSegment,
} from "@/lib/journey";
import type { JourneyEventCategory, JourneyEventStatus } from "@/lib/journey-events";
import { computeTripReadiness } from "@/lib/readiness";

const H_FG    = "#F0EBE3";
const H_MUTED = "#A89880";
const H_BORDER = "rgba(240,235,227,0.1)";

const TRIP_IMAGES: Record<string, string> = {
  "costa-rica-2026":
    "https://images.unsplash.com/photo-1611222566512-cb8dd8e689e5?auto=format&fit=crop&w=1920&q=80",
  "indonesien-2028":
    "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1920&q=80",
  "japan-2025":
    "https://images.unsplash.com/photo-1757220306353-2282322ac464?auto=format&fit=crop&w=1920&q=80",
  "sardinien-2024":
    "https://images.unsplash.com/photo-1780581800373-4fd4961743cd?auto=format&fit=crop&w=1920&q=80",
};

const STAGE_IMAGES = [
  "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1476673160081-cf065607f449?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1592364395653-83e648b20cc2?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80",
];

const NEXT_STEPS = [
  "Flüge buchen und Reiseversicherung abschließen",
  "Hotels und Unterkünfte finalisieren",
  "Aktivitäten und Ausflüge planen",
  "Dokumente und Visa beantragen",
  "Packliste erstellen",
];

type PersonRow = { id: string; name: string; initials: string; color: string }

type StageRow = {
  id: string
  title: string
  location: string | null
  nights: number | null
  start_date: string | null
  end_date: string | null
  accommodation: string | null
  sort_order: number
}

type BookingRow = {
  id: string
  type: BookingType
  title: string
  provider: string | null
  status: BookingStatus
  amount: number | null
  currency: string
  start_datetime: string | null
  end_datetime: string | null
  stage_id: string | null
  details: Record<string, string> | null
  created_at: string
}

type JourneyEventRow = {
  id: string
  stage_id: string | null
  date: string
  time: string | null
  category: JourneyEventCategory
  title: string
  location: string | null
  status: JourneyEventStatus
}

type TripDetail = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  status: string
  start_date: string | null
  end_date: string | null
  trip_members: Array<{ persons: PersonRow | null }>
  stages: StageRow[]
  bookings: BookingRow[]
  journey_events: JourneyEventRow[]
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xs font-medium mb-5"
      style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}
    >
      {children}
    </h2>
  );
}

function StageCard({ stage, idx, slug }: { stage: StageRow; idx: number; slug: string }) {
  const imgUrl = STAGE_IMAGES[idx % STAGE_IMAGES.length];
  const dateRange = stage.start_date
    ? stage.end_date && stage.end_date !== stage.start_date
      ? `${formatDateDE(stage.start_date)} – ${formatDateDE(stage.end_date)}`
      : formatDateDE(stage.start_date)
    : "—";
  return (
    <div className="group relative shrink-0 overflow-hidden rounded-xl" style={{ width: 210, height: 285 }}>
      <Link href={`/trips/${slug}/stages/${stage.id}`} className="absolute inset-0 block">
        {imgUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl} alt={stage.title} className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(10,9,7,0.96) 0%, rgba(10,9,7,0.38) 55%, transparent 100%)" }}
        />
        <div className="absolute top-4 left-4">
          <span style={{ color: "rgba(240,235,227,0.4)", fontSize: "0.6rem", letterSpacing: "0.14em" }}>
            {String(idx + 1).padStart(2, "0")}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span style={{ display: "inline-block", fontSize: "0.56rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#C8A96E", background: "rgba(10,9,7,0.55)", padding: "3px 8px", borderRadius: "20px", backdropFilter: "blur(4px)" }}>
            In Planung
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="text-base font-light mb-0.5" style={{ color: H_FG }}>{stage.title}</div>
          <div className="text-xs mb-3" style={{ color: H_MUTED, letterSpacing: "0.08em", fontSize: "0.68rem" }}>
            {stage.nights !== null ? `${stage.nights} ${stage.nights === 1 ? "Nacht" : "Nächte"}` : "—"}
          </div>
          <div style={{ borderTop: `1px solid ${H_BORDER}`, paddingTop: "10px" }}>
            <div style={{ color: "rgba(240,235,227,0.35)", fontSize: "0.6rem", letterSpacing: "0.04em" }}>
              {dateRange}
            </div>
            {stage.accommodation && (
              <div className="mt-0.5" style={{ color: H_MUTED, fontSize: "0.62rem" }}>
                {stage.accommodation}
              </div>
            )}
          </div>
        </div>
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <ChevronRight size={12} strokeWidth={1.5} style={{ color: H_MUTED }} />
        </div>
      </Link>
    </div>
  );
}

function QuickNavItem({ Icon, label, href }: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  label: string; href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-1.5 shrink-0 transition-opacity hover:opacity-70"
      style={{ width: 68, textDecoration: "none" }}
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <Icon size={16} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
      </div>
      <span
        className="text-center leading-tight"
        style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.02em" }}
      >
        {label}
      </span>
    </Link>
  );
}

function RouteChips({ chips }: { chips: string[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex items-center gap-2 flex-nowrap" style={{ width: "max-content" }}>
        {chips.map((chip, idx) => (
          <div key={idx} className="flex items-center gap-2 shrink-0">
            <span style={{ color: H_FG, fontSize: "0.75rem", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{chip}</span>
            {idx < chips.length - 1 && (
              <ChevronRight size={11} strokeWidth={1.5} style={{ color: H_MUTED, flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StaySegmentCard({ segment, slug }: { segment: Extract<TimelineSegment, { kind: "stay" }>; slug: string }) {
  const { stage, days } = segment;
  const dateRange = stage.start_date && stage.end_date
    ? `${formatDateDE(stage.start_date)} – ${formatDateDE(stage.end_date)}`
    : "—";

  const importantDays = days.filter((d) => d.isStageStart || d.isStageEnd || d.bookings.length + d.events.length > 0);
  const quietDays = days.filter((d) => !d.isStageStart && !d.isStageEnd && d.bookings.length + d.events.length === 0);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="p-5" style={{ background: "var(--surface)" }}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {stage.accommodation || stage.title}
          </div>
          <Link href={`/trips/${slug}/stages/${stage.id}`} style={{ color: "var(--accent)", fontSize: "0.65rem", letterSpacing: "0.08em", textDecoration: "none" }}>
            Aufenthalt planen →
          </Link>
        </div>
        <div style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
          {(stage.location ?? stage.title)} · {dateRange} · {stage.nights} {stage.nights === 1 ? "Nacht" : "Nächte"}
        </div>
      </div>
      <div className="px-5" style={{ background: "var(--background)" }}>
        {importantDays.map((day) => (
          <DayRow key={day.date} day={day} slug={slug} />
        ))}
        {quietDays.length > 0 && (
          <details className="py-2">
            <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: "0.68rem", letterSpacing: "0.04em" }}>
              {quietDays.length} ruhige {quietDays.length === 1 ? "Tag" : "Tage"} ohne Programm
            </summary>
            <div className="pt-2">
              {quietDays.map((day) => (
                <DayRow key={day.date} day={day} slug={slug} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function DaySegmentCard({ segment, slug }: { segment: Extract<TimelineSegment, { kind: "day" }>; slug: string }) {
  const { day } = segment;
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {day.stage && (
        <div className="mb-2">
          <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{day.stage.location ?? day.stage.title}</span>
        </div>
      )}
      <DayRow day={day} slug={slug} />
    </div>
  );
}

function NextStepItem({ text, isLast }: { text: string; isLast: boolean }) {
  return (
    <div className="flex items-start gap-4 py-4" style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
      <div className="w-5 h-5 rounded-full shrink-0 mt-0.5" style={{ border: "1px solid var(--border)", flexShrink: 0 }} />
      <span className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{text}</span>
    </div>
  );
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("trips")
    .select(`
      id, slug, title, subtitle, status, start_date, end_date,
      trip_members ( persons ( id, name, initials, color ) ),
      stages ( id, title, location, nights, start_date, end_date, accommodation, sort_order ),
      bookings ( id, type, title, provider, status, amount, currency, start_datetime, end_datetime, stage_id, details, created_at ),
      journey_events ( id, stage_id, date, time, category, title, location, status )
    `)
    .eq("slug", id)
    .maybeSingle();

  if (!data) notFound();

  const trip = data as unknown as TripDetail;
  const members   = trip.trip_members.flatMap(tm => tm.persons ? [tm.persons] : []);
  const stages    = sortStagesChronologically(trip.stages);
  const bookings  = sortBookingsChronologically(trip.bookings);
  const journeyEvents = trip.journey_events ?? [];
  const stageTitleById = new Map(stages.map((s) => [s.id, s.title]));

  const totalNights = stages.reduce((sum, s) => sum + (s.nights ?? 0), 0);
  const routeChips = buildRouteChips(
    stages,
    bookings.filter((b) => b.type === "flight"),
  );
  const journeyTimeline = buildJourneyTimeline(
    { start_date: trip.start_date, end_date: trip.end_date },
    stages,
    bookings,
    journeyEvents,
  );

  // "Mehr" überspringt die Zwischenansicht und führt bei komplett leerer Kategorie
  // direkt zur Typ-Auswahl; sobald irgendeine Buchung existiert (unabhängig vom Status,
  // damit auch stornierte oder bestehende Versicherungsbuchungen erreichbar bleiben),
  // führt die Kachel weiterhin zur Listenansicht.
  const hasMoreBookings = bookings.some((b) => BOOKING_CATEGORIES.more.types.includes(b.type));
  const moreHref = hasMoreBookings
    ? `/trips/${trip.slug}/bookings/category/more`
    : `/trips/${trip.slug}/bookings/new?category=more`;

  const duration  = trip.start_date && trip.end_date
    ? getTripDuration(trip.start_date, trip.end_date) : 0;
  const heroImage = TRIP_IMAGES[trip.slug]
    ?? "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1920&q=80";

  const statusLabel = trip.status === "active" ? "Aktive Reise"
    : trip.status === "completed" ? "Erlebt"
    : "In Planung";

  const heroMetaParts = [
    totalNights > 0 ? `${totalNights} ${totalNights === 1 ? "Nacht" : "Nächte"}` : null,
    stages.length > 0 ? `${stages.length} ${stages.length === 1 ? "Aufenthalt" : "Aufenthalte"}` : null,
  ].filter(Boolean).join(" · ");

  const readiness = await computeTripReadiness(trip.id);
  const readinessLabel = readiness.status === "ready"
    ? "Reisebereit"
    : readiness.status === "conflicts"
      ? `${readiness.conflictCount} ${readiness.conflictCount === 1 ? "Konflikt" : "Konflikte"}`
      : `${readiness.hintCount} ${readiness.hintCount === 1 ? "Punkt" : "Punkte"} prüfen`;
  const readinessColor = readiness.status === "ready" ? "#4C7A5D" : readiness.status === "conflicts" ? "#B5624A" : "#B89A5E";

  return (
    <div className="flex-1 flex flex-col">

      {/* ── CINEMATIC HERO ── */}
      <div className="relative" style={{ height: 450 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroImage} alt={trip.title} className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(10,9,7,0.97) 0%, rgba(10,9,7,0.62) 45%, rgba(10,9,7,0.18) 100%)" }}
        />

        <div className="absolute top-6 left-7" style={{ maxWidth: "calc(100% - 130px)" }}>
          <Link
            href="/trips"
            className="flex items-center gap-2 transition-opacity hover:opacity-70"
            style={{ color: "rgba(240,235,227,0.5)", fontSize: "0.78rem", letterSpacing: "0.04em", whiteSpace: "nowrap" }}
          >
            <ChevronLeft size={13} strokeWidth={1.5} />
            Alle Reisen
          </Link>
        </div>

        <div className="absolute top-5 right-7 flex flex-wrap items-center justify-end gap-1.5 max-w-[60vw] sm:max-w-none">
          <span style={{ fontSize: "0.52rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(200,169,110,0.75)", background: "rgba(184,154,94,0.08)", border: "1px solid rgba(184,154,94,0.14)", padding: "4px 10px", borderRadius: "20px", whiteSpace: "nowrap" }}>
            {statusLabel}
          </span>

          <Link
            href={`/trips/${trip.slug}/ready-to-travel`}
            className="max-w-[170px] sm:max-w-none"
            style={{
              display: "inline-block",
              background: "rgba(10,9,7,0.62)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: `1px solid ${readinessColor}66`,
              padding: "4px 10px",
              borderRadius: "20px",
              textDecoration: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <span style={{ fontSize: "0.56rem", letterSpacing: "0.1em", textTransform: "uppercase", color: readinessColor, fontWeight: 500 }}>
              {readiness.status === "ready" ? "Ready to Travel ✓" : `Reisestatus · ${readinessLabel}`}
            </span>
          </Link>

          <details className="menu-details relative">
            <summary
              style={{
                cursor: "pointer",
                color: "rgba(240,235,227,0.6)",
                fontSize: "0.9rem",
                lineHeight: 1,
                padding: "6px 10px",
                borderRadius: "20px",
                background: "rgba(10,9,7,0.35)",
                border: "1px solid rgba(240,235,227,0.15)",
              }}
            >
              ⋯
            </summary>
            <div
              className="absolute right-0 mt-2 rounded-lg overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", minWidth: "170px", zIndex: 30 }}
            >
              <Link
                href={`/trips/${trip.slug}/edit`}
                style={{ display: "block", padding: "11px 16px", color: "var(--foreground)", fontSize: "0.78rem", textDecoration: "none" }}
              >
                Reise bearbeiten
              </Link>
              <Link
                href={`/trips/${trip.slug}/archive`}
                style={{ display: "block", padding: "11px 16px", color: "#B5624A", fontSize: "0.78rem", textDecoration: "none", borderTop: "1px solid var(--border)" }}
              >
                Reise archivieren
              </Link>
            </div>
          </details>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-7 md:px-10 pb-8 md:pb-10">
          <div style={{ color: "#C8A96E", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "10px" }}>
            Eure Reise
          </div>
          <h1
            className="text-4xl md:text-5xl font-light leading-tight mb-2"
            style={{ color: H_FG, letterSpacing: "-0.01em" }}
          >
            {trip.title}
          </h1>
          <p className="text-sm font-light mb-1" style={{ color: H_MUTED, letterSpacing: "0.04em" }}>
            {trip.start_date ? formatDateDE(trip.start_date) : "—"}
            {trip.end_date ? ` – ${formatDateDE(trip.end_date)}` : ""}
            {duration ? ` · ${duration} Tage` : ""}
          </p>
          {heroMetaParts && (
            <p className="text-sm font-light mb-5" style={{ color: H_MUTED, letterSpacing: "0.04em" }}>
              {heroMetaParts}
            </p>
          )}

          {routeChips.length > 0 && (
            <div className="mb-5">
              <RouteChips chips={routeChips} />
            </div>
          )}

          <div className="mb-5" style={{ height: "1px", background: H_BORDER }} />

          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(240,235,227,0.1)", color: H_FG, border: "1px solid rgba(240,235,227,0.2)", backdropFilter: "blur(6px)", fontSize: "0.6rem", letterSpacing: "0.04em" }}
                >
                  {m.initials}
                </div>
              ))}
            </div>
            <span style={{ color: H_MUTED, fontSize: "0.68rem", letterSpacing: "0.08em" }}>
              {members.length} Reisende
            </span>
          </div>
        </div>
      </div>

      {/* ── LIGHT CONTENT ── */}
      <div className="flex-1" style={{ background: "var(--background)" }}>
        <div className="max-w-5xl mx-auto px-5 md:px-10 py-10 space-y-14">

          <div className="overflow-x-auto -mx-1 px-1 -mt-2">
            <div className="flex gap-1 sm:gap-3 flex-nowrap sm:flex-wrap sm:justify-between" style={{ width: "max-content", minWidth: "100%" }}>
              <QuickNavItem Icon={Route} label="Journey" href="#journey" />
              <QuickNavItem Icon={Plane} label="Flüge" href={`/trips/${trip.slug}/bookings/category/flight`} />
              <QuickNavItem Icon={BedDouble} label="Hotels" href={`/trips/${trip.slug}/bookings/category/accommodation`} />
              <QuickNavItem Icon={Compass} label="Aktivitäten" href={`/trips/${trip.slug}/bookings/category/activity`} />
              <QuickNavItem Icon={FileText} label="Dokumente" href={`/trips/${trip.slug}/documents`} />
              <QuickNavItem Icon={Wallet} label="Budget" href={`/trips/${trip.slug}/budget`} />
              <QuickNavItem Icon={MoreHorizontal} label="Mehr" href={moreHref} />
            </div>
          </div>

          <section id="journey">
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-xs font-medium"
                style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}
              >
                Journey
              </h2>
              <Link
                href={`/trips/${trip.slug}/journey-events/new`}
                style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}
              >
                + Journey-Termin
              </Link>
            </div>

            {journeyTimeline.length > 0 ? (
              <div className="space-y-3">
                {journeyTimeline.map((segment) =>
                  segment.kind === "stay" ? (
                    <StaySegmentCard key={segment.stage.id} segment={segment} slug={trip.slug} />
                  ) : (
                    <DaySegmentCard key={segment.day.date} segment={segment} slug={trip.slug} />
                  )
                )}
              </div>
            ) : (
              <div
                className="rounded-xl p-6"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                  Sobald Reisedaten und Etappen feststehen, entsteht hier automatisch eure Reiseerzählung.
                </p>
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-xs font-medium"
                style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}
              >
                Etappen{stages.length > 0 ? ` · ${stages.length} ${stages.length === 1 ? "Destination" : "Destinationen"}` : ""}
              </h2>
              <Link
                href={`/trips/${trip.slug}/stages/new`}
                style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}
              >
                + Etappe hinzufügen
              </Link>
            </div>

            {stages.length > 0 ? (
              <div className="overflow-x-auto -mx-1 px-1">
                <div className="flex gap-4 pb-3" style={{ width: "max-content" }}>
                  {stages.map((stage, idx) => (
                    <StageCard key={stage.id} stage={stage} idx={idx} slug={trip.slug} />
                  ))}
                </div>
              </div>
            ) : (
              <div
                className="rounded-xl p-6"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                  Noch keine Etappen angelegt. Jede Reise braucht mindestens eine Etappe.
                </p>
              </div>
            )}
          </section>

          <section id="buchungen">
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-xs font-medium"
                style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}
              >
                Buchungen{bookings.length > 0 ? ` · ${bookings.length}` : ""}
              </h2>
              <Link
                href={`/trips/${trip.slug}/bookings/new`}
                style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}
              >
                + Buchung hinzufügen
              </Link>
            </div>

            {bookings.length > 0 ? (
              <div className="space-y-2">
                {bookings.map((booking) => (
                  <BookingRowItem
                    key={booking.id}
                    booking={booking}
                    slug={trip.slug}
                    stageTitle={booking.stage_id ? stageTitleById.get(booking.stage_id) ?? null : null}
                  />
                ))}
              </div>
            ) : (
              <div
                className="rounded-xl p-6 text-center"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                  Noch keine Buchungen erfasst.
                </p>
                <Link
                  href={`/trips/${trip.slug}/bookings/new`}
                  style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.08em", textDecoration: "none" }}
                >
                  Erste Buchung hinzufügen →
                </Link>
              </div>
            )}
          </section>

          <section>
            <SectionLabel>Nächste Schritte</SectionLabel>
            <div className="rounded-xl px-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              {NEXT_STEPS.map((step, idx) => (
                <NextStepItem key={idx} text={step} isLast={idx === NEXT_STEPS.length - 1} />
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
