import { describe, expect, it } from "vitest";
import { damagePlank } from "./combat";
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

  it("mammoth is a 4-leg ragdoll, cannon is a low static chassis", async () => {
    const world = new World(5);
    await world.init();
    const mid = world.place({ defId: "stoneage.mammoth", x: -6, z: 0, yaw: Math.PI / 2, side: 0 });
    const cid = world.place({ defId: "pirate.cannon", x: 6, z: 0, yaw: -Math.PI / 2, side: 1 });
    const mammoth = world.units.find((u) => u.id === mid)!;
    const cannon = world.units.find((u) => u.id === cid)!;
    expect(mammoth.ragdoll.orderedIds).toHaveLength(7);
    expect(mammoth.ragdoll.bodyIds.legFL).toBeDefined();
    expect(mammoth.ragdoll.bodyIds.legBR).toBeDefined();
    expect(mammoth.ragdoll.bodyIds.armL).toBe(mammoth.ragdoll.bodyIds.legFL);
    expect(cannon.ragdoll.orderedIds).toHaveLength(6);
    expect(cannon.y).toBeLessThan(mammoth.y);
    world.dispose();
  }, 30_000);

  it("stagecoach carries two gunslingers who spill alive when it flips", async () => {
    const world = new World(11);
    await world.init();
    world.place({ defId: "frontier.stagecoach", x: 0, z: 0, yaw: 0, side: 0 });
    expect(world.spent[0]).toBe(850);
    const coach = world.units.find((u) => u.def.id === "frontier.stagecoach")!;
    const riders = world.units.filter((u) => u.def.id === "frontier.gunslinger");
    expect(world.units).toHaveLength(3);
    expect(riders).toHaveLength(2);
    expect(riders.every((r) => r.mounted && r.mountId === coach.id)).toBe(true);

    world.startCountdown();
    for (let i = 0; i < 20; i++) world.step(1 / 60, 1, false);

    world.damage(coach, 10, 200, null);
    expect(coach.state).toBe("launched");
    for (const r of riders) {
      expect(r.mounted).toBe(false);
      expect(r.state).not.toBe("dead");
      expect(r.hp).toBeGreaterThan(0);
    }
    world.dispose();
  }, 30_000);

  it("lod ragdoll is 4 bodies with torso aliased to pelvis", async () => {
    const world = new World(2);
    await world.init();
    const id = world.place({ defId: "haunted.skeleton", x: 0, z: 0, yaw: 0, side: 0 }, { summoned: true, lod: true, free: true });
    const u = world.units.find((n) => n.id === id)!;
    expect(u.ragdoll.orderedIds).toHaveLength(4);
    expect(u.ragdoll.bodyIds.torso).toBe(u.ragdoll.bodyIds.pelvis);
    expect(u.ragdoll.bodyIds.armR).toBe(u.ragdoll.bodyIds.armL);
    world.dispose();
  }, 30_000);

  it("canyon planks hold the walkway until they are shot out", async () => {
    const world = new World(9);
    await world.init();
    world.setArena("canyon");
    expect(world.planks).toHaveLength(12);
    const mid = world.planks.find((p) => Math.abs(p.x) < 0.6 && Math.abs(p.z - 8) < 0.2);
    expect(mid).toBeTruthy();
    const yWalk = world.groundY(mid!.x, mid!.z);
    expect(yWalk).toBeGreaterThan(0.2);
    damagePlank(world, mid!, 99);
    expect(mid!.gone).toBe(true);
    expect(world.groundY(mid!.x, mid!.z)).toBeLessThan(yWalk - 0.4);
    expect(world.snapshot().planks).toHaveLength(11);
    world.dispose();
  }, 30_000);
});
