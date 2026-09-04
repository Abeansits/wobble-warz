import {
  BRIDGE_Z,
  GRAVEYARD_STONES,
  MEADOW_BOULDERS,
  TRENCH_DEPTH,
  TRENCH_HALF,
  terrainHeight,
  type ArenaId,
} from "@/game/data/arenas";
import { getUnit } from "@/game/data/units";
import type { Placement, Side, UnitDef } from "@/game/data/types";
import { retarget, steer } from "./ai";
import { deployYaw } from "./facing";
import { applyDamage, killUnit } from "./combat";
import { ARENA_HALF_X, ARENA_HALF_Z, CORPSE_FADE, CORPSE_LIFE, FIXED_DT } from "./constants";
import { EventRing, type SimEvent } from "./events";
import { LAYER_PHASE, JoltWorld, type BodyHandle, type TransformSnap } from "./physics/joltWorld";
import { mulberry32, type Rng } from "./rng";
import type { Flying, PlaceOpts, SimCtx, Tombstone, TetherLink, UnitInternal } from "./unitTypes";
import { poseGait } from "./poses";
import { dropMountSpring, rootLift, spawnCoachRiders, syncMounts } from "./mounts";
import {
  clearShots,
  resolveMelee,
  stepShots,
  stepTethers,
  tickAura,
  tickChargeContacts,
  tryAttack,
} from "./weapons";

export { FIXED_DT, ARENA_HALF_X, ARENA_HALF_Z } from "./constants";
export type { UnitState, FaceState, UnitInternal } from "./unitTypes";

export type Phase = "setup" | "countdown" | "battle" | "over";

export type UnitView = {
  id: number;
  defId: string;
  side: Side;
  hp: number;
  maxHp: number;
  state: UnitInternal["state"];
  face: UnitInternal["face"];
  root: TransformSnap;
  parts: Record<string, TransformSnap>;
  flash: number;
  fade: number;
  scale: number;
  yaw: number;
};

export type ProjectileView = {
  x: number;
  y: number;
  z: number;
  r: number;
  kind: "rock" | "spear" | "arrow" | "boom";
};

export type WorldSnapshot = {
  time: number;
  phase: Phase;
  countdown: number;
  winner: 0 | 1 | "draw" | null;
  units: UnitView[];
  projectiles: ProjectileView[];
  counts: [number, number];
  hpPct: [number, number];
  physicsMs: number;
};

export type BattleStats = {
  spent: [number, number];
  lost: [number, number];
  damage: [number, number];
  mvpName: string;
  mvpSide: Side;
};

export class World implements SimCtx {
  physics = new JoltWorld();
  events = new EventRing();
  rng: Rng;
  seed: number;
  time = 0;
  phase: Phase = "setup";
  winner: 0 | 1 | "draw" | null = null;
  countdown = 0;
  units: UnitInternal[] = [];
  nextId = 1;
  acc = 0;
  lastPhysicsMs = 0;
  noDamageT = 0;
  startingHp: [number, number] = [0, 0];
  spent: [number, number] = [0, 0];
  hitStop = 0;
  slowmoT = 0;
  pendingWinner: 0 | 1 | "draw" | null = null;
  arena: ArenaId = "meadow";
  tethers: TetherLink[] = [];
  flying: Flying[] = [];
  nextShot = 1;
  scratch: TransformSnap = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
  bananaSide: 0 | 1 | null = null;
  stones: Tombstone[] = [];
  layout: Placement[] = [];
  private reinforceAt: [number | null, number | null] = [null, null];
  private windAt: [number | null, number | null] = [null, null];
  private potatoAt = 0;
  private potatoId: number | null = null;

  constructor(seed = 1) {
    this.seed = seed;
    this.rng = mulberry32(seed);
  }

  async init() {
    await this.physics.init();
    this.buildArena();
  }

  setArena(id: ArenaId) {
    this.arena = id;
    this.buildArena();
    for (const u of this.units) {
      if (u.state === "dead" || u.gone) continue;
      u.y = this.groundY(u.x, u.z) + rootLift(u.def.body.kind, u.def.body.scale);
      this.physics.setPosition(u.ragdoll.rootBody, u.x, u.y, u.z);
    }
  }

