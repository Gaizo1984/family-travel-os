import Link from "next/link";
import { ChevronLeft, Map as MapIcon, Globe, CalendarDays, Compass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { buildTravelWorld, syncTripDerivedCountryVisits } from "@/lib/travel-world";
import { WorldMap } from "@/components/WorldMap";
import { COUNTRY_NAMES } from "@/lib/geo-suggestions";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

/**
 * §"Unsere Welt": volle Erfahrung (Personenfilter + Karte + Statistik +
 * Reisegeschichte-Vorschau + "Land hinzufügen") auf einer eigenen Seite --
 * /family bleibt kompakt mit nur einer kurzen Vorschau hierher. Bezieht
 * ALLE Daten ausschließlich aus `buildTravelWorld` (lib/travel-world.ts),
 * keine eigene Berechnung. "Alle ansehen" verlinkt auf die bestehende
 * `/family/history`-Seite (dieselbe Timeline, keine Doppel-Logik) und
 * erhält den aktuellen Personenfilter.
 */
export default async function FamilyWorldPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const { person: personFilter } = await searchParams;

  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  // §"Besuchte Länder personenbezogen" (Nutzervorgabe): hält
  // person_country_visits aktuell, bevor die Weltkarte deren (jetzt auch
  // manuell markierte) Länder anzeigt -- reine On-Demand-Berechnung wie
  // buildTravelWorld selbst, kein Hintergrundjob.
  await syncTripDerivedCountryVisits(familyId);

  const [{ data: persons }, travelWorld] = await Promise.all([
    supabase.from("persons").select("id, name").eq("family_id", familyId).order("name"),
    buildTravelWorld({ familyId, personId: personFilter || undefined }),
  ]);

  // §"familienweite Ansicht: Land markieren sobald mindestens eine Person
  // dort war; Personenfilter: nur Länder der ausgewählten Person markieren"
  // (Nutzervorgabe, wörtlich): Karte zeigt jetzt person_country_visits
  // (Reise + manuell), NICHT mehr nur travelWorld.countryCodes -- erfasst
  // dadurch auch rein manuell markierte Länder. Statistik/Zeitstrahl bleiben
  // unverändert bei travelWorld (ausschließlich echte Reisen).
  const familyPersonIds = (persons ?? []).map((p) => p.id);
  let mapVisitedCodes = new Set<string>();
  if (familyPersonIds.length > 0) {
    let query = supabase.from("person_country_visits").select("country_code, person_id").in("person_id", familyPersonIds);
    if (personFilter) query = query.eq("person_id", personFilter);
    const { data: visitRows } = await query;
    mapVisitedCodes = new Set((visitRows ?? []).map((r) => r.country_code));
  }

  const selectedPersonName = (persons ?? []).find((p) => p.id === personFilter)?.name;
  const recentEntries = [...travelWorld.timeline].reverse().slice(0, 5);
  const lastCountryName = travelWorld.lastCountryCode ? COUNTRY_NAMES[travelWorld.lastCountryCode] ?? travelWorld.lastCountryCode : null;
  const historyHref = personFilter ? `/family/history?person=${personFilter}` : "/family/history";

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/family"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Familie
        </Link>

        <h1 className="font-light mb-6" style={{ color: "var(--foreground)", fontSize: "1.6rem", letterSpacing: "0.01em" }}>
          Unsere Welt
        </h1>

        {/* ── Personenfilter ── */}
        <div className="flex flex-wrap gap-2 mb-7">
          <Link
            href="/family/world"
            style={{
              fontSize: "0.68rem", letterSpacing: "0.04em", padding: "5px 12px", borderRadius: "20px", textDecoration: "none",
              color: !personFilter ? "var(--surface)" : "var(--muted)",
              background: !personFilter ? "var(--accent)" : "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            Familie
          </Link>
          {(persons ?? []).map((p) => (
            <Link
              key={p.id}
              href={`/family/world?person=${p.id}`}
              style={{
                fontSize: "0.68rem", letterSpacing: "0.04em", padding: "5px 12px", borderRadius: "20px", textDecoration: "none",
                color: personFilter === p.id ? "var(--surface)" : "var(--muted)",
                background: personFilter === p.id ? "var(--accent)" : "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              {p.name}
            </Link>
          ))}
        </div>

        {travelWorld.tripsCount === 0 && mapVisitedCodes.size === 0 ? (
          <Card>
            <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
              {personFilter
                ? `Für ${selectedPersonName ?? "diese Person"} wurden bisher noch keine besuchten Länder erfasst.`
                : "Noch keine Reisen erfasst -- sobald die erste Reise oder ein besuchtes Land eingetragen ist, entsteht hier eure Weltkarte."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/trips/new" style={{ color: "var(--accent)", fontSize: "0.72rem", letterSpacing: "0.06em", textDecoration: "none" }}>
                Erste Reise hinzufügen →
              </Link>
              <Link href="/family/history/new" style={{ color: "var(--accent)", fontSize: "0.72rem", letterSpacing: "0.06em", textDecoration: "none" }}>
                Land besucht →
              </Link>
              <Link
                href={personFilter ? `/family/world/countries?person=${personFilter}` : "/family/world/countries"}
                style={{ color: "var(--accent)", fontSize: "0.72rem", letterSpacing: "0.06em", textDecoration: "none" }}
              >
                Länderliste durchgehen →
              </Link>
            </div>
          </Card>
        ) : (
          <>
            {/* ── Statistik ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { Icon: Globe, value: travelWorld.countryCodes.size, label: "Länder" },
                { Icon: MapIcon, value: travelWorld.tripsCount, label: "Reisen" },
                { Icon: CalendarDays, value: travelWorld.travelDays, label: "Reisetage" },
                { Icon: Compass, value: lastCountryName ?? "—", label: "Zuletzt besucht" },
              ].map(({ Icon, value, label }) => (
                <div key={label} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <Icon size={13} strokeWidth={1.4} style={{ color: "var(--accent)", marginBottom: "8px" }} />
                  <div className="text-xl font-light leading-none mb-1 truncate" style={{ color: "var(--foreground)" }}>{value}</div>
                  <div className="truncate" style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* ── Weltkarte ── */}
            <div className="rounded-xl p-4 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <WorldMap visitedCodes={mapVisitedCodes} />
            </div>
            <div className="mb-8">
              <Link
                href={personFilter ? `/family/world/countries?person=${personFilter}` : "/family/world/countries"}
                style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.06em", textDecoration: "none" }}
              >
                Alle Länder verwalten →
              </Link>
            </div>

            {/* ── Reisegeschichte (Vorschau) ── */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-xs font-medium" style={{ color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.65rem" }}>
                Reisegeschichte
              </h2>
              <Link href={historyHref} style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}>
                Alle ansehen →
              </Link>
            </div>

            <div className="rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              {recentEntries.map((entry, idx) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between gap-4 p-5"
                  style={{ borderBottom: idx < recentEntries.length - 1 ? "1px solid var(--border)" : "none" }}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div style={{ color: "var(--accent)", fontSize: "0.75rem", letterSpacing: "0.04em", width: 44, flexShrink: 0 }}>
                      {entry.year ?? "—"}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate" style={{ color: "var(--foreground)", fontSize: "0.88rem", fontWeight: 400 }}>{entry.title}</div>
                      <div style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
                        {entry.kind === "past_trip" ? "Land besucht" : entry.subtitle}
                      </div>
                    </div>
                  </div>
                  {entry.tripHref ? (
                    <Link href={entry.tripHref} style={{ color: "var(--muted)", fontSize: "0.68rem", textDecoration: "none", flexShrink: 0 }}>
                      Reise ansehen
                    </Link>
                  ) : (
                    <Link href={entry.editHref ?? historyHref} style={{ color: "var(--muted)", fontSize: "0.68rem", textDecoration: "none", flexShrink: 0 }}>
                      Details ergänzen
                    </Link>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6">
              <Link
                href="/family/history/new"
                style={{
                  color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.06em", textDecoration: "none",
                  border: "1px solid rgba(184,154,94,0.4)", borderRadius: "20px", padding: "8px 18px", display: "inline-block",
                }}
              >
                + Land hinzufügen
              </Link>
              <p className="mt-2" style={{ color: "var(--muted)", fontSize: "0.68rem" }}>
                Auch frühere Reisen ohne vollständige Details erfassen.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
