import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createLumiCoreClient } from "@/lib/supabase/lumi-core-server";
import { establishLumiCoreSession } from "@/lib/actions/lumi-core";
import { TRAVEL_RETURN_TO_COOKIE } from "@/lib/passkey-lumi-core-gate";
import { Banner } from "@/components/Banner";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";
import { PasswordField } from "@/components/PasswordField";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

/**
 * Übergangs-Gate für Passkey-Logins (siehe proxy.ts,
 * PASSKEY_PENDING_LC_COOKIE): Travel-Passkey authentifiziert nur gegen
 * Travel, nie gegen Lumi Core (Lumi Core hat kein eigenes Passkey/WebAuthn).
 * Diese Seite fordert nach einem Passkey-Login zwingend eine ECHTE,
 * separate Lumi-Core-Anmeldung nach -- kein automatischer Login, keine
 * übertragenen Zugangsdaten, keine Service-Role, keine stille
 * Hintergrund-Session. Normales Passwort-Login bleibt davon unberührt
 * (läuft bis zum finalen Cutover weiterhin nur über Travel, siehe
 * lib/actions/auth.ts).
 */
export default async function ConnectLumiCorePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo } = await searchParams;
  const target = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/";

  const lumiCore = await createLumiCoreClient();
  const {
    data: { user },
  } = await lumiCore.auth.getUser();
  if (user) {
    // §"App-like Lumi Travel": Cookies dürfen in einer Server-Component-
    // Render-Funktion nur GELESEN werden (Schreiben/Löschen ist Server
    // Actions/Route Handlern vorbehalten) -- deshalb hier nur Lesezugriff,
    // im Gegensatz zu establishLumiCoreSession() (siehe lib/travel-return-to.ts).
    const returnTo = (await cookies()).get(TRAVEL_RETURN_TO_COOKIE)?.value;
    redirect(returnTo || target);
  }

  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm px-5 py-9">
        <div className="text-center mb-8">
          <div style={{ color: "var(--accent)", fontSize: "0.6rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "8px" }}>
            LUMI CORE
          </div>
          <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "-0.01em" }}>
            Zusätzliche Anmeldung erforderlich
          </h1>
          <p className="mt-3" style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.5 }}>
            Du bist per Passkey bei Travel angemeldet. Für den Zugriff auf deine Daten wird zusätzlich eine
            Lumi-Core-Anmeldung benötigt.
          </p>
        </div>

        {error && <Banner variant="error">{error}</Banner>}

        <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <form action={establishLumiCoreSession}>
            <input type="hidden" name="redirectTo" value={target} />
            <div className="mb-5">
              <label htmlFor="lc-email" style={LABEL_STYLE}>Lumi-Core-E-Mail</label>
              <input id="lc-email" name="email" type="email" autoComplete="email" required style={FIELD_STYLE} />
            </div>
            <div className="mb-5">
              <label htmlFor="lc-password" style={LABEL_STYLE}>Lumi-Core-Passwort</label>
              <PasswordField id="lc-password" name="password" autoComplete="current-password" required style={FIELD_STYLE} />
            </div>
            <SubmitButtonWithProgress label="Bei Lumi Core anmelden" pendingLabel="Wird angemeldet …" style={{ width: "100%", justifyContent: "center" }} />
          </form>
        </div>
      </div>
    </div>
  );
}
