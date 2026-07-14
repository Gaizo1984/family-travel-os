import Link from "next/link";
import { notFound } from "next/navigation";
import { Plane, BedDouble, Compass, FileText, MoreHorizontal, ChevronLeft, ChevronRight, Wallet, Route, Pencil, Images } from "lucide-react";
import { formatDateDE } from "@/lib/demo-data";
import { deriveTripDateRange, tripDurationDays, formatTripDateRangeLabel } from "@/lib/trip-dates";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { sortBookingsChronologically, BOOKING_CATEGORIES, BOOKING_CATEGORY_ORDER } from "@/lib/bookings";
import type { BookingType, BookingStatus } from "@/lib/supabase/types";
import { DayRow } from "./JourneyDayRow";
import {
  sortStagesChronologically, buildJourneyTimeline, buildRouteChips,
  type TimelineSegment, type TimelineDay,
} from "@/lib/journey";
import { JOURNEY_EVENT_CATEGORIES, type JourneyEventCategory, type JourneyEventStatus } from "@/lib/journey-events";
import { deleteJourneyEvent } from "@/lib/actions/journey-events";
import { computeTripReadiness } from "@/lib/readiness";
import type { ReadinessFinding, ReadinessSeverity } from "@/lib/readiness";
import { isTripHistorical, isTripCurrentlyRunning, isTripPastEnd } from "@/lib/trip-status";
import { resolveStageImages, FALLBACK_STAGE_IMAGE, type ResolvedStageImage } from "@/lib/stage-images";
import { resolveTripImage, getHighlightPhotoByTripId } from "@/lib/trip-images";
import { SignedPhoto } from "@/components/SignedPhoto";

const H_FG    = "#F0EBE3";
const H_MUTED = "#A89880";
const H_BORDER = "rgba(240,235,227,0.1)";

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
  country_code: string | null
  cover_photo_id: string | null
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
  gradient_from: string | null
  gradient_to: string | null
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

/**
 * §Bugfix "Etappen zeigen fälschlich 'In Planung'": das Label war bisher ein
 * fest verdrahteter Text, unabhängig vom tatsächlichen Status -- weder eine
 * bereits abgeschlossene Reise noch eine gerade laufende Etappe wurden
 * berücksichtigt. Jetzt datumsbasiert wie überall sonst (lib/trip-status.ts):
 * eine historische Reise (Status/Enddatum in der Vergangenheit) zeigt IMMER
 * "Abgeschlossen", unabhängig vom eigenen Etappendatum; sonst entscheidet das
 * Etappendatum selbst zwischen "Läuft" und "In Planung".
 */
function stageStatusLabel(stage: { start_date: string | null; end_date: string | null }, tripHistorical: boolean): string {
  if (tripHistorical || isTripPastEnd({ status: '', start_date: stage.start_date, end_date: stage.end_date }))
    return "Abgeschlossen";
  if (isTripCurrentlyRunning({ status: '', start_date: stage.start_date, end_date: stage.end_date }))
    return "Läuft";
  return "In Planung";
}

