import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { SplashScreen } from "@/components/SplashScreen";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lumi Travel",
  description: "Family Travel OS – eure private Familien-Reise-App",
  appleWebApp: {
    capable: true,
    title: "Lumi Travel",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-icon-180.png",
    other: [
      {
        rel: "apple-touch-startup-image",
        url: "/splash/splash-1170x2532.png",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        rel: "apple-touch-startup-image",
        url: "/splash/splash-1668x2388.png",
        media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        rel: "apple-touch-startup-image",
        url: "/splash/splash-1170x2532.png",
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
        {children}
      </body>
    </html>
  );
}
