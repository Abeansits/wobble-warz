import { describe, expect, it } from "vitest";
import type { TransformSnap, WorldSnapshot } from "@/game/sim/World";
import { interpolateSnapshot, lerp, lerpAngle, lerpTransform } from "./interp";

const ident = (x: number, y: number, z: number): TransformSnap => ({
  x,
  y,
  z,
  qx: 0,
  qy: 0,
  qz: 0,
  qw: 1,
});

function snap(partial: Partial<WorldSnapshot> & Pick<WorldSnapshot, "units">): WorldSnapshot {
  return {
    time: 0,
    phase: "battle",
    countdown: 0,
    winner: null,
    projectiles: [],
    planks: [],
    counts: [1, 0],
    hpPct: [1, 1],
    physicsMs: 0,
    wasmBytes: 0,
    degraded: false,
    ...partial,
  };
}

describe("interp", () => {
  it("lerps numbers and wrapped yaw", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI, 5);
  });

  it("nlerps quats across the hemisphere", () => {
    const a = { ...ident(0, 0, 0), qy: 0, qw: 1 };
    const b = { ...ident(0, 0, 0), qy: 0, qw: -1 };
    const m = lerpTransform(a, b, 0.5);
    expect(Math.hypot(m.qx, m.qy, m.qz, m.qw)).toBeCloseTo(1);
  });

  it("interpolateSnapshot is prev at 0, curr at 1, midpoint in between", () => {
    const prev = snap({
      units: [
        {
          id: 1,
          defId: "stoneage.clubber",
          side: 0,
          hp: 100,
          maxHp: 100,
          state: "seek",
          face: "idle",
          root: ident(0, 1, 0),
          parts: { torso: ident(0, 1.2, 0) },
          flash: 0,
          fade: 0,
          scale: 1,
          yaw: 0,
        },
      ],
    });
    const curr = snap({
      units: [
        {
          ...prev.units[0],
          root: ident(4, 1, 0),
          parts: { torso: ident(4, 1.2, 0) },
          yaw: 1,
        },
      ],
    });
    expect(interpolateSnapshot(prev, curr, 0).units[0].root.x).toBe(0);
    expect(interpolateSnapshot(prev, curr, 1).units[0].root.x).toBe(4);
    const mid = interpolateSnapshot(prev, curr, 0.5);
    expect(mid.units[0].root.x).toBeCloseTo(2);
    expect(mid.units[0].parts.torso.x).toBeCloseTo(2);
    expect(mid.units[0].yaw).toBeCloseTo(0.5);
  });
});
