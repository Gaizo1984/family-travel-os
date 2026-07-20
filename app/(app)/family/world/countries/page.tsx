import Link from "next/link";
import { ChevronLeft, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { syncTripDerivedCountryVisits } from "@/lib/travel-world";
import { addManualCountryVisit, removeManualCountryVisit } from "@/lib/actions/country-visits";
import { WORLD_COUNTRIES, WORLD_CONTINENTS, type WorldContinent } from "@/lib/data/world-countries";
import { CountryVisitSearchBar } from "@/components/CountryVisitSearchBar";

type PersonOption = { id: string; name: string; initials: string; color: string | null };

/**
 * §"Besuchte Länder personenbezogen umsetzen" (Nutzervorgabe): eigenständige
 * Checkliste, getrennt von der bestehenden "Land besucht"-Erfassung
 * (`/family/history/new`, volle past_trips-Einträge mit Jahr/Dauer/Foto) --
 * hier ein reiner, sofort wirksamer Ankreuz-Mechanismus je Person, ohne
 * Jahreszahl/Reisedetails zu verlangen. Sync läuft bei jedem Aufruf (gleiches
 * Prinzip wie buildTravelWorld: on-demand, kein Hintergrundjob).
 */
export default async function CountryVisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; continent?: string }>;
}) {
  const { q, continent } = await searchParams;

  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  await syncTripDerivedCountryVisits(familyId);

  const { data: personsRaw } = await supabase
    .from("persons")
    .select("id, name, initials, color")
    .eq("family_id", familyId)
    .order("name");
  const persons = (personsRaw ?? []) as PersonOption[];
  const personIds = persons.map((p) => p.id);

  const { data: visitsRaw } = personIds.length > 0
    ? await supabase.from("person_country_visits").select("person_id, country_code, source").in("person_id", personIds)
    : { data: [] as { person_id: string; country_code: string; source: string }[] };

  // person_id -> country_code -> source
  const visitsByPerson = new Map<string, Map<string, string>>();
  const countByPerson = new Map<string, number>();
  const familyCountryCodes = new Set<string>();
  for (const v of visitsRaw ?? []) {
    if (!visitsByPerson.has(v.person_id)) visitsByPerson.set(v.person_id, new Map());
    visitsByPerson.get(v.person_id)!.set(v.country_code, v.source);
    countByPerson.set(v.person_id, (countByPerson.get(v.person_id) ?? 0) + 1);
    familyCountryCodes.add(v.country_code);
  }

  const activeContinent = WORLD_CONTINENTS.includes(continent as WorldContinent) ? (continent as WorldContinent) : null;
  const query = (q ?? "").trim().toLowerCase();

  const countries = WORLD_COUNTRIES
    .filter((c) => (!activeContinent || c.continent === activeContinent))
    .filter((c) => (!query || c.name.toLowerCase().includes(query)))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  const currentParams = new URLSearchParams();
  if (q) currentParams.set("q", q);
  if (continent) currentParams.set("continent", continent);
  const returnTo = currentParams.toString() ? `/family/world/countries?${currentParams.toString()}` : "/family/world/countries";

  function continentHref(target: WorldContinent | null): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (target) params.set("continent", target);
    const qs = params.toString();
    return qs ? `/family/world/countries?${qs}` : "/family/world/countries";
  }

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/family/world"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Unsere Welt
        </Link>

        <h1 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.6rem", letterSpacing: "0.01em" }}>
          Besuchte Länder
        </h1>
        <p className="mb-6" style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.6 }}>
          Aus Reisen und Travel-History automatisch übernommene Länder sind angehakt und nicht
          abwählbar. Zusätzliche Länder lassen sich hier frei markieren.
        </p>

        {/* ── Zähler ── */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ color: "var(--foreground)", fontSize: "1.1rem", fontWeight: 300 }}>{familyCountryCodes.size}</div>
            <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Familie gesamt</div>
          </div>
          {persons.map((p) => (
            <div key={p.id} className="rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ color: "var(--foreground)", fontSize: "1.1rem", fontWeight: 300 }}>{countByPerson.get(p.id) ?? 0}</div>
              <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>{p.name}</div>
            </div>
          ))}
        </div>

        {/* ── Suche ── */}
        <div className="mb-4">
          <CountryVisitSearchBar defaultValue={q ?? ""} />
        </div>

        {/* ── Kontinentfilter ── */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            href={continentHref(null)}
            style={{
              fontSize: "0.68rem", letterSpacing: "0.04em", padding: "5px 12px", borderRadius: "20px", textDecoration: "none",
              color: !activeContinent ? "var(--surface)" : "var(--muted)",
              background: !activeContinent ? "var(--accent)" : "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            Alle
          </Link>
          {WORLD_CONTINENTS.map((c) => (
            <Link
              key={c}
              href={continentHref(c)}
              style={{
                fontSize: "0.68rem", letterSpacing: "0.04em", padding: "5px 12px", borderRadius: "20px", textDecoration: "none",
                color: activeContinent === c ? "var(--surface)" : "var(--muted)",
                background: activeContinent === c ? "var(--accent)" : "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              {c}
            </Link>
          ))}
        </div>

        {/* ── Länderliste ── */}
        {countries.length === 0 ? (
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Kein Land gefunden.</p>
          </div>
        ) : (
          <div className="rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {countries.map((country, idx) => (
              <div
                key={country.code}
                className="flex items-center justify-between gap-3 flex-wrap p-4"
                style={{ borderBottom: idx < countries.length - 1 ? "1px solid var(--border)" : "none" }}
              >
                <div className="min-w-0">
                  <div style={{ color: "var(--foreground)", fontSize: "0.85rem" }}>{country.name}</div>
                  <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.06em" }}>{country.continent}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {persons.map((p) => {
                    const source = visitsByPerson.get(p.id)?.get(country.code);
                    const baseStyle: React.CSSProperties = {
                      width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.58rem", letterSpacing: "0.02em", color: "#fff", background: p.color ?? "var(--muted)",
                      border: "2px solid transparent", padding: 0, cursor: "pointer",
                    };

                    if (source === "trip") {
                      return (
                        <span
                          key={p.id}
                          title={`${p.name}: aus Reise -- nicht entfernbar`}
                          style={{ ...baseStyle, border: "2px solid #4C7A5D", cursor: "default", opacity: 1 }}
                          className="relative"
                        >
                          {p.initials}
                          <Check size={10} strokeWidth={2.5} style={{ position: "absolute", bottom: -2, right: -2, background: "#4C7A5D", borderRadius: "50%", color: "#fff", padding: 1 }} />
                        </span>
                      );
                    }
                    if (source === "manual") {
                      return (
                        <form key={p.id} action={removeManualCountryVisit}>
                          <input type="hidden" name="person_id" value={p.id} />
                          <input type="hidden" name="country_code" value={country.code} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <button type="submit" title={`${p.name}: manuell markiert -- abwählen`} style={{ ...baseStyle, border: "2px solid var(--accent)" }}>
                            {p.initials}
                          </button>
                        </form>
                      );
                    }
                    return (
                      <form key={p.id} action={addManualCountryVisit}>
                        <input type="hidden" name="person_id" value={p.id} />
                        <input type="hidden" name="country_code" value={country.code} />
                        <input type="hidden" name="return_to" value={returnTo} />
                        <button type="submit" title={`${p.name}: als besucht markieren`} style={{ ...baseStyle, opacity: 0.35 }}>
                          {p.initials}
                        </button>
                      </form>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
