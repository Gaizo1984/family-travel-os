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
    // §Splash-Bild-Ersatz (Nutzervorgabe): neues Motiv ersetzt die
    // bisherigen zwei geräte-spezifischen JPGs (splash-1170x2532/
    // splash-1668x2388) -- nur noch eine Bilddatei, deshalb ohne
    // Geräte-Media-Queries für exakte native Pixelmaße. Reine iOS-
    // Zusatzoptimierung (natives Startbild vor dem JS-Splash); die
    // eigentliche, plattformübergreifende Anzeige läuft weiterhin über
    // components/SplashScreen.tsx.
    other: [
      {
        rel: "apple-touch-startup-image",
        url: `${BASE_PATH}/splash/splash-travel.png`,
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