  private buildArena() {
    this.physics.beginArena();
    this.stones = [];
    const slope = Math.atan2(2, 60);
    if (this.arena === "meadow") {
      this.physics.createStaticBox(0, -0.6, 0, 40, 0.5, 28, 0, 0.85);
      this.physics.createStaticBox(0, 0.15, 0, 34, 0.18, 22, 0, 0.85, slope);
      for (const [x, y, z, r] of MEADOW_BOULDERS) {
        this.physics.createDynamicSphere(x, y, z, r, 18 * r * r * r);
      }
    } else if (this.arena === "canyon") {
      const rimY = 0.08;
      const leftCx = -(TRENCH_HALF + 16) / 2 - TRENCH_HALF / 2;
      this.physics.createStaticBox(-18, rimY - 0.4, 0, 15, 0.5, 28, 0, 0.9);
      this.physics.createStaticBox(18, rimY - 0.4, 0, 15, 0.5, 28, 0, 0.9);
      this.physics.createStaticBox(0, rimY - TRENCH_DEPTH - 0.25, 0, TRENCH_HALF + 0.2, 0.3, 28, 0, 0.7);
      for (const z of BRIDGE_Z) {
        this.physics.createStaticBox(0, rimY + 0.12, z, 3.4, 0.08, 0.55, 0, 0.6);
      }
    } else {
      this.physics.createStaticBox(0, -0.4, 0, 40, 0.5, 28, 0, 0.75);
      this.physics.createStaticBox(0, 0.02, 0, 6, 0.04, 6, 0, 0.04);
      for (const [x, z] of GRAVEYARD_STONES) {
        const y = this.groundY(x, z) + 0.55;
        const handle = this.physics.createStaticBox(x, y, z, 0.22, 0.55, 0.09, 0, 0.9);
        this.stones.push({ handle, x, y, z, hp: 40 });
      }
    }
    this.physics.endArena();
  }

  groundY(x = 0, z = 0) {
    return terrainHeight(x, z, this.arena);
  }

  place(p: Placement, opts: PlaceOpts = {}): number {
    const def: UnitDef = opts.def ?? getUnit(p.defId);
    const y = this.groundY(p.x, p.z) + 0.05;
    const layer = def.id === "haunted.ghost" ? LAYER_PHASE : undefined;
    const built = this.physics.createUnit(def, p.x, y, p.z, p.yaw, this.nextId, layer);
    const unit: UnitInternal = {
      id: this.nextId++,
      def,
      side: p.side,
      hp: def.body.hp,
      maxHp: def.body.hp,
      state: "idle",
      face: "idle",
      x: p.x,
      y: y + rootLift(def.body.kind, def.body.scale),
      z: p.z,
      yaw: p.yaw,
      ragdoll: built,
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
      aiTickOffset: this.units.length % 6,
      damageDealt: 0,
      swingHits: new Set(),
      chargeHits: new Set(),
      charging: false,
      deadT: 0,
      summoned: opts.summoned ?? false,
      gone: false,
      frozenCorpse: false,
      mounted: opts.mounted ?? false,
      mountId: null,
    };
    this.units.push(unit);
    if (!opts.free) this.spent[p.side] += def.cost;
    this.events.push({ type: "spawn", unitId: unit.id, defId: def.id, side: p.side });
    if (def.id === "frontier.stagecoach" && !opts.mounted) spawnCoachRiders(this, unit);
    return unit.id;
  }

  kill(u: UnitInternal, killerId: number | null) {
    killUnit(this, u, killerId);
  }

  damage(victim: UnitInternal, amount: number, knockback: number, attacker: UnitInternal | null) {
    applyDamage(this, victim, amount, knockback, attacker);
  }

