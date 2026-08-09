import Link from "next/link";
import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { LUMI_CORE_DOCUMENTS_BUCKET } from "@/lib/lumi-core-storage/paths";
import { sortForBoardingPassViewer } from "@/lib/boarding-passes";
import { OfflineDocumentViewer } from "@/components/OfflineDocumentViewer";
import { getCachedSignedUrl } from "@/lib/signed-storage-url";
import { listHouseholdMembers } from "@/lib/household-members";

/** §"Gepäckbelege bekommen einen echten Viewer" (Frag-LUMI-Offline-Sprint): 1:1 nach Vorbild von boarding-passes/page.tsx -- gleiches Layout, gleiche Offline-Anbindung, `policy="standard"` (Default), keine Änderung an der bestehenden 7-Tage-Logik. */
export default async function BaggageTagViewerPage({
  params,
}: {
  params: Promise<{ id: string; bookingId: string }>;
}) {
  const { id, bookingId } = await params;

  const lumiCore = await createLumiCoreClient();
  const { data: trip } = await lumiCore
    .from("travel_trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: booking } = await lumiCore
    .from("travel_bookings")
    .select("id, title, type, start_datetime, end_datetime")
    .eq("id", bookingId)
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (!booking || booking.type !== "flight") notFound();
  const referenceDateIso = booking.end_datetime ?? booking.start_datetime ?? new Date().toISOString();

  // §Lumi-Core-Cutover: keine PostgREST-Embeddings -- Dokumente flach
  // abfragen, Personen-Name per listHouseholdMembers()-Map nachschlagen.
  const { data: docsRaw } = await lumiCore
    .from("travel_documents")
    .select("id, label, storage_path, household_member_id")
    .eq("booking_id", bookingId)
    .eq("doc_type", "baggage_tag");

  const allHouseholdMembers = await listHouseholdMembers();
  const householdMemberById = new Map(allHouseholdMembers.map((m) => [m.id, m]));

  const tags = sortForBoardingPassViewer(
    (docsRaw ?? []).flatMap((d) => {
      const person = d.household_member_id ? householdMemberById.get(d.household_member_id) : undefined;
      if (!person) return [];
      return [{ id: d.id, label: d.label ?? "Gepäckbeleg", storage_path: d.storage_path ?? "", name: person.name }];
    })
  );

  if (tags.length === 0) notFound();

  const withUrl = await Promise.all(
    tags.map(async (t) => {
      const url = await getCachedSignedUrl(LUMI_CORE_DOCUMENTS_BUCKET, t.storage_path);
      const isPdf = t.storage_path.toLowerCase().endsWith(".pdf");
      return { ...t, url, isPdf };
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

      {withUrl.map((tag, index) => (
        <section
          key={tag.id}
          className="flex flex-col items-center justify-center px-6"
          style={{ minHeight: "100vh", borderBottom: index < withUrl.length - 1 ? "1px solid rgba(255,255,255,0.12)" : "none" }}
        >
          <div
            style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.72rem", letterSpacing: "0.1em", marginBottom: "16px", textTransform: "uppercase" }}
          >
            {index + 1} von {withUrl.length} · {tag.name} · {tag.label}
          </div>

          <OfflineDocumentViewer
            documentId={tag.id}
            sourceUrl={tag.url}
            fileName={`gepaeckbeleg-${tag.name}${tag.isPdf ? ".pdf" : ""}`}
            mimeType={tag.isPdf ? "application/pdf" : "image/jpeg"}
            isPdf={tag.isPdf}
            referenceDateIso={referenceDateIso}
            altText={`Gepäckbeleg ${tag.name} · ${tag.label}`}
            tripId={trip.id}
            docType="baggage_tag"
            label={`${tag.name} · ${tag.label}`}
          />
        </section>
      ))}
    </div>
  );
}
