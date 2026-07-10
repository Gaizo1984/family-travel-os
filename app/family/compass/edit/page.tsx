import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { saveFamilyCompass } from "@/lib/actions/family-preferences";
import { COMPASS_CATEGORY_ORDER, COMPASS_CATEGORY_LABELS, HOTEL_CRITERIA_OPTIONS } from "@/lib/family-dna";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.85rem", fontWeight: 300, outline: "none",
};

const WEIGHT_LABELS: Record<number, string> = {
  1: "Unwichtig", 2: "Eher unwichtig", 3: "Neutral", 4: "Wichtig", 5: "Sehr wichtig",
};

export default async function EditFamilyCompassPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: family } = await supabase.from("families").select("id, exceptional_hotel_criteria").limit(1).single();
  const { data: preferences } = await supabase
    .from("family_preference_categories")
    .select("category_key, weight, note")
    .eq("family_id", family?.id ?? "");

  const prefByKey = new Map((preferences ?? []).map((p) => [p.category_key, p]));
  const hotelCriteria = new Set(family?.exceptional_hotel_criteria ?? []);

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

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Reisekompass
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Wie reisen wir am liebsten?
        </h1>

        <form action={saveFamilyCompass}>
          <input type="hidden" name="family_id" value={family?.id ?? ""} />

          <div className="rounded-xl p-8 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && (
              <div
                className="mb-6 px-4 py-3 rounded-lg"
                style={{ background: "rgba(181,98,74,0.12)", border: "1px solid rgba(181,98,74,0.3)", color: "#B5624A", fontSize: "0.75rem", letterSpacing: "0.02em" }}
              >
                {error}
              </div>
            )}

            {COMPASS_CATEGORY_ORDER.map((key, idx) => {
              const pref = prefByKey.get(key);
              return (
                <div key={key} className={idx < COMPASS_CATEGORY_ORDER.length - 1 ? "mb-6 pb-6" : ""} style={idx < COMPASS_CATEGORY_ORDER.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <span style={{ color: "var(--foreground)", fontSize: "0.88rem", fontWeight: 400 }}>{COMPASS_CATEGORY_LABELS[key]}</span>
                    <select name={`weight_${key}`} defaultValue={String(pref?.weight ?? 3)} style={{ ...FIELD_STYLE, width: "auto" }}>
                      {[1, 2, 3, 4, 5].map((w) => (
                        <option key={w} value={w}>{WEIGHT_LABELS[w]}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    name={`note_${key}`}
                    type="text"
                    defaultValue={pref?.note ?? ""}
                    placeholder="Notiz (optional)"
                    style={FIELD_STYLE}
                  />
                </div>
              );
            })}
          </div>

          <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={LABEL_STYLE}>Was bedeutet für uns „außergewöhnliche Hotels"?</div>
            <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.72rem", lineHeight: 1.5 }}>
              Diese Kriterien gelten dauerhaft für die Familie — das Budget bleibt weiterhin je Reise separat festgelegt.
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              {HOTEL_CRITERIA_OPTIONS.map((criterion) => (
                <label key={criterion.key} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox" name={`hotel_${criterion.key}`}
                    defaultChecked={hotelCriteria.has(criterion.key)}
                    style={{ accentColor: "var(--accent)", width: "14px", height: "14px", cursor: "pointer" }}
                  />
                  <span style={{ color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}>{criterion.label}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <Link href="/family" style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
                Abbrechen
              </Link>
              <button
                type="submit"
                style={{
                  background: "var(--foreground)", color: "var(--surface)", border: "none",
                  borderRadius: "6px", padding: "11px 20px", fontSize: "0.65rem",
                  letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer",
                  whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
                }}
              >
                Reisekompass speichern
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
