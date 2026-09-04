import { describe, expect, it } from "vitest";
import {
  ACTION_BOUNDS,
  ACTION_DIST_MAX,
  ACTION_DIST_MIN,
  fightFocus,
} from "./actionCam";

describe("fightFocus", () => {
  it("returns null for an empty field", () => {
    expect(fightFocus([])).toBeNull();
  });

  it("parks on a lone unit at the close stop", () => {
    const f = fightFocus([{ x: 10, z: -4 }]);
    expect(f).not.toBeNull();
    expect(f!.x).toBeCloseTo(10);
    expect(f!.z).toBeCloseTo(-4);
    expect(f!.spread).toBeCloseTo(0);
    expect(f!.dist).toBe(ACTION_DIST_MIN);
  });

  it("sits between two approaching lines and frames them wide", () => {
    const f = fightFocus([
      { x: -12, z: -2 },
      { x: -12, z: 2 },
      { x: 12, z: -2 },
      { x: 12, z: 2 },
    ]);
    expect(f).not.toBeNull();
    expect(f!.x).toBeCloseTo(0);
    expect(f!.z).toBeCloseTo(0);
    expect(f!.spread).toBeGreaterThan(10);
    expect(f!.dist).toBeGreaterThan(24);
    expect(f!.dist).toBeLessThanOrEqual(ACTION_DIST_MAX);
  });

  it("tightens as the scrum collapses", () => {
    const wide = fightFocus([
      { x: -14, z: 0 },
      { x: 14, z: 0 },
    ]);
    const tight = fightFocus([
      { x: -1, z: 0.4 },
      { x: 1, z: -0.4 },
      { x: 0, z: 0 },
    ]);
    expect(wide!.dist).toBeGreaterThan(tight!.dist);
    expect(tight!.dist).toBe(ACTION_DIST_MIN);
  });

  it("clamps a centroid that wandered off the pad", () => {
    const f = fightFocus([{ x: 80, z: -60 }]);
    expect(f!.x).toBe(ACTION_BOUNDS.x);
    expect(f!.z).toBe(-ACTION_BOUNDS.z);
  });
});
