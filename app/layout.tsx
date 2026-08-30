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
// falls nötig.
//
// §Bugfix (Nutzer-Feedback, Folgefehler: "App friert in der installierten
// PWA ein, Dashboard-Wechsel/Reise-Klick reagieren nicht -- nur in der
// installierten App, im Browser-Tab unauffällig, harter Neustart hilft
// nicht"): die ursprüngliche Fassung dieses Scripts erzeugte den Splash-Div
// per document.body.appendChild() -- ein DOM-Knoten, den React beim
// Hydratisieren nicht kennt (er ist nirgends Teil von RootLayouts JSX). Da
// dieser Zweig NUR im Standalone-Modus (installierte App) überhaupt lief,
// deckt sich das exakt mit dem beobachteten Muster. Ein solcher body-fremder
// Knoten kann beim Hydratisieren zu einem Mismatch führen, der Klick-Handler
// in der ganzen App durcheinanderbringt. Fix: der Splash-Div ist jetzt fest
// Teil dieser Komponente (s. JSX unten, React kennt/besitzt ihn vollständig,
// per Default unsichtbar über app/globals.css) -- dieses Script mutiert nur
// noch <head> (eine <style>-Regel zeitlich befristet ein-/ausblenden),
// fasst <body>/den Splash-Div selbst nie mehr direkt an.
const SPLASH_SCRIPT = `(function(){
  try {
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (!standalone) return;
    var KEY = 'lumi-travel-splash-shown';
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, '1');
  } catch (e) { return; }
  var TOTAL = 2500;
  var style = document.createElement('style');
  style.textContent = '#lumi-splash{display:block;position:fixed;inset:0;z-index:999;overflow:hidden;background:#E8E3DA;animation:lumiSplashFade ' + TOTAL + 'ms ease forwards;pointer-events:none}';
  document.head.appendChild(style);
  setTimeout(function(){ style.remove(); }, TOTAL + 50);
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
        {/* §Bugfix (s. Kommentar oben): fest Teil des React-Baums (per Default
            unsichtbar, app/globals.css), damit das Inline-Script diesen Knoten
            nie selbst erzeugen/entfernen muss -- keine Hydration-Konflikte mehr. */}
        <div id="lumi-splash" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- rein clientseitig per <head>-Style ein-/ausgeblendetes Splash-Bild, kein next/image-Setup nötig. */}
          <img src={`${BASE_PATH}/splash/splash-travel.png`} alt="" />
        </div>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
