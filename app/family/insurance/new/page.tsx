import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createInsurancePolicy } from "@/lib/actions/insurance";
import { DateSelectFields } from "@/app/family/DateSelectFields";
import { getDateFieldRange } from "@/lib/documents";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

export default async function NewInsurancePolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; assign_trip?: string; return_to?: string }>;
}) {
  const { error, assign_trip, return_to } = await searchParams;

  const supabase = await createClient();
  const { data: persons } = await supabase.from("persons").select("id, name").order("name");

  const cancelHref = return_to || "/family/insurance";

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={cancelHref}
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", display: "inline-block", marginBottom: "32px" }}
        >
          ← Zurück
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Versicherung anlegen
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Zentrale Bestandsversicherung
        </h1>

        <form action={createInsurancePolicy} encType="multipart/form-data">
          {assign_trip && <input type="hidden" name="assign_trip" value={assign_trip} />}
          {return_to && <input type="hidden" name="return_to" value={return_to} />}
          <div
            className="rounded-xl p-8"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {error && (
              <div
                className="mb-6 px-4 py-3 rounded-lg"
                style={{ background: "rgba(181,98,74,0.12)", border: "1px solid rgba(181,98,74,0.3)", color: "#B5624A", fontSize: "0.75rem", letterSpacing: "0.02em" }}
              >
                {error}
              </div>
            )}

            <div className="mb-5">
              <label htmlFor="ins-label" style={LABEL_STYLE}>Name *</label>
              <input id="ins-label" name="label" type="text" required placeholder="z. B. Amex Reiseversicherung" style={FIELD_STYLE} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label htmlFor="ins-provider" style={LABEL_STYLE}>Anbieter / Karte</label>
                <input id="ins-provider" name="provider" type="text" placeholder="z. B. American Express" style={FIELD_STYLE} />
              </div>
              <div>
                <label htmlFor="ins-type" style={LABEL_STYLE}>Versicherungsart</label>
                <input id="ins-type" name="policy_type" type="text" placeholder="z. B. Reiseversicherung" style={FIELD_STYLE} />
              </div>
            </div>

            <div className="mb-5">
              <label htmlFor="ins-reference" style={LABEL_STYLE}>Referenz-/Policennummer</label>
              <input id="ins-reference" name="reference_number" type="text" style={FIELD_STYLE} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DateSelectFields label="Gültig ab" namePrefix="valid_from" defaultIso={null} range={getDateFieldRange("issue")} />
              <DateSelectFields label="Gültig bis" namePrefix="valid_to" defaultIso={null} range={getDateFieldRange("expiry")} />
            </div>

            <div className="mb-5">
              <label htmlFor="ins-emergency" style={LABEL_STYLE}>Notfallkontakt</label>
              <input id="ins-emergency" name="emergency_contact" type="text" placeholder="z. B. +49 69 9797 3000" style={FIELD_STYLE} />
            </div>

            <div className="mb-8">
              <div style={LABEL_STYLE}>Versicherte Personen</div>
              <div className="flex flex-wrap gap-3">
                {(persons ?? []).map((p) => (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox" name="persons" value={p.id} defaultChecked
                      style={{ accentColor: "var(--accent)", width: "14px", height: "14px", cursor: "pointer" }}
                    />
                    <span style={{ color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}>{p.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label htmlFor="ins-notes" style={LABEL_STYLE}>Notizen</label>
              <textarea id="ins-notes" name="notes" rows={3} style={{ ...FIELD_STYLE, resize: "none" }} />
            </div>

            <div className="mb-8">
              <label htmlFor="ins-file" style={LABEL_STYLE}>Bedingungen / Bestätigung (optional)</label>
              <input
                id="ins-file" name="file" type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                style={{ ...FIELD_STYLE, padding: "10px 16px" }}
              />
              <p className="mt-2" style={{ color: "var(--muted)", fontSize: "0.65rem" }}>
                Erlaubt: JPEG, PNG, WebP oder PDF, maximal 10 MB.
              </p>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <Link href={cancelHref} style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
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
                Versicherung speichern
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
