import { describe, expect, it } from "vitest";
import { mirrorMatch } from "./balance";

describe("balance harness", () => {
  it("clubber vs squire does not NaN or hang", async () => {
    const { wins, rate } = await mirrorMatch("stoneage.clubber", "medieval.squire", 2, 12);
    expect(wins[0] + wins[1] + wins[2]).toBe(2);
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(1);
  }, 30_000);
});
