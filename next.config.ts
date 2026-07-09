import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Next.js begrenzt Server-Action-Request-Bodies standardmäßig auf 1 MB —
      // deutlich unter typischen Handyfotos (2-8 MB). Ohne diese Anhebung
      // scheitert der Upload bereits auf Framework-Ebene, bevor die eigene
      // 10-MB-Validierung in lib/documents.ts greifen kann.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
