import { describe, expect, it } from "vitest";
import { getUnit } from "@/game/data/units";
import type { SimEvent } from "./events";
import type { SimCtx, UnitInternal } from "./unitTypes";
import { emitShot, tickAura, tryAttack } from "./weapons";

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
    },
    noDamageT: 0,
    hitStop: 0,
    stones: [],
    planks: [],
    debris: [],
    arena: "meadow",
    rng: () => 0.5,
    time: 0,
    kill: (u: UnitInternal) => {
      u.state = "dead";
      u.hp = 0;
    },
  } as unknown as SimCtx;
}

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
    expect(shot.tx).toBeCloseTo(8);
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
