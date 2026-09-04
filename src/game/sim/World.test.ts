import { describe, expect, it } from "vitest";
import { rosterFor, UNITS } from "@/game/data/units";
import { applyDamage } from "./combat";
import { CORPSE_LIFE, CORPSE_LIFE_MAX, CORPSE_LIFE_MIN } from "./constants";
import { mulberry32 } from "./rng";
import type { SimCtx, UnitInternal } from "./unitTypes";
import { World } from "./World";

describe("mulberry32", () => {
  it("is deterministic for a seed", () => {
    const a = mulberry32(2026);
    const b = mulberry32(2026);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).toEqual(seqB);
  });
});

describe("roster", () => {
  it("has thirty base units plus anomalies", () => {
    const base = Object.values(UNITS).filter((u) => u.faction !== "anomaly" && !u.id.startsWith("summon."));
    expect(base.length).toBe(30);
    expect(rosterFor("stoneage").length).toBe(6);
  });
});

describe("applyDamage", () => {
  function stubVictim(hp: number): UnitInternal {
    return {
      id: 1,
      def: {
        id: "stoneage.clubber",
        faction: "stoneage",
        name: "Clubber",
        blurb: "",
        cost: 60,
        body: { kind: "humanoid", scale: 1, massMult: 1, hp: 100, speed: 3, springStiffness: 18, launchThreshold: 80 },
        weapon: { kind: "melee", damage: 22, knockback: 18, range: 1.7, cooldown: 1, swingSeconds: 0.3 },
        ai: { targeting: "nearest" },
        recipe: { parts: [] },
        palette: { primary: "#000000", secondary: "#000000", accent: "#000000", skin: "#000000" },
        audio: { attack: "swing", hit: "hit", death: "yelp" },
      },
      side: 0,
      hp,
      maxHp: 100,
      state: "seek",
      face: "idle",
      x: 0,
      y: 1,
      z: 0,
      yaw: 0,
      ragdoll: { bodyIds: { torso: 1, pelvis: 2, head: 3, armL: 4, armR: 5, legs: 6 }, orderedIds: [2, 1, 3, 4, 5, 6] } as unknown as UnitInternal["ragdoll"],
      cooldown: 0,
      swingT: 0,
      launchT: 0,
      stunT: 0,
      hurtT: 0,
      slowT: 0,
      frozenT: 0,
      targetId: null,
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

  it("kills when hp drops to 0", () => {
    const victim = stubVictim(10);
    const killed: number[] = [];
    const sim = {
      units: [victim],
      noDamageT: 1,
      hitStop: 0,
      stones: [],
      planks: [],
      events: { push() {} },
      physics: { applyImpulse() {} },
      kill: (u: UnitInternal) => {
        u.state = "dead";
        u.hp = 0;
        killed.push(u.id);
      },
    } as unknown as SimCtx;
    applyDamage(sim, victim, 22, 8, null);
    expect(killed).toEqual([1]);
    expect(victim.state).toBe("dead");
  });

  it("does not kill when hp remains", () => {
    const victim = stubVictim(100);
    const killed: number[] = [];
    const sim = {
      units: [victim],
      noDamageT: 1,
      hitStop: 0,
      stones: [],
      planks: [],
      events: { push() {} },
      physics: { applyImpulse() {} },
      kill: (u: UnitInternal) => {
        u.state = "dead";
        killed.push(u.id);
      },
    } as unknown as SimCtx;
    applyDamage(sim, victim, 22, 8, null);
    expect(killed).toEqual([]);
    expect(victim.hp).toBe(78);
    expect(victim.state).toBe("seek");
  });
});

describe("corpseLife setting", () => {
  it("defaults to 6s and honors the slider, including degrade and clamps", () => {
    const w = new World(1);
    expect(w.corpseLife()).toBe(CORPSE_LIFE);
    w.setCorpseLife(12);
    expect(w.corpseLife()).toBe(12);
    w.degraded = true;
    expect(w.corpseLife()).toBe(6);
    w.degraded = false;
    w.setCorpseLife(0);
    expect(w.corpseLife()).toBe(CORPSE_LIFE_MIN);
    w.setCorpseLife(99);
    expect(w.corpseLife()).toBe(CORPSE_LIFE_MAX);
    w.setCorpseLife(Number.NaN);
    expect(w.corpseLife()).toBe(CORPSE_LIFE);
  });
});
