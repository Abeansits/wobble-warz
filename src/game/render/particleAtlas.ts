/** 4×2 tiles in `/assets/particles.png` (u=0.25, v=0.5). */
export type ParticleKind =
  | "dust"
  | "spark"
  | "smoke"
  | "star"
  | "ring"
  | "confetti"
  | "snow"
  | "feather"
  | "flash"
  | "ice"
  | "goo"
  | "heal";

export const TILE_U = 0.25;
export const TILE_V = 0.5;

/** Bottom-left of each cell. Row 1 is puffs/sparks; row 0 is ring/confetti/flake/feather. */
export const ATLAS: Record<ParticleKind, [number, number]> = {
  dust: [0, 0.5],
  spark: [0.25, 0.5],
  flash: [0.25, 0.5],
  smoke: [0.5, 0.5],
  star: [0.75, 0.5],
  heal: [0.75, 0.5],
  ring: [0, 0],
  confetti: [0.25, 0],
  goo: [0.25, 0],
  ice: [0.5, 0],
  snow: [0.5, 0],
  feather: [0.75, 0],
};
