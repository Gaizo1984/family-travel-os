// §Lumi Home Navigation: kanonische Launcher-Root, zu der der "Lumi Home"-
// Button zurückführt. Bewusst eine einzige, klar benannte Konstante statt
// mehrfach hartcodierter URLs -- der bestehende bare-Hostname-String in
// next.config.ts (serverActions.allowedOrigins) ist ein CSRF-Allowlist-Eintrag,
// kein für Links geeigneter Wert.
export const LUMI_LAUNCHER_URL = "https://lumi-launcher.vercel.app/";
