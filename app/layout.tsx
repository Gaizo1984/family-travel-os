import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { BASE_PATH } from "@/lib/base-path";
import "./globals.css";

// §Bugfix (Nutzer-Feedback aus Lumi Assistance, gilt für die ganze
// Lumi-Familie: "kurz erscheint das Dashboard, bevor der Splashscreen
// kommt"): die bisherige React-Komponente (components/SplashScreen.tsx)
// entschied per useEffect erst NACH der Hydration, ob der Splash gezeigt
// wird -- der Browser malt die vom Server gerenderte Seite aber bereits VOR
// dem Laden/Ausführen von React einmal roh, dieses erste Paint lässt sich
// durch keinen React-Hook (auch nicht useLayoutEffect) mehr verhindern.
// Einzige zuverlässige Lösung: ein synchrones, blockierendes Inline-<script>
// als buchstäblich ERSTES Element in <body> -- der Browser pausiert das
// weitere Parsen/Malen der restlichen Seite, bis dieses Script fertig ist,
// wodurch der Splash-Overlay bereits im allerersten Frame sichtbar ist,
// falls nötig. Läuft komplett DOM-basiert, unabhängig von React/Hydration
// -- ersetzt die bisherige Komponente vollständig.
const SPLASH_SCRIPT = `(function(){
  try {
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (!standalone) return;
    var KEY = 'lumi-travel-splash-shown';
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, '1');
  } catch (e) { return; }
  var TOTAL = 2500, FADE = 300;
  var style = document.createElement('style');
  style.textContent = '@keyframes lumiSplashFade{0%{opacity:0}' + ((FADE/TOTAL)*100) + '%{opacity:1}' + (((TOTAL-FADE)/TOTAL)*100) + '%{opacity:1}100%{opacity:0}}';
  document.head.appendChild(style);
  var div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;z-index:999;overflow:hidden;background:#E8E3DA;animation:lumiSplashFade ' + TOTAL + 'ms ease forwards;pointer-events:none';
  var img = document.createElement('img');
  img.src = '${BASE_PATH}/splash/splash-travel.png';
  img.alt = '';
  img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
  div.appendChild(img);
  document.body.appendChild(div);
  setTimeout(function(){ div.remove(); style.remove(); }, TOTAL + 50);
})();`;

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
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