function StageCard({ stage, idx, slug, img, tripHistorical }: { stage: StageRow; idx: number; slug: string; img: ResolvedStageImage; tripHistorical: boolean }) {
  const dateRange = stage.start_date
    ? stage.end_date && stage.end_date !== stage.start_date
      ? `${formatDateDE(stage.start_date)} – ${formatDateDE(stage.end_date)}`
      : formatDateDE(stage.start_date)
    : "—";
  return (
    <div className="group relative shrink-0 overflow-hidden rounded-xl" style={{ width: 210, height: 285 }}>
      <Link href={`/trips/${slug}/stages/${stage.id}`} className="absolute inset-0 block">
        {img.storagePath ? (
          <SignedPhoto
            storagePath={img.storagePath} initialUrl={img.url} alt={stage.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.url} alt={stage.title} className="absolute inset-0 w-full h-full object-cover" />
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
            {stageStatusLabel(stage, tripHistorical)}
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

function QuickNavItem({ Icon, label, href, active }: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  label: string; href: string; active?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
      style={{ textDecoration: "none" }}
    >
      <div
        className="aspect-square w-full mx-auto rounded-full flex items-center justify-center"
        style={{
          maxWidth: 72,
          ...(active
            ? { background: "var(--accent)", border: "1px solid var(--accent)" }
            : { background: "var(--surface)", border: "1px solid var(--border)" }),
        }}
      >
        <Icon size={22} strokeWidth={1.5} style={{ color: active ? "var(--surface)" : "var(--accent)" }} />
      </div>
      <span
        className="text-center leading-tight"
        style={{ color: active ? "var(--foreground)" : "var(--muted)", fontSize: "0.62rem", letterSpacing: "0.02em", fontWeight: active ? 500 : 400 }}
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

/** Kompakte Zusammenfassung aufeinanderfolgender kurzer Tages-Segmente (0–1-Nacht-
 * Stopps, etappenlose Tage) in einer einzigen Karte statt einer Karte pro Tag —
 * Aufenthalte/Hotels bleiben dadurch die visuell stärkeren Ankerpunkte. */
function DayGroupCard({ days, slug }: { days: TimelineDay[]; slug: string }) {
  return (
    <div className="rounded-xl overflow-hidden px-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {days.map((day) => (
        <div key={day.date}>
          {day.stage && (
            <div className="pt-2.5" style={{ color: "var(--muted)", fontSize: "0.64rem", letterSpacing: "0.04em" }}>
              {day.stage.location ?? day.stage.title}
            </div>
          )}
          <DayRow day={day} slug={slug} />
        </div>
      ))}
    </div>
  );
}

/** Fasst aufeinanderfolgende 'day'-Segmente zu einem gemeinsamen Block zusammen —
 * reine Anzeigegruppierung, verändert keine Daten. */
type DisplayBlock =
  | { kind: "stay"; segment: Extract<TimelineSegment, { kind: "stay" }> }
  | { kind: "dayGroup"; days: TimelineDay[] };

function groupJourneyBlocks(segments: TimelineSegment[]): DisplayBlock[] {
  const blocks: DisplayBlock[] = [];
  for (const segment of segments) {
    if (segment.kind === "stay") {
      blocks.push({ kind: "stay", segment });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last && last.kind === "dayGroup") {
      last.days.push(segment.day);
    } else {
      blocks.push({ kind: "dayGroup", days: [segment.day] });
    }
  }
  return blocks;
}

type DisplayFinding = { key: string; message: string; href: string; severity: ReadinessSeverity };

/**
 * Gruppiert gleichartige, sich wiederholende Befunde (z. B. eine "X hat keinen
 * Reisepass hinterlegt."-Zeile pro Familienmitglied) zu einer einzigen kompakten
 * Zeile statt N nahezu identischer Zeilen. Andere Befundarten (Etappenkonflikte,
 * fehlende Flüge etc.) bleiben unverändert einzeln sichtbar, da sie in der Praxis
 * nicht in dieser Häufigkeit auftreten.
 */
function groupReadinessFindings(findings: ReadinessFinding[]): DisplayFinding[] {
  const missingPassport: ReadinessFinding[] = [];
  const expiringPassport: ReadinessFinding[] = [];
  const rest: ReadinessFinding[] = [];

  for (const f of findings) {
    if (f.theme === "documents" && / hat keinen Reisepass hinterlegt\.$/.test(f.message)) {
      missingPassport.push(f);
    } else if (f.theme === "documents" && /^Reisepass von .+ läuft/.test(f.message)) {
      expiringPassport.push(f);
    } else {
      rest.push(f);
    }
  }

  const result: DisplayFinding[] = [];

  if (missingPassport.length >= 2) {
    const names = missingPassport.map((f) => f.message.match(/^(.+?) hat keinen Reisepass/)?.[1]).filter(Boolean);
    result.push({
      key: "missing-passports",
      message: `${missingPassport.length} Reisepässe fehlen · ${names.join(" · ")}`,
      href: "/family",
      severity: "conflict",
    });
  } else {
    missingPassport.forEach((f, i) => result.push({ key: `mp-${i}`, message: f.message, href: f.href, severity: f.severity }));
  }

  if (expiringPassport.length >= 2) {
    const names = expiringPassport.map((f) => f.message.match(/^Reisepass von (.+?) läuft/)?.[1]).filter(Boolean);
    result.push({
      key: "expiring-passports",
      message: `${expiringPassport.length} Reisepässe laufen bald ab · ${names.join(" · ")}`,
      href: "/family",
      severity: "conflict",
    });
  } else {
    expiringPassport.forEach((f, i) => result.push({ key: `ep-${i}`, message: f.message, href: f.href, severity: f.severity }));
  }

  rest.forEach((f, i) => result.push({ key: `r-${i}`, message: f.message, href: f.href, severity: f.severity }));

  return result;
}

function ReadinessStepItem({ finding, isLast }: { finding: DisplayFinding; isLast: boolean }) {
  const color = finding.severity === "conflict" ? "#B5624A" : "#B89A5E";
  return (
    <Link
      href={finding.href}
      className="flex items-start gap-4 py-4 transition-opacity hover:opacity-70"
      style={{ borderBottom: isLast ? "none" : "1px solid var(--border)", textDecoration: "none" }}
    >
      <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: color, flexShrink: 0 }} />
      <span className="text-sm leading-relaxed flex-1" style={{ color: "var(--foreground)" }}>{finding.message}</span>
    </Link>
  );
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const [{ id: familyId }, { data }] = await Promise.all([
    getFamily(),
    supabase
      .from("trips")
      .select(`
        id, slug, title, subtitle, status, start_date, end_date, gradient_from, gradient_to,
        trip_members ( persons ( id, name, initials, color ) ),
        stages ( id, title, location, nights, start_date, end_date, accommodation, sort_order, country_code, cover_photo_id ),
        bookings ( id, type, title, provider, status, amount, currency, start_datetime, end_datetime, stage_id, details, created_at ),
        journey_events ( id, stage_id, date, time, category, title, location, status )
      `)
      .eq("slug", id)
      .maybeSingle(),
  ]);

  if (!data) notFound();

  const trip = data as unknown as TripDetail;
  const members   = trip.trip_members.flatMap(tm => tm.persons ? [tm.persons] : []);
  const stages    = sortStagesChronologically(trip.stages);
  const bookings  = sortBookingsChronologically(trip.bookings);
  const journeyEvents = trip.journey_events ?? [];
  /** §"Merkliste": trip-weite Liste aller "Idee"-Termine (u.a. per LUMI "Merken" übernommene Orte), unabhängig vom Datum -- bisher gingen sie im Tages-Journey unter. */
  const ideaEvents = journeyEvents.filter((e) => e.status === "idea").sort((a, b) => a.date.localeCompare(b.date));

  const totalNights = stages.reduce((sum, s) => sum + (s.nights ?? 0), 0);
  const routeChips = buildRouteChips(
    stages,
    bookings.filter((b) => b.type === "flight"),
  );
  // §"Reisezeitraum automatisch ableiten": EINZIGE Ableitungslogik
  // (lib/trip-dates.ts) -- ohne sie würde die Journey-Timeline bei einer
  // Reise ohne manuelles Datum leer bleiben, selbst wenn bereits datierte
  // Flug-/Hotelbuchungen existieren (buildJourneyTimeline spannt den
  // Tagesbereich sonst nur über trip.start_date/end_date + Etappen auf).
  const tripDateRange = deriveTripDateRange(trip, bookings, stages);
  const journeyTimeline = buildJourneyTimeline(
    { start_date: tripDateRange.startDate, end_date: tripDateRange.endDate },
    stages,
    bookings,
    journeyEvents,
  );
  const journeyBlocks = groupJourneyBlocks(journeyTimeline);

  // "Mehr" überspringt die Zwischenansicht und führt bei komplett leerer Kategorie
  // direkt zur Typ-Auswahl; sobald irgendeine Buchung existiert (unabhängig vom Status,
  // damit auch stornierte oder bestehende Versicherungsbuchungen erreichbar bleiben),
  // führt die Kachel weiterhin zur Listenansicht.
  const hasMoreBookings = bookings.some((b) => BOOKING_CATEGORIES.more.types.includes(b.type));
  const moreHref = hasMoreBookings
    ? `/trips/${trip.slug}/bookings/category/more`
    : `/trips/${trip.slug}/bookings/new?category=more`;

  const duration  = tripDurationDays(tripDateRange);

  // §"Vergangene Reisen: keine Boardingpass-/Dokumenten-/Konflikthinweise mehr":
  // Readiness ist eine reine Vorbereitungs-Checkliste — für abgeschlossene
  // Reisen gibt es nichts mehr vorzubereiten, daher wird sie gar nicht erst
  // berechnet, sondern durch eine Erinnerungs-/Statistik-Ansicht ersetzt.
  const tripStatusInput = { status: trip.status, start_date: tripDateRange.startDate, end_date: tripDateRange.endDate };
  const historical = isTripHistorical(tripStatusInput);
  // §Performance-Audit: alle drei unabhängig voneinander (Etappenbilder
  // brauchen nur stages, Highlight-Foto nur familyId/trip.id, Readiness nur
  // trip.id) — resolveStageImages lief bisher separat davor statt in
  // derselben Parallel-Ladung.
  const [stageImages, highlightPhotoByTripId, readiness] = await Promise.all([
    resolveStageImages(supabase, stages),
    getHighlightPhotoByTripId(supabase, familyId, [trip.id]),
    historical ? Promise.resolve(null) : computeTripReadiness(trip.id),
  ]);
  const heroImage = resolveTripImage(trip, highlightPhotoByTripId.get(trip.id) ?? null);
  const groupedFindings = readiness ? groupReadinessFindings(readiness.findings) : [];

  // "Aktive Reise" nur, wenn die Reise anhand der echten Daten gerade läuft —
  // nicht allein anhand des manuell gesetzten Status. Zukünftige Reisen zeigen
  // stattdessen "Bevorstehende Reise"; Reisen, deren Enddatum bereits vergangen
  // ist (auch wenn der Status nie manuell auf "completed" gesetzt wurde), gelten
  // als "Erlebt" statt fälschlich als bevorstehend.
  const statusLabel = historical ? "Erlebt"
    : isTripCurrentlyRunning(tripStatusInput) ? "Aktive Reise"
    : "Bevorstehende Reise";

  const bookingCategorySummaries = BOOKING_CATEGORY_ORDER.map((cat) => {
    const config = BOOKING_CATEGORIES[cat];
    const active = bookings.filter((b) => config.types.includes(b.type) && b.status !== "cancelled");
    const href = cat === "more" ? moreHref : `/trips/${trip.slug}/bookings/category/${cat}`;
    if (active.length === 0) {
      return { label: config.label, href, detail: config.emptyDetail, color: "var(--muted)" };
    }
    const allConfirmed = active.every((b) => b.status === "confirmed");
    return {
      label: config.label,
      href,
      detail: `${active.length} ${allConfirmed ? "bestätigt" : "in Planung"}`,
      color: allConfirmed ? "#4C7A5D" : "#B89A5E",
    };
  });

  const heroMetaParts = [
    totalNights > 0 ? `${totalNights} ${totalNights === 1 ? "Nacht" : "Nächte"}` : null,
    stages.length > 0 ? `${stages.length} ${stages.length === 1 ? "Aufenthalt" : "Aufenthalte"}` : null,
  ].filter(Boolean).join(" · ");
  // §"Konflikte" -> "ToDos" umbenannt (nutzerseitige Bitte): ToDos und
  // Hinweise nicht mehr vermischen/verschweigen: Sind beide Arten vorhanden,
  // zeigt die Hero-Pille beide Zahlen statt nur die eine Kategorie — sonst
  // könnte "5 ToDos" stehen, während unten zusätzlich Hinweise (z. B.
  // fehlende Flugbuchung) existieren, ohne dass die Zahl das widerspiegelt.
  const readinessLabel = !readiness ? "" : readiness.status === "ready"
    ? "Reisebereit"
    : readiness.conflictCount > 0 && readiness.hintCount > 0
      ? `${readiness.conflictCount} ${readiness.conflictCount === 1 ? "ToDo" : "ToDos"} · ${readiness.hintCount} ${readiness.hintCount === 1 ? "Hinweis" : "Hinweise"}`
      : readiness.conflictCount > 0
        ? `${readiness.conflictCount} ${readiness.conflictCount === 1 ? "ToDo" : "ToDos"}`
        : `${readiness.hintCount} ${readiness.hintCount === 1 ? "Hinweis" : "Hinweise"}`;
  const readinessColor = !readiness ? "#4C7A5D" : readiness.status === "ready" ? "#4C7A5D" : readiness.status === "conflicts" ? "#B5624A" : "#B89A5E";

  const visitedCountryCount = new Set(stages.map((s) => s.country_code).filter((c): c is string => !!c)).size;

  return (
    <div className="flex-1 flex flex-col">

      {/* ── CINEMATIC HERO ── */}
      <div className="relative" style={{ height: 360 }}>
        {heroImage ? (
          <SignedPhoto storagePath={heroImage.storagePath} initialUrl={heroImage.url} alt={trip.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${trip.gradient_from ?? "#1a1a1a"}, ${trip.gradient_to ?? "#333"})` }}
          />
        )}
        {/* Nur dezenter Verlauf für Lesbarkeit oben/unten -- die Bildmitte bleibt frei, damit das Foto trägt. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,9,7,0.55) 0%, rgba(10,9,7,0.1) 30%, rgba(10,9,7,0.05) 50%, rgba(10,9,7,0.88) 100%)",
          }}
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

        <div className="absolute top-5 right-7 flex flex-wrap items-center justify-end gap-2">
          <span
            style={{
              fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500,
              color: "#F0EBE3", background: "rgba(10,9,7,0.5)", border: "1px solid rgba(240,235,227,0.16)",
              padding: "5px 11px", borderRadius: "20px", whiteSpace: "nowrap",
            }}
          >
            {statusLabel}
          </span>

          {readiness ? (
            <Link
              href={`/trips/${trip.slug}/ready-to-travel`}
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
              style={{
                background: "rgba(10,9,7,0.82)",
                border: `1px solid ${readinessColor}55`,
                padding: "5px 12px",
                borderRadius: "20px",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: readinessColor }} />
              <span style={{ fontSize: "0.64rem", letterSpacing: "0.04em", fontWeight: 500, color: "#F0EBE3" }}>
                {readiness.status === "ready" ? "Ready to Travel" : readinessLabel}
              </span>
            </Link>
          ) : (
            <Link
              href={`/trips/${trip.slug}/gallery`}
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
              style={{
                background: "rgba(10,9,7,0.82)",
                border: "1px solid rgba(184,154,94,0.35)",
                padding: "5px 12px",
                borderRadius: "20px",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: "var(--accent)" }} />
              <span style={{ fontSize: "0.64rem", letterSpacing: "0.04em", fontWeight: 500, color: "#F0EBE3" }}>
                Erinnerungen ansehen
              </span>
            </Link>
          )}

          <Link
            href={`/trips/${trip.slug}/edit`}
            aria-label="Reise bearbeiten"
            className="flex items-center justify-center shrink-0 transition-opacity hover:opacity-80"
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(10,9,7,0.5)", border: "1px solid rgba(240,235,227,0.18)",
            }}
          >
            <Pencil size={14} strokeWidth={1.6} style={{ color: "#F0EBE3" }} />
          </Link>

          <details className="menu-details relative">
            <summary
              style={{
                cursor: "pointer",
                color: "rgba(240,235,227,0.6)",
                fontSize: "0.9rem",
                lineHeight: 1,
                width: 36, height: 36,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "50%",
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
                href={`/trips/${trip.slug}/archive`}
                style={{ display: "block", padding: "11px 16px", color: "#B5624A", fontSize: "0.78rem", textDecoration: "none" }}
              >
                Reise archivieren
              </Link>
            </div>
          </details>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-5 pb-5 md:px-8 md:pb-7 flex flex-col gap-2.5">
          <div>
            <div style={{ color: "#C8A96E", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "6px" }}>
              Eure Reise
            </div>
            <h1
              className="font-light leading-tight"
              style={{ color: H_FG, letterSpacing: "-0.01em", fontSize: "clamp(1.7rem, 4.5vw, 2.7rem)" }}
            >
              {trip.title}
            </h1>
          </div>

          <div className="flex flex-col gap-2">
            {routeChips.length > 0 && <RouteChips chips={routeChips} />}

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div style={{ color: "#D8CFC0", letterSpacing: "0.02em", fontSize: "0.65rem" }}>
                {formatTripDateRangeLabel(tripDateRange)}
                {duration ? ` · ${duration} Tage` : ""}
                {heroMetaParts ? ` · ${heroMetaParts}` : ""}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex -space-x-1.5">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(240,235,227,0.14)", color: H_FG, border: "1px solid rgba(240,235,227,0.22)", fontSize: "0.55rem", letterSpacing: "0.02em" }}
                    >
                      {m.initials}
                    </div>
                  ))}
                </div>
                <span style={{ color: H_MUTED, fontSize: "0.62rem", letterSpacing: "0.06em" }}>
                  {members.length} Reisende
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── LIGHT CONTENT ── */}
      <div className="flex-1" style={{ background: "var(--background)" }}>
        <div className="max-w-5xl mx-auto px-5 md:px-10 py-10 space-y-14">

          <div
            className="sticky top-0 z-20 -mx-5 md:-mx-10 px-5 md:px-10 -mt-2 py-2.5"
            style={{ background: "var(--background)", borderBottom: "1px solid var(--border)" }}
          >
            <div className="grid grid-cols-4 gap-x-2 gap-y-3">
              <QuickNavItem Icon={Route} label="Journey" href="#journey" active />
              <QuickNavItem Icon={Plane} label="Flüge" href={`/trips/${trip.slug}/bookings/category/flight`} />
              <QuickNavItem Icon={BedDouble} label="Hotels" href={`/trips/${trip.slug}/bookings/category/accommodation`} />
              <QuickNavItem Icon={Compass} label="Aktivitäten" href={`/trips/${trip.slug}/bookings/category/activity`} />
              <QuickNavItem Icon={Images} label="Galerie" href={`/trips/${trip.slug}/gallery`} />
              <QuickNavItem Icon={FileText} label="Dokumente" href={`/trips/${trip.slug}/documents`} />
              <QuickNavItem Icon={Wallet} label="Budget" href={`/trips/${trip.slug}/budget`} />
              <QuickNavItem Icon={MoreHorizontal} label="Mehr" href={moreHref} />
            </div>
          </div>

          <section id="journey">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <h2
                  className="text-xs font-medium"
                  style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}
                >
                  Journey
                </h2>
                {/* §Punkt 4 "Nach der Reise zeigt Journey den tatsächlich erlebten
                    Ablauf": reine Darstellungs-Ergänzung auf Basis der bereits
                    vorhandenen datumsbasierten Reise-Historie (lib/trip-status.ts),
                    kein neues journey_events-Statusfeld. */}
                {isTripHistorical(trip) && (
                  <span
                    style={{
                      color: "var(--accent)", fontSize: "0.56rem", letterSpacing: "0.12em", textTransform: "uppercase",
                      background: "rgba(184,154,94,0.12)", border: "1px solid rgba(184,154,94,0.3)",
                      borderRadius: "20px", padding: "2px 9px",
                    }}
                  >
                    Erlebt
                  </span>
                )}
              </div>
              <Link
                href={`/trips/${trip.slug}/journey-events/new`}
                style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}
              >
                + Journey-Termin
              </Link>
            </div>

            {journeyBlocks.length > 0 ? (
              <div className="space-y-2.5">
                {journeyBlocks.map((block) =>
                  block.kind === "stay" ? (
                    <StaySegmentCard key={block.segment.stage.id} segment={block.segment} slug={trip.slug} />
                  ) : (
                    <DayGroupCard key={block.days[0].date} days={block.days} slug={trip.slug} />
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

          <section id="merkliste">
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-xs font-medium"
                style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}
              >
                Merkliste{ideaEvents.length > 0 ? ` · ${ideaEvents.length}` : ""}
              </h2>
            </div>

            {ideaEvents.length > 0 ? (
              <div className="space-y-2.5">
                {ideaEvents.map((e) => {
                  const config = JOURNEY_EVENT_CATEGORIES[e.category];
                  const Icon = config.icon;
                  return (
                    <div
                      key={e.id}
                      className="rounded-xl p-4 flex items-center gap-3"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <Icon size={14} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0 }} />
                      <Link
                        href={`/trips/${trip.slug}/journey-events/${e.id}/edit`}
                        className="flex-1 min-w-0"
                        style={{ textDecoration: "none" }}
                      >
                        <div className="truncate" style={{ color: "var(--foreground)", fontSize: "0.85rem" }}>
                          {e.title}{e.location ? ` · ${e.location}` : ""}
                        </div>
                        <div style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{formatDateDE(e.date)}</div>
                      </Link>
                      <form action={deleteJourneyEvent}>
                        <input type="hidden" name="event_id" value={e.id} />
                        <input type="hidden" name="slug" value={trip.slug} />
                        <input type="hidden" name="return_to" value={`/trips/${trip.slug}#merkliste`} />
                        <button
                          type="submit"
                          style={{
                            background: "transparent", color: "#B5624A", border: "1px solid rgba(181,98,74,0.35)",
                            borderRadius: "6px", padding: "6px 12px", fontSize: "0.6rem", letterSpacing: "0.08em",
                            textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0,
                            WebkitAppearance: "none", appearance: "none",
                          }}
                        >
                          Löschen
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="rounded-xl p-6"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                  Von LUMI gemerkte Orte und Ideen erscheinen hier, unabhängig vom Datum.
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
              <div className="overflow-x-auto scroll-hide -mx-1 px-1">
                <div className="flex gap-4 pb-3" style={{ width: "max-content" }}>
                  {stages.map((stage, idx) => (
                    <StageCard
                      key={stage.id} stage={stage} idx={idx} slug={trip.slug}
                      img={stageImages.get(stage.id) ?? { url: FALLBACK_STAGE_IMAGE, storagePath: null }}
                      tripHistorical={historical}
                    />
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
              {bookings.length > 0 && (
                <Link
                  href={`/trips/${trip.slug}/bookings/new`}
                  style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}
                >
                  + Buchung hinzufügen
                </Link>
              )}
            </div>

            {bookings.length > 0 ? (
              <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                {bookingCategorySummaries.map((cat, idx) => (
                  <Link
                    key={cat.label}
                    href={cat.href}
                    className="flex items-center justify-between px-5 py-3.5 transition-opacity hover:opacity-70"
                    style={{ borderBottom: idx < bookingCategorySummaries.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}
                  >
                    <span style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>{cat.label}</span>
                    <span style={{ color: cat.color, fontSize: "0.7rem" }}>{cat.detail}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                href={`/trips/${trip.slug}/bookings/new`}
                className="flex items-center justify-between rounded-xl px-5 py-4 transition-opacity hover:opacity-80"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
              >
                <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Noch keine Buchungen erfasst.</span>
                <span style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                  Erste Buchung hinzufügen →
                </span>
              </Link>
            )}
          </section>

          {groupedFindings.length > 0 && (
            <section>
              <SectionLabel>Nächste Schritte</SectionLabel>
              <div className="rounded-xl px-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                {groupedFindings.map((finding, idx) => (
                  <ReadinessStepItem key={finding.key} finding={finding} isLast={idx === groupedFindings.length - 1} />
                ))}
              </div>
            </section>
          )}

          {historical && (
            <section>
              <SectionLabel>Diese Reise ist abgeschlossen</SectionLabel>
              <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex gap-8 mb-5">
                  {[
                    { value: duration, label: duration === 1 ? "Tag" : "Tage" },
                    { value: stages.length, label: stages.length === 1 ? "Aufenthalt" : "Aufenthalte" },
                    { value: visitedCountryCount, label: visitedCountryCount === 1 ? "Land" : "Länder" },
                  ].map(({ value, label }) => (
                    <div key={label}>
                      <div className="text-2xl font-light leading-none mb-1" style={{ color: "var(--foreground)" }}>{value}</div>
                      <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>{label}</div>
                    </div>
                  ))}
                </div>
                <Link
                  href={`/trips/${trip.slug}/gallery`}
                  className="inline-flex items-center gap-1"
                  style={{ color: "var(--accent)", fontSize: "0.75rem", letterSpacing: "0.04em", textDecoration: "none" }}
                >
                  Erinnerungsfotos ansehen <ChevronRight size={13} strokeWidth={1.6} />
                </Link>
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
