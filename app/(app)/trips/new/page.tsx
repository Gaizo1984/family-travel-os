import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createTrip } from "@/lib/actions/trips";
import { Banner } from "@/components/Banner";
import { DateSelectFields } from "@/components/DateSelectFields";
import { getDateFieldRange } from "@/lib/documents";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "planned",   label: "Geplant" },
  { value: "active",    label: "Aktiv / schon gebucht" },
  { value: "completed", label: "Abgeschlossen" },
];

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: persons } = await supabase
    .from("persons")
    .select("id, name, initials, color")
    .order("name");

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/trips"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", display: "inline-block", marginBottom: "32px" }}
        >
          ← Alle Reisen
        </Link>

        <div
          style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}
        >
          Reise selbst anlegen
        </div>
        <h1
          className="font-light mb-8"
          style={{ color: "var(--foreground)", fontSize: "1.6rem", letterSpacing: "0.01em" }}
        >
          Für bereits gebuchte oder konkret geplante Reisen.
        </h1>

        <form action={createTrip}>
          <input type="hidden" name="_referer" value="/trips/new" />

          <div
            className="rounded-xl p-8"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {error && (
              <Banner variant="error">
                {error}
              </Banner>
            )}

            <div className="mb-5">
              <label
                htmlFor="new-title"
                style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
              >
                Reisetitel *
              </label>
              <input
                id="new-title"
                name="title"
                type="text"
                required
                placeholder="z. B. Oman 2027"
                style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.9rem", fontWeight: 300, outline: "none" }}
              />
            </div>

            <div className="mb-5">
              <label
                htmlFor="new-subtitle"
                style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
              >
                Ziel / Region
              </label>
              <input
                id="new-subtitle"
                name="subtitle"
                type="text"
                placeholder="z. B. Muscat · Wahiba Sands · Salalah"
                style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.9rem", fontWeight: 300, outline: "none" }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DateSelectFields label="Von *" namePrefix="start_date" range={getDateFieldRange("travel")} quickActions />
              <DateSelectFields label="Bis *" namePrefix="end_date" range={getDateFieldRange("travel")} quickActions />
            </div>

            <div className="mb-8">
              <label
                htmlFor="new-status"
                style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}
              >
                Status
              </label>
              <select
                id="new-status"
                name="status"
                defaultValue="planned"
                style={{ width: "100%", padding: "12px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.88rem", outline: "none" }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="mb-8">
              <div
                style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "12px" }}
              >
                Wer reist mit *
              </div>
              <div className="flex flex-wrap gap-3">
                {(persons ?? []).map((p) => (
                  <label
                    key={p.id}
                    style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      name="members"
                      value={p.id}
                      defaultChecked
                      style={{ accentColor: "var(--accent)", width: "14px", height: "14px", cursor: "pointer" }}
                    />
                    <span style={{ color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}>
                      {p.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <Link
                href="/plan"
                style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}
              >
                Lieber eine Reiseidee entwickeln?
              </Link>
              <button
                type="submit"
                style={{ background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px", padding: "11px 20px", fontSize: "0.65rem", letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none" }}
              >
                Reise anlegen →
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
