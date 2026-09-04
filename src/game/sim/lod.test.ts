import { describe, expect, it } from "vitest";
import { CORPSE_CAP, cullCorpses, shouldLod, updateDegrade } from "./lod";

describe("shouldLod", () => {
  it("never lods player-placed units", () => {
    expect(shouldLod(120, false, true)).toBe(false);
  });

  it("lods summons past 60, or 40 when degraded", () => {
    expect(shouldLod(59, true, false)).toBe(false);
    expect(shouldLod(60, true, false)).toBe(true);
    expect(shouldLod(40, true, true)).toBe(true);
    expect(shouldLod(39, true, true)).toBe(false);
  });
});

describe("cullCorpses", () => {
  it("starts the oldest extras fading", () => {
    const units = Array.from({ length: 85 }, (_, i) => ({
      state: "dead",
      gone: false,
      deadT: 0.1 + i * 0.01,
    }));
    const n = cullCorpses(units, 80, 6);
    expect(n).toBe(5);
    expect(units.filter((u) => u.deadT >= 6).length).toBe(5);
    expect(CORPSE_CAP).toBe(80);
  });
});

describe("updateDegrade", () => {
  it("trips after a window of slow steps and recovers when fast", () => {
    let samples: number[] = [];
    let degraded = false;
    for (let i = 0; i < 60; i++) {
      const r = updateDegrade(samples, 9, degraded);
      samples = r.samples;
      degraded = r.degraded;
    }
    expect(degraded).toBe(true);
    for (let i = 0; i < 60; i++) {
      const r = updateDegrade(samples, 2, degraded);
      samples = r.samples;
      degraded = r.degraded;
    }
    expect(degraded).toBe(false);
  });
});
