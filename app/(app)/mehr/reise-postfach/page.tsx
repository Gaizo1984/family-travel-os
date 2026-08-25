import Link from "next/link";
import { ChevronLeft, ChevronRight, Users, Mail, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getCurrentPerson } from "@/lib/current-person";
import { createLumiCoreServiceClient } from "@/lib/supabase/lumi-core-service";
import { disconnectGmailConnection, testGmailConnection } from "@/lib/actions/gmail-connection";

/**
 * §Reise-Postfach, OAuth-Verbindungsfluss: zeigt jetzt den echten
 * Verbindungsstatus (travel_gmail_connections, keine RLS-Policy für
 * household-Mitglieder -- refresh_token ist ein Secret mit vollem
 * Postfachzugriff, deshalb Lesen hier über den Service-Role-Client, exakt
 * wie app/(app)/mehr/einstellungen/google-kalender/page.tsx in Lumi
 * Assistance). Die eigentliche Verarbeitungs-Übersicht (Verarbeitet/
 * Zuordnung prüfen/Fehler, s. travel_email_imports) bleibt weiterhin ein
 * separater, noch nicht gebauter nächster Schritt.
 */
export default async function ReisePostfachPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail_error?: string; gmail_connected?: string; gmail_test_checked?: string; gmail_test_allowed?: string; gmail_test_error?: string }>;
}) {
  const { gmail_error, gmail_connected, gmail_test_checked, gmail_test_allowed, gmail_test_error } = await searchParams;

  const person = await getCurrentPerson();
  if (!person) return null;

  const lumiCore = createLumiCoreServiceClient();
  const { data: connection } = await lumiCore
    .from("travel_gmail_connections")
    .select("gmail_account_email")
    .eq("household_id", person.familyId)
    .maybeSingle();

  return (
    <div className="flex-1" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-5 md:px-8 pb-24 pt-9">

        <Link
          href="/mehr"
          className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-70"
          style={{ color: "var(--muted)", fontSize: "0.78rem", letterSpacing: "0.04em", textDecoration: "none", width: "fit-content" }}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
          Mehr
        </Link>

        <h1 className="font-light mb-3" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Reise-Postfach
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1.6 }}>
          Weitergeleitete Buchungsbestätigungen sollen hier künftig automatisch erkannt,
          der richtigen Reise zugeordnet und gespeichert werden.
        </p>

        {gmail_error && (
          <div className="rounded-xl p-4 mb-4 flex items-start gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "3px solid #c0392b" }}>
            <AlertTriangle size={15} style={{ color: "#c0392b", flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: "0.78rem" }}>{gmail_error}</p>
          </div>
        )}
        {gmail_connected === "1" && !gmail_error && (
          <div className="rounded-xl p-4 mb-4 flex items-center gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "3px solid var(--accent)" }}>
            <CheckCircle2 size={15} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <p style={{ fontSize: "0.78rem" }}>Gmail-Postfach verbunden.</p>
          </div>
        )}
        {gmail_test_error && (
          <div className="rounded-xl p-4 mb-4 flex items-start gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "3px solid #c0392b" }}>
            <AlertTriangle size={15} style={{ color: "#c0392b", flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: "0.78rem" }}>Verbindungstest fehlgeschlagen: {gmail_test_error}</p>
          </div>
        )}
        {gmail_test_checked && !gmail_test_error && (
          <div className="rounded-xl p-4 mb-4 flex items-center gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "3px solid var(--accent)" }}>
            <CheckCircle2 size={15} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <p style={{ fontSize: "0.78rem" }}>
              Verbindungstest erfolgreich: {gmail_test_checked} Nachricht{gmail_test_checked === "1" ? "" : "en"} im Posteingang geprüft,
              {" "}{gmail_test_allowed ?? "0"} von einem erlaubten Absender.
            </p>
          </div>
        )}

        {!connection ? (
          <div className="rounded-xl p-6 mb-4 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <Mail size={18} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
              <p className="text-sm font-medium">Noch kein Gmail-Postfach verbunden</p>
            </div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Verbindet das dedizierte LUMI-Travel-Gmail-Postfach. Es wird nur Lesen/Verwalten von
              Nachrichten und Labels angefragt (kein Kalender-/Kontakte-/Drive-Zugriff).
            </p>
            {/* §Bugfix (Nutzer-Feedback: "Gmail verbinden meldet 404"): ein rohes
                <a href="/api/auth/gmail/start"> hängt den basePath ("/travel")
                NICHT automatisch an -- nur next/link tut das. prefetch={false},
                da diese Route echte Seiteneffekte hat (setzt das CSRF-state-
                Cookie, würde bei einem reinen Prefetch also unnötig/verwirrend
                mit ausgelöst). */}
            <Link
              href="/api/auth/gmail/start"
              prefetch={false}
              className="inline-block text-center"
              style={{ background: "var(--foreground)", color: "var(--surface)", border: "none", borderRadius: "6px", padding: "10px 18px", fontSize: "0.72rem", letterSpacing: "0.06em", cursor: "pointer", textDecoration: "none" }}
            >
              Gmail verbinden
            </Link>
          </div>
        ) : (
          <div className="rounded-xl p-6 mb-4 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div>
              <p className="text-sm font-medium">Verbunden als</p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>{connection.gmail_account_email}</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <form action={testGmailConnection}>
                <button
                  type="submit"
                  style={{ border: "1px solid var(--border)", background: "transparent", borderRadius: "6px", padding: "8px 14px", fontSize: "0.72rem", cursor: "pointer" }}
                >
                  Verbindung testen
                </button>
              </form>
              <form action={disconnectGmailConnection}>
                <button type="submit" style={{ border: "none", background: "transparent", color: "#c0392b", fontSize: "0.72rem", cursor: "pointer" }}>
                  Verbindung trennen
                </button>
              </form>
            </div>
          </div>
        )}

        <Link
          href="/mehr/reise-postfach/erlaubte-absender"
          className="flex items-center gap-4 p-4 rounded-xl transition-colors"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none" }}
        >
          <div className="shrink-0 flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: "var(--accent-subtle)" }}>
            <Users size={15} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Erlaubte Absender</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>Wer darf Buchungen weiterleiten</div>
          </div>
          <ChevronRight size={15} strokeWidth={1.4} style={{ color: "var(--muted)" }} />
        </Link>

      </div>
    </div>
  );
}
