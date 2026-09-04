import { describe, expect, it } from "vitest";
import { PRIZE_COLOR, prizeLabel, rollPrize } from "./rolls";

describe("rollPrize", () => {
  it("pity 19 always hands an anomaly", () => {
    for (let i = 0; i < 12; i++) {
      expect(rollPrize(19).kind).toBe("anomaly");
    }
  });

  it("labels credits and anomalies", () => {
    expect(prizeLabel({ kind: "credits", amount: 150 })).toContain("150");
    expect(prizeLabel({ kind: "anomaly", id: "anomaly.jelly", name: "Jelly Titan" })).toMatch(/ANOMALY/);
    expect(PRIZE_COLOR.anomaly).toBe("#d4a017");
  });
});
