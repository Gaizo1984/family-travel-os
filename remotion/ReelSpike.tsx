import { AbsoluteFill, Img, Sequence, staticFile } from "remotion";

/**
 * §Content Studio 3.0, Sprint 0b (Infrastruktur-Spike): ausschließlich zum
 * Beweis, dass die Kette Bundle -> Vercel Sandbox -> Render -> Datei-Rückgabe
 * funktioniert. Zwei synthetische, lokal erzeugte Testbilder (keine echten
 * Familienfotos), einfacher statischer Textoverlay -- bewusst ohne
 * Animation/Übergänge, um die Komposition selbst als Fehlerquelle
 * auszuschließen.
 */
const FPS = 30;
const HALF_DURATION = 225; // 7.5s bei 30fps -- die Hälfte der 15s-Gesamtlänge

export function ReelSpike() {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Sequence from={0} durationInFrames={HALF_DURATION}>
        <Slide src={staticFile("test-photo-1.jpg")} label="Content Studio 3.0 -- Infrastruktur-Spike" />
      </Sequence>
      <Sequence from={HALF_DURATION} durationInFrames={HALF_DURATION}>
        <Slide src={staticFile("test-photo-2.jpg")} label="Remotion + Vercel Sandbox" />
      </Sequence>
    </AbsoluteFill>
  );
}

function Slide({ src, label }: { src: string; label: string }) {
  return (
    <AbsoluteFill>
      <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 160 }}>
        <div
          style={{
            color: "white", fontSize: 48, fontFamily: "sans-serif", textAlign: "center",
            padding: "0 40px", textShadow: "0 2px 12px rgba(0,0,0,0.6)",
          }}
        >
          {label}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export const REEL_SPIKE_FPS = FPS;
export const REEL_SPIKE_DURATION_IN_FRAMES = HALF_DURATION * 2;
