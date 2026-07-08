import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { LayoutDashboard, Plane, Users, Sun, Camera, Compass, MessageSquare } from "lucide-react";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Family Travel OS",
  description: "Unsere private Familien-Reise-App",
};

const NAV = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/trips", label: "Reisen", Icon: Plane },
  { href: "/family", label: "Familie", Icon: Users },
  { href: "/today", label: "Heute", Icon: Sun },
  { href: "/content-studio", label: "Content", Icon: Camera },
  { href: "/discover", label: "Entdecken", Icon: Compass },
  { href: "/concierge", label: "Concierge", Icon: MessageSquare },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${geist.variable} h-full`}>
      <body
        className="min-h-screen flex flex-col md:flex-row"
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      >
        {/* Sidebar — desktop */}
        <aside
          className="hidden md:flex flex-col w-52 shrink-0"
          style={{ borderRight: "1px solid var(--border)", background: "var(--surface-2)" }}
        >
          {/* Logo */}
          <div className="px-7 py-8" style={{ borderBottom: "1px solid var(--border)" }}>
            <div
              className="text-xs font-medium tracking-widest uppercase"
              style={{ color: "var(--muted)", letterSpacing: "0.2em" }}
            >
              Family
            </div>
            <div
              className="text-sm font-semibold tracking-widest uppercase mt-0.5"
              style={{ color: "var(--accent)", letterSpacing: "0.22em" }}
            >
              Travel OS
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
        <main className="flex-1 flex flex-col min-w-0 pb-14 md:pb-0">{children}</main>

        {/* Bottom nav — mobile */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 flex z-50"
          style={{ background: "var(--background)", borderTop: "1px solid var(--border)" }}
        >
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors"
              style={{ color: "var(--muted)", letterSpacing: "0.06em" }}
            >
              <Icon size={16} strokeWidth={1.5} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </body>
    </html>
  );
}
