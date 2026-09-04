import { describe, expect, it } from "vitest";
import { deployYaw } from "./facing";
import { FIXED_DT } from "./constants";
import { World } from "./World";

function part(world: World, defId: string, name: string) {
  const u = world.snapshot().units.find((n) => n.defId === defId);
  expect(u, defId).toBeTruthy();
  const p = u!.parts[name];
  expect(p, `${defId}.${name}`).toBeTruthy();
  return p;
}

function playToGo(world: World) {
  world.startCountdown();
  let guard = 0;
  while (world.phase === "countdown" && guard++ < 400) world.step(FIXED_DT, 1, false);
  expect(world.phase).toBe("battle");
}

describe("spawn stance", () => {
  it("clubber stays upright through countdown and GO", async () => {
    const world = new World(1);
    await world.init();
    world.place({ defId: "stoneage.clubber", x: -8, z: 0, yaw: deployYaw(0), side: 0 });
    world.place({ defId: "medieval.squire", x: 8, z: 0, yaw: deployYaw(1), side: 1 });

    const spawnHead = part(world, "stoneage.clubber", "head");
    const spawnPelvis = part(world, "stoneage.clubber", "pelvis");
    const spawnRise = spawnHead.y - spawnPelvis.y;

    world.startCountdown();
    for (let i = 0; i < Math.round(2.9 / FIXED_DT); i++) world.step(FIXED_DT, 1, false);
    expect(world.phase).toBe("countdown");
    const pre = part(world, "stoneage.clubber", "head");
    expect(pre.y, `pre-GO head dropped ${spawnHead.y - pre.y}`).toBeGreaterThan(spawnHead.y - 0.16);

    let guard = 0;
    while (world.phase === "countdown" && guard++ < 40) world.step(FIXED_DT, 1, false);
    expect(world.phase).toBe("battle");

    const atGo = () => {
      const head = part(world, "stoneage.clubber", "head");
      const pelvis = part(world, "stoneage.clubber", "pelvis");
      return {
        head,
        pelvis,
        rise: head.y - pelvis.y,
        bow: Math.hypot(head.x - pelvis.x, head.z - pelvis.z),
      };
    };

    const go = atGo();
    expect(go.head.y, `GO head dropped ${spawnHead.y - go.head.y} (pre ${spawnHead.y - pre.y})`).toBeGreaterThan(spawnHead.y - 0.16);
    expect(go.rise, `GO spine collapsed ${spawnRise} → ${go.rise}`).toBeGreaterThan(spawnRise - 0.1);
    expect(go.bow, `GO bowed ${go.bow}`).toBeLessThan(0.22);

    for (let i = 0; i < Math.round(1.2 / FIXED_DT); i++) world.step(FIXED_DT, 1, false);
    const later = atGo();
    expect(later.rise, `1.2s spine collapsed ${spawnRise} → ${later.rise}`).toBeGreaterThan(spawnRise - 0.12);
    expect(later.bow, `1.2s bowed ${later.bow}`).toBeLessThan(0.28);
    world.dispose();
  }, 30_000);

  it("mammoth hips stay planted through countdown and GO", async () => {
    const world = new World(2);
    await world.init();
    world.place({ defId: "stoneage.mammoth", x: -8, z: 0, yaw: deployYaw(0), side: 0 });
    world.place({ defId: "medieval.squire", x: 8, z: 0, yaw: deployYaw(1), side: 1 });

    const spawnPelvis = part(world, "stoneage.mammoth", "pelvis");
    playToGo(world);

    const pelvis = part(world, "stoneage.mammoth", "pelvis");
    const head = part(world, "stoneage.mammoth", "head");
    expect(pelvis.y, `pelvis dropped ${spawnPelvis.y - pelvis.y}`).toBeGreaterThan(spawnPelvis.y - 0.25);
    expect(head.y, "head hit the dirt").toBeGreaterThan(pelvis.y - 0.35);
    world.dispose();
  }, 30_000);
});
