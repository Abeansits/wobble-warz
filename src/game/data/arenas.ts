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
    blurb: "A dry trench. Shoot the rope-bridge planks out.",
    grass: "#c45a32",
    dirt: "#7a3a22",
    sky: "#f0a060",
    fog: "#e08950",
    night: false,
  },
  {
    id: "graveyard",
    name: "Hollow Graveyard",
    blurb: "Fog, smashable stones, and a slick wet-grass patch.",
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

/** Center slick. cy sits above the graveyard floor so ragdolls actually touch it. */
export const WET_PATCH = {
  hx: 6,
  hy: 0.05,
  hz: 6,
  cy: 0.14,
  friction: 0.04,
} as const;

export type PlankSpec = {
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
};

export function bridgePlankLayout(bridgeZ: number): PlankSpec[] {
  const xs = [-2.55, -1.53, -0.51, 0.51, 1.53, 2.55];
  const hx = 0.48;
  const hy = 0.06;
  const hz = 0.52;
  const y = 0.22;
  return xs.map((x) => ({ x, y, z: bridgeZ, hx, hy, hz }));
}

/** Visual + kinematic-root height. Planks lift canyon walkers in World.groundY. */
export function terrainHeight(x: number, z: number, arena: ArenaId = "meadow") {
  let y = 0.08 + ((x + 30) / 60) * 2;
  y += 0.05 * Math.sin(x * 0.14) * Math.cos(z * 0.18);
  if (arena === "canyon") {
    const trench = Math.max(0, 1 - Math.abs(x) / TRENCH_HALF);
    y -= trench * TRENCH_DEPTH;
  }
  if (arena === "graveyard") {
    y = 0.08 + 0.03 * Math.sin(x * 0.2) * Math.cos(z * 0.2);
  }
  return y;
}
