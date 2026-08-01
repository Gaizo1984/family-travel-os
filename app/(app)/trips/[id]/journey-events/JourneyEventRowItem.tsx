import Link from "next/link";
import { JOURNEY_EVENT_CATEGORIES, JOURNEY_EVENT_STATUS_LABELS } from "@/lib/journey-events";
import type { JourneyEventCategory, JourneyEventStatus } from "@/lib/journey-events";
import { formatDateDE } from "@/lib/demo-data";

export type JourneyEventRowData = {
  id: string;
  date: string;
  time: string | null;
  category: JourneyEventCategory;
  title: string;
  location: string | null;
  status: JourneyEventStatus;
};

/**
 * §"Journal-Einträge zusätzlich in der Aktivitäten-Liste zeigen, klar
 * markiert" (Nutzervorgabe, wörtlich) -- Vorbild BookingRowItem.tsx, aber für
 * journey_events statt bookings: kein Preis (Journal-Termine haben keinen),
 * stattdessen Status-Label, und ein "Journal"-Badge statt des
 * Etappen-Badges, damit auf einen Blick klar ist, dass dies KEINE echte
 * Buchung ist. Journal-Einträge haben keine eigene Detailseite -- Link führt
 * direkt zur Bearbeiten-Seite.
 */
export function JourneyEventRowItem({
  event,
  slug,
}: {
  event: JourneyEventRowData;
  slug: string;
}) {
  const categoryConfig = JOURNEY_EVENT_CATEGORIES[event.category];
  const Icon = categoryConfig.icon;
  return (
    <Link
      href={`/trips/${slug}/journey-events/${event.id}/edit`}
      className="flex items-center gap-4 p-4 rounded-xl transition-colors"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
    >
      <div
        className="shrink-0 flex items-center justify-center rounded-lg"
        style={{ width: 36, height: 36, background: "var(--accent-subtle)" }}
      >
        <Icon size={15} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{event.title}</span>
          <span style={{ color: "var(--accent)", fontSize: "0.6rem", letterSpacing: "0.06em", background: "var(--accent-subtle)", padding: "1px 8px", borderRadius: "10px" }}>
            Journal
          </span>
        </div>
        <div className="text-xs mt-0.5" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
          {event.location ? `${event.location} · ` : ""}{formatDateDE(event.date)}{event.time ? ` · ${event.time.slice(0, 5)}` : ""}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {JOURNEY_EVENT_STATUS_LABELS[event.status]}
        </div>
      </div>
    </Link>
  );
}
