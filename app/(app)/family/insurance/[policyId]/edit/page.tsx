import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateInsurancePolicy } from "@/lib/actions/insurance";
import { DateSelectFields } from "@/components/DateSelectFields";
import { getDateFieldRange } from "@/lib/documents";
import { Banner } from "@/components/Banner";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

export default async function EditInsurancePolicyPage({
  params,
  searchParams,
}: {
  params: Promise<{ policyId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { policyId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: policy } = await supabase
    .from("insurance_policies")
    .select("id, label, provider, policy_type, reference_number, valid_from, valid_to, emergency_contact, notes")
    .eq("id", policyId)
    .maybeSingle();

  if (!policy) notFound();

  const { data: persons } = await supabase.from("persons").select("id, name").order("name");
  const { data: assigned } = await supabase.from("insurance_policy_persons").select("person_id").eq("policy_id", policy.id);
  const assignedIds = new Set((assigned ?? []).map((a) => a.person_id));

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/family/insurance/${policy.id}`}
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", display: "inline-block", marginBottom: "32px" }}
        >
          ← {policy.label}
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Versicherung bearbeiten
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          {policy.label}
        </h1>

        <form action={updateInsurancePolicy} encType="multipart/form-data">
          <input type="hidden" name="policy_id" value={policy.id} />

          <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {error && (
              <Banner variant="error">
                {error}
              </Banner>
            )}

            <div className="mb-5">
              <label htmlFor="ins-label" style={LABEL_STYLE}>Name *</label>
              <input id="ins-label" name="label" type="text" required defaultValue={policy.label} style={FIELD_STYLE} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label htmlFor="ins-provider" style={LABEL_STYLE}>Anbieter / Karte</label>
                <input id="ins-provider" name="provider" type="text" defaultValue={policy.provider ?? ""} style={FIELD_STYLE} />
              </div>
              <div>
                <label htmlFor="ins-type" style={LABEL_STYLE}>Versicherungsart</label>
                <input id="ins-type" name="policy_type" type="text" defaultValue={policy.policy_type ?? ""} style={FIELD_STYLE} />
              </div>
            </div>

            <div className="mb-5">
              <label htmlFor="ins-reference" style={LABEL_STYLE}>Referenz-/Policennummer</label>
              <input id="ins-reference" name="reference_number" type="text" defaultValue={policy.reference_number ?? ""} style={FIELD_STYLE} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DateSelectFields label="Gültig ab" namePrefix="valid_from" defaultIso={policy.valid_from} range={getDateFieldRange("issue")} />
              <DateSelectFields label="Gültig bis" namePrefix="valid_to" defaultIso={policy.valid_to} range={getDateFieldRange("expiry")} />
            </div>

            <div className="mb-5">
              <label htmlFor="ins-emergency" style={LABEL_STYLE}>Notfallkontakt</label>
              <input id="ins-emergency" name="emergency_contact" type="text" defaultValue={policy.emergency_contact ?? ""} style={FIELD_STYLE} />
            </div>

            <div className="mb-8">
              <div style={LABEL_STYLE}>Versicherte Personen</div>
              <div className="flex flex-wrap gap-3">
                {(persons ?? []).map((p) => (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox" name="persons" value={p.id} defaultChecked={assignedIds.has(p.id)}
                      style={{ accentColor: "var(--accent)", width: "14px", height: "14px", cursor: "pointer" }}
                    />
                    <span style={{ color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300 }}>{p.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label htmlFor="ins-notes" style={LABEL_STYLE}>Notizen</label>
              <textarea id="ins-notes" name="notes" rows={3} defaultValue={policy.notes ?? ""} style={{ ...FIELD_STYLE, resize: "none" }} />
            </div>

            <div className="mb-8">
              <label htmlFor="ins-file" style={LABEL_STYLE}>Neue Datei hochladen (optional, ersetzt vorhandene Datei)</label>
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
              <Link href={`/family/insurance/${policy.id}`} style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
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
                Änderungen speichern
              </button>
            </div>
          </div>
        </form>

        <div
          className="rounded-xl p-6 mt-6 flex items-center justify-between flex-wrap gap-3"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
            Versicherung endgültig entfernen (Reisen bleiben erhalten).
          </p>
          <Link
            href={`/family/insurance/${policy.id}/delete`}
            style={{
              background: "transparent", color: "#B5624A", border: "1px solid rgba(181,98,74,0.35)",
              borderRadius: "6px", padding: "9px 18px", fontSize: "0.62rem", letterSpacing: "0.14em",
              textTransform: "uppercase", whiteSpace: "nowrap", textDecoration: "none",
            }}
          >
            Versicherung löschen
          </Link>
        </div>
      </div>
    </div>
  );
}
