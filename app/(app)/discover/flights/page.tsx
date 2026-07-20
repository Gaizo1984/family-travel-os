import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { searchFlightsStandalone } from "@/lib/actions/flight-search";
import {
  saveFlightOption, deleteSavedFlightOption, assignTripToSavedFlightOption,
  markSavedFlightOptionSelected, unmarkSavedFlightOptionSelected, refreshSavedFlightOption,
} from "@/lib/actions/saved-flights";
import { buildRouteKey, MAX_SAVED_FLIGHTS_PER_ROUTE, buildFlightAdoptionUrl } from "@/lib/saved-flights-shared";
import { listTripsForPicker } from "@/lib/lumi-trip-picker";
import { SavedOptionStatusRow } from "@/components/SavedOptionStatusRow";
import { getFlightProviderName } from "@/lib/providers/flights-provider";
import { FlightScoringService } from "@/lib/flight-scoring-service";
import { FlightSearchForm, type SearchMode } from "@/components/FlightSearchForm";
import { FlightFilterBar } from "@/components/FlightFilterBar";
import { FlightCard } from "@/components/FlightCard";
import { FlightDateComparisonTable, type FlightDateComparisonRow } from "@/components/FlightDateComparisonTable";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";
import { Banner } from "@/components/Banner";
import { isoToday, isBeforeIso } from "@/lib/date-utils";
import { countFlexibleDateCombinations } from "@/lib/flight-date-combinations";
import type { FlightSearchOption } from "@/lib/flight-types";
import type { FlightDateContext } from "@/components/FlightCard";

// §"Duffel-Suchen können mehrere Sekunden bis über eine Minute dauern"
// (insbesondere die flexible Suche: mehrere Datumskombinationen à bis zu 60s
// Rundflug-Timeout, in Vierer-Blöcken): deutlich höher als die Plattform-
// Standardlaufzeit, damit eine langsame, aber erfolgreiche Suche nicht durch
// ein Funktions-Timeout abgewürgt wird.
export const maxDuration = 280;

function nightsBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
}

/** Rekonstruiert die aktuelle Such-URL (ohne `error`) -- Rücksprungziel für Merken-/Löschen-Formulare, damit nach dem Absenden exakt dieselbe Ansicht wieder erscheint. */
function buildCurrentFlightsUrl(sp: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value && key !== "error") usp.set(key, value);
  }
  const qs = usp.toString();
  return qs ? `/discover/flights?${qs}` : "/discover/flights";
}

/**
 * §Bugfix "Kein falscher Buchungslink, stattdessen ehrliche Neusuche"
 * (Nutzervorgabe, wörtlich): "Treffer öffnen" nur, solange die Cache-Zeile
 * noch existiert UND das Angebot noch nicht abgelaufen ist (Duffel,
 * ~15-30 Min.) -- sonst "Verbindung neu suchen" statt eines stillen/falschen
 * Links. Kein externer/erfundener Link, ausschließlich diese beiden
 * Zustände.
 */
function TrefferOrRefreshAction({
  savedOptionId, searchKey, isFresh, returnTo,
}: {
  savedOptionId: string
  searchKey: string | null
  isFresh: boolean
  returnTo: string
}) {
  if (isFresh && searchKey) {
    return (
      <Link
        href={`/discover/flights?search_key=${encodeURIComponent(searchKey)}`}
        className="block mt-2"
        style={{ color: "var(--accent)", fontSize: "0.68rem", textDecoration: "none" }}
      >
        Treffer öffnen →
      </Link>
    );
  }
  return (
    <form action={refreshSavedFlightOption} className="mt-2">
      <input type="hidden" name="id" value={savedOptionId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button
        type="submit"
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: "0.68rem", padding: 0 }}
      >
        Verbindung neu suchen
      </button>
    </form>
  );
}

