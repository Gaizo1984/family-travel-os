import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
