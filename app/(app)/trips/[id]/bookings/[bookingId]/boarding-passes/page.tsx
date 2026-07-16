import Link from "next/link";
import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { sortForBoardingPassViewer } from "@/lib/boarding-passes";
import { OfflineDocumentViewer } from "@/components/OfflineDocumentViewer";
import { getCachedSignedUrl } from "@/lib/signed-storage-url";

export default async function BoardingPassViewerPage({
  params,
}: {
  params: Promise<{ id: string; bookingId: string }>;
}) {
  const { id, bookingId } = await params;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, title, type, start_datetime, end_datetime")
    .eq("id", bookingId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (!booking || booking.type !== "flight") notFound();
  const referenceDateIso = booking.end_datetime ?? booking.start_datetime ?? new Date().toISOString();

  const { data: docsRaw } = await supabase
    .from("documents")
    .select("id, storage_path, person_id, persons ( id, name )")
    .eq("booking_id", bookingId)
    .eq("doc_type", "boarding_pass");

  const passes = sortForBoardingPassViewer(
    (docsRaw ?? [])
      .map((d) => ({
        id: d.id,
        storage_path: d.storage_path,
        person: d.persons as unknown as { id: string; name: string } | null,
      }))
      .filter((d): d is { id: string; storage_path: string; person: { id: string; name: string } } => d.person !== null)
      .map((d) => ({ ...d, name: d.person.name }))
  );

  if (passes.length === 0) notFound();

  const withUrl = await Promise.all(
    passes.map(async (p) => {
      const url = await getCachedSignedUrl("documents", p.storage_path);
      const isPdf = p.storage_path.toLowerCase().endsWith(".pdf");
      return { ...p, url, isPdf };
    })
  );

  return (
    <div style={{ background: "#000" }}>
      <Link
        href={`/trips/${trip.slug}/bookings/${bookingId}`}
        className="flex items-center gap-2"
        style={{
          position: "fixed", top: "16px", right: "16px", zIndex: 10,
          background: "rgba(255,255,255,0.12)", borderRadius: "50%", padding: "10px",
          color: "#fff", textDecoration: "none",
        }}
        aria-label="Schließen"
      >
        <X size={18} strokeWidth={1.6} />
      </Link>

      {withUrl.map((pass, index) => (
        <section
          key={pass.id}
          className="flex flex-col items-center justify-center px-6"
          style={{ minHeight: "100vh", borderBottom: index < withUrl.length - 1 ? "1px solid rgba(255,255,255,0.12)" : "none" }}
        >
          <div
            style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.72rem", letterSpacing: "0.1em", marginBottom: "16px", textTransform: "uppercase" }}
          >
            {index + 1} von {withUrl.length} · {pass.name}
          </div>

          <OfflineDocumentViewer
            documentId={pass.id}
            sourceUrl={pass.url}
            fileName={`boardingpass-${pass.name}${pass.isPdf ? ".pdf" : ""}`}
            mimeType={pass.isPdf ? "application/pdf" : "image/jpeg"}
            isPdf={pass.isPdf}
            referenceDateIso={referenceDateIso}
            altText={`Boardingpass ${pass.name}`}
          />
        </section>
      ))}
    </div>
  );
}
