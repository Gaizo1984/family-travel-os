import Link from "next/link";
import { Users, CloudDownload, Images, Fingerprint, ChevronRight, TerminalSquare, type LucideIcon } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";

interface MoreLink {
  href: string;
  label: string;
  description: string;
  Icon: LucideIcon;
}

// §"Neue Reiseideen und Frag LUMI ins Dashboard LUMI integrieren": beide
// sind hier raus, jetzt als Icon-Kacheln direkt auf /today erreichbar
// (analog zu den dortigen Kategorien) statt in der Mehr-Übersicht.
// §"Buchungsportal entfernen" (Nutzervorgabe, kombinierter Fix-Sprint): kein
// eigenes Datenmodell, dupliziert /discover/hotels, keine echte Flugsuche --
// Merkliste schrieb bereits in journey_events (status='idea'), diese Zeilen
// bleiben in der Journey der jeweiligen Reise erhalten. Ersetzt durch
// "Offline-Reisen" (neues Feature, siehe app/(app)/mehr/offline-reisen).
const MORE_LINKS: MoreLink[] = [
  { href: "/family", label: "Familie", description: "Reiseprofile & Vorlieben", Icon: Users },
  { href: "/mehr/offline-reisen", label: "Offline-Reisen", description: "Gespeicherte Reisen ohne Verbindung nutzen", Icon: CloudDownload },
  { href: "/memories", label: "Travel Memory", description: "Eure gemeinsame Reisegalerie", Icon: Images },
  { href: "/mehr/passkeys", label: "Passkeys verwalten", description: "Anmeldung per Fingerabdruck oder Gesichtserkennung", Icon: Fingerprint },
  { href: "/mehr/developer", label: "Developer", description: "Serverseitige Testmodule für neue Integrationen", Icon: TerminalSquare },
];

export default function MehrPage() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 px-5 md:px-8 pb-16 max-w-4xl w-full mx-auto">
        <header className="flex items-start justify-between gap-4 pt-9 pb-9">
          <div>
            <h1
              className="text-2xl font-light mb-1"
              style={{ color: "var(--foreground)", letterSpacing: "0.01em" }}
            >
              Mehr
            </h1>
            <p
              className="text-xs"
              style={{ color: "var(--muted)", letterSpacing: "0.08em", fontSize: "0.7rem" }}
            >
              Weitere Bereiche von LUMI
            </p>
          </div>
          <LogoutButton />
        </header>

        <div className="flex flex-col gap-3">
          {MORE_LINKS.map(({ href, label, description, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 rounded-xl px-5 py-5"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div
                className="flex items-center justify-center shrink-0 rounded-full"
                style={{ width: "40px", height: "40px", background: "var(--accent-subtle)" }}
              >
                <Icon size={18} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ color: "var(--foreground)", fontSize: "0.95rem" }}>{label}</div>
                <div style={{ color: "var(--muted)", fontSize: "0.72rem", letterSpacing: "0.02em" }}>
                  {description}
                </div>
              </div>
              <ChevronRight size={16} strokeWidth={1.5} style={{ color: "var(--muted)", flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
