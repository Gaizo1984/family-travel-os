import Link from "next/link";
import { login } from "@/lib/actions/auth";
import { Banner } from "@/components/Banner";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";
import { PasskeyLoginButton } from "@/components/PasskeyLoginButton";
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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const { error, reset } = await searchParams;

  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm px-5 py-9">
        <div className="text-center mb-8">
          <div style={{ color: "var(--accent)", fontSize: "0.6rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "8px" }}>
            LUMI
          </div>
          <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "-0.01em" }}>
            Anmelden
          </h1>
        </div>

        {error && <Banner variant="error">{error}</Banner>}
        {reset && <Banner variant="success">Passwort erfolgreich geändert. Bitte melde dich mit dem neuen Passwort an.</Banner>}

        <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <PasskeyLoginButton />
          <form action={login}>
            <div className="mb-5">
              <label htmlFor="login-email" style={LABEL_STYLE}>E-Mail</label>
              <input id="login-email" name="email" type="email" autoComplete="email" required style={FIELD_STYLE} />
            </div>
            <div className="mb-2">
              <label htmlFor="login-password" style={LABEL_STYLE}>Passwort</label>
              <PasswordField id="login-password" name="password" autoComplete="current-password" required style={FIELD_STYLE} />
            </div>
            <div className="mb-5 text-right">
              <Link href="/login/reset" style={{ color: "var(--accent)", fontSize: "0.7rem", textDecoration: "none" }}>
                Passwort vergessen?
              </Link>
            </div>
            <SubmitButtonWithProgress label="Anmelden" pendingLabel="Wird angemeldet …" style={{ width: "100%", justifyContent: "center" }} />
          </form>
        </div>
      </div>
    </div>
  );
}
