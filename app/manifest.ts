import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/base-path";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lumi Travel",
    short_name: "Lumi Travel",
    description: "Family Travel OS – eure private Familien-Reise-App",
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    background_color: "#E8E3DA",
    theme_color: "#E8E3DA",
    lang: "de",
    icons: [
      { src: `${BASE_PATH}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${BASE_PATH}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
      {
        src: `${BASE_PATH}/icons/icon-512-maskable.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
