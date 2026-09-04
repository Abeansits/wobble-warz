import type { UnitDef } from "@/game/data/types";

export type TwistAxis = "y" | "x" | "-x" | "-y" | "z";
export type SkelShape = "capsule" | "sphere" | "box";

/** Capsule size = [halfHeight, radius]. Sphere = [radius]. Box = half-extents. */
export type SkelPart = {
  name: string;
  parent: number;
  /** Bind offset at scale 1, +Z forward. */
  pos: [number, number, number];
  /** World-space joint anchor at scale 1. */
  joint: [number, number, number];
  shape: SkelShape;
  size: [number, number, number];
  massFrac: number;
  twist: TwistAxis;
  twistDeg: number;
  normalDeg: number;
  planeDeg: number;
  /** Yaw the bind rotation so elongated boxes face the pad. */
  orient?: boolean;
};

export type SkelLayout = {
  kind: UnitDef["body"]["kind"];
  /** Rotate bind positions by spawn yaw (beasts/vehicles). Humanoids stay unyawed. */
  orient: boolean;
  rootLift: number;
  rootHalf: number;
  rootRadius: number;
  springSlack: number;
  parts: SkelPart[];
};

export function rootLift(kind: UnitDef["body"]["kind"], scale: number): number {
  switch (kind) {
    case "quadruped":
      return 0.62 * scale;
    case "vehicle":
      return 0.48 * scale;
    case "static":
      return 0.36 * scale;
    default:
      return 0.95 * scale;
  }
}

export function jointCountFor(kind: UnitDef["body"]["kind"]): number {
  return kind === "quadruped" || kind === "vehicle" ? 7 : 6;
}

/** Combat always reads torso/pelvis/armR — alias extra bones onto those names. */
export const BONE_ALIASES: Record<string, string[]> = {
  arms: ["armL", "armR"],
  legFL: ["armL"],
  legFR: ["armR"],
  legBL: ["legs"],
  wheelFL: ["armL"],
  wheelFR: ["armR"],
  wheelBR: ["legs"],
};

export function skeletonLayout(kind: UnitDef["body"]["kind"], lod = false): SkelLayout {
  if (lod && kind === "humanoid") return HUMANOID_LOD;
  switch (kind) {
    case "quadruped":
      return QUAD;
    case "vehicle":
      return VEHICLE;
    case "static":
      return STATIC;
    default:
      return HUMANOID;
  }
}

const HUMANOID: SkelLayout = {
  kind: "humanoid",
  orient: false,
  rootLift: 0.95,
  rootHalf: 0.42,
  rootRadius: 0.16,
  springSlack: 0.12,
  parts: [
    p("pelvis", -1, [0, 0.88, 0], [0, 0, 0], "capsule", [0.08, 0.13, 0], 0.28, "y", 0, 0, 0),
    p("torso", 0, [0, 1.22, 0], [0, 1.05, 0], "capsule", [0.15, 0.15, 0], 0.32, "y", 16, 22, 22),
    p("head", 1, [0, 1.54, 0], [0, 1.4, 0], "sphere", [0.15, 0, 0], 0.1, "y", 35, 28, 28),
    p("armL", 1, [-0.28, 1.22, 0], [-0.16, 1.34, 0], "capsule", [0.15, 0.05, 0], 0.1, "-x", 35, 55, 40),
    p("armR", 1, [0.28, 1.22, 0], [0.16, 1.34, 0], "capsule", [0.15, 0.05, 0], 0.1, "x", 35, 55, 40),
    p("legs", 0, [0, 0.42, 0], [0, 0.68, 0], "capsule", [0.22, 0.11, 0], 0.1, "-y", 20, 28, 28),
  ],
};

/** 4-body: merged pelvis+torso, head, arms-as-one, legs. */
const HUMANOID_LOD: SkelLayout = {
  kind: "humanoid",
  orient: false,
  rootLift: 0.95,
  rootHalf: 0.42,
  rootRadius: 0.16,
  springSlack: 0.12,
  parts: [
    p("pelvis", -1, [0, 1.05, 0], [0, 0, 0], "capsule", [0.18, 0.16, 0], 0.5, "y", 0, 0, 0),
    p("head", 0, [0, 1.54, 0], [0, 1.4, 0], "sphere", [0.15, 0, 0], 0.1, "y", 35, 28, 28),
    p("arms", 0, [0, 1.22, 0], [0, 1.34, 0], "capsule", [0.12, 0.16, 0], 0.2, "x", 35, 50, 40),
    p("legs", 0, [0, 0.42, 0], [0, 0.68, 0], "capsule", [0.22, 0.11, 0], 0.2, "-y", 20, 28, 28),
  ],
};