  clearUnits() {
    for (const u of this.units) {
      dropMountSpring(this, u);
      try {
        this.physics.destroyRagdoll(u.ragdoll);
      } catch {
        try {
          this.physics.removeBody(u.ragdoll.rootBody);
        } catch {
          /* */
        }
      }
    }
    this.units = [];
    this.nextId = 1;
    this.time = 0;
    this.phase = "setup";
    this.winner = null;
    this.countdown = 0;
    this.acc = 0;
    this.spent = [0, 0];
    this.hitStop = 0;
    this.slowmoT = 0;
    this.pendingWinner = null;
    this.bananaSide = null;
    this.noDamageT = 0;
    this.startingHp = [0, 0];
    this.reinforceAt = [null, null];
    this.windAt = [null, null];
    this.potatoAt = 0;
    this.potatoId = null;
    clearShots(this);
  }

  replay() {
    const layout = this.layout.map((p) => ({ ...p }));
    this.clearUnits();
    for (const p of layout) this.place(p);
    this.layout = layout;
  }

  removeLast(side?: 0 | 1) {
    const idx =
      side == null
        ? [...this.units]
            .map((u, i) => ({ u, i }))
            .reverse()
            .find((x) => !x.u.mounted && !x.u.summoned)?.i
        : [...this.units]
            .map((u, i) => ({ u, i }))
            .reverse()
            .find((x) => x.u.side === side && !x.u.mounted && !x.u.summoned)?.i;
    if (idx == null || idx < 0) return null;
    return this.removeAt(idx);
  }

  removeById(id: number): UnitInternal | null {
    const unit = this.units.find((u) => u.id === id);
    if (!unit) return null;
    if (unit.mounted && unit.mountId != null) return this.removeById(unit.mountId);
    const idx = this.units.findIndex((u) => u.id === id);
    if (idx < 0) return null;
    return this.removeAt(idx);
  }

  private removeAt(idx: number) {
    const u = this.units[idx];
    const riderIds = this.units.filter((o) => o.mountId === u.id).map((o) => o.id);
    dropMountSpring(this, u);
    try {
      this.physics.destroyRagdoll(u.ragdoll);
    } catch {
      this.physics.removeBody(u.ragdoll.rootBody);
    }
    this.units.splice(idx, 1);
    if (!u.mounted && !u.summoned) this.spent[u.side] = Math.max(0, this.spent[u.side] - u.def.cost);
    for (const rid of riderIds) {
      const i = this.units.findIndex((o) => o.id === rid);
      if (i >= 0) this.removeAt(i);
    }
    return u;
  }

  clearSide(side: Side) {
    const keep = [];
    for (const u of this.units) {
      if (u.side !== side) {
        keep.push(u);
        continue;
      }
      dropMountSpring(this, u);
      try {
        this.physics.destroyRagdoll(u.ragdoll);
      } catch {
        this.physics.removeBody(u.ragdoll.rootBody);
      }
    }
    this.units = keep;
    this.spent[side] = 0;
  }

  mirrorSide(side: 0 | 1) {
    for (const u of this.units) {
      if (u.side !== side) continue;
      u.z = -u.z;
      u.yaw = -u.yaw;
      this.physics.setPosition(u.ragdoll.rootBody, u.x, u.y, u.z);
    }
  }

  startCountdown(powerups: [string[], string[]] = [[], []]) {
    this.layout = this.units
      .filter((u) => !u.summoned && !u.mounted)
      .map((u) => ({ defId: u.def.id, x: u.x, z: u.z, yaw: u.yaw, side: u.side }));
    this.phase = "countdown";
    this.countdown = 3;
    this.startingHp = [0, 0];
    this.applyPowerups(powerups);
    for (const u of this.units) {
      this.startingHp[u.side] += u.maxHp;
    }
  }

