import Link from "next/link";
import { ChevronLeft, Trash2 } from "lucide-react";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { getFamily } from "@/lib/family";
import { listHouseholdMembers } from "@/lib/household-members";
import { addAllowedSender, toggleAllowedSenderActive, deleteAllowedSender } from "@/lib/actions/email-allowed-senders";
import { Banner } from "@/components/Banner";

/**
 * §Reise-Postfach, Schritt 1 ("Mehr -> Reise-Postfach -> Erlaubte
 * Absender"): reine Verwaltung der Whitelist -- die Whitelist-Prüfung
 * selbst (vor jeder KI-Verarbeitung, kein Zugriff für nicht gelistete
 * Absender) ist Teil eines späteren Schritts (Gmail-Anbindung). Diese Seite
 * legt nur die Daten dafür an.
 */
export default async function AllowedSendersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const lumiCore = await createLumiCoreClient();
  const { id: householdId } = await getFamily();

  const [{ data: sendersRaw }, members] = await Promise.all([
    lumiCore
      .from("travel_email_allowed_senders")
      .select("id, household_member_id, email, active")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true }),
    listHouseholdMembers(),
  ]);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const senders = (sendersRaw ?? []).map((s) => ({
    ...s,
    memberName: memberById.get(s.household_member_id)?.name ?? "Unbekannte Person",
  }));

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/mehr/reise-postfach"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Reise-Postfach
        </Link>

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Reise-Postfach
        </div>
        <h1 className="font-light mb-3" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Erlaubte Absender
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1.6 }}>
          Nur E-Mails von hier freigegebenen Adressen werden später automatisch verarbeitet.
          Alle anderen Absender werden ungeprüft verworfen — es wird nie eine KI-Analyse für
          nicht freigegebene Adressen ausgelöst.
        </p>

        {error && <Banner variant="error">{error}</Banner>}

        <div className="rounded-xl p-6 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {senders.length > 0 ? (
            <div className="mb-2">
              {senders.map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: "var(--foreground)" }}>{s.email}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>{s.memberName}</div>
                  </div>
                  <form action={toggleAllowedSenderActive}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="currently_active" value={String(s.active)} />
                    <button
                      type="submit"
                      className="rounded-full"
                      style={{
                        padding: "5px 12px", fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase",
                        border: "1px solid var(--border)", cursor: "pointer", whiteSpace: "nowrap",
                        background: s.active ? "var(--accent-subtle)" : "transparent",
                        color: s.active ? "var(--accent)" : "var(--muted)",
                      }}
                    >
                      {s.active ? "Aktiv" : "Inaktiv"}
                    </button>
                  </form>
                  <form action={deleteAllowedSender}>
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex" }} aria-label="Absender entfernen">
                      <Trash2 size={13} strokeWidth={1.4} />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              Noch keine erlaubten Absender hinterlegt.
            </p>
          )}
        </div>

        <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "14px" }}>
            Absender hinzufügen
          </div>
          <form action={addAllowedSender} className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label htmlFor="ea-person" style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                Person
              </label>
              <select
                id="ea-person" name="household_member_id" required
                style={{ width: "100%", padding: "10px 12px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300, outline: "none" }}
              >
                <option value="">Bitte wählen</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label htmlFor="ea-email" style={{ display: "block", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                E-Mail-Adresse
              </label>
              <input
                id="ea-email" name="email" type="email" required placeholder="z. B. marcel@privat.de"
                style={{ width: "100%", padding: "9px 12px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "0.82rem", fontWeight: 300, outline: "none" }}
              />
            </div>
            <button
              type="submit"
              style={{ background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px", padding: "10px 18px", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Hinzufügen
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
