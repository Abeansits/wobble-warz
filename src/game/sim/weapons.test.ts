import { describe, expect, it } from "vitest";
import { getUnit } from "@/game/data/units";
import type { SimEvent } from "./events";
import type { SimCtx, UnitInternal } from "./unitTypes";
import type { Flying } from "./unitTypes";
import { applyCheerSprings, emitShot, explode, shotKind, stepShots, tickAura, tryAttack } from "./weapons";

function stub(partial: Partial<UnitInternal> & { defId: string; id: number; side: 0 | 1 }): UnitInternal {
  const def = getUnit(partial.defId);
  return {
    id: partial.id,
    def,
    side: partial.side,
    hp: partial.hp ?? def.body.hp,
    maxHp: def.body.hp,
    state: partial.state ?? "seek",
    face: "idle",
    x: partial.x ?? 0,
    y: partial.y ?? 1,
    z: partial.z ?? 0,
    yaw: 0,
    ragdoll: {
      bodyIds: { torso: 1, pelvis: 2, head: 3, armL: 4, armR: 5, legs: 6 },
      orderedIds: [2, 1, 3, 4, 5, 6],
    } as unknown as UnitInternal["ragdoll"],
    cooldown: 0,
    swingT: 0,
    launchT: 0,
    stunT: 0,
    stunImmuneT: 0,
    hurtT: 0,
    slowT: 0,
    frozenT: 0,
    targetId: partial.targetId ?? null,
    flash: 0,
    lastHitBy: null,
    aiTickOffset: 0,
    damageDealt: 0,
    swingHits: new Set(),
    chargeHits: new Set(),
    charging: false,
    steered: false,
    deadT: 0,
    summoned: false,
    gone: false,
    frozenCorpse: false,
    mounted: false,
    mountId: null,
  };
}

