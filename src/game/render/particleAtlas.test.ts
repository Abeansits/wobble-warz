import { describe, expect, it } from "vitest";
import { ATLAS, TILE_U, TILE_V } from "./particleAtlas";

describe("particle atlas", () => {
  it("gives freeze, heal, and pumpkin distinct tiles", () => {
    expect(ATLAS.ice).not.toEqual(ATLAS.heal);
    expect(ATLAS.goo).not.toEqual(ATLAS.ice);
    expect(ATLAS.heal).not.toEqual(ATLAS.goo);
    expect(ATLAS.ice).toEqual([0.5, 0]);
    expect(ATLAS.heal).toEqual([0.75, 0.5]);
    expect(ATLAS.goo).toEqual([0.25, 0]);
  });

  it("keeps every kind inside the 4×2 sheet", () => {
    for (const [u, v] of Object.values(ATLAS)) {
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(u % TILE_U).toBeCloseTo(0);
      expect(v % TILE_V).toBeCloseTo(0);
    }
  });
});
