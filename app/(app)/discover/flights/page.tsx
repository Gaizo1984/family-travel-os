import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { searchFlightsStandalone } from "@/lib/actions/flight-search";
import { getFlightProviderName } from "@/lib/providers/flights-provider";
import { FlightScoringService } from "@/lib/flight-scoring-service";
import { FlightSearchForm, type SearchMode } from "@/components/FlightSearchForm";
import { FlightFilterBar } from "@/components/FlightFilterBar";
import { FlightDateComparisonTable, type FlightDateComparisonRow } from "@/components/FlightDateComparisonTable";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";
import { Banner } from "@/components/Banner";
import { isoToday, isBeforeIso } from "@/lib/date-utils";
import { countFlexibleDateCombinations } from "@/lib/flight-date-combinations";
import type { FlightSearchOption } from "@/lib/flight-types";
import type { FlightDateContext } from "@/components/FlightCard";

// §"Duffel-Suchen können mehrere Sekunden bis über eine Minute dauern"
// (insbesondere die flexible Suche mit mehreren Kombinationen): höher als
// die Plattform-Standardlaufzeit, damit eine langsame, aber erfolgreiche
// Suche nicht durch ein Funktions-Timeout abgewürgt wird.
export const maxDuration = 90;

function nightsBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
}

export default async function DiscoverFlightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    destination?: string; departure_city?: string; departure_date?: string; return_date?: string
    traveler_ids?: string; idea_id?: string; search_key?: string; search_keys?: string
    mode?: string; window_start_date?: string; window_end_date?: string
    nights_min?: string; nights_max?: string; batch?: string; error?: string
  }>;
}) {
  const sp = await searchParams;
  const mode: SearchMode = sp.mode === "flexible" ? "flexible" : "fixed";

  const supabase = await createClient();
  const { id: familyId } = await getFamily();
  const { data: persons } = await supabase
    .from("persons")
    .select("id, name, initials, color, birth_date, is_minor")
    .order("name");

  // §"Bei ungültigen vorausgefüllten Altdaten Werte leeren": ein Deep-Link
  // (z. B. von einer älteren Ideen-Seite) kann ein inzwischen vergangenes
  // Datum mitbringen -- das darf nie stillschweigend als gültige Vorauswahl
  // erscheinen.
  const today = isoToday();
  let departureIsoDefault = sp.departure_date ?? null;
  let returnIsoDefault = sp.return_date ?? null;
  let staleDateBanner: string | null = null;
  if (departureIsoDefault && isBeforeIso(departureIsoDefault, today)) {
    departureIsoDefault = null;
    returnIsoDefault = null;
    staleDateBanner = "Das vorausgefüllte Hinflugdatum lag in der Vergangenheit und wurde entfernt -- bitte neu wählen.";
  } else if (returnIsoDefault && departureIsoDefault && isBeforeIso(returnIsoDefault, departureIsoDefault)) {
    returnIsoDefault = null;
    staleDateBanner = "Das vorausgefüllte Rückflugdatum lag vor dem Hinflug und wurde entfernt -- bitte neu wählen.";
  }

  const defaultTravelerIds = sp.traveler_ids ? sp.traveler_ids.split(",").filter(Boolean) : [];

  let flightResult: { options: FlightSearchOption[]; isSandboxData: boolean; searchedAt: string } | null = null;
  let dateContextByOptionId: Record<string, FlightDateContext> | undefined;
  const comparisonRows: FlightDateComparisonRow[] = [];

  if (mode === "flexible" && sp.search_keys) {
    const keys = sp.search_keys.split(",").filter(Boolean);
    const { data: cachedRows } = await supabase
      .from("flight_search_cache")
      .select("search_key, results, is_sandbox_data, updated_at, departure_date, return_date")
      .eq("family_id", familyId)
      .in("search_key", keys);

    const rows = cachedRows ?? [];
    const allOptions: FlightSearchOption[] = [];
    dateContextByOptionId = {};
    let latestUpdatedAt = "";
    let anySandbox = false;

    for (const row of rows) {
      const options = (row.results as unknown as FlightSearchOption[]) ?? [];
      if (options.length === 0) continue;
      const nights = row.return_date ? nightsBetween(row.departure_date, row.return_date) : null;
      const dateContext: FlightDateContext = { departureDate: row.departure_date, returnDate: row.return_date, nights };
      for (const o of options) {
        allOptions.push(o);
        dateContextByOptionId[o.id] = dateContext;
      }
      const minPrice = Math.min(...options.map((o) => o.price));
      comparisonRows.push({ departureDate: row.departure_date, returnDate: row.return_date, nights, minPrice, currency: options[0].currency });
      if (row.is_sandbox_data) anySandbox = true;
      if (row.updated_at > latestUpdatedAt) latestUpdatedAt = row.updated_at;
    }

    if (allOptions.length > 0) {
      const withBadges = FlightScoringService.computeBadges(allOptions);
      const sorted = FlightScoringService.sortByDefault(withBadges);
      flightResult = { options: sorted, isSandboxData: anySandbox, searchedAt: latestUpdatedAt };
    }
  } else if (sp.search_key) {
    const { data: cached } = await supabase
      .from("flight_search_cache")
      .select("results, is_sandbox_data, updated_at")
      .eq("family_id", familyId)
      .eq("search_key", sp.search_key)
      .maybeSingle();
    flightResult = cached
      ? { options: cached.results as unknown as FlightSearchOption[], isSandboxData: cached.is_sandbox_data, searchedAt: cached.updated_at }
      : null;
  }

  const { total: combosTotal, capped: combosCapped } = mode === "flexible" && sp.window_start_date && sp.window_end_date
    ? countFlexibleDateCombinations(sp.window_start_date, sp.window_end_date, Number(sp.nights_min) || 0, Number(sp.nights_max) || 0)
    : { total: 0, capped: 0 };
  const canSearchMore = mode === "flexible" && combosTotal > combosCapped && sp.search_keys;
  const currentBatch = Number(sp.batch ?? "0") || 0;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/discover"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Entdecken
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Flugvergleich
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Beste Flüge finden
        </h1>

        {staleDateBanner && <Banner variant="error">{staleDateBanner}</Banner>}
        {sp.error && <Banner variant="error">{sp.error}</Banner>}

        <div className="rounded-xl p-6 md:p-8 mb-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <FlightSearchForm
            persons={persons ?? []}
            action={searchFlightsStandalone}
            defaultDestination={sp.destination}
            defaultDepartureCity={sp.departure_city}
            defaultDepartureIso={departureIsoDefault}
            defaultReturnIso={returnIsoDefault}
            defaultTravelerIds={defaultTravelerIds}
            ideaId={sp.idea_id}
            defaultMode={mode}
            defaultWindowStartIso={sp.window_start_date}
            defaultWindowEndIso={sp.window_end_date}
            defaultNightsMin={sp.nights_min}
            defaultNightsMax={sp.nights_max}
          />
        </div>

        {mode === "flexible" && comparisonRows.length > 0 && (
          <>
            <p className="mb-3" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
              {comparisonRows.length} von {combosTotal || comparisonRows.length} möglichen Datumsvarianten geprüft.
            </p>
            <FlightDateComparisonTable rows={comparisonRows} />
          </>
        )}

        {flightResult && (
          <FlightFilterBar
            options={flightResult.options}
            isSandboxData={flightResult.isSandboxData}
            providerName={getFlightProviderName()}
            searchedAt={flightResult.searchedAt}
            dateContextByOptionId={dateContextByOptionId}
          />
        )}

        {canSearchMore && (
          <form action={searchFlightsStandalone} className="mt-6">
            <input type="hidden" name="destination" value={sp.destination ?? ""} />
            <input type="hidden" name="departure_city" value={sp.departure_city ?? ""} />
            <input type="hidden" name="search_mode" value="flexible" />
            <input type="hidden" name="window_start_date_day" value={sp.window_start_date?.slice(8, 10) ?? ""} />
            <input type="hidden" name="window_start_date_month" value={sp.window_start_date?.slice(5, 7) ?? ""} />
            <input type="hidden" name="window_start_date_year" value={sp.window_start_date?.slice(0, 4) ?? ""} />
            <input type="hidden" name="window_end_date_day" value={sp.window_end_date?.slice(8, 10) ?? ""} />
            <input type="hidden" name="window_end_date_month" value={sp.window_end_date?.slice(5, 7) ?? ""} />
            <input type="hidden" name="window_end_date_year" value={sp.window_end_date?.slice(0, 4) ?? ""} />
            <input type="hidden" name="nights_min" value={sp.nights_min ?? ""} />
            <input type="hidden" name="nights_max" value={sp.nights_max ?? ""} />
            <input type="hidden" name="batch" value={String(currentBatch + 1)} />
            <input type="hidden" name="existing_search_keys" value={sp.search_keys ?? ""} />
            {defaultTravelerIds.map((id) => <input key={id} type="hidden" name="traveler_ids" value={id} />)}
            {sp.idea_id && <input type="hidden" name="idea_id" value={sp.idea_id} />}
            <SubmitButtonWithProgress label="Weitere Datumsvarianten prüfen" pendingLabel="Wird geprüft …" />
          </form>
        )}
      </div>
    </div>
  );
}