  applyPowerups(chosen: [string[], string[]]) {
    for (const u of this.units) {
      const ids = chosen[u.side] ?? [];
      if (ids.includes("iron")) {
        u.maxHp = Math.round(u.maxHp * 1.2);
        u.hp = u.maxHp;
      }
      if (ids.includes("boots")) {
        u.def = { ...u.def, body: { ...u.def.body, launchThreshold: u.def.body.launchThreshold * 1.35 } };
      }
    }
    for (const side of [0, 1] as const) {
      if (!(chosen[side] ?? []).includes("giant")) continue;
      const pool = this.units.filter((u) => u.side === side && u.state !== "dead" && !u.summoned && !u.mounted);
      const pick = pool[Math.floor(this.rng() * pool.length)];
      if (pick) {
        const p: Placement = { defId: pick.def.id, x: pick.x, z: pick.z, yaw: pick.yaw, side: pick.side };
        const scaled: UnitDef = {
          ...pick.def,
          body: {
            ...pick.def.body,
            scale: pick.def.body.scale * 2,
            massMult: pick.def.body.massMult * 8,
            hp: pick.def.body.hp * 2,
          },
        };
        const cost = pick.def.cost;
        const side = pick.side;
        this.removeById(pick.id);
        this.place(p, { free: true, def: scaled });
        this.spent[side] += cost;
      }
    }
    this.reinforceAt = [null, null];
    this.windAt = [null, null];
    this.potatoId = null;
    this.potatoAt = 0;
    this.bananaSide = null;
    for (const side of [0, 1] as const) {
      const ids = chosen[side] ?? [];
      if (ids.includes("reinforce")) this.reinforceAt[side] = 20;
      if (ids.includes("wind")) this.windAt[side] = 30;
      if (ids.includes("banana")) this.bananaSide = (side === 0 ? 1 : 0) as 0 | 1;
      if (ids.includes("potato")) {
        const foes = this.units.filter((u) => u.side !== side && u.state !== "dead");
        foes.sort((a, b) => b.def.cost - a.def.cost);
        if (foes[0]) {
          this.potatoId = foes[0].id;
          this.potatoAt = 5;
        }
      }
    }
    if (this.bananaSide != null) {
      const x = this.bananaSide === 0 ? -18 : 18;
      this.physics.createStaticBox(x, 0.04, 0, 8, 0.03, 12, 0, 0.03);
    }
  }

