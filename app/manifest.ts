import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Family Travel OS",
    short_name: "Travel OS",
    description: "Unsere private Familien-Reise-App",
    start_url: "/",
    display: "standalone",
    background_color: "#E8E3DA",
    theme_color: "#E8E3DA",
    lang: "de",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