const QUAD: SkelLayout = {
  kind: "quadruped",
  orient: true,
  rootLift: 0.62,
  rootHalf: 0.22,
  rootRadius: 0.3,
  springSlack: 0.16,
  parts: [
    p("pelvis", -1, [0, 0.58, -0.22], [0, 0, 0], "box", [0.28, 0.16, 0.28], 0.28, "y", 0, 0, 0, true),
    p("torso", 0, [0, 0.64, 0.26], [0, 0.6, 0.02], "box", [0.3, 0.2, 0.38], 0.3, "y", 12, 16, 16, true),
    p("head", 1, [0, 0.72, 0.62], [0, 0.68, 0.48], "sphere", [0.16, 0, 0], 0.08, "y", 28, 24, 24),
    p("legFL", 1, [-0.22, 0.28, 0.32], [-0.2, 0.5, 0.3], "capsule", [0.18, 0.08, 0], 0.085, "-y", 22, 32, 28),
    p("legFR", 1, [0.22, 0.28, 0.32], [0.2, 0.5, 0.3], "capsule", [0.18, 0.08, 0], 0.085, "-y", 22, 32, 28),
    p("legBL", 0, [-0.22, 0.28, -0.32], [-0.2, 0.5, -0.28], "capsule", [0.18, 0.08, 0], 0.085, "-y", 22, 32, 28),
    p("legBR", 0, [0.22, 0.28, -0.32], [0.2, 0.5, -0.28], "capsule", [0.18, 0.08, 0], 0.085, "-y", 22, 32, 28),
  ],
};

const VEHICLE: SkelLayout = {
  kind: "vehicle",
  orient: true,
  rootLift: 0.48,
  rootHalf: 0.16,
  rootRadius: 0.34,
  springSlack: 0.14,
  parts: [
    p("pelvis", -1, [0, 0.38, 0], [0, 0, 0], "box", [0.42, 0.12, 0.7], 0.4, "y", 0, 0, 0, true),
    p("torso", 0, [0, 0.7, -0.04], [0, 0.52, 0], "box", [0.4, 0.22, 0.48], 0.22, "y", 8, 10, 10, true),
    p("head", 1, [0, 0.78, 0.42], [0, 0.74, 0.28], "box", [0.22, 0.1, 0.14], 0.06, "y", 12, 14, 14, true),
    p("wheelFL", 0, [-0.38, 0.18, 0.42], [-0.38, 0.28, 0.42], "sphere", [0.16, 0, 0], 0.08, "x", 160, 8, 8),
    p("wheelFR", 0, [0.38, 0.18, 0.42], [0.38, 0.28, 0.42], "sphere", [0.16, 0, 0], 0.08, "x", 160, 8, 8),
    p("wheelBR", 0, [0.38, 0.18, -0.42], [0.38, 0.28, -0.42], "sphere", [0.16, 0, 0], 0.08, "x", 160, 8, 8),
    p("wheelBL", 0, [-0.38, 0.18, -0.42], [-0.38, 0.28, -0.42], "sphere", [0.16, 0, 0], 0.08, "x", 160, 8, 8),
  ],
};

const STATIC: SkelLayout = {
  kind: "static",
  orient: true,
  rootLift: 0.36,
  rootHalf: 0.14,
  rootRadius: 0.3,
  springSlack: 0.06,
  parts: [
    p("pelvis", -1, [0, 0.22, 0], [0, 0, 0], "box", [0.42, 0.1, 0.32], 0.36, "y", 0, 0, 0, true),
    p("torso", 0, [0, 0.4, 0.22], [0, 0.32, 0.08], "box", [0.14, 0.12, 0.42], 0.28, "y", 6, 8, 8, true),
    p("head", 1, [0, 0.4, 0.58], [0, 0.4, 0.46], "sphere", [0.12, 0, 0], 0.08, "y", 10, 12, 12),
    p("armL", 0, [-0.32, 0.16, 0.08], [-0.28, 0.22, 0.08], "sphere", [0.14, 0, 0], 0.1, "x", 40, 10, 10),
    p("armR", 0, [0.32, 0.16, 0.08], [0.28, 0.22, 0.08], "sphere", [0.14, 0, 0], 0.1, "x", 40, 10, 10),
    p("legs", 0, [0, 0.16, -0.22], [0, 0.22, -0.16], "sphere", [0.14, 0, 0], 0.08, "x", 40, 10, 10),
  ],
};

function p(
  name: string,
  parent: number,
  pos: [number, number, number],
  joint: [number, number, number],
  shape: SkelShape,
  size: [number, number, number],
  massFrac: number,
  twist: TwistAxis,
  twistDeg: number,
  normalDeg: number,
  planeDeg: number,
  orient?: boolean,
): SkelPart {
  return { name, parent, pos, joint, shape, size, massFrac, twist, twistDeg, normalDeg, planeDeg, orient };
}
