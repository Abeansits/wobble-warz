import { describe, expect, it } from "vitest";
import {
  canyonCacti,
  graveyardLanterns,
  inChargeLane,
  meadowFence,
  meadowTrees,
  sceneryFor,
} from "./sceneryLayout";

describe("scenery layout", () => {
  it("meadow trees stay off the charge lane", () => {
    const trees = meadowTrees();
    expect(trees.length).toBeGreaterThan(12);
    for (const t of trees) {
      expect(inChargeLane(t.x, t.z), `${t.x},${t.z}`).toBe(false);
    }
    expect(trees.some((t) => Math.abs(t.z) > 12 && Math.abs(t.z) < 20 && Math.abs(t.x) < 28)).toBe(true);
  });

  it("cacti stay off the trench lane", () => {
    for (const c of canyonCacti()) {
      expect(inChargeLane(c.x, c.z)).toBe(false);
    }
  });

  it("lanterns sit beside the graveyard, not in the wet patch", () => {
    for (const l of graveyardLanterns()) {
      expect(Math.hypot(l.x, l.z)).toBeGreaterThan(8);
    }
  });

  it("sideline fence does not cross the east-west charge", () => {
    for (const p of meadowFence()) {
      expect(Math.abs(p.z)).toBeGreaterThan(18);
    }
  });

  it("sceneryFor picks a distinct kit per arena", () => {
    expect(sceneryFor("meadow").kind).toBe("meadow");
    expect(sceneryFor("canyon").kind).toBe("canyon");
    expect(sceneryFor("graveyard").kind).toBe("graveyard");
  });
});
