import { describe, expect, it } from "vitest";
import { World } from "../World";

describe("jolt wasm lifetime", () => {
  it("place/clear does not grow the wasm heap", async () => {
    const world = new World(17);
    await world.init();

    const round = () => {
      for (let i = 0; i < 6; i++) {
        world.place({ defId: "stoneage.clubber", x: -8, z: -5 + i * 1.6, yaw: Math.PI / 2, side: 0 });
        world.place({ defId: "medieval.squire", x: 8, z: -5 + i * 1.6, yaw: -Math.PI / 2, side: 1 });
      }
      expect(world.units.length).toBeGreaterThan(0);
      world.clearUnits();
      expect(world.units).toHaveLength(0);
    };

    for (let i = 0; i < 4; i++) round();
    const free0 = world.physics.sampleFree();
    const total0 = world.physics.sampleHeap();
    expect(total0).toBeGreaterThan(0);

    for (let i = 0; i < 24; i++) round();
    world.place({ defId: "stoneage.clubber", x: -6, z: 0, yaw: Math.PI / 2, side: 0 });
    expect(world.units).toHaveLength(1);

    const free1 = world.physics.sampleFree();
    const total1 = world.physics.sampleHeap();
    expect(total1).toBe(total0);
    if (free0 > 0 && free1 > 0) {
      expect(free0 - free1).toBeLessThan(2_000_000);
    }
    world.dispose();
  }, 60_000);
});
