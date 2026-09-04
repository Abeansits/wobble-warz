import { describe, expect, it } from "vitest";
import { useGame } from "@/store/gameStore";
import { startHotseat } from "./hotseat";
import { useProfiles } from "./profiles";

describe("startHotseat", () => {
  it("seats Blue and Red and opens a fresh hot-seat match", () => {
    useProfiles.setState({ profiles: [], p1: "", p2: "" });
    useGame.getState().startLadder(3, 1400);
    const result = startHotseat();
    expect(result).toEqual({ ok: true });
    const s = useProfiles.getState();
    expect(s.profiles.map((p) => p.name)).toEqual(["Blue", "Red"]);
    expect(s.p1).not.toBe(s.p2);
    const g = useGame.getState();
    expect(g.vsAI).toBe(false);
    expect(g.ladderLevel).toBeNull();
    expect(g.seat).toBe("setupP1");
  });

  it("refuses when both seats are the same profile", () => {
    startHotseat();
    const id = useProfiles.getState().p1;
    useProfiles.setState({ p2: id });
    expect(startHotseat()).toEqual({ ok: false, reason: "same" });
  });
});
