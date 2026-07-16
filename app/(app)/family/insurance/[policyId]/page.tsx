import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assignPolicyToTrip, unassignPolicyFromTrip } from "@/lib/actions/insurance";
import { formatExpiresAt } from "@/lib/documents";
import { getCachedSignedUrl } from "@/lib/signed-storage-url";

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px" }}>
        {label}
      </div>
      <div className="text-sm font-light" style={{ color: "var(--foreground)" }}>{value}</div>
    </div>
  );
}

export default async function InsurancePolicyDetailPage({
  params,
}: {
  params: Promise<{ policyId: string }>;
}) {
  const { policyId } = await params;

  const supabase = await createClient();
  const { data: policy } = await supabase
    .from("insurance_policies")
    .select(`
      id, label, provider, policy_type, reference_number, valid_from, valid_to,
      emergency_contact, notes, storage_bucket, storage_path,
      insurance_policy_persons ( persons ( id, name, initials ) )
    `)
    .eq("id", policyId)
    .maybeSingle();

  if (!policy) notFound();

  const persons = (policy.insurance_policy_persons as unknown as Array<{ persons: { id: string; name: string; initials: string } | null }>)
    .flatMap((p) => (p.persons ? [p.persons] : []));

  const signedUrl = policy.storage_path ? await getCachedSignedUrl("documents", policy.storage_path) : null;
  const isImage = policy.storage_path ? /\.(jpe?g|png|webp)$/i.test(policy.storage_path) : false;

  const { data: assignedTripsRaw } = await supabase
    .from("insurance_policy_trips")
    .select("trip_id, trips ( id, slug, title )")
    .eq("policy_id", policy.id);

  const assignedTrips = (assignedTripsRaw ?? [])
    .map((r) => r.trips as unknown as { id: string; slug: string; title: string } | null)
    .filter((t): t is { id: string; slug: string; title: string } => t !== null);
  const assignedTripIds = new Set(assignedTrips.map((t) => t.id));

  const { data: allTrips } = await supabase.from("trips").select("id, title").order("start_date", { ascending: false });
  const availableTrips = (allTrips ?? []).filter((t) => !assignedTripIds.has(t.id));

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/family/insurance"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", display: "inline-block", marginBottom: "32px" }}
        >
          ← Versicherungen
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.5rem", letterSpacing: "0.01em" }}>
            {policy.label}
          </h1>
          <Link
            href={`/family/insurance/${policy.id}/edit`}
            style={{
              fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent)",
              border: "1px solid rgba(184,154,94,0.3)", padding: "8px 16px", borderRadius: "20px", textDecoration: "none",
            }}
          >
            Bearbeiten
          </Link>
        </div>

        <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <MetaItem label="Anbieter / Karte" value={policy.provider ?? "—"} />
            <MetaItem label="Versicherungsart" value={policy.policy_type ?? "—"} />
            <MetaItem label="Referenznummer" value={policy.reference_number ?? "—"} />
            <MetaItem label="Gültig ab" value={formatExpiresAt(policy.valid_from)} />
            <MetaItem label="Gültig bis" value={formatExpiresAt(policy.valid_to)} />
            <MetaItem label="Notfallkontakt" value={policy.emergency_contact ?? "—"} />
          </div>
        </div>

        {persons.length > 0 && (
          <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
              Versicherte Personen
            </div>
            <div className="flex flex-wrap gap-2">
              {persons.map((p) => (
                <span
                  key={p.id}
                  style={{ color: "var(--foreground)", fontSize: "0.78rem", background: "var(--background)", border: "1px solid var(--border)", padding: "4px 12px", borderRadius: "20px" }}
                >
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {policy.notes && (
          <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
              Notizen
            </div>
            <p className="leading-relaxed" style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{policy.notes}</p>
          </div>
        )}

        {policy.storage_path && (
          <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
              Hinterlegte Datei
            </div>
            {signedUrl ? (
              isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signedUrl} alt={policy.label} className="rounded-lg w-full" style={{ maxHeight: 480, objectFit: "contain", background: "var(--background)" }} />
              ) : (
                <a href={signedUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontSize: "0.8rem", textDecoration: "none" }}>
                  PDF öffnen →
                </a>
              )
            ) : (
              <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Datei konnte nicht geladen werden.</p>
            )}
          </div>
        )}

        <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ color: "var(--muted)", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "12px" }}>
            Zugeordnete Reisen
          </div>

          {assignedTrips.length > 0 ? (
            <div className="space-y-2 mb-5">
              {assignedTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg"
                  style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                >
                  <Link href={`/trips/${trip.slug}`} className="min-w-0 truncate" style={{ color: "var(--foreground)", fontSize: "0.82rem", textDecoration: "none" }}>
                    {trip.title}
                  </Link>
                  <form action={unassignPolicyFromTrip}>
                    <input type="hidden" name="policy_id" value={policy.id} />
                    <input type="hidden" name="trip_id" value={trip.id} />
                    <button
                      type="submit"
                      style={{
                        fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#B5624A",
                        background: "transparent", border: "1px solid rgba(181,98,74,0.3)", padding: "5px 12px",
                        borderRadius: "20px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                      }}
                    >
                      Entfernen
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-5" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Noch keiner Reise zugeordnet.</p>
          )}

          {availableTrips.length > 0 && (
            <form action={assignPolicyToTrip} className="flex items-center gap-2 flex-wrap" style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
              <input type="hidden" name="policy_id" value={policy.id} />
              <select
                name="trip_id" required
                style={{ flex: "1 1 200px", padding: "10px 14px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.82rem", outline: "none" }}
              >
                <option value="">Reise wählen…</option>
                {availableTrips.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <button
                type="submit"
                style={{ fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", background: "transparent", border: "1px solid rgba(184,154,94,0.3)", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Zuordnen
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