  private tickTimedPowerups() {
    for (const side of [0, 1] as const) {
      if (this.reinforceAt[side] != null && this.time >= this.reinforceAt[side]!) {
        this.reinforceAt[side] = null;
        const x0 = side === 0 ? -22 : 22;
        for (let i = 0; i < 5; i++) {
          try {
            this.place(
              {
                defId: "haunted.skeleton",
                x: x0,
                z: -6 + i * 3,
                yaw: deployYaw(side),
                side,
              },
              { free: true, summoned: true },
            );
          } catch {
            /* */
          }
        }
      }
      if (this.windAt[side] != null && this.time >= this.windAt[side]!) {
        this.windAt[side] = null;
        for (const u of this.units) {
          if (u.side === side && u.state !== "dead") u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.3);
        }
      }
    }
    if (this.potatoId != null && this.time >= this.potatoAt) {
      const u = this.units.find((n) => n.id === this.potatoId);
      this.potatoId = null;
      if (u && u.state !== "dead") {
        for (const o of this.units) {
          if (o.id === u.id || o.state === "dead") continue;
          if (Math.hypot(o.x - u.x, o.z - u.z) < 3.2) this.damage(o, 40, 22, null);
        }
      }
    }
  }

  step(dt: number, speed: number, paused: boolean) {
    if (this.phase === "countdown") {
      this.countdown -= Math.min(dt, 0.1);
      if (this.countdown > 0) return;
      this.countdown = 0;
      this.phase = "battle";
    }
    if (this.phase === "setup" || this.phase === "over") return;
    if (paused || speed === 0) return;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }
    const rate = this.slowmoT > 0 ? 0.22 : 1;
    const feed = Math.min(dt, 0.08) * speed * rate;
    this.acc += feed;
    let steps = 0;
    while (this.acc >= FIXED_DT && steps < 4) {
      this.fixedStep();
      this.acc -= FIXED_DT;
      steps++;
    }
  }

  private fixedStep() {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (this.phase === "setup" || this.phase === "over" || this.phase === "countdown") return;

    this.time += FIXED_DT;
    this.noDamageT += FIXED_DT;
    this.tickTimedPowerups();
    if (this.slowmoT > 0) {
      this.slowmoT -= FIXED_DT;
      if (this.slowmoT <= 0 && this.pendingWinner != null) {
        this.finish(this.pendingWinner);
        this.physics.step(FIXED_DT);
        this.lastPhysicsMs =
          (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
        return;
      }
    }
    const rush = this.noDamageT > 15;
    const stepIndex = Math.floor(this.time / FIXED_DT);
    syncMounts(this);

    for (const u of this.units) {
      if (u.gone) continue;
      if (u.state === "dead") {
        u.deadT += FIXED_DT;
        if (!u.frozenCorpse && u.deadT > 1 && this.physics.speedOf(u.ragdoll.bodyIds.pelvis) < 0.45) {
          for (const id of u.ragdoll.orderedIds) this.physics.freezeBody(id);
          u.frozenCorpse = true;
        }
        if (u.deadT > CORPSE_LIFE + CORPSE_FADE) {
          u.gone = true;
          try {
            this.physics.destroyRagdoll(u.ragdoll);
          } catch {
            /* */
          }
        }
        continue;
      }
      u.cooldown = Math.max(0, u.cooldown - FIXED_DT);
      u.slowT = Math.max(0, u.slowT - FIXED_DT);
      u.frozenT = Math.max(0, u.frozenT - FIXED_DT);
      if (u.def.id === "anomaly.bard") {
        for (const o of this.units) {
          if (o.side === u.side || o.state === "dead" || o.gone) continue;
          const d = Math.hypot(o.x - u.x, o.z - u.z);
          if (d > 8 || d < 0.4) continue;
          o.x += ((u.x - o.x) / d) * 1.6 * FIXED_DT;
          o.z += ((u.z - o.z) / d) * 1.6 * FIXED_DT;
          this.physics.setPosition(o.ragdoll.rootBody, o.x, o.y, o.z);
        }
      }
      u.flash = Math.max(0, u.flash - FIXED_DT);
      u.hurtT = Math.max(0, u.hurtT - FIXED_DT);
      if (u.hurtT <= 0 && u.swingT <= 0) u.face = u.state === "attack" ? "angry" : "idle";

      if (u.state === "launched") {
        u.launchT -= FIXED_DT;
        u.charging = false;
        if (u.launchT <= 0 && u.hp > 0) {
          u.state = "seek";
          this.physics.getTransform(u.ragdoll.bodyIds.pelvis, this.scratch);
          u.x = this.scratch.x;
          u.z = this.scratch.z;
          u.y = this.groundY(u.x, u.z) + rootLift(u.def.body.kind, u.def.body.scale);
          this.physics.endLaunch(u.ragdoll);
          this.physics.setActive(u.ragdoll.rootBody, true);
          this.physics.setPosition(u.ragdoll.rootBody, u.x, u.y, u.z);
        }
        continue;
      }

      if (u.state === "stunned") {
        u.stunT -= FIXED_DT;
        u.charging = false;
        if (u.stunT <= 0 && u.frozenT <= 0) u.state = "seek";
      }

      if (stepIndex % 6 === u.aiTickOffset) {
        retarget(this, u);
        tickAura(this, u);
      }

      if (u.state !== "stunned" && u.frozenT <= 0) {
        steer(this, u, rush);
        tryAttack(this, u);
        tickChargeContacts(this, u);
      }

      const swingDur = "swingSeconds" in u.def.weapon ? u.def.weapon.swingSeconds : 0.35;
      if (u.swingT > 0) {
        u.swingT -= FIXED_DT;
        const t = 1 - u.swingT / swingDur;
        if (t > 0.25 && t < 0.7) resolveMelee(this, u);
        if (u.swingT <= 0) u.swingHits.clear();
      }

      this.physics.drivePose(u.ragdoll, {
        time: this.time,
        gait: poseGait(u),
        swingT: u.swingT,
        swingDur,
        phase: u.id * 0.73,
        hurtT: u.hurtT,
        kind: u.def.body.kind,
        charging: u.charging,
      });
      this.physics.moveKinematic(u.ragdoll.rootBody, u.x, u.y, u.z, u.yaw, FIXED_DT);

      if (Math.abs(u.x) > ARENA_HALF_X + 4 || Math.abs(u.z) > ARENA_HALF_Z + 4) {
        this.kill(u, u.lastHitBy);
      }
    }

    stepShots(this);
    stepTethers(this);
    this.physics.step(FIXED_DT);
    this.checkVictory();

    this.lastPhysicsMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  }

  private checkVictory() {
    if (this.phase !== "battle") return;
    const alive: [number, number] = [0, 0];
    const hp: [number, number] = [0, 0];
    for (const u of this.units) {
      if (u.state !== "dead" && !u.gone) {
        alive[u.side]++;
        hp[u.side] += Math.max(0, u.hp);
      }
    }
    if (alive[0] === 0 && alive[1] === 0) {
      this.beginSlowmo("draw");
      return;
    }
    if (alive[0] === 0) {
      this.beginSlowmo(1);
      return;
    }
    if (alive[1] === 0) {
      this.beginSlowmo(0);
      return;
    }
    if (this.time >= 120) {
      const p0 = this.startingHp[0] ? hp[0] / this.startingHp[0] : 0;
      const p1 = this.startingHp[1] ? hp[1] / this.startingHp[1] : 0;
      this.finish(p0 === p1 ? "draw" : p0 > p1 ? 0 : 1);
    }
  }

  private beginSlowmo(winner: 0 | 1 | "draw") {
    if (this.pendingWinner != null) return;
    this.pendingWinner = winner;
    this.slowmoT = 1.4;
  }

  private finish(winner: 0 | 1 | "draw") {
    this.phase = "over";
    this.winner = winner;
    this.events.push({ type: "victory", winner });
  }

  snapshot(): WorldSnapshot {
    const views: UnitView[] = [];
    const counts: [number, number] = [0, 0];
    const hp: [number, number] = [0, 0];
    for (const u of this.units) {
      if (u.gone) continue;
      const parts: Record<string, TransformSnap> = {};
      for (const [name, handle] of Object.entries(u.ragdoll.bodyIds) as [string, BodyHandle][]) {
        const t: TransformSnap = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
        this.physics.getTransform(handle, t);
        parts[name] = t;
      }
      const root: TransformSnap = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
      if (u.state !== "dead") this.physics.getTransform(u.ragdoll.rootBody, root);
      else root.x = parts.pelvis?.x ?? u.x;
      if (u.state !== "dead") {
        counts[u.side]++;
        hp[u.side] += Math.max(0, u.hp);
      }
      const fade =
        u.state === "dead" ? (u.deadT < CORPSE_LIFE ? 0 : Math.min(1, (u.deadT - CORPSE_LIFE) / CORPSE_FADE)) : 0;
      views.push({
        id: u.id,
        defId: u.def.id,
        side: u.side,
        hp: u.hp,
        maxHp: u.maxHp,
        state: u.state,
        face: u.face,
        root,
        parts,
        flash: u.flash,
        fade,
        scale: u.def.body.scale,
        yaw: u.yaw,
      });
    }
    const hpPct: [number, number] = [
      this.startingHp[0] ? hp[0] / this.startingHp[0] : 1,
      this.startingHp[1] ? hp[1] / this.startingHp[1] : 1,
    ];
    return {
      time: this.time,
      phase: this.phase,
      countdown: this.countdown,
      winner: this.winner,
      units: views,
      projectiles: this.flying.map((s) => {
        const t: TransformSnap = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
        this.physics.getTransform(s.body, t);
        return { x: t.x, y: t.y, z: t.z, r: s.kind === "boom" ? 0.28 : 0.16, kind: s.kind };
      }),
      counts,
      hpPct,
      physicsMs: this.lastPhysicsMs,
    };
  }

  stats(): BattleStats {
    const lost: [number, number] = [0, 0];
    const damage: [number, number] = [0, 0];
    let mvp = this.units[0];
    for (const u of this.units) {
      if (u.state === "dead" || u.gone) lost[u.side]++;
      damage[u.side] += u.damageDealt;
      if (!mvp || u.damageDealt > mvp.damageDealt) mvp = u;
    }
    return {
      spent: [...this.spent],
      lost,
      damage,
      mvpName: mvp?.def.name ?? "—",
      mvpSide: mvp?.side ?? 0,
    };
  }

  drainEvents(): SimEvent[] {
    return this.events.drain();
  }

  dispose() {
    this.physics.dispose();
  }
}
