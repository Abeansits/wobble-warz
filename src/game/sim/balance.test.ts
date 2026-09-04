import { describe, expect, it } from "vitest";
import { FLAG_RATE, formatReport, isHot, mirrorMatch, runMirrors, type MirrorResult } from "./balance";

function row(partial: Partial<MirrorResult> & Pick<MirrorResult, "a" | "b" | "rate">): MirrorResult {
  const decided = partial.decided ?? 10;
  return {
    wins: partial.wins ?? [Math.round(partial.rate * decided), decided - Math.round(partial.rate * decided), 0],
    decided,
    avgTime: partial.avgTime ?? 8,
    hot: partial.hot ?? isHot(partial.rate, decided),
    ...partial,
  };
}

describe("isHot", () => {
  it("flags either side above 65%, not a 65% tie or a draw", () => {
    expect(FLAG_RATE).toBe(0.65);
    expect(isHot(0.66, 10)).toBe(true);
    expect(isHot(0.3, 10)).toBe(true);
    expect(isHot(0.65, 20)).toBe(false);
    expect(isHot(0.5, 8)).toBe(false);
    expect(isHot(1, 0)).toBe(false);
  });
});

describe("formatReport", () => {
  it("prints FLAG lines only for hot rows", () => {
    const text = formatReport([
      row({ a: "stoneage.clubber", b: "medieval.squire", rate: 0.8, wins: [8, 2, 0], decided: 10, hot: true }),
      row({ a: "pirate.deckhand", b: "frontier.gunslinger", rate: 0.5, wins: [5, 5, 0], decided: 10, hot: false }),
    ]);
    expect(text).toMatch(/FLAG stoneage\.clubber vs medieval\.squire \(80%\)/);
    expect(text).not.toMatch(/FLAG pirate\.deckhand/);
  });

  it("says so when nothing is hot", () => {
    const text = formatReport([
      row({ a: "a", b: "b", rate: 0.5, wins: [1, 1, 0], decided: 2, hot: false }),
    ]);
    expect(text).toMatch(/No matchup above 65%/);
  });
});

describe("balance harness", () => {
  it("clubber vs squire does not NaN or hang", async () => {
    const result = await mirrorMatch("stoneage.clubber", "medieval.squire", 2, 12);
    expect(result.wins[0] + result.wins[1] + result.wins[2]).toBe(2);
    expect(result.rate).toBeGreaterThanOrEqual(0);
    expect(result.rate).toBeLessThanOrEqual(1);
    expect(result.avgTime).toBeGreaterThan(0);
    expect(typeof result.hot).toBe("boolean");
  }, 30_000);

  it("prints flagged equal-cost mirrors", async () => {
    const rows = await runMirrors(
      [
        ["stoneage.clubber", "medieval.squire"],
        ["haunted.skeleton", "stoneage.clubber"],
      ],
      2,
      12,
    );
    expect(rows).toHaveLength(2);
    const report = formatReport(rows);
    expect(report).toMatch(/stoneage\.clubber vs medieval\.squire/);
    expect(report).toMatch(/FLAG |No matchup above 65%/);
    // Visible when Grok (or anyone) runs the suite after a unit tweak.
    console.log(`\n${report}\n`);
  }, 60_000);
});
