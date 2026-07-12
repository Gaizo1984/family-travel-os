import Link from "next/link";
import { Map as MapIcon, Globe, CalendarDays, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamily } from "@/lib/family";
import { COMPASS_CATEGORY_ORDER, COMPASS_CATEGORY_LABELS } from "@/lib/family-dna";
import { buildWorldStats } from "@/lib/world-stats";
import { isTripHistorical, isTripCurrentlyRunning } from "@/lib/trip-status";
import { WorldMap } from "@/components/WorldMap";

type PersonRow = {
  id: string; name: string; initials: string; is_minor: boolean
  role_label: string | null; description: string | null
  interest_tags: string[]; travel_needs: string[]; photo_storage_path: string | null
};

function Tag({ label }: { label: string }) {
  return (
    <span style={{ fontSize: "0.6rem", letterSpacing: "0.07em", color: "var(--muted)", background: "var(--background)", padding: "3px 10px", borderRadius: "20px", border: "1px solid var(--border)", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function PersonCard({ person, photoUrl, compact }: { person: PersonRow; photoUrl: string | null; compact: boolean }) {
  return (
    <Link href={`/family/${person.id}`} className="block overflow-hidden rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}>
      <div className="relative overflow-hidden" style={{ height: compact ? 150 : 200 }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={person.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--accent-subtle)" }}>
            <span style={{ color: "var(--accent)", fontSize: "1.8rem", letterSpacing: "0.04em" }}>{person.initials}</span>
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 55%, rgba(243,239,232,0.35) 100%)" }} />
      </div>
      <div className={compact ? "p-5" : "p-6"}>
        <h3 className={compact ? "text-base font-light" : "text-lg font-light"} style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}>
          {person.name}
        </h3>
        {person.role_label && (
          <div className="mt-0.5 mb-3" style={{ color: "var(--accent)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            {person.role_label}
          </div>
        )}
        {person.description && (
          <p className="leading-relaxed mb-4" style={{ color: "var(--muted)", fontSize: compact ? "0.74rem" : "0.78rem" }}>
            {person.description}
          </p>
        )}
        {person.interest_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {person.interest_tags.map((t) => <Tag key={t} label={t} />)}
          </div>
        )}
      </div>
    </Link>
  );
}

export default async function FamilyPage() {
  const supabase = await createClient();
  const { id: familyId } = await getFamily();

  const [{ data: personsRaw }, { data: preferences }, worldStats] = await Promise.all([
    supabase.from("persons").select("id, name, initials, is_minor, role_label, description, interest_tags, travel_needs, photo_storage_path").eq("family_id", familyId).order("is_minor"),
    supabase.from("family_preference_categories").select("category_key, weight, note").eq("family_id", familyId),
    buildWorldStats(familyId),
  ]);

  const persons = (personsRaw ?? []) as PersonRow[];
  const adults = persons.filter((p) => !p.is_minor);
  const kids = persons.filter((p) => p.is_minor);

  const photoUrlByPersonId = new Map<string, string>();
  await Promise.all(
    persons
      .filter((p): p is PersonRow & { photo_storage_path: string } => !!p.photo_storage_path)
      .map(async (p) => {
        const { data: signed } = await supabase.storage.from("documents").createSignedUrl(p.photo_storage_path, 3600);
        if (signed?.signedUrl) photoUrlByPersonId.set(p.id, signed.signedUrl);
      }),
  );

  const prefByKey = new Map((preferences ?? []).map((p) => [p.category_key, p]));

  const { trips: activeTrips, pastTrips, tripsCount, countryCodes, travelDays } = worldStats;

  const timelineEntries = [
    ...activeTrips
      .filter((t) => isTripHistorical(t) || isTripCurrentlyRunning(t))
      .map((t) => ({ key: `trip-${t.id}`, year: t.start_date ? new Date(t.start_date).getFullYear() : 0, label: t.title, isNext: isTripCurrentlyRunning(t) })),
    ...pastTrips.map((p) => ({ key: `past-${p.id}`, year: p.year, label: p.country_or_region, isNext: false })),
  ].sort((a, b) => a.year - b.year).slice(-5);

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 px-5 md:px-8 pb-16 max-w-4xl w-full mx-auto">

        {/* ── Header ── */}
        <header className="flex items-start justify-between flex-wrap gap-4 pt-9 pb-9">
          <div>
            <h1 className="text-2xl font-light mb-1" style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}>
              Unsere Familie
            </h1>
            <p className="text-xs" style={{ color: "var(--muted)", letterSpacing: "0.08em", fontSize: "0.7rem" }}>
              {persons.length} Menschen. {persons.length} Arten zu reisen.
            </p>
          </div>
          <Link
            href="/family/vault"
            style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.08em", textDecoration: "none" }}
          >
            Travel Vault
          </Link>
        </header>

        {/* ── 1. Unsere Familie ── */}
        <section className="mb-14">
          <div className="mb-6" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
            Unsere Familie
          </div>

          {adults.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {adults.map((p) => (
                <PersonCard key={p.id} person={p} photoUrl={photoUrlByPersonId.get(p.id) ?? null} compact={false} />
              ))}
            </div>
          )}

          {kids.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {kids.map((p) => (
                <PersonCard key={p.id} person={p} photoUrl={photoUrlByPersonId.get(p.id) ?? null} compact={true} />
              ))}
            </div>
          )}
        </section>

        {/* ── 2. Unser Reisekompass ── */}
        <section className="mb-14">
          <div className="flex items-center justify-between mb-7 flex-wrap gap-3">
            <h2 className="text-xl font-light" style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}>
              Unser Reisekompass
            </h2>
            <Link href="/family/compass/edit" style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}>
              Bearbeiten →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {COMPASS_CATEGORY_ORDER.map((key) => {
              const pref = prefByKey.get(key);
              const weight = pref?.weight ?? 3;
              return (
                <div key={key} className="p-5 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                    {COMPASS_CATEGORY_LABELS[key]}
                  </div>
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((dot) => (
                      <div key={dot} className="rounded-full" style={{ width: 6, height: 6, background: dot <= weight ? "var(--accent)" : "var(--border)" }} />
                    ))}
                  </div>
                  {pref?.note && (
                    <p className="leading-relaxed" style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{pref.note}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 3. Unsere Welt ── */}
        <section id="unsere-welt" className="mb-14" style={{ scrollMarginTop: "16px" }}>
          <h2 className="text-xl font-light mb-7" style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}>
            Unsere Welt
          </h2>

          <div className="grid grid-cols-3 gap-3 md:gap-8 mb-8">
            {[
              { Icon: MapIcon, value: tripsCount, label: "Reisen" },
              { Icon: Globe, value: countryCodes.size, label: "Länder" },
              { Icon: CalendarDays, value: travelDays, label: "Reisetage" },
            ].map(({ Icon, value, label }) => (
              <div key={label} className="flex items-center gap-2 md:gap-4 min-w-0">
                <Icon size={13} strokeWidth={1.4} style={{ color: "var(--accent)", flexShrink: 0 }} />
                <div className="min-w-0">
                  <div className="text-3xl md:text-4xl font-light leading-none mb-1 truncate" style={{ color: "var(--foreground)" }}>{value}</div>
                  <div className="truncate" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>{label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <WorldMap visitedCodes={countryCodes} />
          </div>
        </section>

        {/* ── 4. Unsere Reisegeschichte ── */}
        <section className="mb-14">
          <div className="flex items-center justify-between mb-7 flex-wrap gap-3">
            <h2 className="text-xl font-light" style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}>
              Unsere Reisegeschichte
            </h2>
            <Link href="/family/history" style={{ color: "var(--accent)", fontSize: "0.68rem", letterSpacing: "0.08em", textDecoration: "none" }}>
              Alle ansehen →
            </Link>
          </div>

          {timelineEntries.length > 0 ? (
            <div className="rounded-xl p-6 overflow-x-auto scroll-hide" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-start" style={{ width: "max-content", minWidth: "100%" }}>
                {timelineEntries.flatMap((h, idx) => [
                  <div key={h.key} className="flex flex-col items-center" style={{ minWidth: "80px" }}>
                    <div
                      className="w-2.5 h-2.5 rounded-full mb-3"
                      style={{
                        background: h.isNext ? "var(--accent)" : "transparent",
                        border: `1.5px solid ${h.isNext ? "var(--accent)" : "var(--muted)"}`,
                        boxShadow: h.isNext ? "0 0 0 4px rgba(184,154,94,0.12)" : "none",
                      }}
                    />
                    <div className="text-sm font-light text-center" style={{ color: h.isNext ? "var(--foreground)" : "var(--muted)" }}>
                      {h.label}
                    </div>
                    <div className="text-center mt-1" style={{ color: h.isNext ? "var(--accent)" : "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.08em" }}>
                      {h.isNext ? `${h.year} · Aktuelle Reise` : h.year}
                    </div>
                  </div>,
                  idx < timelineEntries.length - 1 ? (
                    <div key={`sep-${idx}`} className="flex-1" style={{ height: "1px", background: "var(--border)", marginTop: "5px", minWidth: "24px" }} />
                  ) : null,
                ])}
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Noch keine Reisegeschichte erfasst.</p>
            </div>
          )}
        </section>

        {/* ── Persönliche Notiz ── */}
        <section>
          <div className="py-14" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="mb-9" style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.24em", textTransform: "uppercase" }}>
              Was eine perfekte Reise für uns bedeutet
            </div>
            <blockquote className="font-light leading-relaxed" style={{ color: "var(--foreground)", fontSize: "1.45rem", letterSpacing: "0.01em", maxWidth: "600px", lineHeight: 1.55 }}>
              „Ein besonderer Ort. Zeit füreinander. Etwas, das wir noch nie gesehen haben. Und am Ende Geschichten, die nur uns gehören."
            </blockquote>
            <div className="pt-8">
              <Link
                href="/concierge"
                style={{ display: "inline-flex", alignItems: "center", gap: "7px", color: "var(--muted)", fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none", borderBottom: "1px solid var(--border)", paddingBottom: "2px" }}
              >
                Reiseentscheidungen mit LUMI klären
                <ArrowRight size={10} strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
