import { describe, expect, it } from "vitest";
import { World } from "./World";

describe("headless fight", () => {
  it("a clubber and a squire actually kill instead of timing out", async () => {
    const world = new World(7);
    await world.init();
    world.place({ defId: "stoneage.clubber", x: -4, z: 0, yaw: Math.PI / 2, side: 0 });
    world.place({ defId: "medieval.squire", x: 4, z: 0, yaw: -Math.PI / 2, side: 1 });
    world.startCountdown();
    for (let i = 0; i < 60 * 25; i++) {
      world.step(1 / 60, 1, false);
      if (world.phase === "over") break;
    }
    const dead = world.units.filter((u) => u.state === "dead" || u.gone).length;
    expect(dead).toBeGreaterThan(0);
    expect(world.phase).toBe("over");
    const snap = world.snapshot();
    expect(snap.phase).toBe("over");
    expect(snap.winner).not.toBeNull();
    world.stats();
    world.dispose();
  }, 30_000);

  it("place then clear then place again does not blow up", async () => {
    const world = new World(3);
    await world.init();
    for (let round = 0; round < 4; round++) {
      for (let i = 0; i < 4; i++) {
        world.place({ defId: "stoneage.clubber", x: -12, z: -4 + i * 2, yaw: Math.PI / 2, side: 0 });
        world.place({ defId: "stoneage.mammoth", x: 12, z: -4 + i * 2, yaw: -Math.PI / 2, side: 1 });
      }
      world.clearUnits();
      expect(world.units).toHaveLength(0);
    }
    world.place({ defId: "stoneage.clubber", x: -12, z: 0, yaw: Math.PI / 2, side: 0 });
    expect(world.units).toHaveLength(1);
    world.dispose();
  }, 30_000);
});
