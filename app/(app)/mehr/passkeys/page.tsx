import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PasskeyManager } from "@/components/PasskeyManager";

export default function PasskeysPage() {
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

        <div style={{ color: "var(--accent)", fontSize: "0.55rem", letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: "12px" }}>
          Sicherheit
        </div>
        <h1 className="font-light mb-2" style={{ color: "var(--foreground)", fontSize: "1.4rem", letterSpacing: "0.01em" }}>
          Passkeys verwalten
        </h1>
        <p className="mb-8" style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.5 }}>
          Mit einem Passkey meldet ihr euch per Fingerabdruck, Gesichtserkennung oder Gerätecode an —
          ohne Passwort. Das Passwort bleibt weiterhin nutzbar.
        </p>

        <PasskeyManager />

      </div>
    </div>
  );
}
