import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isTripHistorical, isTripCurrentlyRunning } from "@/lib/trip-status";

type TimelineEntry = {
  key: string;
  year: number | null;
  title: string;
  subtitle: string;
  isPast: boolean;
  editHref: string | null;
  travelerIds: string[];
  countryCodes: string[];
};

export default async function FamilyHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const { person: personFilter } = await searchParams;

  const supabase = await createClient();
  const { data: family } = await supabase.from("families").select("id").limit(1).single();
  const familyId = family?.id ?? "";

  const [{ data: persons }, { data: trips }, { data: pastTrips }, { data: pastTravelers }] = await Promise.all([
    supabase.from("persons").select("id, name").eq("family_id", familyId).order("name"),
    supabase
      .from("trips")
      .select("id, slug, title, start_date, end_date, status, trip_members(person_id), stages(country_code)")
      .eq("family_id", familyId)
      .order("start_date"),
    supabase.from("past_trips").select("id, country_or_region, country_code, year, places, duration_days, note").eq("family_id", familyId).order("year"),
    supabase.from("past_trip_travelers").select("past_trip_id, person_id"),
  ]);

  const travelersByPastTrip = new Map<string, string[]>();
  (pastTravelers ?? []).forEach((t) => {
    const list = travelersByPastTrip.get(t.past_trip_id) ?? [];
    list.push(t.person_id);
    travelersByPastTrip.set(t.past_trip_id, list);
  });

  let entries: TimelineEntry[] = [
    ...(trips ?? [])
      .filter((t) => isTripHistorical(t) || isTripCurrentlyRunning(t))
      .map((t) => ({
        key: `trip-${t.id}`,
        year: t.start_date ? new Date(t.start_date).getFullYear() : null,
        title: t.title,
        subtitle: isTripCurrentlyRunning(t) ? "Aktuelle Reise" : isTripHistorical(t) ? "Erlebt" : "In Family Travel OS geplant",
        isPast: false,
        editHref: null,
        travelerIds: (t.trip_members ?? []).map((m) => m.person_id),
        countryCodes: Array.from(new Set((t.stages ?? []).map((s) => s.country_code).filter((c): c is string => Boolean(c)))),
      })),
    ...(pastTrips ?? []).map((p) => ({
      key: `past-${p.id}`,
      year: p.year,
      title: p.country_or_region,
      subtitle: [p.places, p.duration_days ? `${p.duration_days} Tage` : null].filter(Boolean).join(" · ") || "Manuell erfasst",
      isPast: true,
      editHref: `/family/history/${p.id}/edit`,
      travelerIds: travelersByPastTrip.get(p.id) ?? [],
      countryCodes: p.country_code ? [p.country_code] : [],
    })),
  ].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  if (personFilter) {
    entries = entries.filter((e) => e.travelerIds.includes(personFilter));
  }

  const filteredCountryCount = new Set(entries.flatMap((e) => e.countryCodes)).size;
  const selectedPersonName = (persons ?? []).find((p) => p.id === personFilter)?.name;

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
                {entry.editHref && (
                  <Link href={entry.editHref} style={{ color: "var(--muted)", fontSize: "0.68rem", textDecoration: "none" }}>
                    Bearbeiten
                  </Link>
                )}
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
