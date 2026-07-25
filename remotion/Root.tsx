import { Composition } from "remotion";
import { ReelSpike, REEL_SPIKE_FPS, REEL_SPIKE_DURATION_IN_FRAMES } from "./ReelSpike";
import { ReelTimelineComposition, scenesTotalDurationInFrames, type ReelTimelineCompositionProps } from "./ReelTimelineComposition";

const FPS = 30;

/**
 * §Content Studio 3.0, Sprint 4: "drei bestehende Stil-Kompositionen (Luxury
 * Travel/Family Memory/Dynamic Adventure)" -- hier registriert, damit sie
 * per Remotion-Lambda unter einer stabilen `id` ansteuerbar sind. Für die
 * renderfreie Vorschau (components/ReelTimelineEditor.tsx) wird
 * `ReelTimelineComposition` direkt per `<Player>` eingebunden, OHNE über
 * diese Registrierung zu gehen.
 *
 * §Sprint 5: "echte Szenendauer dynamisch an die Remotion-Komposition
 * übergeben" (Nutzervorgabe, wörtlich) -- `calculateMetadata` überschreibt
 * die feste `durationInFrames` unten (nur Platzhalter für die
 * Remotion-Studio-Vorschau ohne echte Props) anhand der TATSÄCHLICH
 * übergebenen Szenen, sobald `renderMediaOnLambda` reale `inputProps`
 * mitschickt (lib/actions/reel-render.ts). So bleibt der fertige Render
 * exakt so lang wie die Summe der Szenendauern in der Timeline.
 */
const DEFAULT_PROPS: ReelTimelineCompositionProps = { scenes: [], style: "family_memory", musicUrl: null };

function calculateReelMetadata({ props }: { props: ReelTimelineCompositionProps }) {
  return {
    durationInFrames: Math.max(1, scenesTotalDurationInFrames(props.scenes, FPS)),
    fps: FPS,
    width: 1080,
    height: 1920,
  };
}

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="ReelSpike"
      component={ReelSpike}
      durationInFrames={REEL_SPIKE_DURATION_IN_FRAMES}
      fps={REEL_SPIKE_FPS}
      width={1080}
      height={1920}
    />
    <Composition
      id="LuxuryTravelReel"
      component={ReelTimelineComposition}
      durationInFrames={FPS * 15}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ ...DEFAULT_PROPS, style: "luxury_travel" }}
      calculateMetadata={calculateReelMetadata}
    />
    <Composition
      id="FamilyMemoryReel"
      component={ReelTimelineComposition}
      durationInFrames={FPS * 15}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ ...DEFAULT_PROPS, style: "family_memory" }}
      calculateMetadata={calculateReelMetadata}
    />
    <Composition
      id="DynamicAdventureReel"
      component={ReelTimelineComposition}
      durationInFrames={FPS * 15}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ ...DEFAULT_PROPS, style: "dynamic_adventure" }}
      calculateMetadata={calculateReelMetadata}
    />
  </>
);
