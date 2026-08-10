import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // §"App-like Lumi Travel": Next.js Multi-Zones -- diese App läuft künftig
  // server-seitig transparent unter /travel auf der Lumi-Launcher-Origin
  // (next.config.ts dort: rewrites() -> family-travel-os-xi.vercel.app).
  // basePath hängt automatisch /travel vor next/link, next/navigation's
  // redirect(), alle App-Router-Routen (inkl. Metadata-Routen wie
  // manifest.ts) und generierte /_next/static-Asset-URLs -- keine
  // Codeänderung an der eigentlichen Navigations-/Fachlogik nötig, da diese
  // bereits durchgängig root-relativ ist. Kein separates assetPrefix nötig,
  // da keine andere Zone /travel/_next beansprucht.
  basePath: "/travel",
  // §Root-Cause-Fix Broken-Image-Bug: sharp ist ein natives Binary-Addon.
  // Ohne diese Angabe kann Next.js' Serverless-Bundling (File-Tracing) die
  // native Binary beim Deploy auf Vercel falsch/unvollständig einpacken —
  // lief lokal (next start) immer korrekt, weil dort direkt die lokal
  // installierte Binary genutzt wird, nie der tatsächliche Vercel-Bundling-
  // Pfad. Genau das erklärt, warum die Kompression nur in echter Produktion
  // korrupte Bilddaten erzeugte.
  // §Content Studio 3.0, Sprint 5: `@remotion/lambda` zieht transitiv
  // `@remotion/renderer`/`@remotion/cli` nach, die plattformspezifische
  // native Compositor-Binaries per `require()` laden (analog zu `sharp`
  // oben) -- ohne diesen Eintrag versucht Next.js' Bundler, diese `require`-
  // Aufrufe statisch aufzulösen, und schlägt fehl, weil die Linux-Binaries
  // lokal (Windows-Dev) gar nicht installiert sind.
  serverExternalPackages: ["sharp", "@remotion/lambda"],
  // §Content Studio 3.0, Sprint 0b (Infrastruktur-Spike): das Remotion-Bundle
  // wird per "prebuild"-Skript (NICHT "postbuild"!) VOR `next build` einmalig
  // nach remotion/.output/ erzeugt (bundle() selbst darf laut Remotion-Doku
  // NICHT innerhalb einer Serverless-Function laufen -- deshalb Build-Zeit
  // statt Request-Zeit). §Bugfix (in diesem Sprint selbst gefunden): mit
  // "postbuild" existierte remotion/.output beim eigentlichen File-Tracing
  // während `next build` noch gar nicht -- outputFileTracingIncludes wertet
  // nur zu DIESEM Zeitpunkt vorhandene Dateien aus, ein "postbuild"-Skript
  // läuft zu spät. Ohne diesen Eintrag (und die richtige Reihenfolge) würde
  // das Bundle beim Deploy NICHT mit ausgeliefert und die Server Action
  // fände zur Laufzeit keine Bundle-Datei -- exakt dasselbe Grundmuster wie
  // serverExternalPackages oben für die native sharp-Binary.
  // §Content Studio 3.0, Sprint 5: der Render-Trigger (lib/actions/reel-render.ts,
  // von /content-studio/reel/[projectId]/render aus aufgerufen) braucht das
  // Bundle zur Laufzeit ebenso wie der bisherige Dev-Test unter
  // /mehr/developer -- ohne einen eigenen Eintrag hier würde Next.js'
  // File-Tracing das Bundle für DIESE Route beim Vercel-Deploy nicht
  // mitausliefern (siehe Bugfix-Kommentar unten).
  outputFileTracingIncludes: {
    "/mehr/developer": ["remotion/.output/**/*"],
    "/content-studio/reel/[projectId]/render": ["remotion/.output/**/*"],
  },
  experimental: {
    serverActions: {
      // Next.js begrenzt Server-Action-Request-Bodies standardmäßig auf 1 MB —
      // deutlich unter typischen Handyfotos (2-8 MB). Das Limit gilt für den
      // GESAMTEN Request-Body, nicht pro Datei — bei Mehrfach-Uploads (Content
      // Studio/Travel Memory, bis zu 20 Fotos) reichte 15 MB nicht aus und
      // ließ den Upload schon auf Framework-Ebene scheitern, bevor die
      // eigene Pro-Datei-Validierung greifen konnte.
      bodySizeLimit: "50mb",
      // §"App-like Lumi Travel": Next.js prüft bei Server Actions den
      // Origin-Header gegen Host/X-Forwarded-Host (CSRF-Schutz). Hinter dem
      // Multi-Zones-Proxy sieht diese App als Host die Lumi-Launcher-Origin,
      // nicht ihre eigene Domain -- ohne diesen Eintrag würden dadurch ALLE
      // Server Actions (nahezu jede Mutation der App) mit einem Origin-Fehler
      // abgelehnt. localhost:3006 zusätzlich für den lokalen Multi-Zones-Test.
      //
      // §Preview-Testrunde: die Lumi-Launcher-PRODUCTION-Domain allein reicht
      // für einen Preview-Test nicht -- der Launcher läuft dort unter einer
      // eigenen, wechselnden Vercel-Preview-URL. TRAVEL_ALLOWED_SERVER_ACTION_ORIGINS
      // (serverseitige, kommagetrennte Environment Variable, pro Vercel-
      // Environment einzeln setzbar) ergänzt/ersetzt die feste Liste, ohne
      // diese Datei je Testrunde anfassen zu müssen.
      allowedOrigins: process.env.TRAVEL_ALLOWED_SERVER_ACTION_ORIGINS
        ? process.env.TRAVEL_ALLOWED_SERVER_ACTION_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
        : ["lumi-launcher.vercel.app", "localhost:3006"],
    },
  },
  // §Bugfix "Service-Worker-Update erreicht das installierte App-Icon nicht
  // zuverlässig": manche Android/Chrome-Kombinationen führen den üblichen
  // Byte-Vergleich von /sw.js bei Standalone-gestarteten PWAs erkennbar
  // nicht zuverlässig/rechtzeitig aus (bestätigt per Live-Test -- weder
  // Warten noch Löschen der Chrome-Website-Daten hat geholfen). Fix: die
  // Registrierungs-URL selbst wird pro Deploy eindeutig gemacht (siehe
  // ServiceWorkerRegistration.tsx), das umgeht die Update-Heuristik
  // komplett. VERCEL_GIT_COMMIT_SHA wird von Vercel automatisch gesetzt,
  // aber nicht ohne explizites Re-Exposing im Client-Bundle sichtbar.
  env: {
    NEXT_PUBLIC_SW_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now()),
  },
  // §"Service Worker nur für Offline-Reisen" (Nutzervorgabe): exakt die von
  // der offiziellen Next.js-16-PWA-Doku empfohlene Konfiguration für
  // public/sw.js -- der Browser muss bei jedem Start die aktuelle Service-
  // Worker-Datei selbst prüfen, statt eine veraltete Version zu behalten.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
