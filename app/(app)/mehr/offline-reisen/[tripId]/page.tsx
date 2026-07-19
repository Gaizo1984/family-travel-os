import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { OfflineTripDetail } from "@/components/OfflineTripDetail";

/** §"Innerhalb einer echten Offline-Reise eine klare Navigation ergänzen" (Nutzervorgabe): dünne Server-Hülle, Tabs + alle Inhalte lädt OfflineTripDetail ausschließlich aus IndexedDB -- keine Online-Abfragen beim Öffnen. */
export default async function OfflineTripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
        <Link
          href="/mehr/offline-reisen"
          className="flex items-center gap-2 mb-6 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Offline-Reisen
        </Link>

        <OfflineTripDetail tripId={tripId} />
      </div>
    </div>
  );
}
