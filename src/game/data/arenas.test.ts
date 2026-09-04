import { describe, expect, it } from "vitest";
import { BRIDGE_Z, WET_PATCH, bridgePlankLayout, terrainHeight } from "./arenas";

describe("arena gimmicks", () => {
  it("canyon trench is a hole — planks, not the heightfield, make the walkway", () => {
    expect(terrainHeight(0, 8, "canyon")).toBeLessThan(terrainHeight(12, 8, "canyon"));
    const planks = BRIDGE_Z.flatMap((z) => bridgePlankLayout(z));
    expect(planks).toHaveLength(12);
    expect(planks.every((p) => p.y > 0.15)).toBe(true);
  });

  it("wet patch sits above the graveyard floor so ragdolls can slide", () => {
    expect(WET_PATCH.cy + WET_PATCH.hy).toBeGreaterThan(0.1);
    expect(WET_PATCH.friction).toBeLessThan(0.1);
  });
});
