import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { sortBookingsChronologically } from "@/lib/bookings";
import { sortStagesChronologically } from "@/lib/journey";
import type { StageInput, TimelineBooking, TimelineEvent } from "@/lib/journey";
import { deriveTripDateRange } from "@/lib/trip-dates";
import { isTripHistorical } from "@/lib/trip-status";
import { computeTripReadiness } from "@/lib/readiness";
import { buildJourneyOverview, type MemoryPhotoInput } from "@/lib/journey-events-model";
import { getWeatherForLocation, type DailyForecast } from "@/lib/weather";
import { nearbyStageGeocodeCandidates } from "@/lib/today";
import { todayIsoInFamilyTimezone } from "@/lib/time";
import { getPhotoDisplayUrls } from "@/lib/photo-thumbnails";
import { JourneyBeforeSection } from "@/components/journey/JourneyBeforeSection";
import { JourneyTimeline } from "@/components/journey/JourneyTimeline";
import { JourneyAfterSection } from "@/components/journey/JourneyAfterSection";
import type { BookingType, BookingStatus } from "@/lib/supabase/types";
import type { JourneyEventCategory, JourneyEventStatus } from "@/lib/journey-events";

function addDaysIso(date: string, delta: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

type StageRow = StageInput & { is_transit: boolean };
type BookingRow = TimelineBooking & { created_at: string };
type JourneyEventRow = TimelineEvent;
type PhotoRow = MemoryPhotoInput;

type TripDetail = {
  id: string; slug: string; title: string; status: string
  start_date: string | null; end_date: string | null
  trip_members: Array<{ persons: { id: string; name: string; initials: string; color: string } | null }>
  stages: StageRow[]
  bookings: BookingRow[]
  journey_events: JourneyEventRow[]
}

/**
 * §"Journey 2.0 -- zentrale operative Reiseansicht" (Nutzervorgabe): lädt
 * exakt dieselben Rohdaten wie bisher die Reise-Detailseite (keine neue
 * Abfrage-Logik), reicht sie aber durch `buildJourneyOverview`
 * (lib/journey-events-model.ts) -- die wiederum `buildJourneyTimeline`
 * (lib/journey.ts) unverändert wiederverwendet, keine zweite Timeline-Logik.
 */
export default async function TripJourneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();

  const { data } = await supabase
    .from("trips")
    .select(`
      id, slug, title, status, start_date, end_date,
      trip_members ( persons ( id, name, initials, color ) ),
      stages ( id, title, location, start_date, end_date, nights, accommodation, sort_order, country_code, cover_photo_id, is_transit ),
      bookings ( id, type, title, provider, status, start_datetime, end_datetime, stage_id, details, created_at ),
      journey_events ( id, stage_id, date, time, category, title, location, status )
    `)
    .eq("slug", id)
    .maybeSingle();

  if (!data) notFound();
  const trip = data as unknown as TripDetail;

  const stages = sortStagesChronologically(trip.stages);
  const bookings = sortBookingsChronologically(trip.bookings) as unknown as TimelineBooking[];
  const events = trip.journey_events as unknown as TimelineEvent[];

  const tripDateRange = deriveTripDateRange(trip, bookings as never, stages);
  const todayIso = todayIsoInFamilyTimezone();
  const historical = isTripHistorical({ status: trip.status, start_date: tripDateRange.startDate, end_date: tripDateRange.endDate });

  const { data: photosRaw } = await supabase
    .from("memory_photos")
    .select("id, stage_id, taken_at, created_at, caption, storage_path")
    .eq("trip_id", trip.id)
    .eq("is_selected", true)
    .order("taken_at", { ascending: true });
  const photos: PhotoRow[] = photosRaw ?? [];

  // §"Vor der Reise: nur historische Reisen brauchen keine Checkliste mehr"
  // (gleiche Konvention wie die bestehende Reise-Detailseite).
  const readiness = historical ? null : await computeTripReadiness(trip.id);

  // §"Wetter nur innerhalb des 5-Tage-Fensters" (Nutzerentscheidung): nur für
  // Etappen abgefragt, deren Zeitraum die nächsten 5 Tage berührt -- gleiche
  // Fallback-Kandidaten-Kette wie /today (lib/today.ts::nearbyStageGeocodeCandidates),
  // keine zweite Wetterlogik.
  const windowEnd = addDaysIso(todayIso, 4);
  const relevantStages = stages.filter((s) => s.start_date && s.end_date && s.start_date <= windowEnd && s.end_date >= todayIso);
  const weatherByDate = new Map<string, DailyForecast>();
  await Promise.all(
    relevantStages.map(async (stage) => {
      const label = stage.location || stage.title;
      const candidates = [
        { query: label, countryCode: stage.country_code },
        ...nearbyStageGeocodeCandidates(stages, label, stage.country_code ?? null, todayIso),
      ];
      const result = await getWeatherForLocation(candidates);
      if (!result) return;
      for (const d of result.daily) weatherByDate.set(d.date, d);
    }),
  );

  const overview = buildJourneyOverview({
    trip: { start_date: tripDateRange.startDate, end_date: tripDateRange.endDate },
    slug: trip.slug,
    stages, bookings, events, photos,
    readinessFindings: readiness?.findings ?? [],
    weatherByDate, tripDateRange, todayIso,
  });

  // §"Nach der Reise ohne Wetter-Ausblick": Ausblick ist nur vor Reisebeginn relevant.
  const weatherOutlook = overview.phase === "before" ? [...weatherByDate.values()].sort((a, b) => a.date.localeCompare(b.date)) : [];

  const photoDisplayByPath = await getPhotoDisplayUrls("documents", photos.map((p) => p.storage_path), "thumb400");
  const photoUrlByPhotoId = new Map<string, string>();
  for (const p of photos) {
    const resolved = photoDisplayByPath.get(p.storage_path);
    if (resolved) photoUrlByPhotoId.set(p.id, resolved.url);
  }

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

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Journey
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {trip.title}
        </h1>

        {overview.phase === "before" && (
          <JourneyBeforeSection checklist={overview.beforeChecklist} weatherOutlook={weatherOutlook} />
        )}

        {overview.days.length > 0 ? (
          <section>
            <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "14px" }}>
              {overview.phase === "after" ? "Reiseverlauf (Rückblick)" : "Reiseverlauf"}
            </div>
            <JourneyTimeline days={overview.days} photoUrlByPhotoId={photoUrlByPhotoId} />
          </section>
        ) : (
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Sobald Reisedaten und Etappen feststehen, entsteht hier automatisch eure Reiseerzählung.
            </p>
          </div>
        )}

        {overview.phase === "after" && (
          <JourneyAfterSection memories={overview.afterMemories} photoUrlByPhotoId={photoUrlByPhotoId} />
        )}
      </div>
    </div>
  );
}
