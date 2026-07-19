import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { OfflineTripsList } from "@/components/OfflineTripsList";

/** §"Offline-Bereich" (Nutzervorgabe): dünne Server-Hülle -- die eigentliche Liste liest ausschließlich aus IndexedDB (keine Supabase-Abfrage, siehe OfflineTripsList/lib/offline-document-cache.ts::listTripSnapshots). */
export default function OfflineTripsPage() {
  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
        <Link
          href="/mehr"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Mehr
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "10px" }}>
          Ohne Verbindung nutzbar
        </div>
        <h1 className="font-light mb-3" style={{ color: "var(--foreground)", fontSize: "clamp(1.5rem, 5vw, 2rem)", letterSpacing: "-0.01em" }}>
          Offline-Reisen
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.6 }}>
          Nur Reisen, die ihr ausdrücklich für die Offline-Nutzung gespeichert habt.
        </p>

        <OfflineTripsList />
      </div>
    </div>
  );
}
