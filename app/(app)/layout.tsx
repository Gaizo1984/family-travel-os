import Link from "next/link";
import { LayoutDashboard, Plane, Users, Sun, Camera, Compass, MessageSquare, MoreHorizontal, BookOpenCheck, Images, LogOut } from "lucide-react";
import { RoutePrefetcher } from "@/components/RoutePrefetcher";
import { logout } from "@/lib/actions/auth";

const NAV = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/trips", label: "Reisen", Icon: Plane },
  { href: "/family", label: "Familie", Icon: Users },
  { href: "/today", label: "Heute", Icon: Sun },
  { href: "/content-studio", label: "Content", Icon: Camera },
  { href: "/discover", label: "Entdecken", Icon: Compass },
  { href: "/buchungsportal", label: "Buchungsportal", Icon: BookOpenCheck },
  { href: "/memories", label: "Memory", Icon: Images },
  { href: "/concierge", label: "Concierge", Icon: MessageSquare },
];

// Mobile Bottom-Nav: nur die 4 häufigsten Bereiche direkt anzeigen (sonst zu
// schmale Touch-Flächen bei 7 Icons in einer Reihe) — der Rest liegt unter „Mehr".
const MOBILE_NAV = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/trips", label: "Reisen", Icon: Plane },
  { href: "/today", label: "Heute", Icon: Sun },
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

      {/* Logout — permanent oben rechts auf jeder geschützten Seite, dezent
          (keine Warnfarbe). Nutzt die bestehende logout-Server-Action direkt,
          keine zweite Logout-Logik. */}
      <form
        action={logout}
        style={{ position: "fixed", top: "max(16px, env(safe-area-inset-top))", right: "16px", zIndex: 40 }}
      >
        <button
          type="submit"
          aria-label="Abmelden"
          style={{
            width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "50%",
            color: "var(--muted)", cursor: "pointer", WebkitAppearance: "none", appearance: "none",
          }}
        >
          <LogOut size={16} strokeWidth={1.6} />
        </button>
      </form>

      {/* Sidebar — desktop */}
      <aside
        className="hidden md:flex flex-col w-52 shrink-0"
        style={{ borderRight: "1px solid var(--border)", background: "var(--surface-2)" }}
      >
        {/* Logo */}
        <div className="px-7 py-8" style={{ borderBottom: "1px solid var(--border)" }}>
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
