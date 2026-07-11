import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // §Root-Cause-Fix Broken-Image-Bug: sharp ist ein natives Binary-Addon.
  // Ohne diese Angabe kann Next.js' Serverless-Bundling (File-Tracing) die
  // native Binary beim Deploy auf Vercel falsch/unvollständig einpacken —
  // lief lokal (next start) immer korrekt, weil dort direkt die lokal
  // installierte Binary genutzt wird, nie der tatsächliche Vercel-Bundling-
  // Pfad. Genau das erklärt, warum die Kompression nur in echter Produktion
  // korrupte Bilddaten erzeugte.
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: {
      // Next.js begrenzt Server-Action-Request-Bodies standardmäßig auf 1 MB —
      // deutlich unter typischen Handyfotos (2-8 MB). Das Limit gilt für den
      // GESAMTEN Request-Body, nicht pro Datei — bei Mehrfach-Uploads (Content
      // Studio/Travel Memory, bis zu 20 Fotos) reichte 15 MB nicht aus und
      // ließ den Upload schon auf Framework-Ebene scheitern, bevor die
      // eigene Pro-Datei-Validierung greifen konnte.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
