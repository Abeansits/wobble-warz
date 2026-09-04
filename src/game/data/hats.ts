export type HatShape = "box" | "capsule" | "sphere";

export type HatPart = {
  shape: HatShape;
  size: [number, number, number];
  /** Local to the brim plane (y=0 sits on the skull). */
  offset: [number, number, number];
  color: string;
};

export type HatDef = {
  id: `hat.${string}`;
  name: string;
  parts: HatPart[];
};

/** Head-center → brim, in recipe units. */
export const HAT_BRIM_Y = 0.22;

function p(
  shape: HatShape,
  size: [number, number, number],
  offset: [number, number, number],
  color: string,
): HatPart {
  return { shape, size, offset, color };
}

const ORANGE = "#c45a32";
const GOLD = "#d4a017";
const INK = "#1c1710";
const STEEL = "#3a5f8a";
const OCHRE = "#c48a3a";
const METAL = "#9aa3ad";
const CREAM = "#f4e8c8";
const CRIMSON = "#b33a2b";
const BONE = "#d9c9a4";
const MOSS = "#2e5a2c";
const PARCHMENT = "#efe0b4";

export const HATS: HatDef[] = [
  {
    id: "hat.cone",
    name: "Traffic cone",
    parts: [p("capsule", [0.08, 0.22, 0.08], [0, 0.06, 0], ORANGE)],
  },
  {
    id: "hat.crown",
    name: "Tiny crown",
    parts: [
      p("box", [0.18, 0.08, 0.18], [0, 0.02, 0], GOLD),
      p("box", [0.04, 0.1, 0.04], [0.07, 0.1, 0.07], GOLD),
      p("box", [0.04, 0.1, 0.04], [-0.07, 0.1, 0.07], GOLD),
      p("box", [0.04, 0.1, 0.04], [0.07, 0.1, -0.07], GOLD),
      p("box", [0.04, 0.1, 0.04], [-0.07, 0.1, -0.07], GOLD),
    ],
  },
  {
    id: "hat.tophat",
    name: "Top hat",
    parts: [
      p("box", [0.28, 0.04, 0.28], [0, 0, 0], INK),
      p("box", [0.16, 0.22, 0.16], [0, 0.13, 0], INK),
      p("box", [0.18, 0.03, 0.18], [0, 0.24, 0], GOLD),
    ],
  },
  {
    id: "hat.propeller",
    name: "Propeller cap",
    parts: [
      p("sphere", [0.14, 0.14, 0.14], [0, 0.02, 0], STEEL),
      p("box", [0.26, 0.03, 0.06], [0, 0.16, 0], OCHRE),
      p("box", [0.06, 0.03, 0.26], [0, 0.16, 0], OCHRE),
    ],
  },
  {
    id: "hat.bucket",
    name: "Bucket",
    parts: [
      p("sphere", [0.16, 0.16, 0.16], [0, 0.06, 0], METAL),
      p("box", [0.2, 0.04, 0.2], [0, 0.14, 0], METAL),
    ],
  },
  {
    id: "hat.halo",
    name: "Halo",
    parts: [
      p("sphere", [0.045, 0.045, 0.045], [0.16, 0.2, 0], GOLD),
      p("sphere", [0.045, 0.045, 0.045], [-0.16, 0.2, 0], GOLD),
      p("sphere", [0.045, 0.045, 0.045], [0, 0.2, 0.16], GOLD),
      p("sphere", [0.045, 0.045, 0.045], [0, 0.2, -0.16], GOLD),
      p("sphere", [0.045, 0.045, 0.045], [0.11, 0.2, 0.11], GOLD),
      p("sphere", [0.045, 0.045, 0.045], [-0.11, 0.2, 0.11], GOLD),
      p("sphere", [0.045, 0.045, 0.045], [0.11, 0.2, -0.11], GOLD),
      p("sphere", [0.045, 0.045, 0.045], [-0.11, 0.2, -0.11], GOLD),
    ],
  },
  {
    id: "hat.fez",
    name: "Fez",
    parts: [
      p("box", [0.16, 0.16, 0.16], [0, 0.08, 0], CRIMSON),
      p("capsule", [0.02, 0.12, 0.02], [0, 0.2, 0], GOLD),
    ],
  },
  {
    id: "hat.horn",
    name: "Viking horns",
    parts: [
      p("box", [0.2, 0.06, 0.14], [0, 0.02, 0], INK),
      p("capsule", [0.045, 0.2, 0.045], [0.14, 0.16, 0], BONE),
      p("capsule", [0.045, 0.2, 0.045], [-0.14, 0.16, 0], BONE),
    ],
  },
  {
    id: "hat.chef",
    name: "Chef toque",
    parts: [
      p("box", [0.18, 0.04, 0.18], [0, 0, 0], CREAM),
      p("capsule", [0.1, 0.28, 0.1], [0, 0.16, 0], CREAM),
    ],
  },
  {
    id: "hat.flower",
    name: "Flower pot",
    parts: [
      p("box", [0.14, 0.12, 0.14], [0, 0.04, 0], OCHRE),
      p("sphere", [0.08, 0.08, 0.08], [0, 0.16, 0], MOSS),
      p("sphere", [0.06, 0.06, 0.06], [0.08, 0.18, 0], ORANGE),
    ],
  },
  {
    id: "hat.sombrero",
    name: "Sombrero",
    parts: [
      p("box", [0.36, 0.03, 0.36], [0, 0, 0], OCHRE),
      p("sphere", [0.12, 0.12, 0.12], [0, 0.08, 0], CRIMSON),
    ],
  },
  {
    id: "hat.cap",
    name: "Ball cap",
    parts: [
      p("sphere", [0.14, 0.14, 0.14], [0, 0.02, -0.02], STEEL),
      p("box", [0.16, 0.03, 0.14], [0, 0, 0.12], STEEL),
    ],
  },
];

const BY_ID = Object.fromEntries(HATS.map((h) => [h.id, h])) as Record<string, HatDef>;

export function getHat(id: string | null | undefined): HatDef | null {
  if (!id) return null;
  return BY_ID[id] ?? null;
}

export function isHatId(id: string): boolean {
  return id.startsWith("hat.") && id in BY_ID;
}
