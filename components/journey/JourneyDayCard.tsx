import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Image as ImageIcon, ListChecks } from "lucide-react";
import { formatDateDE } from "@/lib/demo-data";
import { BOOKING_TYPE_CONFIG } from "@/lib/bookings";
import { JOURNEY_EVENT_CATEGORIES } from "@/lib/journey-events";
import { describeWeatherCode } from "@/lib/weather";
import type { JourneyDayBucket, JourneyEvent, JourneyEventCategory, JourneyEventStatusUnified } from "@/lib/journey-events-model";
import type { BookingType } from "@/lib/supabase/types";
import type { JourneyEventCategory as JourneyEventEntryCategory } from "@/lib/journey-events";

const EXTRA_ICONS: Record<"photo" | "checklist", LucideIcon> = { photo: ImageIcon, checklist: ListChecks };

/** Vereint Buchungs- und Journey-Termin-Icons mit den beiden neuen Kategorien -- eine Auflösung statt getrennter Schalter je Aufrufer. */
function resolveIcon(category: JourneyEventCategory): LucideIcon {
  if (category === "photo" || category === "checklist") return EXTRA_ICONS[category];
  if (category in BOOKING_TYPE_CONFIG) return BOOKING_TYPE_CONFIG[category as BookingType].icon;
  return JOURNEY_EVENT_CATEGORIES[category as JourneyEventEntryCategory].icon;
}

const STATUS_LABEL: Partial<Record<JourneyEventStatusUnified, string>> = {
  idea: "Idee", missing: "Fehlt", info: "Hinweis",
};
const STATUS_COLOR: Record<JourneyEventStatusUnified, string> = {
  confirmed: "var(--foreground)", planned: "#B89A5E", idea: "var(--muted)", missing: "#B5624A", info: "var(--muted)",
};

function EventRow({ event }: { event: JourneyEvent }) {
  const Icon = resolveIcon(event.category);
  const statusLabel = STATUS_LABEL[event.status];
  const content = (
    <div className="flex items-center gap-3 py-2">
      <Icon size={13} strokeWidth={1.4} style={{ color: event.priority === "high" ? "var(--accent)" : "var(--muted)", flexShrink: 0 }} />
      <span className="flex-1 min-w-0 truncate" style={{ color: STATUS_COLOR[event.status], fontSize: "0.82rem", fontWeight: event.priority === "high" ? 500 : 400 }}>
        {event.title}
      </span>
      {statusLabel && (
        <span style={{ color: STATUS_COLOR[event.status], fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
          {statusLabel}
        </span>
      )}
      {event.time && <span style={{ color: "var(--muted)", fontSize: "0.68rem", flexShrink: 0 }}>{event.time}</span>}
    </div>
  );
  if (!event.linkHref) return content;
  return (
    <Link href={event.linkHref} style={{ textDecoration: "none" }}>
      {content}
    </Link>
  );
}

/**
 * §"Aktuelle Position hervorheben, vergangene Punkte reduziert" (Nutzervorgabe):
 * `isToday` bekommt den Glow-Akzent (gleiche Optik wie `TravelHistoryTimeline`
 * auf dem Dashboard), `isPast` wird gedimmt (gleiche `opacity:0.45`-Konvention
 * wie bisher auf /today).
 */
export function JourneyDayCard({ day, photoUrlByPhotoId }: { day: JourneyDayBucket; photoUrlByPhotoId: Map<string, string> }) {
  const weather = day.weather ? describeWeatherCode(day.weather.code) : null;
  const dayLabel = day.stage?.location ?? day.stage?.title ?? null;

  return (
    <div
      className="relative pl-8 pb-6"
      style={{ opacity: day.isPast ? 0.5 : 1 }}
    >
      <div
        className="absolute rounded-full"
        style={{
          left: 0, top: "6px", width: "10px", height: "10px",
          background: day.isToday ? "var(--accent)" : "transparent",
          border: `1.5px solid ${day.isToday ? "var(--accent)" : "var(--muted)"}`,
          boxShadow: day.isToday ? "0 0 0 4px rgba(184,154,94,0.12)" : "none",
        }}
      />
      <div className="absolute" style={{ left: "4px", top: "16px", bottom: 0, width: "1px", background: "var(--border)" }} />

      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <span style={{ color: day.isToday ? "var(--accent)" : "var(--muted)", fontSize: "0.68rem", letterSpacing: "0.06em" }}>
          {formatDateDE(day.date)}
          {day.isStageStart && " · Anreise"}
          {day.isStageEnd && !day.isStageStart && " · Abreise"}
          {dayLabel && ` · ${dayLabel}`}
        </span>
        {weather && (
          <span className="inline-flex items-center gap-1" style={{ color: "var(--muted)", fontSize: "0.68rem" }}>
            <weather.icon size={13} strokeWidth={1.6} />
            {day.weather!.tempMax}°/{day.weather!.tempMin}°
            {day.weather!.precipitationProbability !== null && ` · ${day.weather!.precipitationProbability}% Regen`}
          </span>
        )}
      </div>

      {day.events.length > 0 ? (
        <div className="rounded-xl px-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {day.events.map((e) => <EventRow key={e.id} event={e} />)}
        </div>
      ) : (
        <div className="rounded-xl px-4 py-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Kein Programm</span>
        </div>
      )}

      {day.photos.length > 0 && (
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {day.photos.map((p) => {
            const url = photoUrlByPhotoId.get(p.sourceId);
            if (!url) return null;
            return (
              <Link key={p.id} href={p.linkHref ?? "/memories"} className="shrink-0 rounded-lg overflow-hidden" style={{ width: 64, height: 64 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
