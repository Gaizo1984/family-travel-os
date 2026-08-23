import Link from "next/link";
import { ChevronLeft, ChevronRight, Users, Inbox } from "lucide-react";

/**
 * §Reise-Postfach, Schritt 1: nur der Einstieg + "Erlaubte Absender".
 * Die eigentliche Verarbeitungs-Übersicht (Verarbeitet/Zuordnung prüfen/
 * Fehler, s. travel_email_imports) kommt erst mit der Gmail-Anbindung in
 * einem späteren Schritt -- hier bewusst noch keine Liste mit
 * (zwangsläufig leeren) Zahlen vorgetäuscht, solange dahinter noch keine
 * echte Verarbeitung läuft.
 */
export default function ReisePostfachPage() {
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

        <div className="rounded-xl p-5 mb-4" style={{ background: "var(--accent-subtle)", border: "1px solid var(--border)" }}>
          <p style={{ color: "var(--foreground)", fontSize: "0.78rem", lineHeight: 1.6 }}>
            Die Gmail-Anbindung ist noch nicht eingerichtet — hier lässt sich aktuell nur
            festlegen, welche Absender später verarbeitet werden dürfen.
          </p>
        </div>

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

        <div
          className="flex items-center gap-4 p-4 rounded-xl mt-3"
          style={{ background: "var(--surface)", border: "1px dashed var(--border)", opacity: 0.6 }}
        >
          <div className="shrink-0 flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: "var(--accent-subtle)" }}>
            <Inbox size={15} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Verarbeitete E-Mails</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>Folgt mit der Gmail-Anbindung</div>
          </div>
        </div>

      </div>
    </div>
  );
}
