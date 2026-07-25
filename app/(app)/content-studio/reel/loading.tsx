import { Skeleton } from "@/components/Skeleton";

/**
 * §Content Studio 3.0, Sprint 6: "verständliche ... Loading-Zustände"
 * (Nutzervorgabe) -- gemeinsames Skeleton für alle Reel-Unterrouten
 * (new/media/timeline/render, gleiches einspaltiges Layout), Next.js nutzt
 * diese eine Datei als Suspense-Fallback für alle darunterliegenden
 * Segmente, solange keine spezifischere loading.tsx näher am Blatt liegt.
 */
export default function ReelLoading() {
  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-lg w-full mx-auto px-5 md:px-8 pb-24 pt-9">
        <Skeleton className="mb-8" style={{ width: 120, height: 14 }} />
        <Skeleton className="mb-3" style={{ width: 100, height: 10 }} />
        <Skeleton className="mb-8" style={{ width: 220, height: 22 }} />
        <div className="space-y-3">
          <Skeleton style={{ height: 260, borderRadius: 12 }} />
          <Skeleton style={{ height: 60, borderRadius: 12 }} />
          <Skeleton style={{ height: 60, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  );
}
