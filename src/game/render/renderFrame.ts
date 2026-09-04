import type { WorldSnapshot } from "@/game/sim/World";

export type RenderBatch = {
  key: string;
  pos: number[];
  quat: number[];
  scale: number[];
  color: string[];
};

/** Latest interpolated pose. Written from the rAF sim loop, read in useFrame. */
export const renderFrame: {
  snap: WorldSnapshot | null;
  batches: Map<string, RenderBatch>;
} = {
  snap: null,
  batches: new Map(),
};
