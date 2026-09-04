import { describe, expect, it } from "vitest";
import { clampBudget, BUDGET_MAX, BUDGET_MIN, duplicatePlacement } from "./setup";

describe("clampBudget", () => {
  it("keeps a legal value and clamps the rest", () => {
    expect(clampBudget(3000)).toBe(3000);
    expect(clampBudget(250)).toBe(BUDGET_MIN);
    expect(clampBudget(99999)).toBe(BUDGET_MAX);
    expect(clampBudget(1234.6)).toBe(1235);
    expect(clampBudget(Number.NaN)).toBe(3000);
  });
});

describe("duplicatePlacement", () => {
  const src = { defId: "stoneage.clubber", x: -16, z: 0, yaw: 1.57, side: 0 as const };

  it("plants a copy beside the original", () => {
    const next = duplicatePlacement(src, [{ x: src.x, z: src.z }]);
    expect(next).not.toBeNull();
    expect(next?.defId).toBe(src.defId);
    expect(next?.side).toBe(0);
    expect(next?.yaw).toBe(src.yaw);
    expect(Math.hypot((next?.x ?? 0) - src.x, (next?.z ?? 0) - src.z)).toBeGreaterThan(1);
    expect(next?.x).toBeLessThanOrEqual(-8);
  });

  it("stays on the owner's pad", () => {
    const tight = { defId: "stoneage.clubber", x: -8.2, z: 0, yaw: 0, side: 0 as const };
    const next = duplicatePlacement(tight, [{ x: tight.x, z: tight.z }]);
    expect(next).not.toBeNull();
    expect(next!.x).toBeLessThanOrEqual(-8);
  });

  it("returns null when the pad is packed", () => {
    const occupied = [{ x: src.x, z: src.z }];
    for (const dx of [-2.4, -1.25, 0, 1.25, 2.4]) {
      for (const dz of [-2.4, -1.25, 0, 1.25, 2.4]) {
        occupied.push({ x: src.x + dx, z: src.z + dz });
      }
    }
    expect(duplicatePlacement(src, occupied)).toBeNull();
  });
});
