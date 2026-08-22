import { AbsoluteFill, Sequence, Img, OffthreadVideo, Audio, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

/**
 * §Content Studio 3.0, Sprint 4 -- gemeinsame Timeline-Komposition für alle
 * drei Stile (Luxury Travel/Family Memory/Dynamic Adventure). Bewusst EINE
 * Implementierung mit einem `style`-Prop statt drei fast identischer
 * Kompositionen ("keine unnötige Abstraktion, aber auch keine Duplizierung"):
 * echte Unterschiede liegen nur in Typografie/Farbakzent/Overlay, nicht in
 * der Ablauflogik. Läuft UNVERÄNDERT sowohl im `<Player>` (renderfreie
 * Vorschau, components/ReelTimelineEditor.tsx) als auch später beim
 * tatsächlichen Remotion-Lambda-Render (remotion/Root.tsx) -- alle Medien-
 * URLs müssen daher bereits vorab aufgelöste, gültige (signierte) URLs sein,
 * die Komposition selbst kennt keine Supabase-Zugriffslogik.
 */
export type ReelCompositionScene = {
  sourceType: "photo" | "video";
  mediaUrl: string;
  durationSeconds: number;
  transition: string;
  cameraMotion: string;
  textOverlay: string;
  videoStartSeconds: number | null;
};

export type ReelStyleId = "luxury_travel" | "family_memory" | "dynamic_adventure";

export type ReelTimelineCompositionProps = {
  scenes: ReelCompositionScene[];
  style: ReelStyleId;
  musicUrl?: string | null;
};

type StyleTheme = {
  fontFamily: string;
  overlayGradient: string;
  letterSpacing: string;
  textTransform: React.CSSProperties["textTransform"];
  fontWeight: React.CSSProperties["fontWeight"];
};

const STYLE_THEME: Record<ReelStyleId, StyleTheme> = {
  luxury_travel: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    overlayGradient: "linear-gradient(to top, rgba(10,9,7,0.78) 0%, transparent 45%)",
    letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 400,
  },
  family_memory: {
    fontFamily: "'Segoe UI', sans-serif",
    overlayGradient: "linear-gradient(to top, rgba(40,24,20,0.6) 0%, transparent 40%)",
    letterSpacing: "0.01em", textTransform: "none", fontWeight: 500,
  },
  dynamic_adventure: {
    fontFamily: "Arial, sans-serif",
    overlayGradient: "linear-gradient(to top, rgba(6,10,8,0.72) 0%, transparent 32%)",
    letterSpacing: "0.03em", textTransform: "uppercase", fontWeight: 800,
  },
};

export function scenesTotalDurationInFrames(scenes: ReelCompositionScene[], fps: number): number {
  return scenes.reduce((sum, s) => sum + Math.max(1, Math.round(s.durationSeconds * fps)), 0);
}

export function ReelTimelineComposition({ scenes, style, musicUrl }: ReelTimelineCompositionProps) {
  const { fps } = useVideoConfig();
  const theme = STYLE_THEME[style] ?? STYLE_THEME.family_memory;

  let cursor = 0;
  const placedScenes = scenes.map((scene) => {
    const durationInFrames = Math.max(1, Math.round(scene.durationSeconds * fps));
    const from = cursor;
    // eslint-disable-next-line react-hooks/immutability -- False Positive: rein lokaler Laufindex innerhalb EINES synchronen .map()-Durchlaufs (frisch je Render via `let cursor = 0` initialisiert), keine Mutation, die den Render überlebt oder nach außen sichtbar wird.
    cursor += durationInFrames;
    return { ...scene, from, durationInFrames };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {placedScenes.map((scene, idx) => (
        <Sequence key={`${scene.sourceType}-${idx}-${scene.from}`} from={scene.from} durationInFrames={scene.durationInFrames}>
          <ReelSceneView scene={scene} theme={theme} />
        </Sequence>
      ))}
      {musicUrl ? <Audio src={musicUrl} volume={0.7} /> : null}
    </AbsoluteFill>
  );
}

function ReelSceneView({ scene, theme }: { scene: ReelCompositionScene & { durationInFrames: number }; theme: StyleTheme }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = Math.min(1, frame / scene.durationInFrames);

  let scale = 1;
  let translateX = 0;
  if (scene.cameraMotion === "ken_burns_in") scale = interpolate(progress, [0, 1], [1, 1.12]);
  else if (scene.cameraMotion === "ken_burns_out") scale = interpolate(progress, [0, 1], [1.12, 1]);
  else if (scene.cameraMotion === "pan_left") translateX = interpolate(progress, [0, 1], [0, -30]);
  else if (scene.cameraMotion === "pan_right") translateX = interpolate(progress, [0, 1], [0, 30]);

  const fadeInFrames = Math.min(10, Math.floor(scene.durationInFrames / 3));
  const opacity = scene.transition === "fade"
    ? interpolate(frame, [0, Math.max(1, fadeInFrames)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ transform: `scale(${scale}) translateX(${translateX}px)` }}>
        {scene.sourceType === "video" ? (
          <OffthreadVideo
            src={scene.mediaUrl}
            trimBefore={Math.max(0, Math.round((scene.videoStartSeconds ?? 0) * fps))}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            muted
          />
        ) : (
          <Img src={scene.mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: theme.overlayGradient }} />
      {scene.textOverlay ? (
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 180, paddingLeft: 48, paddingRight: 48 }}>
          <div
            style={{
              color: "white", fontSize: 44, fontFamily: theme.fontFamily, textAlign: "center",
              letterSpacing: theme.letterSpacing, textTransform: theme.textTransform, fontWeight: theme.fontWeight,
              textShadow: "0 2px 16px rgba(0,0,0,0.65)", lineHeight: 1.3,
            }}
          >
            {scene.textOverlay}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}