export default async function DiscoverFlightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    destination?: string; departure_city?: string; departure_date?: string; return_date?: string
    traveler_ids?: string; idea_id?: string; search_key?: string; search_keys?: string
    mode?: string; window_start_date?: string; window_end_date?: string
    nights_min?: string; nights_max?: string; batch?: string; error?: string
    expired_option?: string
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
  const searchKeyByOptionId: Record<string, string> = {};
  const comparisonRows: FlightDateComparisonRow[] = [];
  let currentRouteKey: string | null = null;

  if (mode === "flexible" && sp.search_keys) {
    const keys = sp.search_keys.split(",").filter(Boolean);
    const { data: cachedRows } = await supabase
      .from("flight_search_cache")
      .select("search_key, results, is_sandbox_data, updated_at, departure_date, return_date, origin_codes, destination_code")
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
        searchKeyByOptionId[o.id] = row.search_key;
      }
      const minPrice = Math.min(...options.map((o) => o.price));
      comparisonRows.push({ departureDate: row.departure_date, returnDate: row.return_date, nights, minPrice, currency: options[0].currency });
      if (row.is_sandbox_data) anySandbox = true;
      if (row.updated_at > latestUpdatedAt) latestUpdatedAt = row.updated_at;
      if (!currentRouteKey) currentRouteKey = buildRouteKey(row.origin_codes, row.destination_code);
    }

    if (allOptions.length > 0) {
      const withBadges = FlightScoringService.computeBadges(allOptions);
      const sorted = FlightScoringService.sortByDefault(withBadges);
      flightResult = { options: sorted, isSandboxData: anySandbox, searchedAt: latestUpdatedAt };
    }
  } else if (sp.search_key) {
    const { data: cached } = await supabase
      .from("flight_search_cache")
      .select("results, is_sandbox_data, updated_at, origin_codes, destination_code")
      .eq("family_id", familyId)
      .eq("search_key", sp.search_key)
      .maybeSingle();
    flightResult = cached
      ? { options: cached.results as unknown as FlightSearchOption[], isSandboxData: cached.is_sandbox_data, searchedAt: cached.updated_at }
      : null;
    if (cached) {
      currentRouteKey = buildRouteKey(cached.origin_codes, cached.destination_code);
      for (const o of flightResult!.options) searchKeyByOptionId[o.id] = sp.search_key;
    }
  }

  // §Bugfix "Stiller Leerzustand bei abgelaufenem/fehlendem Cache"
  // (Nutzervorgabe): bislang zeigte ein toter/gelöschter search_key
  // kommentarlos gar nichts an. `expired_option` hat sein eigenes,
  // spezifischeres Banner (siehe unten) -- dieses hier greift nur, wenn ein
  // Cache-Lookup versucht wurde, aber ohne diesen Kontext leer blieb (z. B.
  // ein alter Link/Lesezeichen).
  const cacheLookupAttempted = Boolean(sp.search_key) || (mode === "flexible" && Boolean(sp.search_keys));
  const missingCacheBanner = cacheLookupAttempted && !flightResult && !sp.expired_option
    ? "Dieser gespeicherte Treffer ist nicht mehr verfügbar -- bitte über \"Verbindung neu suchen\" bei einer gemerkten Verbindung aktualisieren, oder eine neue Suche starten."
    : null;

  // §"Gemerkte Flüge sichtbar machen" (Nutzervorgabe, kombinierter Fix-Sprint):
  // vorher nur sichtbar, wenn gerade eine Suche für exakt diese Strecke lief
  // (currentRouteKey) -- jetzt immer alle gemerkten Verbindungen der Familie,
  // über alle Strecken hinweg, unabhängig vom aktuellen Suchzustand.
  const { data: allSavedRows } = await supabase
    .from("saved_flight_options")
    .select("id, route_key, option_id, flight_option, found_departure_date, found_return_date, created_at, search_key, status, trip_id, booking_id")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });
  const allSavedFlightsRaw = allSavedRows ?? [];
  // §Phase B "gebuchte Einträge nicht zusätzlich als bloß gemerkt anzeigen"
  // (Nutzervorgabe): eigener Abschnitt statt Mischung mit den aktiven
  // Gemerkt-/Ausgewählt-Listen.
  const allSavedFlights = allSavedFlightsRaw.filter((s) => s.status !== "booked");
  const bookedFlights = allSavedFlightsRaw.filter((s) => s.status === "booked");
  const savedFlights = currentRouteKey ? allSavedFlights.filter((s) => s.route_key === currentRouteKey) : [];

  // §Phase B "Reise zuordnen" (Nutzervorgabe): dieselbe zentrale, sortierte
  // Reiseliste wie Frag LUMI (lib/lumi-trip-picker.ts) -- keine zweite
  // Reise-Query/-Sortierung.
  const pickerTrips = await listTripsForPicker(familyId);
  const tripById = new Map(pickerTrips.map((t) => [t.id, t]));

  // §Bugfix "Kein falscher Buchungslink, stattdessen ehrliche Neusuche"
  // (Nutzervorgabe): "gültiger Cache" heißt sowohl "flight_search_cache-Zeile
  // existiert noch" ALS AUCH "das Angebot selbst ist noch nicht abgelaufen"
  // (Duffel `expires_at`, ~15-30 Min., bereits vorhandene Prüfung
  // FlightScoringService.isExpired -- bisher nur kosmetisch genutzt in
  // FlightCard, jetzt zusätzlich für die Treffer-öffnen/Neu-suchen-Weiche).
  // Eine Batch-Abfrage statt N+1 Einzel-Lookups pro gemerktem Flug.
  const savedSearchKeys = [...new Set(allSavedFlights.map((s) => s.search_key).filter((k): k is string => Boolean(k)))];
  const { data: cacheExistRows } = savedSearchKeys.length > 0
    ? await supabase.from("flight_search_cache").select("search_key").eq("family_id", familyId).in("search_key", savedSearchKeys)
    : { data: [] as { search_key: string }[] };
  const cacheKeysPresent = new Set((cacheExistRows ?? []).map((r) => r.search_key));

  function isSavedFlightFresh(s: { search_key: string | null; flight_option: unknown }): boolean {
    if (!s.search_key || !cacheKeysPresent.has(s.search_key)) return false;
    return !FlightScoringService.isExpired(s.flight_option as unknown as FlightSearchOption);
  }

  // §Nutzer-Nachbesserung "ursprüngliche Verbindung hervorheben": nach einer
  // Neusuche (refreshSavedFlightOption) versucht, dieselbe Verbindung unter
  // den frischen Ergebnissen wiederzufinden. Duffel-Angebots-IDs sind pro
  // Suche neu -- Abgleich stattdessen über Carrier+Flugnummer+Abflugtag des
  // ersten Hinflug-Segments (robust, ohne Fuzzy-Logik).
  let expiredOptionBanner: string | null = null;
  let highlightOptionId: string | undefined;
  if (sp.expired_option) {
    const expiredRow = allSavedFlightsRaw.find((s) => s.id === sp.expired_option);
    if (expiredRow) {
      const originalOption = expiredRow.flight_option as unknown as FlightSearchOption;
      expiredOptionBanner = `Das ursprüngliche Angebot ist nicht mehr aktuell -- hier die aktuellen Ergebnisse für dieselbe Suche. Preis beim Merken: ${originalOption.price} ${originalOption.currency}.`;
      const origFirstSeg = originalOption.outbound.segments[0];
      if (flightResult && origFirstSeg) {
        const match = flightResult.options.find((o) => {
          const seg = o.outbound.segments[0];
          return seg && seg.carrierCode === origFirstSeg.carrierCode && seg.flightNumber === origFirstSeg.flightNumber
            && seg.departureTime.slice(0, 10) === origFirstSeg.departureTime.slice(0, 10);
        });
        if (match) highlightOptionId = match.id;
      }
    }
  }

  const { total: combosTotal, capped: combosCapped } = mode === "flexible" && sp.window_start_date && sp.window_end_date
    ? countFlexibleDateCombinations(sp.window_start_date, sp.window_end_date, Number(sp.nights_min) || 0, Number(sp.nights_max) || 0)
    : { total: 0, capped: 0 };
  const canSearchMore = mode === "flexible" && combosTotal > combosCapped && sp.search_keys;
  const currentBatch = Number(sp.batch ?? "0") || 0;
  const returnTo = buildCurrentFlightsUrl(sp);
  const savedOptionIds = savedFlights.map((s) => s.option_id);

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/today"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          LUMI
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Flugvergleich
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Beste Flüge finden
        </h1>

        {staleDateBanner && <Banner variant="error">{staleDateBanner}</Banner>}
        {sp.error && <Banner variant="error">{sp.error}</Banner>}
        {missingCacheBanner && <Banner variant="error">{missingCacheBanner}</Banner>}
        {expiredOptionBanner && <Banner variant="error">{expiredOptionBanner}</Banner>}

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

        {(() => {
          const otherRoutes = allSavedFlights.filter((s) => s.route_key !== currentRouteKey);
          if (otherRoutes.length === 0) return null;
          const grouped = new Map<string, typeof otherRoutes>();
          for (const s of otherRoutes) grouped.set(s.route_key, [...(grouped.get(s.route_key) ?? []), s]);
          return (
            <section className="mb-8">
              <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>
                Gemerkte Flüge
              </div>
              <div className="space-y-6">
                {[...grouped.entries()].map(([routeKey, items]) => {
                  const first = items[0].flight_option as unknown as FlightSearchOption;
                  const routeLabel = `${first.outbound.segments[0]?.departureAirport ?? "?"} → ${first.outbound.segments[first.outbound.segments.length - 1]?.arrivalAirport ?? "?"}`;
                  return (
                    <div key={routeKey}>
                      <div className="mb-2" style={{ color: "var(--foreground)", fontSize: "0.76rem" }}>
                        {routeLabel} <span style={{ color: "var(--muted)" }}>({items.length}/{MAX_SAVED_FLIGHTS_PER_ROUTE})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {items.map((s) => {
                          const option = s.flight_option as unknown as FlightSearchOption;
                          const nights = s.found_return_date ? nightsBetween(s.found_departure_date, s.found_return_date) : null;
                          return (
                            <div key={s.id} className="relative">
                              <FlightCard
                                option={option}
                                searchedAt={s.created_at}
                                dateContext={{ departureDate: s.found_departure_date, returnDate: s.found_return_date, nights }}
                              />
                              <TrefferOrRefreshAction
                                savedOptionId={s.id} searchKey={s.search_key} isFresh={isSavedFlightFresh(s)} returnTo={returnTo}
                              />
                              <SavedOptionStatusRow
                                id={s.id}
                                status={s.status}
                                tripId={s.trip_id}
                                tripTitle={s.trip_id ? tripById.get(s.trip_id)?.title ?? null : null}
                                tripSlug={s.trip_id ? tripById.get(s.trip_id)?.slug ?? null : null}
                                adoptionUrl={s.trip_id ? buildFlightAdoptionUrl(tripById.get(s.trip_id)?.slug ?? "", s.id, option) : null}
                                bookingId={s.booking_id}
                                trips={pickerTrips}
                                returnTo={returnTo}
                                deleteAction={deleteSavedFlightOption}
                                assignTripAction={assignTripToSavedFlightOption}
                                markSelectedAction={markSavedFlightOptionSelected}
                                unmarkSelectedAction={unmarkSavedFlightOptionSelected}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {savedFlights.length > 0 && (
          <section className="mb-8">
            <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>
              Gemerkte Verbindungen für diese Strecke ({savedFlights.length}/{MAX_SAVED_FLIGHTS_PER_ROUTE})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {savedFlights.map((s) => {
                const option = s.flight_option as unknown as FlightSearchOption;
                const nights = s.found_return_date ? nightsBetween(s.found_departure_date, s.found_return_date) : null;
                return (
                  <div key={s.id} className="relative">
                    <FlightCard
                      option={option}
                      searchedAt={s.created_at}
                      dateContext={{ departureDate: s.found_departure_date, returnDate: s.found_return_date, nights }}
                    />
                    <TrefferOrRefreshAction
                      savedOptionId={s.id} searchKey={s.search_key} isFresh={isSavedFlightFresh(s)} returnTo={returnTo}
                    />
                    <SavedOptionStatusRow
                      id={s.id}
                      status={s.status}
                      tripId={s.trip_id}
                      tripTitle={s.trip_id ? tripById.get(s.trip_id)?.title ?? null : null}
                      tripSlug={s.trip_id ? tripById.get(s.trip_id)?.slug ?? null : null}
                      adoptionUrl={s.trip_id ? buildFlightAdoptionUrl(tripById.get(s.trip_id)?.slug ?? "", s.id, option) : null}
                      bookingId={s.booking_id}
                      trips={pickerTrips}
                      returnTo={returnTo}
                      deleteAction={deleteSavedFlightOption}
                      assignTripAction={assignTripToSavedFlightOption}
                      markSelectedAction={markSavedFlightOptionSelected}
                      unmarkSelectedAction={unmarkSavedFlightOptionSelected}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {bookedFlights.length > 0 && (
          <section className="mb-8">
            <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>
              Bereits gebucht
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {bookedFlights.map((s) => {
                const option = s.flight_option as unknown as FlightSearchOption;
                const nights = s.found_return_date ? nightsBetween(s.found_departure_date, s.found_return_date) : null;
                const tripSlug = s.trip_id ? tripById.get(s.trip_id)?.slug ?? null : null;
                return (
                  <div key={s.id}>
                    <FlightCard
                      option={option}
                      searchedAt={s.created_at}
                      dateContext={{ departureDate: s.found_departure_date, returnDate: s.found_return_date, nights }}
                    />
                    <SavedOptionStatusRow
                      id={s.id} status={s.status} tripId={s.trip_id}
                      tripTitle={s.trip_id ? tripById.get(s.trip_id)?.title ?? null : null}
                      tripSlug={tripSlug} adoptionUrl={null} bookingId={s.booking_id}
                      trips={pickerTrips} returnTo={returnTo}
                      deleteAction={deleteSavedFlightOption} assignTripAction={assignTripToSavedFlightOption}
                      markSelectedAction={markSavedFlightOptionSelected} unmarkSelectedAction={unmarkSavedFlightOptionSelected}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
            searchKeyByOptionId={searchKeyByOptionId}
            savedOptionIds={savedOptionIds}
            saveAction={saveFlightOption}
            returnTo={returnTo}
            highlightOptionId={highlightOptionId}
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
