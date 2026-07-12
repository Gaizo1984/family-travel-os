import { updatePassword } from "@/lib/actions/auth";
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

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm px-5 py-9">
        <div className="text-center mb-8">
          <div style={{ color: "var(--accent)", fontSize: "0.6rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "8px" }}>
            LUMI
          </div>
          <h1 className="font-light" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "-0.01em" }}>
            Neues Passwort
          </h1>
        </div>

        {error && <Banner variant="error">{error}</Banner>}

        <form action={updatePassword}>
          <div className="rounded-xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="mb-5">
              <label htmlFor="new-password" style={LABEL_STYLE}>Neues Passwort</label>
              <PasswordField id="new-password" name="password" autoComplete="new-password" minLength={10} required style={FIELD_STYLE} />
            </div>
            <div className="mb-5">
              <label htmlFor="new-password-confirm" style={LABEL_STYLE}>Passwort bestätigen</label>
              <PasswordField id="new-password-confirm" name="password_confirm" autoComplete="new-password" minLength={10} required style={FIELD_STYLE} />
            </div>
            <SubmitButtonWithProgress label="Passwort speichern" pendingLabel="Wird gespeichert …" style={{ width: "100%", justifyContent: "center" }} />
          </div>
        </form>
      </div>
    </div>
  );
}
