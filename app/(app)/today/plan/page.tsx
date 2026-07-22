import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { isTripCurrentlyRunning, isTripHistorical } from "@/lib/trip-status";
import { deriveTripDateRange } from "@/lib/trip-dates";
import { todayIsoInFamilyTimezone } from "@/lib/time";
import { sortStagesChronologically } from "@/lib/journey";
import type { StageInput, TimelineBooking } from "@/lib/journey";
import { resolveCurrentLocation, resolvePlanningLocation } from "@/lib/today";
import { generateDayPlan, getLatestDayPlan, type DayPlan, type DayPlanVariant } from "@/lib/actions/day-planner";
import { commitDayPlanVariantToJourney } from "@/lib/actions/lumi-journey";
import { Banner } from "@/components/Banner";
import { StopoverPlanningNotice } from "@/components/StopoverPlanningNotice";

type TripRow = {
  id: string; slug: string; title: string; subtitle: string | null; status: string; start_date: string | null; end_date: string | null
  stages: StageInput[]
  bookings: TimelineBooking[]
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

/**
 * §"Tagesplaner 2.0": ersetzt die bisherige heute/morgen/Vormittag/...-
 * Moduswahl (v1) durch ein freies Zieldatum -- Voraussetzung dafür, dass die
 * Journey einen beliebigen freien Reisetag direkt hierher verlinken kann
 * (siehe components/journey/JourneyDayCard.tsx). Zeigt nach der Erzeugung
 * alle drei Varianten (Entspannt/Ausgewogen/Erlebnisreich) nebeneinander --
 * jede mit eigenem "Diesen Plan übernehmen"-Formular, Speicherung erst nach
 * ausdrücklicher Wahl einer Variante.
 */
export default async function DayPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; date?: string; stopover?: string }>;
}) {
  const { error, date: dateParam, stopover } = await searchParams;
  const preferStopover = stopover === "1";
  const supabase = await createClient();
  const { id: familyId } = await getFamily();
  const todayIso = todayIsoInFamilyTimezone();

  const { data: trips } = await supabase
    .from("trips")
    .select(`
      id, slug, title, subtitle, status, start_date, end_date,
      stages ( id, title, location, start_date, end_date, nights, accommodation, sort_order, country_code, is_transit ),
      bookings ( id, type, title, provider, status, start_datetime, end_datetime, stage_id )
    `)
    .eq("family_id", familyId);
  // §"Reisezeitraum automatisch ableiten": ohne manuelles Datum, aber mit
  // Buchungen/Etappen, gilt die Reise trotzdem korrekt als laufend (lib/trip-dates.ts).
  const allTrips = ((trips ?? []) as unknown as TripRow[]).map((t) => {
    const range = deriveTripDateRange(t, t.bookings, t.stages);
    return { ...t, start_date: range.startDate, end_date: range.endDate };
  });
  const activeTrip = allTrips.find((t) => isTripCurrentlyRunning(t, todayIso));
  const nextTrip = !activeTrip
    ? allTrips.filter((t) => t.status !== "archived" && !isTripHistorical(t, todayIso)).sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))[0] ?? null
    : null;
  const trip = activeTrip ?? nextTrip;

  const backLink = (
    <Link href="/today" className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70" style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}>
      <ChevronLeft size={13} strokeWidth={1.5} />
      LUMI
    </Link>
  );

  if (!trip) {
    return (
      <div className="flex-1" style={{ background: "var(--background)" }}>
        <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
          {backLink}
          <Card><p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Sobald eine Reise geplant oder aktiv ist, hilft LUMI euch hier beim Tagesplan.</p></Card>
        </div>
      </div>
    );
  }

  // §"Freies Zieldatum": Vorbelegung aus ?date= (Journey-Link auf einen
  // konkreten freien Tag) oder heute, innerhalb des Reisezeitraums begrenzt.
  const tripStart = trip.start_date ?? todayIso;
  const tripEnd = trip.end_date ?? todayIso;
  const defaultDate = dateParam && dateParam >= tripStart && dateParam <= tripEnd ? dateParam : (todayIso >= tripStart && todayIso <= tripEnd ? todayIso : tripStart);

  // §Bugfix "Tagestrips löschen sich bei Menüpunktwechsel": der zuletzt
  // erzeugte Plan kommt aus day_plan_cache (family_id, trip_id, date) und
  // bleibt bei Navigation bestehen, solange dasselbe Datum gewählt ist.
  const cachedPlan: DayPlan | null = dateParam ? await getLatestDayPlan(familyId, trip.id, defaultDate) : null;
  // §"Zwischenstopp-Planung optional" (Nutzervorgabe): ein mit anderem
  // Umschalter-Stand erzeugter Plan passt nicht zum aktuell gewählten Ziel --
  // dann lieber "noch kein Plan" statt einen aus dem falschen Kontext zeigen.
  const plan = cachedPlan && cachedPlan.preferStopover === preferStopover ? cachedPlan : null;

  // §Der Zwischenstopp-Umschalter/-Hinweis gilt nur für die laufende Reise
  // (siehe lib/today.ts::resolvePlanningLocation) -- bei einer bevorstehenden
  // Reise wählt resolveTripAiContext ohnehin immer die Etappe mit den meisten
  // Nächten, unabhängig vom Umschalter.
  const sortedStages = sortStagesChronologically(trip.stages);
  const currentLocation = trip === activeTrip ? resolveCurrentLocation(trip, sortedStages, trip.bookings, todayIso) : null;
  const unforcedPlanningLocation = currentLocation ? resolvePlanningLocation(currentLocation, sortedStages, todayIso, false) : null;
  const stopoverOverrideAvailable = unforcedPlanningLocation?.isPlanningAheadOfStopover ?? false;
  const stopoverToggleParams = new URLSearchParams();
  if (dateParam) stopoverToggleParams.set("date", dateParam);
  if (!preferStopover) stopoverToggleParams.set("stopover", "1");
  const stopoverToggleHref = `/today/plan${stopoverToggleParams.toString() ? `?${stopoverToggleParams.toString()}` : ""}`;
  const stopoverBannerStopoverLabel = currentLocation?.label ?? "";
  const stopoverBannerDestinationLabel = unforcedPlanningLocation?.location.label ?? "";

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">
        {backLink}
        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Tagesplanung
        </div>

        {error && <Banner variant="error">{error}</Banner>}

        {stopoverOverrideAvailable && (
          <StopoverPlanningNotice
            destinationLabel={stopoverBannerDestinationLabel}
            stopoverLabel={stopoverBannerStopoverLabel}
            preferStopover={preferStopover}
            toggleHref={stopoverToggleHref}
          />
        )}

        <Card>
          <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
            LUMI baut euch drei Tagespläne (Entspannt/Ausgewogen/Erlebnisreich) aus Sehenswürdigkeiten, Natur, Stränden und Restaurants -- mit echten Fahrzeiten und rund um bereits feststehende Termine, nur auf Klick.
          </p>
          <form action={generateDayPlan} className="flex items-end gap-2 flex-wrap">
            <input type="hidden" name="family_id" value={familyId} />
            <input type="hidden" name="trip_id" value={trip.id} />
            <input type="hidden" name="return_to" value="/today/plan" />
            <input type="hidden" name="prefer_stopover" value={preferStopover ? "1" : ""} />
            <div className="flex flex-col gap-1">
              <label style={{ color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "0.06em" }}>Für welchen Tag?</label>
              <input
                type="date" name="date" defaultValue={defaultDate} min={tripStart} max={tripEnd} required
                style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px 12px", fontSize: "0.8rem", minHeight: "44px" }}
              />
            </div>
            <button
              type="submit"
              style={{
                background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px",
                padding: "12px 20px", fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", minHeight: "44px",
              }}
            >
              Tagesplan erzeugen
            </button>
          </form>
        </Card>

        {plan && plan.freeWindowNote && (
          <div className="mt-5">
            <Card><p style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>{plan.freeWindowNote}</p></Card>
          </div>
        )}

        {plan && plan.variants.length > 0 && (
          <div className="flex flex-col gap-5 mt-5">
            {plan.variants.map((variant) => (
              <VariantCard key={variant.pace} variant={variant} tripId={trip.id} tripSlug={trip.slug} date={plan.date} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VariantCard({ variant, tripId, tripSlug, date }: { variant: DayPlanVariant; tripId: string; tripSlug: string; date: string }) {
  return (
    <div>
      <h2 className="font-light mb-1" style={{ color: "var(--foreground)", fontSize: "1.15rem", letterSpacing: "-0.01em" }}>
        {variant.title}
      </h2>
      <p className="mb-3" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
        Gesamtfahrzeit ca. {variant.totalTravelMinutes} Min · {variant.totalTravelDistanceKm} km
      </p>

      <div className="space-y-2.5 mb-3">
        {variant.stops.map((stop, i) => (
          <Card key={stop.placeId}>
            <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
              <div style={{ color: "var(--foreground)", fontSize: "0.9rem" }}>
                {i + 1}. {stop.name}
                {stop.time && <span style={{ color: "var(--accent)", fontSize: "0.72rem", marginLeft: "8px" }}>{stop.time}</span>}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{stop.travelMinutes} Min · {stop.travelDistanceKm} km</div>
            </div>
            <div className="mb-2" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
              ca. {stop.stopDurationMinutes} Min vor Ort
            </div>
            {stop.why && <p style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>{stop.why}</p>}
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-1.5" style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
          {variant.weatherNote && <div>☀ {variant.weatherNote}</div>}
          {variant.kidsNote && <div>👨‍👩‍👧‍👦 {variant.kidsNote}</div>}
          {variant.mealBreakNote && <div>🍽 {variant.mealBreakNote}</div>}
          <div>🕐 {variant.returnNote}</div>
        </div>
      </Card>

      <form action={commitDayPlanVariantToJourney} className="mt-3">
        <input type="hidden" name="trip_id" value={tripId} />
        <input type="hidden" name="trip_slug" value={tripSlug} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="variant" value={JSON.stringify(variant)} />
        <button
          type="submit"
          style={{
            background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px",
            padding: "10px 20px", fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", minHeight: "44px",
          }}
        >
          Diesen Plan übernehmen
        </button>
      </form>
    </div>
  );
}
