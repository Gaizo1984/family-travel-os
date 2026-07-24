import { Composition } from "remotion";
import { ReelSpike, REEL_SPIKE_FPS, REEL_SPIKE_DURATION_IN_FRAMES } from "./ReelSpike";
import { ReelTimelineComposition, type ReelTimelineCompositionProps } from "./ReelTimelineComposition";

const FPS = 30;

/**
 * §Content Studio 3.0, Sprint 4: "drei bestehende Stil-Kompositionen (Luxury
 * Travel/Family Memory/Dynamic Adventure)" -- hier registriert, damit sie
 * später (Sprint 5, echtes Rendering) unter einer stabilen `id` per
 * Remotion-Lambda ansteuerbar sind. Für die renderfreie Vorschau in diesem
 * Sprint (components/ReelTimelineEditor.tsx) wird `ReelTimelineComposition`
 * direkt per `<Player>` eingebunden, OHNE über diese Registrierung zu gehen
 * -- der Player bekommt Szenen/Dauer als Props direkt vom aktuellen
 * Bearbeitungsstand, nicht aus `defaultProps` hier.
 *
 * §Bekannte Lücke, bewusst nicht in diesem Sprint gelöst: `durationInFrames`
 * ist hier ein fester Platzhalter (15s) für die Remotion-Studio-Vorschau --
 * ein echter Lambda-Render (Sprint 5) muss die TATSÄCHLICHE Szenenlänge des
 * jeweiligen Drafts kennen (`calculateMetadata` oder ein Render-Parameter),
 * das ist Teil der Sprint-5-Rendering-Arbeit, nicht dieser Registrierung.
 */
const DEFAULT_PROPS: ReelTimelineCompositionProps = { scenes: [], style: "family_memory", musicUrl: null };

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
    />
    <Composition
      id="FamilyMemoryReel"
      component={ReelTimelineComposition}
      durationInFrames={FPS * 15}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ ...DEFAULT_PROPS, style: "family_memory" }}
    />
    <Composition
      id="DynamicAdventureReel"
      component={ReelTimelineComposition}
      durationInFrames={FPS * 15}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ ...DEFAULT_PROPS, style: "dynamic_adventure" }}
    />
  </>
);
