import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { BOOKING_CATEGORIES, sortBookingsChronologically } from "@/lib/bookings";
import type { BookingCategory } from "@/lib/bookings";
import type { BookingType, BookingStatus } from "@/lib/supabase/types";
import { BookingRowItem } from "../../BookingRowItem";
import { JourneyEventRowItem, type JourneyEventRowData } from "@/app/(app)/trips/[id]/journey-events/JourneyEventRowItem";

type BookingWithStage = {
  id: string;
  type: BookingType;
  title: string;
  provider: string | null;
  status: BookingStatus;
  amount: number | null;
  currency: string;
  start_datetime: string | null;
  created_at: string;
  stages: { title: string } | null;
};

export default async function BookingCategoryPage({
  params,
}: {
  params: Promise<{ id: string; category: string }>;
}) {
  const { id, category } = await params;
  const categoryConfig = BOOKING_CATEGORIES[category as BookingCategory];
  if (!categoryConfig) notFound();

  const lumiCore = await createLumiCoreClient();
  const { data: trip } = await lumiCore
    .from("travel_trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  // §Lumi-Core-Cutover: kein PostgREST-Embedding für stages(title) verfügbar
  // -- flache Buchungsabfrage + separate Etappen-Abfrage, per Map(stage_id ->
  // title) reassembliert, statt der früheren verschachtelten Selektion.
  const { data: bookingsRaw } = await lumiCore
    .from("travel_bookings")
    .select("id, type, title, provider, status, amount, currency, start_datetime, created_at, stage_id")
    .eq("trip_id", trip.id)
    .in("type", categoryConfig.types);

  const stageIds = Array.from(new Set((bookingsRaw ?? []).map((b) => b.stage_id).filter((v): v is string => Boolean(v))));
  const { data: stagesRaw } = stageIds.length > 0
    ? await lumiCore.from("travel_stages").select("id, title").in("id", stageIds)
    : { data: [] as { id: string; title: string }[] };
  const stageTitleById = new Map((stagesRaw ?? []).map((s) => [s.id, s.title]));

  const data: BookingWithStage[] = (bookingsRaw ?? []).map((b) => ({
    id: b.id, type: b.type as BookingWithStage["type"], title: b.title, provider: b.provider,
    status: b.status as BookingWithStage["status"], amount: b.amount, currency: b.currency ?? "EUR",
    start_datetime: b.start_datetime, created_at: b.created_at,
    stages: b.stage_id && stageTitleById.has(b.stage_id) ? { title: stageTitleById.get(b.stage_id)! } : null,
  }));

  const bookings = sortBookingsChronologically(data);

  // §"Journal-Einträge zusätzlich in der Aktivitäten-Liste zeigen, klar
  // markiert -- Flüge/Unterkünfte/Etappen bleiben davon unberührt"
  // (Nutzervorgabe, wörtlich): nur für die "Aktivitäten"-Kategorie, da nur
  // journey_events.category die Werte 'activity'/'restaurant' überhaupt
  // kennt (dieselben String-Werte wie BOOKING_CATEGORIES.activity.types).
  let journeyEvents: JourneyEventRowData[] = [];
  if (categoryConfig.value === "activity") {
    const { data: journeyEventsRaw } = await lumiCore
      .from("travel_journey_events")
      .select("id, date, time, category, title, location, status")
      .eq("trip_id", trip.id)
      .in("category", categoryConfig.types);
    journeyEvents = (journeyEventsRaw ?? []) as unknown as JourneyEventRowData[];
  }

  type CombinedRow =
    | { kind: "booking"; sortKey: string; booking: BookingWithStage }
    | { kind: "journey_event"; sortKey: string; event: JourneyEventRowData };

  const combinedRows: CombinedRow[] = [
    ...bookings.map((booking): CombinedRow => ({ kind: "booking", sortKey: booking.start_datetime ?? booking.created_at, booking })),
    ...journeyEvents.map((event): CombinedRow => ({ kind: "journey_event", sortKey: `${event.date}T${event.time ?? "00:00"}`, event })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const addHref = categoryConfig.pickerTypes.length === 1
    ? `/trips/${trip.slug}/bookings/new?type=${categoryConfig.pickerTypes[0]}&category=${categoryConfig.value}`
    : `/trips/${trip.slug}/bookings/new?category=${categoryConfig.value}`;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/trips/${trip.slug}`}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {trip.title}
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "8px" }}>
              {trip.title}
            </div>
            <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.5rem", letterSpacing: "0.01em" }}>
              {categoryConfig.label}
            </h1>
          </div>
          <Link href={addHref} className="btn-neue-reise" style={{ flexShrink: 0 }}>
            + {categoryConfig.addLabel}
          </Link>
        </div>

        {combinedRows.length > 0 ? (
          <div className="space-y-2">
            {combinedRows.map((row) => (
              row.kind === "booking" ? (
                <BookingRowItem
                  key={`booking-${row.booking.id}`}
                  booking={row.booking}
                  slug={trip.slug}
                  stageTitle={row.booking.stages?.title ?? null}
                />
              ) : (
                <JourneyEventRowItem key={`journey-event-${row.event.id}`} event={row.event} slug={trip.slug} />
              )
            ))}
          </div>
        ) : (
          <div
            className="rounded-xl p-6 text-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              {categoryConfig.emptyDetail}
            </p>
            <Link
              href={addHref}
              style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.08em", textDecoration: "none" }}
            >
              {categoryConfig.addLabel} →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
