import type { WorldSnapshot } from "@/game/sim/World";

export type RenderBatch = {
  key: string;
  pos: number[];
  quat: number[];
  scale: number[];
  color: string[];
};

export type TeamRing = {
  x: number;
  y: number;
  z: number;
  side: 0 | 1;
  s: number;
};

/** Latest interpolated pose. Written from the rAF sim loop, read in useFrame. */
export const renderFrame: {
  snap: WorldSnapshot | null;
  batches: Map<string, RenderBatch>;
  rings: TeamRing[];
} = {
  snap: null,
  batches: new Map(),
  rings: [],
};
