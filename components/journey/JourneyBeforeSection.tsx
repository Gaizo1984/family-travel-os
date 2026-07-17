import Link from "next/link";
import { describeWeatherCode, type DailyForecast } from "@/lib/weather";
import { formatDateDE } from "@/lib/demo-data";
import type { JourneyEvent } from "@/lib/journey-events-model";

/** Gleiche Punkt-Optik wie `ReadinessStepItem` auf der Reise-Detailseite -- rot für "missing"/Konflikt, gold für Hinweise. */
function ChecklistRow({ item, isLast }: { item: JourneyEvent; isLast: boolean }) {
  const color = item.status === "missing" ? "#B5624A" : "#B89A5E";
  const content = (
    <div className="flex items-start gap-4 py-4" style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
      <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: color }} />
      <span className="text-sm leading-relaxed flex-1" style={{ color: "var(--foreground)" }}>{item.title}</span>
    </div>
  );
  if (!item.linkHref) return content;
  return (
    <Link href={item.linkHref} className="block transition-opacity hover:opacity-70" style={{ textDecoration: "none" }}>
      {content}
    </Link>
  );
}

/** Kompakte Tages-Chips (Icon + Temperatur) -- gleiches Muster wie `WeatherStrip` auf /today, hier für den Ausblick vor Reisebeginn. */
function WeatherOutlookStrip({ daily }: { daily: DailyForecast[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto">
      {daily.map((d) => {
        const info = describeWeatherCode(d.code);
        return (
          <div key={d.date} className="flex flex-col items-center gap-1 shrink-0">
            <span style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.06em" }}>{formatDateDE(d.date).slice(0, 5)}</span>
            <info.icon size={16} strokeWidth={1.6} style={{ color: "var(--accent)" }} />
            <span style={{ color: "var(--foreground)", fontSize: "0.72rem" }}>{d.tempMax}°</span>
          </div>
        );
      })}
    </div>
  );
}

export function JourneyBeforeSection({
  checklist, weatherOutlook,
}: {
  checklist: JourneyEvent[]
  weatherOutlook: DailyForecast[]
}) {
  if (checklist.length === 0 && weatherOutlook.length === 0) return null;
  return (
    <section className="mb-8">
      <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>
        Vor der Reise
      </div>

      {weatherOutlook.length > 0 && (
        <div className="rounded-xl p-4 mb-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <WeatherOutlookStrip daily={weatherOutlook} />
        </div>
      )}

      {checklist.length > 0 && (
        <div className="rounded-xl px-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {checklist.map((item, idx) => (
            <ChecklistRow key={item.id} item={item} isLast={idx === checklist.length - 1} />
          ))}
        </div>
      )}
    </section>
  );
}
