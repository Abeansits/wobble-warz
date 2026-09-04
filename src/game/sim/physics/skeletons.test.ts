import { describe, expect, it } from "vitest";
import { BONE_ALIASES, jointCountFor, rootLift, skeletonLayout } from "./skeletons";

describe("skeleton layouts", () => {
  it("humanoid stays 6 bodies; beasts and coaches get 7", () => {
    expect(skeletonLayout("humanoid").parts).toHaveLength(6);
    expect(skeletonLayout("quadruped").parts).toHaveLength(7);
    expect(skeletonLayout("vehicle").parts).toHaveLength(7);
    expect(skeletonLayout("static").parts).toHaveLength(6);
    expect(jointCountFor("quadruped")).toBe(7);
    expect(jointCountFor("humanoid")).toBe(6);
  });

  it("quadruped names four legs and aliases them onto combat bones", () => {
    const names = skeletonLayout("quadruped").parts.map((p) => p.name);
    expect(names).toEqual(["pelvis", "torso", "head", "legFL", "legFR", "legBL", "legBR"]);
    expect(BONE_ALIASES.legFL).toContain("armL");
    expect(BONE_ALIASES.legFR).toContain("armR");
  });

  it("vehicle names four wheels", () => {
    const names = skeletonLayout("vehicle").parts.map((p) => p.name);
    expect(names.filter((n) => n.startsWith("wheel"))).toHaveLength(4);
  });

  it("root lift is lower for beasts than humanoids", () => {
    expect(rootLift("quadruped", 2.2)).toBeLessThan(rootLift("humanoid", 2.2));
    expect(rootLift("vehicle", 1.8)).toBeLessThan(rootLift("humanoid", 1.8));
    expect(rootLift("static", 1.3)).toBeLessThan(rootLift("humanoid", 1));
  });

  it("humanoid LOD is 4 bodies with combat aliases", () => {
    const lod = skeletonLayout("humanoid", true);
    expect(lod.parts).toHaveLength(4);
    expect(lod.parts.map((p) => p.name)).toEqual(["pelvis", "head", "arms", "legs"]);
    expect(BONE_ALIASES.arms).toEqual(["armL", "armR"]);
    lod.parts.forEach((p, i) => {
      expect(p.parent).toBeLessThan(i);
    });
  });

  it("parent indices always point at earlier joints", () => {
    for (const kind of ["humanoid", "quadruped", "vehicle", "static"] as const) {
      skeletonLayout(kind).parts.forEach((p, i) => {
        expect(p.parent).toBeLessThan(i);
        expect(p.parent).toBeGreaterThanOrEqual(-1);
      });
    }
  });
});
