import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/auth";
import { Banner } from "@/components/Banner";
import { SubmitButtonWithProgress } from "@/components/SubmitButtonWithProgress";

const LABEL_STYLE: React.CSSProperties = {
  display: "block", color: "var(--muted)", fontSize: "0.55rem",
  letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px",
};
const FIELD_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "var(--background)",
  border: "1px solid var(--border)", borderRadius: "8px", color: "var(--foreground)",
  fontSize: "0.9rem", fontWeight: 300, outline: "none",
};

export default async function RequestPasswordResetPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm px-5 py-9">
        <div className="text-center mb-8">
          <div style={{ color: "var(--accent)", fontSize: "0.6rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "8px" }}>
            LUMI
          </div>
          <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "-0.01em" }}>
            Passwort vergessen
          </h1>
        </div>

        {error && <Banner variant="error">{error}</Banner>}
        {sent && (
          <Banner variant="success">
            Falls diese E-Mail-Adresse bei uns bekannt ist, wurde ein Link zum Zurücksetzen verschickt.
          </Banner>
        )}

        <form action={requestPasswordReset}>
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="mb-5">
              <label htmlFor="reset-email" style={LABEL_STYLE}>E-Mail</label>
              <input id="reset-email" name="email" type="email" autoComplete="email" required style={FIELD_STYLE} />
            </div>
            <SubmitButtonWithProgress label="Link anfordern" pendingLabel="Wird gesendet …" style={{ width: "100%", justifyContent: "center" }} />
          </div>
        </form>

        <div className="mt-5 text-center">
          <Link href="/login" style={{ color: "var(--accent)", fontSize: "0.7rem", textDecoration: "none" }}>
            Zurück zur Anmeldung
          </Link>
        </div>
      </div>
    </div>
  );
}
