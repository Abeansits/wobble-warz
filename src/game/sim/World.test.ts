import { describe, expect, it } from "vitest";
import { rosterFor, UNITS } from "@/game/data/units";
import { mulberry32 } from "./rng";

describe("mulberry32", () => {
  it("is deterministic for a seed", () => {
    const a = mulberry32(2026);
    const b = mulberry32(2026);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).toEqual(seqB);
  });
});

describe("roster", () => {
  it("has thirty base units plus anomalies", () => {
    const base = Object.values(UNITS).filter((u) => u.faction !== "anomaly");
    expect(base.length).toBe(30);
    expect(rosterFor("stoneage").length).toBe(6);
  });
});
