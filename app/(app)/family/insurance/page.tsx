import Link from "next/link";
import { Shield } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { getFamily } from "@/lib/family";
import { getHouseholdMemberById, deriveInitials } from "@/lib/household-members";

type PersonRow = { id: string; name: string; initials: string };
type PolicyRow = {
  id: string;
  label: string;
  provider: string | null;
  policy_type: string | null;
  persons: PersonRow[];
};

export default async function InsuranceListPage() {
  const lumiCore = await createLumiCoreClient();
  const { id: familyId } = await getFamily();

  // §Lumi-Core-Cutover: keine PostgREST-Embeddings zwischen travel_*-Tabellen --
  // flache Abfragen (travel_insurance_policies -> travel_insurance_policy_persons
  // -> household_members) statt verschachteltem Select.
  const { data: policiesRaw } = await lumiCore
    .from("travel_insurance_policies")
    .select("id, label, provider, policy_type")
    .eq("household_id", familyId)
    .order("created_at", { ascending: true });

  const policyIds = (policiesRaw ?? []).map((p) => p.id);
  const { data: policyPersonLinks } = policyIds.length > 0
    ? await lumiCore.from("travel_insurance_policy_persons").select("policy_id, household_member_id").in("policy_id", policyIds)
    : { data: [] as { policy_id: string; household_member_id: string }[] };

  const memberIdsByPolicy = new Map<string, string[]>();
  (policyPersonLinks ?? []).forEach((link) => {
    const list = memberIdsByPolicy.get(link.policy_id) ?? [];
    list.push(link.household_member_id);
    memberIdsByPolicy.set(link.policy_id, list);
  });
  const uniqueMemberIds = [...new Set((policyPersonLinks ?? []).map((l) => l.household_member_id))];
  const members = await Promise.all(uniqueMemberIds.map((id) => getHouseholdMemberById(id)));
  const memberById = new Map(members.filter((m) => m !== null).map((m) => [m!.id, m!]));

  const policies: PolicyRow[] = (policiesRaw ?? []).map((p) => ({
    id: p.id, label: p.label, provider: p.provider, policy_type: p.policy_type,
    persons: (memberIdsByPolicy.get(p.id) ?? []).flatMap((id) => {
      const m = memberById.get(id);
      return m ? [{ id: m.id, name: m.name, initials: deriveInitials(m.name) }] : [];
    }),
  }));

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/family"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", display: "inline-block", marginBottom: "32px" }}
        >
          ← Familie
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "8px" }}>
              Travel Vault
            </div>
            <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.5rem", letterSpacing: "0.01em" }}>
              Versicherungen
            </h1>
          </div>
          <Link href="/family/insurance/new" className="btn-neue-reise" style={{ flexShrink: 0 }}>
            + Versicherung anlegen
          </Link>
        </div>

        {policies.length > 0 ? (
          <div className="space-y-2">
            {policies.map((policy) => {
              const persons = policy.persons;
              return (
                <Link
                  key={policy.id}
                  href={`/family/insurance/${policy.id}`}
                  className="flex items-center gap-4 p-4 rounded-xl transition-colors"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
                >
                  <div
                    className="shrink-0 flex items-center justify-center rounded-lg"
                    style={{ width: 36, height: 36, background: "var(--accent-subtle)" }}
                  >
                    <Shield size={15} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{policy.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
                      {[policy.provider, policy.policy_type].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  {persons.length > 0 && (
                    <div className="flex -space-x-1.5 shrink-0">
                      {persons.map((p) => (
                        <div
                          key={p.id}
                          className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--surface)", fontSize: "0.5rem" }}
                        >
                          {p.initials}
                        </div>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="mb-4" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Noch keine Versicherung hinterlegt.
            </p>
            <Link href="/family/insurance/new" style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.08em", textDecoration: "none" }}>
              Versicherung anlegen →
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
