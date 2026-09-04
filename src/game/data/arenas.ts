export type ArenaId = "meadow" | "canyon" | "graveyard";

export type ArenaDef = {
  id: ArenaId;
  name: string;
  blurb: string;
  grass: string;
  dirt: string;
  sky: string;
  fog: string;
  night: boolean;
};

export const ARENAS: ArenaDef[] = [
  {
    id: "meadow",
    name: "Highland Meadow",
    blurb: "Soft hills. Charges hit harder downhill.",
    grass: "#4f8a4a",
    dirt: "#8a6a3a",
    sky: "#8ec6e8",
    fog: "#9fd0ee",
    night: false,
  },
  {
    id: "canyon",
    name: "Sunset Canyon",
    blurb: "A dry trench down the middle. Ranged likes the rims.",
    grass: "#c45a32",
    dirt: "#7a3a22",
    sky: "#f0a060",
    fog: "#e08950",
    night: false,
  },
  {
    id: "graveyard",
    name: "Hollow Graveyard",
    blurb: "Fog and slick grass. Tombstones to smash.",
    grass: "#2f4a38",
    dirt: "#3a3228",
    sky: "#1a2230",
    fog: "#2a3848",
    night: true,
  },
];

export function getArena(id: ArenaId) {
  return ARENAS.find((a) => a.id === id) ?? ARENAS[0];
}

/** Shared boulder positions: [x, y, z, radius] */
export const MEADOW_BOULDERS: [number, number, number, number][] = [
  [-8, 0.9, 6, 0.7],
  [6, 1.3, -7, 1.1],
  [14, 0.75, 8, 0.55],
  [-16, 1.0, -5, 0.8],
];

/** Tombstone bases: [x, z] */
export const GRAVEYARD_STONES: [number, number][] = [
  [-4, 4],
  [5, -3],
  [-10, -8],
  [11, 6],
  [0, 9],
  [-6, -2],
  [8, 3],
];

export const BRIDGE_Z = [8, -8] as const;
export const TRENCH_HALF = 3;
export const TRENCH_DEPTH = 1.5;

/** Visual + kinematic-root height. Physics colliders follow the same function. */
export function terrainHeight(x: number, z: number, arena: ArenaId = "meadow") {
  let y = 0.08 + ((x + 30) / 60) * 2;
  y += 0.05 * Math.sin(x * 0.14) * Math.cos(z * 0.18);
  if (arena === "canyon") {
    const trench = Math.max(0, 1 - Math.abs(x) / TRENCH_HALF);
    y -= trench * TRENCH_DEPTH;
    if (BRIDGE_Z.some((bz) => Math.abs(z - bz) < 0.7) && Math.abs(x) < 3.4) {
      y = 0.08 + ((x + 30) / 60) * 2;
    }
  }
  if (arena === "graveyard") {
    y = 0.08 + 0.03 * Math.sin(x * 0.2) * Math.cos(z * 0.2);
  }
  return y;
}
