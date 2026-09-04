import { describe, expect, it } from "vitest";
import { BALL_R, PEG_R, PlinkoSim, plinkoPegs } from "./plinko";

describe("plinko pegs", () => {
  it("staggers eight rows with a ball-width gap", () => {
    const pegs = plinkoPegs();
    const rows = new Set(pegs.map((p) => p.y.toFixed(2)));
    expect(rows.size).toBe(8);
    expect(pegs.length).toBeGreaterThan(40);
    const min = pegs.reduce((best, a, i) => {
      let m = best;
      for (let j = i + 1; j < pegs.length; j++) {
        const d = Math.hypot(a.x - pegs[j].x, a.y - pegs[j].y);
        if (d < m) m = d;
      }
      return m;
    }, Infinity);
    expect(min).toBeGreaterThan(2 * PEG_R + BALL_R);
  });
});

describe("plinko drop", () => {
  it("a capsule settles in the tray", async () => {
    const sim = new PlinkoSim();
    await sim.init();
    sim.drop(0.2);
    expect(sim.phase).toBe("falling");
    for (let i = 0; i < 60 * 8; i++) {
      sim.step(1 / 60);
      if (sim.phase === "settled") break;
    }
    expect(sim.phase).toBe("settled");
    expect(sim.scratch.y).toBeLessThan(1.2);
    expect(Number.isFinite(sim.scratch.x)).toBe(true);
    sim.dispose();
  }, 30_000);
});
