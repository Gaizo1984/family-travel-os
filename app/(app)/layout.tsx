import Link from "next/link";
import { LayoutDashboard, Plane, Users, Sparkles, Camera, MoreHorizontal, Images, LayoutGrid } from "lucide-react";
import { RoutePrefetcher } from "@/components/RoutePrefetcher";
import { LUMI_LAUNCHER_URL } from "@/lib/launcher-url";

// §"Neue Reiseideen und Frag LUMI sollen ins Dashboard LUMI integriert
// werden": beide sind keine eigenen Nav-Einträge mehr (weder Sidebar noch
// "Mehr") -- stattdessen zwei zusätzliche Kacheln im Icon-Grid auf /today,
// analog zu den dortigen Kategorien (Aktivitäten, Restaurants, ...). Die
// Zielseiten /discover und /concierge bleiben unverändert bestehen, nur
// ohne eigenen Nav-Einstieg.
const NAV = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/trips", label: "Reisen", Icon: Plane },
  { href: "/family", label: "Familie", Icon: Users },
  { href: "/today", label: "LUMI", Icon: Sparkles },
  { href: "/content-studio", label: "Content", Icon: Camera },
  { href: "/memories", label: "Memory", Icon: Images },
];

// Mobile Bottom-Nav: nur die 4 häufigsten Bereiche direkt anzeigen (sonst zu
// schmale Touch-Flächen bei 7 Icons in einer Reihe) — der Rest liegt unter „Mehr".
const MOBILE_NAV = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/trips", label: "Reisen", Icon: Plane },
  { href: "/today", label: "LUMI", Icon: Sparkles },
  { href: "/content-studio", label: "Content", Icon: Camera },
  { href: "/mehr", label: "Mehr", Icon: MoreHorizontal },
];

/**
 * Security Foundation 1A: App-Shell (Sidebar/Bottom-Nav/RoutePrefetcher) --
 * verschachteltes Layout innerhalb der (app)-Route-Group, kein eigenes
 * html/body (das bleibt einzig in app/layout.tsx). Läuft nicht für
 * (auth)-Routen (Login/Passwort-Reset), die ein eigenes, nav-freies
 * Layout haben.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RoutePrefetcher />

      {/* Sidebar — desktop */}
      <aside
        className="hidden md:flex flex-col w-52 shrink-0"
        style={{ borderRight: "1px solid var(--border)", background: "var(--surface-2)" }}
      >
        {/* Logo + Lumi-Home-Link (§Lumi Home Navigation: einheitlicher Rückweg
            zum Launcher, hier im gemeinsamen Sidebar-Header integriert, damit
            er automatisch auf jeder Unterseite verfügbar ist, ohne pro Seite
            dupliziert zu werden). */}
        <div className="px-7 py-8 flex items-start justify-between gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <div
              className="text-sm font-semibold tracking-widest uppercase"
              style={{ color: "var(--accent)", letterSpacing: "0.22em" }}
            >
              LUMI
            </div>
            <div
              className="text-xs font-medium tracking-widest uppercase mt-0.5"
              style={{ color: "var(--muted)", letterSpacing: "0.2em" }}
            >
              Family Travel OS
            </div>
          </div>
          <a
            href={LUMI_LAUNCHER_URL}
            aria-label="Lumi Home"
            title="Lumi Home"
            style={{
              width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "50%",
              color: "var(--muted)",
            }}
          >
            <LayoutGrid size={15} strokeWidth={1.6} />
          </a>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-0.5">
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className="nav-link">
              <Icon size={14} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div
          className="px-7 py-5 text-xs"
          style={{ borderTop: "1px solid var(--border)", color: "var(--muted)", letterSpacing: "0.04em" }}
        >
          Familie Gaitanidis
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 pb-safe-nav md:pb-0">{children}</main>

      {/* Lumi-Home-Link — mobile (Sidebar mit dem Desktop-Pendant ist hier
          "hidden md:flex", braucht daher ein eigenes, kleines Gegenstück statt
          Duplizierung auf jeder einzelnen Seite). Fixed oben rechts, bewusst
          klein/dezent (32px) und mit sichtbarem Abstand zum Seiteninhalt, um
          eigene Header-Aktionen einzelner Seiten (z.B. Abmelden auf /mehr)
          nicht zu verdecken. */}
      <a
        href={LUMI_LAUNCHER_URL}
        aria-label="Lumi Home"
        title="Lumi Home"
        className="md:hidden fixed z-50"
        style={{
          top: "12px", right: "12px", width: "32px", height: "32px",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "50%",
          color: "var(--muted)", boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}
      >
        <LayoutGrid size={15} strokeWidth={1.6} />
      </a>

      {/* Bottom nav — mobile */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex z-50"
        style={{
          background: "var(--background)",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          minHeight: "var(--bottom-nav-height)",
        }}
      >
        {MOBILE_NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs transition-colors"
            style={{ color: "var(--muted)", letterSpacing: "0.06em", minHeight: "44px", minWidth: 0 }}
          >
            <Icon size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              {label}
            </span>
          </Link>
        ))}
      </nav>
    </>
  );
}
