import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={130}
    fps={30}
    width={500}
    height={500}
  />
);
