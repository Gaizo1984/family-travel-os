import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { searchFlightsStandalone } from "@/lib/actions/flight-search";
import { getFlightProviderName } from "@/lib/providers/flights-provider";
import { FlightSearchForm } from "@/components/FlightSearchForm";
import { FlightFilterBar } from "@/components/FlightFilterBar";
import { Banner } from "@/components/Banner";
import type { FlightSearchOption } from "@/lib/flight-types";

export default async function DiscoverFlightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    destination?: string; departure_city?: string; departure_date?: string; return_date?: string
    traveler_ids?: string; idea_id?: string; search_key?: string; error?: string
  }>;
}) {
  const sp = await searchParams;

  const supabase = await createClient();
  const { id: familyId } = await getFamily();
  const { data: persons } = await supabase
    .from("persons")
    .select("id, name, initials, color, birth_date, is_minor")
    .order("name");

  let flightResult: { options: FlightSearchOption[]; isSandboxData: boolean; searchedAt: string } | null = null;
  if (sp.search_key) {
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

  const defaultTravelerIds = sp.traveler_ids ? sp.traveler_ids.split(",").filter(Boolean) : [];

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

        {sp.error && (
          <Banner variant="error" className="mb-6 px-4 py-3 rounded-lg">
            {sp.error}
          </Banner>
        )}

        <div className="rounded-xl p-6 md:p-8 mb-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <FlightSearchForm
            persons={persons ?? []}
            action={searchFlightsStandalone}
            defaultDestination={sp.destination}
            defaultDepartureCity={sp.departure_city}
            defaultDepartureIso={sp.departure_date}
            defaultReturnIso={sp.return_date}
            defaultTravelerIds={defaultTravelerIds}
            ideaId={sp.idea_id}
          />
        </div>

        {flightResult && (
          <FlightFilterBar
            options={flightResult.options}
            isSandboxData={flightResult.isSandboxData}
            providerName={getFlightProviderName()}
            searchedAt={flightResult.searchedAt}
          />
        )}
      </div>
    </div>
  );
}
