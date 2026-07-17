import Link from "next/link";
import type { JourneyEvent } from "@/lib/journey-events-model";

/**
 * §"Nach der Reise: Erinnerungen, Fotos und Travel Memory" (Nutzervorgabe):
 * reine Anzeige bereits vorhandener `memory_photos` (trip_id-verknüpft,
 * siehe lib/journey-events-model.ts::memoryPhotosToJourneyEvents) -- keine
 * neue Datenhaltung. Ergänzt die tagesweisen Foto-Streifen der Timeline
 * darunter um einen kompakten Gesamt-Rückblick.
 */
export function JourneyAfterSection({ memories, photoUrlByPhotoId }: { memories: JourneyEvent[]; photoUrlByPhotoId: Map<string, string> }) {
  if (memories.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <span style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Nach der Reise
        </span>
        <Link href="/memories" style={{ color: "var(--accent)", fontSize: "0.68rem", textDecoration: "none" }}>
          Alle Erinnerungen →
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {memories.map((m) => {
          const url = photoUrlByPhotoId.get(m.sourceId);
          if (!url) return null;
          return (
            <Link key={m.id} href={m.linkHref ?? "/memories"} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: "1/1" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
