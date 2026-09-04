import { describe, expect, it } from "vitest";
import { UNITS } from "@/game/data/units";
import { deployYaw } from "./facing";
import { FIXED_DT } from "./constants";
import { World, type WorldSnapshot } from "./World";

const ROSTER = Object.values(UNITS).filter((u) => !u.id.startsWith("summon."));

function goBattle(world: World) {
  world.startCountdown();
  world.countdown = 0;
  world.step(FIXED_DT, 1, false);
}

function fmt(n: number) {
  return n.toFixed(5);
}

function poseFingerprint(snap: WorldSnapshot): string {
  return snap.units
    .map((u) => {
      const parts = Object.keys(u.parts)
        .sort()
        .map((k) => {
          const p = u.parts[k];
          return `${k}:${fmt(p.x)},${fmt(p.y)},${fmt(p.z)},${fmt(p.qx)},${fmt(p.qy)},${fmt(p.qz)},${fmt(p.qw)}`;
        })
        .join(";");
      return `${u.id}|${u.defId}|${u.state}|${fmt(u.hp)}|${fmt(u.root.x)},${fmt(u.root.y)},${fmt(u.root.z)}|${fmt(u.yaw)}|${parts}`;
    })
    .join("\n");
}

function assertFinite(snap: WorldSnapshot, label: string) {
  expect(Number.isFinite(snap.time), `${label} time`).toBe(true);
  for (const u of snap.units) {
    const nums = [u.hp, u.root.x, u.root.y, u.root.z, u.root.qx, u.root.qy, u.root.qz, u.root.qw, u.yaw, u.fade, u.scale];
    for (const n of nums) {
      expect(Number.isFinite(n), `${label} ${u.defId}#${u.id}`).toBe(true);
    }
    for (const [name, p] of Object.entries(u.parts)) {
      for (const n of [p.x, p.y, p.z, p.qx, p.qy, p.qz, p.qw]) {
        expect(Number.isFinite(n), `${label} ${u.defId} ${name}`).toBe(true);
      }
    }
  }
  for (const p of snap.projectiles) {
    expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), `${label} projectile`).toBe(true);
  }
}

async function seededFight(seed: number, steps: number): Promise<string> {
  const world = new World(seed);
  await world.init();
  world.place({ defId: "stoneage.clubber", x: -5, z: -1.5, yaw: deployYaw(0), side: 0 });
  world.place({ defId: "stoneage.clubber", x: -5, z: 1.5, yaw: deployYaw(0), side: 0 });
  world.place({ defId: "medieval.squire", x: 5, z: -1.5, yaw: deployYaw(1), side: 1 });
  world.place({ defId: "medieval.squire", x: 5, z: 1.5, yaw: deployYaw(1), side: 1 });
  goBattle(world);
  for (let i = 0; i < steps; i++) world.step(FIXED_DT, 1, false);
  const key = poseFingerprint(world.snapshot());
  world.dispose();
  return key;
}

function dist(world: World) {
  const a = world.units[0];
  const b = world.units[1];
  return Math.hypot(a.x - b.x, a.z - b.z);
}

describe("sim harness", () => {
  it("same seed yields identical body transforms after 600 steps", async () => {
    const a = await seededFight(2026, 600);
    const b = await seededFight(2026, 600);
    expect(a.length).toBeGreaterThan(80);
    expect(a).toBe(b);
  }, 60_000);

  it("every unit 1v1 for 30s does not throw or NaN", async () => {
    const world = new World(99);
    await world.init();
    const fails: string[] = [];
    for (const def of ROSTER) {
      const foe = def.id === "stoneage.clubber" ? "medieval.squire" : "stoneage.clubber";
      try {
        world.clearUnits();
        world.place({ defId: def.id, x: -8, z: 0, yaw: deployYaw(0), side: 0 });
        world.place({ defId: foe, x: 8, z: 0, yaw: deployYaw(1), side: 1 });
        goBattle(world);
        for (let i = 0; i < 30 * 60; i++) {
          world.step(FIXED_DT, 1, false);
          if (world.phase === "over") break;
        }
        assertFinite(world.snapshot(), def.id);
      } catch (err) {
        fails.push(`${def.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    world.dispose();
    expect(fails).toEqual([]);
  }, 180_000);

  it("stalemate rush drops keep-away so kiting units stop backing off", async () => {
    const world = new World(3);
    await world.init();
    world.place({ defId: "stoneage.shaman", x: -2.5, z: 0, yaw: deployYaw(0), side: 0 });
    world.place({ defId: "stoneage.shaman", x: 2.5, z: 0, yaw: deployYaw(1), side: 1 });
    goBattle(world);
    world.noDamageT = 16;
    const before = dist(world);
    for (let i = 0; i < 45; i++) world.step(FIXED_DT, 1, false);
    const after = dist(world);
    expect(after).toBeLessThan(before + 0.35);
    world.dispose();
  }, 30_000);

  it("kiting shamans let the no-damage clock reach 15s then rush in", async () => {
    const world = new World(5);
    await world.init();
    world.place({ defId: "stoneage.shaman", x: -10, z: 0, yaw: deployYaw(0), side: 0 });
    world.place({ defId: "stoneage.shaman", x: 10, z: 0, yaw: deployYaw(1), side: 1 });
    goBattle(world);
    for (let i = 0; i < 16 * 60; i++) world.step(FIXED_DT, 1, false);
    expect(world.noDamageT).toBeGreaterThan(15);
    expect(world.units.filter((u) => u.state !== "dead" && !u.gone)).toHaveLength(2);
    const parked = dist(world);
    expect(parked).toBeGreaterThan(6);
    world.dispose();
  }, 30_000);
});
