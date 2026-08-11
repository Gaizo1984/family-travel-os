import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { SplashScreen } from "@/components/SplashScreen";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { BASE_PATH } from "@/lib/base-path";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

// §"App-like Lumi Travel": `metadata.icons`-URLs sind normale, vom
// Entwickler angegebene Strings -- basePath schreibt sie NICHT automatisch
// um (anders als next/link/redirect()), deshalb hier manuell vorangestellt.
export const metadata: Metadata = {
  title: "Lumi Travel",
  description: "Family Travel OS – eure private Familien-Reise-App",
  appleWebApp: {
    capable: true,
    title: "Lumi Travel",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: `${BASE_PATH}/icons/apple-icon-180.png`,
    other: [
      {
        rel: "apple-touch-startup-image",
        url: `${BASE_PATH}/splash/splash-1170x2532.jpg`,
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        rel: "apple-touch-startup-image",
        url: `${BASE_PATH}/splash/splash-1668x2388.jpg`,
        media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        rel: "apple-touch-startup-image",
        url: `${BASE_PATH}/splash/splash-1170x2532.jpg`,
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#E8E3DA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${geist.variable} h-full`}>
      <body
        className="min-h-screen flex flex-col md:flex-row"
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      >
        <SplashScreen />
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
