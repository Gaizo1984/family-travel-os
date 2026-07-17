import Link from "next/link";
import { BOOKING_TYPE_CONFIG, splitDateTime } from "@/lib/bookings";
import type { BookingType } from "@/lib/supabase/types";
import {
  JOURNEY_EVENT_CATEGORIES, JOURNEY_EVENT_STATUS_COLORS, JOURNEY_EVENT_STATUS_LABELS,
  formatEventTime,
} from "@/lib/journey-events";
import type { TimelineDay } from "@/lib/journey";
import { formatDateDE } from "@/lib/demo-data";

/**
 * §Bugfix "Flug erscheint teilweise nach dem Hotel am selben Tag": Check-in-/
 * Check-out-Zeitpunkte von Unterkünften sind selten exakt erfasst (meist nur
 * ein Datum, keine echte Uhrzeit) und sortierten dadurch nach reiner
 * Uhrzeit teils vor einer An-/Abreise, die tatsächlich zuerst bzw. danach
 * stattfindet. Klassische Regel statt unzuverlässiger Uhrzeit: Flug immer
 * vor Hotel-Check-in, außer am Rückreisetag -- dort schließt der
 * Hotel-Check-out (End-Vorkommnis) den Aufenthalt ab, bevor der Rückflug
 * losgeht. Gilt nur für die Flug/Unterkunft-Paarung, alle anderen Einträge
 * behalten ihre normale Uhrzeit-Sortierung.
 */
function compareDayItems(a: Item, b: Item): number {
  if (a.type === "flight" && b.type === "accommodation") return b.isEnd ? 1 : -1;
  if (a.type === "accommodation" && b.type === "flight") return a.isEnd ? -1 : 1;
  return a.sortKey.localeCompare(b.sortKey);
}

type Item = { sortKey: string; type?: BookingType; isEnd?: boolean; node: React.ReactNode };

function renderDayItems(day: TimelineDay, slug: string): React.ReactNode[] {
  const items: Item[] = [];

  for (const b of day.bookings) {
    if (b.status === "cancelled") continue;
    const { time } = splitDateTime(b.start_datetime);
    const config = BOOKING_TYPE_CONFIG[b.type];
    const Icon = config.icon;
    items.push({
      sortKey: b.start_datetime ?? "",
      type: b.type,
      isEnd: b.isEndOccurrence ?? false,
      node: (
        <Link key={`b-${b.id}`} href={`/trips/${slug}/bookings/${b.id}`} className="flex items-center gap-3 py-2" style={{ textDecoration: "none" }}>
          <Icon size={13} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <span className="flex-1 min-w-0 truncate" style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>
            {b.provider ? `${b.provider} · ${b.title}` : b.title}
          </span>
          {time && <span style={{ color: "var(--muted)", fontSize: "0.68rem", flexShrink: 0 }}>{time}</span>}
        </Link>
      ),
    });
  }

  for (const e of day.events) {
    const config = JOURNEY_EVENT_CATEGORIES[e.category];
    const Icon = config.icon;
    const time = formatEventTime(e.time);
    items.push({
      sortKey: `${e.date}T${e.time ?? "00:00"}`,
      node: (
        <Link key={`e-${e.id}`} href={`/trips/${slug}/journey-events/${e.id}/edit`} className="flex items-center gap-3 py-2" style={{ textDecoration: "none" }}>
          <Icon size={13} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <span className="flex-1 min-w-0 truncate" style={{ color: "var(--foreground)", fontSize: "0.82rem" }}>
            {e.title}{e.location ? ` · ${e.location}` : ""}
          </span>
          <span style={{ color: JOURNEY_EVENT_STATUS_COLORS[e.status], fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
            {JOURNEY_EVENT_STATUS_LABELS[e.status]}
          </span>
          {time && <span style={{ color: "var(--muted)", fontSize: "0.68rem", flexShrink: 0 }}>{time}</span>}
        </Link>
      ),
    });
  }

  return items.sort(compareDayItems).map((i) => i.node);
}

export function DayRow({ day, slug, dayHref }: { day: TimelineDay; slug: string; dayHref?: string }) {
  const items = renderDayItems(day, slug);
  const hasEvents = items.length > 0;
  const dateLabel = (
    <span style={{ color: "var(--muted)", fontSize: "0.62rem", letterSpacing: "0.08em" }}>
      {formatDateDE(day.date)}
      {day.isStageStart && " · Anreise"}
      {day.isStageEnd && !day.isStageStart && " · Abreise"}
    </span>
  );
  return (
    <div className="py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-1">
        {dayHref ? (
          <Link href={dayHref} style={{ textDecoration: "none" }}>{dateLabel}</Link>
        ) : dateLabel}
        {!hasEvents && <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>Kein Programm</span>}
      </div>
      {hasEvents && <div>{items}</div>}
    </div>
  );
}
