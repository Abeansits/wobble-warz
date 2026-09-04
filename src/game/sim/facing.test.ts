import { describe, expect, it } from "vitest";
import { deployYaw, lookYaw } from "./facing";

describe("facing", () => {
  it("P1 looks +X (toward P2) and P2 looks −X (toward P1)", () => {
    expect(deployYaw(0)).toBeCloseTo(Math.PI / 2);
    expect(deployYaw(1)).toBeCloseTo(-Math.PI / 2);
  });

  it("lookYaw aims +Z-facing meshes at a world direction", () => {
    expect(lookYaw(1, 0)).toBeCloseTo(Math.PI / 2);
    expect(lookYaw(-1, 0)).toBeCloseTo(-Math.PI / 2);
    expect(lookYaw(0, 1)).toBeCloseTo(0);
    expect(lookYaw(0, -1)).toBeCloseTo(Math.PI);
  });
});
