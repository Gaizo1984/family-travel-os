import type { JourneyDayBucket } from "@/lib/journey-events-model";
import { JourneyDayCard } from "./JourneyDayCard";

/**
 * §"Klare vertikale Timeline, Tagesgruppen mit Datum und Ort" (Nutzervorgabe):
 * eine einzige durchgehende Linie über alle Tage (die Verbindungslinie wird
 * je Tag in JourneyDayCard gezeichnet, damit sie zwischen den Karten
 * durchläuft), keine Kalenderansicht.
 */
export function JourneyTimeline({ days, photoUrlByPhotoId }: { days: JourneyDayBucket[]; photoUrlByPhotoId: Map<string, string> }) {
  if (days.length === 0) return null;
  return (
    <div>
      {days.map((day) => (
        <JourneyDayCard key={day.date} day={day} photoUrlByPhotoId={photoUrlByPhotoId} />
      ))}
    </div>
  );
}
