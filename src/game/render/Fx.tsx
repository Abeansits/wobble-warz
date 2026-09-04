import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useGame } from "@/store/gameStore";

export function BattleFx() {
  const phase = useGame((s) => s.snapshot?.phase ?? "setup");
  if (phase === "setup") return null;
  return (
    <EffectComposer multisampling={0}>
      <Bloom luminanceThreshold={0.92} intensity={0.35} mipmapBlur />
      <Vignette eskil={false} offset={0.25} darkness={phase === "over" ? 0.7 : 0.45} />
    </EffectComposer>
  );
}
