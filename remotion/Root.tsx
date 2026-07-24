import { Composition } from "remotion";
import { ReelSpike, REEL_SPIKE_FPS, REEL_SPIKE_DURATION_IN_FRAMES } from "./ReelSpike";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="ReelSpike"
    component={ReelSpike}
    durationInFrames={REEL_SPIKE_DURATION_IN_FRAMES}
    fps={REEL_SPIKE_FPS}
    width={1080}
    height={1920}
  />
);
