import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteInsurancePolicy } from "@/lib/actions/insurance";

export default async function DeleteInsurancePolicyPage({
  params,
}: {
  params: Promise<{ policyId: string }>;
}) {
  const { policyId } = await params;

  const supabase = await createClient();
  const { data: policy } = await supabase
    .from("insurance_policies")
    .select("id, label, storage_path")
    .eq("id", policyId)
    .maybeSingle();

  if (!policy) notFound();

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-lg mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={`/family/insurance/${policy.id}/edit`}
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", display: "inline-block", marginBottom: "32px" }}
        >
          ← {policy.label}
        </Link>

        <div
          className="rounded-xl p-8"
          style={{ background: "var(--surface)", border: "1px solid rgba(181,98,74,0.3)" }}
        >
          <div style={{ color: "#B5624A", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
            Versicherung löschen
          </div>
          <h1 className="font-light mb-5" style={{ color: "var(--foreground)", fontSize: "1.3rem", letterSpacing: "0.01em" }}>
            &bdquo;{policy.label}&rdquo; wirklich löschen?
          </h1>
          <p className="leading-relaxed mb-8" style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
            Die zentrale Versicherung wird unwiderruflich entfernt. Zugeordnete Reisen und versicherte
            Personen bleiben selbst unverändert erhalten — nur die Zuordnung zu dieser Police verschwindet.
          </p>

          <form action={deleteInsurancePolicy} className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
            <input type="hidden" name="policy_id" value={policy.id} />
            <input type="hidden" name="storage_path" value={policy.storage_path ?? ""} />
            <Link href={`/family/insurance/${policy.id}/edit`} style={{ color: "var(--muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textDecoration: "none" }}>
              Abbrechen
            </Link>
            <button
              type="submit"
              style={{
                background: "#B5624A", color: "#F0EBE3", border: "none",
                borderRadius: "6px", padding: "11px 20px", fontSize: "0.65rem",
                letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer",
                whiteSpace: "nowrap", WebkitAppearance: "none", appearance: "none",
              }}
            >
              Ja, löschen
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
