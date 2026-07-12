import Link from "next/link";
import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type PersonRow = { id: string; name: string; initials: string };
type PolicyRow = {
  id: string;
  label: string;
  provider: string | null;
  policy_type: string | null;
  insurance_policy_persons: Array<{ persons: PersonRow | null }>;
};

export default async function InsuranceListPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("insurance_policies")
    .select("id, label, provider, policy_type, insurance_policy_persons ( persons ( id, name, initials ) )")
    .order("created_at", { ascending: true });

  const policies = (data ?? []) as unknown as PolicyRow[];

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
              const persons = policy.insurance_policy_persons.flatMap((p) => (p.persons ? [p.persons] : []));
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
