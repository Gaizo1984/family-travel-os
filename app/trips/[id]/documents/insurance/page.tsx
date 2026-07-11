import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { assignPolicyToTrip } from "@/lib/actions/insurance";
import { Banner } from "@/components/Banner";

export default async function AssignInsuranceToTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, slug, title")
    .eq("slug", id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: assignedRows } = await supabase
    .from("insurance_policy_trips")
    .select("policy_id")
    .eq("trip_id", trip.id);
  const assignedIds = new Set((assignedRows ?? []).map((r) => r.policy_id));

  const { data: allPolicies } = await supabase
    .from("insurance_policies")
    .select("id, label, provider")
    .order("created_at", { ascending: true });

  const availablePolicies = (allPolicies ?? []).filter((p) => !assignedIds.has(p.id));
  const returnTo = `/trips/${trip.slug}/documents`;

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href={returnTo}
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          {trip.title}
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Bestehende Versicherung übernehmen
        </div>
        <h1 className="font-light mb-8" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Police auswählen und dieser Reise zuordnen
        </h1>

        {error && (
          <Banner variant="error">
            {error}
          </Banner>
        )}

        {availablePolicies.length > 0 ? (
          <div className="space-y-2 mb-8">
            {availablePolicies.map((policy) => (
              <form key={policy.id} action={assignPolicyToTrip}>
                <input type="hidden" name="policy_id" value={policy.id} />
                <input type="hidden" name="trip_id" value={trip.id} />
                <input type="hidden" name="return_to" value={returnTo} />
                <button
                  type="submit"
                  className="w-full flex items-center gap-4 p-4 rounded-xl transition-colors"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer", textAlign: "left" }}
                >
                  <div
                    className="shrink-0 flex items-center justify-center rounded-lg"
                    style={{ width: 36, height: 36, background: "var(--accent-subtle)" }}
                  >
                    <Shield size={15} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{policy.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>{policy.provider ?? "—"}</div>
                  </div>
                </button>
              </form>
            ))}
          </div>
        ) : (
          <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
            Keine weiteren Versicherungen vorhanden.
          </p>
        )}

        <Link
          href={`/family/insurance/new?assign_trip=${trip.id}&return_to=${encodeURIComponent(returnTo)}`}
          style={{ color: "var(--accent)", fontSize: "0.7rem", letterSpacing: "0.08em", textDecoration: "none" }}
        >
          Neue Versicherung anlegen →
        </Link>
      </div>
    </div>
  );
}
