import Link from "next/link";
import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { sortForBoardingPassViewer, detectFlightLegOptions, legLabelFor } from "@/lib/boarding-passes";
import { BoardingPassCarousel, type BoardingPassCarouselItem } from "@/components/BoardingPassCarousel";
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
    .select("id, title, type, start_datetime, end_datetime, details")
    .eq("id", bookingId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (!booking || booking.type !== "flight") notFound();
  const referenceDateIso = booking.end_datetime ?? booking.start_datetime ?? new Date().toISOString();
  const flightLegOptions = detectFlightLegOptions(booking.details as Record<string, string> | null);
  const legOrder = new Map(flightLegOptions.map((opt, i) => [opt.value, i]));

  const { data: docsRaw } = await supabase
    .from("documents")
    .select("id, storage_path, person_id, details, persons ( id, name )")
    .eq("booking_id", bookingId)
    .eq("doc_type", "boarding_pass");

  type RawPass = { id: string; storage_path: string; leg: string | null; person: { id: string; name: string } };
  const rawPasses: RawPass[] = (docsRaw ?? [])
    .map((d) => ({
      id: d.id,
      storage_path: d.storage_path,
      leg: (d.details as Record<string, string> | null)?.leg ?? null,
      person: d.persons as unknown as { id: string; name: string } | null,
    }))
    .filter((d): d is RawPass => d.person !== null);

  // §"klar nach Flug trennen" (Nutzervorgabe): Personen-Reihenfolge bleibt
  // sortForBoardingPassViewer, innerhalb einer Person zusätzlich nach
  // Flugabschnitt sortiert (bekannte Legs in Reihenfolge, unbekannte/Altpässe
  // ohne leg-Feld ans Ende dieser Person statt willkürlich).
  const orderedPersons = sortForBoardingPassViewer([...new Map(rawPasses.map((p) => [p.person.id, p.person])).values()]);
  const passes = orderedPersons.flatMap((person) =>
    rawPasses
      .filter((p) => p.person.id === person.id)
      .sort((a, b) => (a.leg !== null ? legOrder.get(a.leg) ?? 99 : 100) - (b.leg !== null ? legOrder.get(b.leg) ?? 99 : 100))
      .map((p) => ({ ...p, name: person.name })),
  );

  if (passes.length === 0) notFound();

  const withUrl: BoardingPassCarouselItem[] = await Promise.all(
    passes.map(async (p) => {
      const url = await getCachedSignedUrl("documents", p.storage_path);
      const isPdf = p.storage_path.toLowerCase().endsWith(".pdf");
      const legLabel = legLabelFor(p.leg, flightLegOptions);
      const label = legLabel ? `${p.name} · ${legLabel}` : p.name;
      return {
        id: p.id, url, isPdf,
        fileName: `boardingpass-${p.name}${p.leg ? `-${p.leg}` : ""}${isPdf ? ".pdf" : ""}`,
        altText: `Boardingpass ${label}`,
        label,
      };
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

      <BoardingPassCarousel passes={withUrl} referenceDateIso={referenceDateIso} tripId={trip.id} />
    </div>
  );
}
