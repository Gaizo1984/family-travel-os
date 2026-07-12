/**
 * Security Foundation 1A: schlankes, nav-freies Layout für Login/
 * Passwort-Reset -- kein eigenes html/body (bleibt einzig in
 * app/layout.tsx), keine Sidebar/Bottom-Nav/RoutePrefetcher.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex-1 flex flex-col min-w-0">{children}</main>;
}
