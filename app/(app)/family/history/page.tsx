import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getFamily } from "@/lib/family";
import { listHouseholdMembers, resolveLegacyTravelPersonId } from "@/lib/household-members";
import { buildTravelWorld } from "@/lib/travel-world";

export default async function FamilyHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const { person: personFilter } = await searchParams;

  const { id: familyId } = await getFamily();

  const [householdMembers, travelWorld] = await Promise.all([
    listHouseholdMembers(),
    // §ID-Space: buildTravelWorld erwartet weiterhin Travels legacy person_id
    // (siehe lib/travel-world.ts) -- personFilter kommt unten konsistent aus
    // resolveLegacyTravelPersonId, nicht aus household_member_id.
    buildTravelWorld({ familyId, personId: personFilter || undefined }),
  ]);
  // §Rückrichtung (lib/household-members.ts::resolveLegacyTravelPersonId):
  // die Personenfilter-Chips müssen weiterhin auf Travels legacy person_id
  // verlinken, damit buildTravelWorld() oben dieselbe ID korrekt auflösen kann.
  const persons = await Promise.all(
    householdMembers.map(async (m) => ({ id: (await resolveLegacyTravelPersonId(m.id)) ?? m.id, name: m.name })),
  );

  const entries = travelWorld.timeline;
  const filteredCountryCount = travelWorld.countryCodes.size;
  const selectedPersonName = persons.find((p) => p.id === personFilter)?.name;

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

        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
            Unsere Reisegeschichte
          </h1>
          <Link
            href="/family/history/new"
            style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}
          >
            + Reise/Land ergänzen
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            href="/family/history"
            style={{
              fontSize: "0.68rem", letterSpacing: "0.04em", padding: "5px 12px", borderRadius: "20px", textDecoration: "none",
              color: !personFilter ? "var(--surface)" : "var(--muted)",
              background: !personFilter ? "var(--accent)" : "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            Alle
          </Link>
          {(persons ?? []).map((p) => (
            <Link
              key={p.id}
              href={`/family/history?person=${p.id}`}
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

        {personFilter && (
          <p className="mb-6" style={{ color: "var(--muted)", fontSize: "0.74rem" }}>
            {selectedPersonName ?? "Diese Person"}: {entries.length} {entries.length === 1 ? "Reise" : "Reisen"} · {filteredCountryCount} {filteredCountryCount === 1 ? "Land" : "Länder"}
          </p>
        )}

        {entries.length > 0 ? (
          <div className="rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {entries.map((entry, idx) => (
              <div
                key={entry.key}
                className="flex items-center justify-between gap-4 p-5"
                style={{ borderBottom: idx < entries.length - 1 ? "1px solid var(--border)" : "none" }}
              >
                <div className="flex items-center gap-4">
                  <div style={{ color: "var(--accent)", fontSize: "0.75rem", letterSpacing: "0.04em", width: 44 }}>
                    {entry.year ?? "—"}
                  </div>
                  <div>
                    <div style={{ color: "var(--foreground)", fontSize: "0.88rem", fontWeight: 400 }}>{entry.title}</div>
                    <div style={{ color: "var(--muted)", fontSize: "0.7rem" }}>{entry.subtitle}</div>
                  </div>
                </div>
                <Link href={entry.viewHref} style={{ color: "var(--muted)", fontSize: "0.68rem", textDecoration: "none" }}>
                  {entry.kind === "trip" ? "Reise ansehen" : "Details ansehen"}
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              {personFilter ? "Für diese Person noch keine Reisen erfasst." : "Noch keine Reisegeschichte erfasst."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
