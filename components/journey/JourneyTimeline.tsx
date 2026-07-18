import Link from "next/link";
import type { JourneyDayBucket } from "@/lib/journey-events-model";
import { formatDateDE } from "@/lib/demo-data";
import { JourneyDayCard } from "./JourneyDayCard";

/**
 * §"Aktuellen Reisetag und nächstes Ereignis stärker hervorheben"
 * (Nutzervorgabe): das erste Ereignis des ersten nicht-vergangenen Tages
 * (heute oder künftig) gilt als "nächstes Ereignis" -- bewusst auf
 * Tages-Granularität beschränkt, keine Uhrzeit-genaue "jetzt"-Berechnung
 * über Zeitzonen hinweg (siehe bestehende v1-Einschränkung zu
 * JourneyDayBucket.timeZone in lib/journey-events-model.ts).
 */
function findNextEventId(days: JourneyDayBucket[]): string | null {
  for (const day of days) {
    if (day.isPast) continue;
    if (day.events.length > 0) return day.events[0].id;
  }
  return null;
}

type TimelineRenderItem =
  | { kind: "day"; day: JourneyDayBucket }
  | { kind: "freeGroup"; days: JourneyDayBucket[] };

/**
 * §"Mehrere aufeinanderfolgende freie Tage kompakt gruppieren" (Nutzervorgabe):
 * reine Darstellungs-Gruppierung, erzeugt keine neuen Datensätze -- ein
 * "freier Tag" ist ein Tag ohne Ereignisse UND ohne An-/Abreise (ein reiner
 * An-/Abreisetag bleibt immer einzeln sichtbar, auch ohne eigenes Programm).
 * Ab zwei aufeinanderfolgenden freien Tagen wird zu EINER Gruppe
 * zusammengefasst, ein einzelner freier Tag bleibt wie bisher eine eigene Karte.
 */
function groupConsecutiveFreeDays(days: JourneyDayBucket[]): TimelineRenderItem[] {
  const items: TimelineRenderItem[] = [];
  let i = 0;
  const isFreeDay = (d: JourneyDayBucket) => d.events.length === 0 && !d.isStageStart && !d.isStageEnd;

  while (i < days.length) {
    if (isFreeDay(days[i])) {
      const group: JourneyDayBucket[] = [days[i]];
      let j = i + 1;
      while (j < days.length && isFreeDay(days[j])) {
        group.push(days[j]);
        j++;
      }
      if (group.length >= 2) {
        items.push({ kind: "freeGroup", days: group });
        i = j;
        continue;
      }
    }
    items.push({ kind: "day", day: days[i] });
    i++;
  }
  return items;
}

function FreeDayGroupCard({ days }: { days: JourneyDayBucket[] }) {
  const allPast = days.every((d) => d.isPast);
  const firstActionableDate = days.find((d) => !d.isPast)?.date ?? days[0].date;
  const label = `${formatDateDE(days[0].date)} – ${formatDateDE(days[days.length - 1].date)} · ${days.length} freie Tage`;

  return (
    <div className="relative pl-8 pb-6" style={{ opacity: allPast ? 0.5 : 1 }}>
      <div className="absolute rounded-full" style={{ left: 0, top: "6px", width: "10px", height: "10px", background: "transparent", border: "1.5px solid var(--muted)" }} />
      <div className="absolute" style={{ left: "4px", top: "16px", bottom: 0, width: "1px", background: "var(--border)" }} />

      <div className="mb-1" style={{ color: "var(--muted)", fontSize: "0.68rem", letterSpacing: "0.06em" }}>{label}</div>

      {allPast ? (
        <div className="rounded-xl px-4 py-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Kein Programm</span>
        </div>
      ) : (
        <Link
          href={`/today/plan?date=${firstActionableDate}`}
          className="flex items-center justify-between rounded-xl px-4 py-3 transition-opacity hover:opacity-80"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none", minHeight: "44px" }}
        >
          <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>Kein Programm</span>
          <span style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.04em" }}>Tagesplan erstellen →</span>
        </Link>
      )}
    </div>
  );
}

/**
 * §"Klare vertikale Timeline, Tagesgruppen mit Datum und Ort" (Nutzervorgabe):
 * eine einzige durchgehende Linie über alle Tage (die Verbindungslinie wird
 * je Tag in JourneyDayCard gezeichnet, damit sie zwischen den Karten
 * durchläuft), keine Kalenderansicht.
 */
export function JourneyTimeline({ days, photoUrlByPhotoId }: { days: JourneyDayBucket[]; photoUrlByPhotoId: Map<string, string> }) {
  if (days.length === 0) return null;
  const nextEventId = findNextEventId(days);
  const items = groupConsecutiveFreeDays(days);
  return (
    <div>
      {items.map((item) =>
        item.kind === "freeGroup" ? (
          <FreeDayGroupCard key={`group-${item.days[0].date}`} days={item.days} />
        ) : (
          <JourneyDayCard key={item.day.date} day={item.day} photoUrlByPhotoId={photoUrlByPhotoId} nextEventId={nextEventId} />
        ),
      )}
    </div>
  );
}
