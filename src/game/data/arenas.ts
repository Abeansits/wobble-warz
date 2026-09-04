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

/** Visual + spawn height. Kept low so it matches the physics floor. */
export function terrainHeight(x: number, z: number, arena: ArenaId = "meadow") {
  let y = 0.38 + ((x + 30) / 60) * 0.28 + 0.06 * Math.sin(x * 0.14) * Math.cos(z * 0.18);
  if (arena === "canyon") {
    const trench = Math.max(0, 1 - Math.abs(x) / 3.4);
    y -= trench * 0.45;
  }
  if (arena === "graveyard") y -= 0.04;
  return y;
}