function simOf(units: UnitInternal[], events: SimEvent[]): SimCtx {
  return {
    units,
    events: { push: (e: SimEvent) => events.push(e), drain: () => events.splice(0) },
    physics: {
      raycast: () => null,
      getTransform: (_id: number, out: { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number }) => {
        out.x = units[0]?.x ?? 0;
        out.y = (units[0]?.y ?? 1) + 0.4;
        out.z = units[0]?.z ?? 0;
        out.qx = 0;
        out.qy = 0;
        out.qz = 0;
        out.qw = 1;
      },
      applyImpulse: () => {},
      setActive: () => {},
      beginLaunch: () => {},
      applySpringBoost: () => {},
      removeBody: () => {},
    },
    noDamageT: 0,
    hitStop: 0,
    stones: [],
    planks: [],
    debris: [],
    flying: [],
    nextShot: 1,
    scratch: { x: 0, y: 1, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
    groundY: () => 0,
    arena: "meadow",
    rng: () => 0.5,
    time: 0,
    kill: (u: UnitInternal) => {
      u.state = "dead";
      u.hp = 0;
    },
  } as unknown as SimCtx;
}

function bombShot(partial: Partial<Flying> = {}): Flying {
  return {
    id: 1,
    body: 99,
    ownerId: 1,
    side: 0,
    damage: 60,
    knockback: 22,
    radius: 2.5,
    life: 6,
    linger: 0,
    explosive: true,
    fuse: 2,
    armed: 0,
    fuseOnGround: false,
    kind: "boom",
    hit: new Set(),
    ...partial,
  };
}

describe("shotKind", () => {
  it("maps every ranged def to a visible flavor", () => {
    expect(shotKind("stoneage.rocklobber", "projectile")).toBe("rock");
    expect(shotKind("stoneage.spearchucker", "projectile")).toBe("spear");
    expect(shotKind("medieval.archer", "projectile")).toBe("arrow");
    expect(shotKind("medieval.trebuchet", "explosive")).toBe("boom");
    expect(shotKind("pirate.cannon", "explosive")).toBe("boom");
    expect(shotKind("haunted.pumpkin", "status")).toBe("pumpkin");
    expect(shotKind("anomaly.ice", "status")).toBe("ice");
  });
});

describe("hitscan tracers", () => {
  it("emits origin and impact for a gunslinger shot", () => {
    const gun = stub({ defId: "frontier.gunslinger", id: 1, side: 0, x: 0, z: 0, targetId: 2 });
    const foe = stub({ defId: "medieval.squire", id: 2, side: 1, x: 8, z: 0 });
    const events: SimEvent[] = [];
    tryAttack(simOf([gun, foe], events), gun);
    const shot = events.find((e) => e.type === "shot");
    expect(shot?.type).toBe("shot");
    if (shot?.type !== "shot") return;
    expect(shot.flavor).toBe("hitscan");
    expect(shot.tx).toBeCloseTo(16);
    expect(Math.hypot(shot.tx - shot.ox, shot.tz - shot.oz)).toBeGreaterThan(4);
  });

  it("emitShot records a muzzle-to-target beam", () => {
    const gun = stub({ defId: "pirate.musketeer", id: 1, side: 0, x: -4, y: 1.2, z: 1 });
    const events: SimEvent[] = [];
    emitShot(simOf([gun], events), gun, "hitscan", { x: 10, y: 1, z: 1 });
    const shot = events[0];
    expect(shot.type).toBe("shot");
    if (shot.type !== "shot") return;
    expect(shot.flavor).toBe("hitscan");
    expect(shot.ox).toBeCloseTo(-4);
    expect(shot.tx).toBeCloseTo(10);
  });
});

describe("splat emitters", () => {
  it("heal aura sparkles on wounded allies", () => {
    const shaman = stub({ defId: "stoneage.shaman", id: 1, side: 0, x: 0, z: 0 });
    const pal = stub({ defId: "stoneage.clubber", id: 2, side: 0, x: 1, z: 0, hp: 40 });
    const events: SimEvent[] = [];
    tickAura(simOf([shaman, pal], events), shaman);
    expect(events.some((e) => e.type === "splat" && e.kind === "heal")).toBe(true);
    expect(pal.hp).toBeGreaterThan(40);
  });
});

describe("explosive fuse", () => {
  it("explodes a miss when the fuse runs out instead of vanishing", () => {
    const bomber = stub({ defId: "pirate.bomber", id: 1, side: 0, x: 0, z: 0 });
    const foe = stub({ defId: "medieval.squire", id: 2, side: 1, x: 20, z: 0 });
    const events: SimEvent[] = [];
    const sim = simOf([bomber, foe], events);
    let removed = false;
    sim.flying = [bombShot({ fuse: 0.01, armed: 0 })];
    sim.physics.getTransform = (_id, out) => {
      out.x = 5;
      out.y = 2;
      out.z = 0;
      out.qx = 0;
      out.qy = 0;
      out.qz = 0;
      out.qw = 1;
    };
    sim.physics.removeBody = () => {
      removed = true;
    };
    stepShots(sim);
    expect(sim.flying).toHaveLength(0);
    expect(removed).toBe(true);
    expect(events.some((e) => e.type === "splat" && e.kind === "boom")).toBe(true);
  });

  it("cooks a friendly once armed, not while leaving the hand", () => {
    const bomber = stub({ defId: "pirate.bomber", id: 1, side: 0, x: 0, z: 0 });
    const pal = stub({ defId: "pirate.deckhand", id: 2, side: 0, x: 0.4, z: 0 });
    const events: SimEvent[] = [];
    const sim = simOf([bomber, pal], events);
    sim.physics.getTransform = (_id, out) => {
      out.x = 0.2;
      out.y = 1;
      out.z = 0;
      out.qx = 0;
      out.qy = 0;
      out.qz = 0;
      out.qw = 1;
    };
    sim.physics.removeBody = () => {};
    sim.flying = [bombShot({ fuse: 1.5, armed: 0.2, ownerId: 1 })];
    stepShots(sim);
    expect(sim.flying).toHaveLength(1);
    expect(pal.hp).toBe(pal.maxHp);

    sim.flying[0].armed = 0;
    stepShots(sim);
    expect(sim.flying).toHaveLength(0);
    expect(pal.hp).toBeLessThan(pal.maxHp);
  });

  it("blast hits both sides", () => {
    const dan = stub({ defId: "frontier.dynamite", id: 1, side: 0, x: 0, z: 0 });
    const pal = stub({ defId: "frontier.brawler", id: 2, side: 0, x: 1, z: 0 });
    const foe = stub({ defId: "medieval.squire", id: 3, side: 1, x: 1.2, z: 0 });
    const events: SimEvent[] = [];
    const sim = simOf([dan, pal, foe], events);
    explode(sim, 0.5, 0, bombShot({ radius: 3, damage: 70, knockback: 24, ownerId: 1 }), dan);
    expect(pal.hp).toBeLessThan(pal.maxHp);
    expect(foe.hp).toBeLessThan(foe.maxHp);
    expect(events.some((e) => e.type === "splat" && e.kind === "boom")).toBe(true);
  });
});

describe("cheer spring aura", () => {
  it("stiffens nearby allies and restores 1× outside / on enemies", () => {
    const cheer = stub({ defId: "anomaly.cheer", id: 1, side: 0, x: 0, z: 0 });
    const pal = stub({ defId: "stoneage.clubber", id: 2, side: 0, x: 1, z: 0 });
    const far = stub({ defId: "stoneage.clubber", id: 3, side: 0, x: 20, z: 0 });
    const foe = stub({ defId: "medieval.squire", id: 4, side: 1, x: 1, z: 0 });
    const flying = stub({ defId: "stoneage.clubber", id: 5, side: 0, x: 1, z: 1, state: "launched" });
    const seen: { id: number; mul: number }[] = [];
    const sim = simOf([cheer, pal, far, foe, flying], []);
    sim.physics.applySpringBoost = (ragdoll, mul) => {
      const who = [cheer, pal, far, foe, flying].find((u) => u.ragdoll === ragdoll);
      seen.push({ id: who?.id ?? -1, mul });
    };
    applyCheerSprings(sim);
    expect(seen.find((s) => s.id === 1)?.mul).toBeCloseTo(1.5);
    expect(seen.find((s) => s.id === 2)?.mul).toBeCloseTo(1.5);
    expect(seen.find((s) => s.id === 3)?.mul).toBe(1);
    expect(seen.find((s) => s.id === 4)?.mul).toBe(1);
    expect(seen.some((s) => s.id === 5)).toBe(false);
  });
});
