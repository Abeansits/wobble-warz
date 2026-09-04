import { getUnit } from "@/game/data/units";
import type { Placement, Side, UnitDef } from "@/game/data/types";
import { EventRing, type SimEvent } from "./events";
import { mulberry32, type Rng } from "./rng";
import {
  JoltWorld,
  type BuiltRagdoll,
  type BodyHandle,
  type TransformSnap,
} from "./physics/joltWorld";

export const FIXED_DT = 1 / 60;
export const ARENA_HALF_X = 30;
export const ARENA_HALF_Z = 20;

export type UnitState = "idle" | "seek" | "attack" | "stunned" | "launched" | "dead";
export type FaceState = "idle" | "angry" | "hurt" | "dead";
export type Phase = "setup" | "countdown" | "battle" | "over";

export type UnitView = {
  id: number;
  defId: string;
  side: Side;
  hp: number;
  maxHp: number;
  state: UnitState;
  face: FaceState;
  root: TransformSnap;
  parts: Record<string, TransformSnap>;
  flash: number;
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

type UnitInternal = {
  id: number;
  def: UnitDef;
  side: Side;
  hp: number;
  maxHp: number;
  state: UnitState;
  face: FaceState;
  x: number;
  y: number;
  z: number;
  yaw: number;
  ragdoll: BuiltRagdoll;
  cooldown: number;
  swingT: number;
  launchT: number;
  stunT: number;
  hurtT: number;
  targetId: number | null;
  flash: number;
  lastHitBy: number | null;
  aiTickOffset: number;
  damageDealt: number;
  swingHits: Set<number>;
  charging: boolean;
};

type Flying = {
  id: number;
  body: BodyHandle;
  ownerId: number;
  side: Side;
  damage: number;
  knockback: number;
  radius: number;
  life: number;
  linger: number;
  explosive: boolean;
  kind: ProjectileView["kind"];
  hit: Set<number>;
};

export class World {
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
  private nextShot = 1;
  private flying: Flying[] = [];
  private scratch: TransformSnap = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };

  constructor(seed = 1) {
    this.seed = seed;
    this.rng = mulberry32(seed);
  }

  async init() {
    await this.physics.init();
    this.buildArena();
  }

  private buildArena() {
    const slope = Math.atan2(2, 60);
    this.physics.createStaticBox(0, -0.5, 0, 40, 0.5, 28, 0);
    this.physics.createStaticBox(0, 0.2, 0, 32, 0.2, 22, slope);
    const boulders: [number, number, number, number][] = [
      [-8, 0.7, 6, 0.7],
      [6, 1.1, -7, 1.1],
      [14, 0.55, 8, 0.55],
      [-16, 0.8, -5, 0.8],
    ];
    for (const [x, y, z, r] of boulders) {
      this.physics.createStaticSphere(x, y, z, r);
    }
  }

  groundY(_x?: number) {
    return 0.45;
  }

  place(p: Placement): number {
    const def = getUnit(p.defId);
    const y = this.groundY(p.x) + 0.05;
    const built = this.physics.createHumanoid(def, p.x, y, p.z, p.yaw, this.nextId);
    const unit: UnitInternal = {
      id: this.nextId++,
      def,
      side: p.side,
      hp: def.body.hp,
      maxHp: def.body.hp,
      state: "idle",
      face: "idle",
      x: p.x,
      y: y + 0.95 * def.body.scale,
      z: p.z,
      yaw: p.yaw,
      ragdoll: built,
      cooldown: 0,
      swingT: 0,
      launchT: 0,
      stunT: 0,
      hurtT: 0,
      targetId: null,
      flash: 0,
      lastHitBy: null,
      aiTickOffset: this.units.length % 6,
      damageDealt: 0,
      swingHits: new Set(),
      charging: false,
    };
    this.units.push(unit);
    this.spent[p.side] += def.cost;
    this.events.push({ type: "spawn", unitId: unit.id, defId: def.id, side: p.side });
    return unit.id;
  }

  clearUnits() {
    for (const u of this.units) {
      try {
        u.ragdoll.ragdoll.RemoveFromPhysicsSystem();
      } catch {
        /* */
      }
      this.physics.removeBody(u.ragdoll.rootBody);
    }
    this.units = [];
    this.nextId = 1;
    this.time = 0;
    this.phase = "setup";
    this.winner = null;
    this.acc = 0;
    this.spent = [0, 0];
    this.clearShots();
  }

  startCountdown() {
    this.phase = "countdown";
    this.countdown = 3;
    this.startingHp = [0, 0];
    for (const u of this.units) {
      this.startingHp[u.side] += u.maxHp;
    }
  }

  step(dt: number, speed: number, paused: boolean) {
    if (this.phase === "countdown") {
      this.countdown -= Math.min(dt, 0.1);
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.phase = "battle";
      }
    }
    if (this.phase === "setup" || this.phase === "over") return;
    if (paused || speed === 0) return;
    const feed = Math.min(dt, 0.08) * speed;
    this.acc += feed;
    let steps = 0;
    while (this.acc >= FIXED_DT && steps < 4) {
      this.fixedStep();
      this.acc -= FIXED_DT;
      steps++;
    }
  }

  private fixedStep() {
    const t0 =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    if (this.phase === "countdown") {
      this.physics.step(FIXED_DT);
      this.lastPhysicsMs =
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
      return;
    }

    this.time += FIXED_DT;
    this.noDamageT += FIXED_DT;
    const rush = this.noDamageT > 15;

    const stepIndex = Math.floor(this.time / FIXED_DT);
    for (const u of this.units) {
      if (u.state === "dead") continue;
      u.cooldown = Math.max(0, u.cooldown - FIXED_DT);
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
          u.y = this.groundY(u.x) + 0.95 * u.def.body.scale;
          this.physics.setPosition(u.ragdoll.rootBody, u.x, u.y, u.z);
        }
        continue;
      }

      if (u.state === "stunned") {
        u.stunT -= FIXED_DT;
        u.charging = false;
        if (u.stunT <= 0) u.state = "seek";
      }

      if (stepIndex % 6 === u.aiTickOffset) {
        this.retarget(u);
        this.tickAura(u);
      }

      if (u.state !== "stunned") {
        this.steer(u, rush);
        this.tryAttack(u);
      }

      if (u.swingT > 0) {
        u.swingT -= FIXED_DT;
        const dur = "swingSeconds" in u.def.weapon ? u.def.weapon.swingSeconds : 0.35;
        const t = 1 - u.swingT / dur;
        const ang = Math.sin(t * Math.PI) * 1.4;
        this.physics.swingRightArm(u.ragdoll, ang);
        if (t > 0.25 && t < 0.7) this.resolveMelee(u);
        if (u.swingT <= 0) {
          this.physics.resetArm(u.ragdoll);
          u.swingHits.clear();
        }
      } else {
        this.physics.resetArm(u.ragdoll);
      }

      this.physics.drivePose(u.ragdoll);
      this.physics.moveKinematic(u.ragdoll.rootBody, u.x, u.y, u.z, u.yaw, FIXED_DT);
      this.physics.holdUpright(u.ragdoll.bodyIds.pelvis, u.yaw);
      this.physics.holdUpright(u.ragdoll.bodyIds.torso, u.yaw);
      this.physics.holdUpright(u.ragdoll.bodyIds.legs, u.yaw);
      this.physics.holdUpright(u.ragdoll.bodyIds.head, u.yaw);

      if (Math.abs(u.x) > ARENA_HALF_X + 4 || Math.abs(u.z) > ARENA_HALF_Z + 4) {
        this.kill(u, u.lastHitBy);
      }
    }

    this.stepShots();
    this.physics.step(FIXED_DT);
    this.checkVictory();

    this.lastPhysicsMs =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  }

  private retarget(u: UnitInternal) {
    const rule = u.def.ai.targeting;
    let best: UnitInternal | null = null;
    let bestScore = Infinity;
    const king = this.units.find(
      (o) =>
        o.side !== u.side &&
        o.state !== "dead" &&
        o.def.abilities?.some((a) => a.kind === "taunt") &&
        Math.hypot(o.x - u.x, o.z - u.z) <= (o.def.weapon.kind === "aura" ? o.def.weapon.tauntRange ?? 10 : 10),
    );
    if (king && u.def.weapon.kind !== "aura") {
      u.targetId = king.id;
      if (u.state !== "attack" && u.state !== "stunned" && u.state !== "launched") u.state = "seek";
      return;
    }
    for (const o of this.units) {
      if (o.side === u.side || o.state === "dead") continue;
      const d = Math.hypot(o.x - u.x, o.z - u.z);
      let score = d;
      if (rule === "prefer:large") score = d / Math.max(1, o.def.body.scale);
      if (rule === "prefer:weakest") score = d + o.hp / 80;
      if (rule === "prefer:ranged") {
        const ranged = o.def.weapon.kind === "projectile" || o.def.weapon.kind === "explosive";
        score = d * (ranged ? 0.6 : 1);
      }
      if (score < bestScore) {
        bestScore = score;
        best = o;
      }
    }
    u.targetId = best ? best.id : null;
    if (best && u.state !== "attack" && u.state !== "stunned" && u.state !== "launched") {
      u.state = "seek";
    }
  }

  private steer(u: UnitInternal, rush: boolean) {
    const target = this.units.find((o) => o.id === u.targetId && o.state !== "dead");
    if (!target) return;
    let dx = target.x - u.x;
    let dz = target.z - u.z;
    const dist = Math.hypot(dx, dz) || 1;
    dx /= dist;
    dz /= dist;

    let sepX = 0;
    let sepZ = 0;
    for (const o of this.units) {
      if (o.id === u.id || o.state === "dead" || o.side !== u.side) continue;
      const ox = u.x - o.x;
      const oz = u.z - o.z;
      const d2 = ox * ox + oz * oz;
      if (d2 < 1.8 && d2 > 1e-4) {
        sepX += ox / d2;
        sepZ += oz / d2;
      }
    }

    const keep = rush ? 0 : (u.def.ai.keepAway ?? 0);
    const range = u.def.weapon.range;
    const staticUnit = u.def.body.speed <= 0.05;
    u.charging = false;
    if (!staticUnit) {
      let speed = u.def.body.speed * (rush ? 1.5 : 1);
      if (u.def.weapon.kind === "charge" && dist > 3) {
        speed *= 2.6;
        u.charging = true;
      }
      const tooClose = keep > 0 && dist < keep;
      const wantClose = dist > range * 0.85 && !tooClose;
      if (tooClose) {
        u.x -= (dx * 0.7 - sepX * 0.2) * speed * FIXED_DT;
        u.z -= (dz * 0.7 - sepZ * 0.2) * speed * FIXED_DT;
      } else if (wantClose) {
        u.x += (dx * 0.85 + sepX * 0.25) * speed * FIXED_DT;
        u.z += (dz * 0.85 + sepZ * 0.25) * speed * FIXED_DT;
      }
    }
    u.yaw = Math.atan2(-dx, -dz);
    u.y = this.groundY(u.x) + 0.95 * u.def.body.scale;
    u.x = Math.max(-ARENA_HALF_X + 1, Math.min(ARENA_HALF_X - 1, u.x));
    u.z = Math.max(-ARENA_HALF_Z + 1, Math.min(ARENA_HALF_Z - 1, u.z));
  }

  private tryAttack(u: UnitInternal) {
    const target = this.units.find((o) => o.id === u.targetId && o.state !== "dead");
    if (!target || u.cooldown > 0) return;
    const dist = Math.hypot(target.x - u.x, target.z - u.z);
    const w = u.def.weapon;
    if (w.kind === "charge") {
      if (dist <= w.range) this.resolveCharge(u, target);
      return;
    }
    if (w.kind === "projectile" || w.kind === "explosive") {
      const minR = w.minRange ?? 0;
      if (dist <= w.range && dist >= minR) {
        this.fireShot(u, target);
        u.cooldown = w.cooldown;
        u.state = "attack";
        u.face = "angry";
        this.events.push({ type: "shot", unitId: u.id });
      }
      return;
    }
    if (w.kind === "aura" && (w.damage ?? 0) > 12) {
      if (dist <= w.range && u.swingT <= 0) {
        u.state = "attack";
        u.face = "angry";
        u.swingT = 0.35;
        u.cooldown = w.cooldown;
        u.swingHits.clear();
        this.events.push({ type: "swing", unitId: u.id });
      }
      return;
    }
    if (w.kind === "melee" || w.kind === "melee-reach") {
      if (dist <= w.range && u.swingT <= 0) {
        u.state = "attack";
        u.face = "angry";
        u.swingT = w.swingSeconds;
        u.cooldown = w.cooldown;
        u.swingHits.clear();
        this.events.push({ type: "swing", unitId: u.id });
      }
    }
  }

  private resolveMelee(u: UnitInternal) {
    const w = u.def.weapon;
    if (w.kind !== "melee" && w.kind !== "melee-reach" && w.kind !== "aura") return;
    for (const o of this.units) {
      if (o.side === u.side || o.state === "dead") continue;
      if (u.swingHits.has(o.id)) continue;
      const dist = Math.hypot(o.x - u.x, o.z - u.z);
      if (dist > w.range + 0.4) continue;
      u.swingHits.add(o.id);
      let dmg = w.damage;
      if (w.kind === "melee-reach" && w.vsChargeMult && o.charging) dmg *= w.vsChargeMult;
      this.damage(o, dmg, w.knockback, u);
    }
  }

  private resolveCharge(u: UnitInternal, target: UnitInternal) {
    if (u.cooldown > 0) return;
    u.cooldown = u.def.weapon.cooldown;
    this.damage(target, u.def.weapon.damage, u.def.weapon.knockback, u);
  }

  private tickAura(u: UnitInternal) {
    const abs = u.def.abilities;
    if (!abs) return;
    for (const a of abs) {
      if (a.kind === "heal-aura") {
        for (const o of this.units) {
          if (o.side !== u.side || o.state === "dead") continue;
          if (Math.hypot(o.x - u.x, o.z - u.z) <= a.radius) {
            o.hp = Math.min(o.maxHp, o.hp + a.amount * 0.5);
          }
        }
      }
    }
  }

  private fireShot(u: UnitInternal, target: UnitInternal) {
    const w = u.def.weapon;
    if (w.kind !== "projectile" && w.kind !== "explosive") return;
    const dx = target.x - u.x;
    const dz = target.z - u.z;
    const dist = Math.hypot(dx, dz) || 1;
    const y = u.y + 0.6 * u.def.body.scale;
    const body = this.physics.createDynamicSphere(u.x + (dx / dist) * 0.6, y, u.z + (dz / dist) * 0.6, w.kind === "explosive" ? 0.28 : 0.16, 1.4);
    const flight = dist / Math.max(4, w.speed);
    const vy = w.arc + 0.5 * 18 * flight * 0.35;
    this.physics.setLinearVelocity(body, (dx / dist) * w.speed, vy, (dz / dist) * w.speed);
    const kind: ProjectileView["kind"] =
      w.kind === "explosive" ? "boom" : u.def.id.includes("spear") ? "spear" : u.def.id.includes("archer") ? "arrow" : "rock";
    this.flying.push({
      id: this.nextShot++,
      body,
      ownerId: u.id,
      side: u.side,
      damage: w.damage,
      knockback: w.knockback,
      radius: w.radius ?? 0.45,
      life: 6,
      linger: w.linger ?? 0,
      explosive: w.kind === "explosive",
      kind,
      hit: new Set(),
    });
  }

  private stepShots() {
    const keep: Flying[] = [];
    for (const shot of this.flying) {
      shot.life -= FIXED_DT;
      this.physics.getTransform(shot.body, this.scratch);
      const px = this.scratch.x;
      const py = this.scratch.y;
      const pz = this.scratch.z;
      let consumed = shot.life <= 0 || py < -2;
      const owner = this.units.find((u) => u.id === shot.ownerId);
      for (const o of this.units) {
        if (o.side === shot.side || o.state === "dead") continue;
        if (shot.hit.has(o.id)) continue;
        const d = Math.hypot(o.x - px, o.z - pz);
        if (d < shot.radius + 0.55 * o.def.body.scale && Math.abs(o.y - py) < 1.6) {
          shot.hit.add(o.id);
          if (shot.explosive) {
            this.explode(px, pz, shot, owner ?? null);
            consumed = true;
            break;
          }
          this.damage(o, shot.damage, shot.knockback, owner ?? null);
          if (shot.linger <= 0) consumed = true;
        }
      }
      if (consumed && shot.linger > 0 && shot.life > 0) {
        shot.linger -= FIXED_DT;
        consumed = shot.linger <= 0;
      }
      if (consumed) this.physics.removeBody(shot.body);
      else keep.push(shot);
    }
    this.flying = keep;
  }

  private explode(x: number, z: number, shot: Flying, owner: UnitInternal | null) {
    for (const o of this.units) {
      if (o.state === "dead") continue;
      const d = Math.hypot(o.x - x, o.z - z);
      if (d > shot.radius + 1.2) continue;
      const falloff = Math.max(0.25, 1 - d / (shot.radius + 1.2));
      this.damage(o, shot.damage * falloff, shot.knockback * falloff, owner);
    }
  }

  private clearShots() {
    for (const s of this.flying) {
      try {
        this.physics.removeBody(s.body);
      } catch {
        /* */
      }
    }
    this.flying = [];
  }

  damage(victim: UnitInternal, amount: number, knockback: number, attacker: UnitInternal | null) {
    if (victim.state === "dead") return;
    let dealt = amount;
    if (attacker) {
      const kingNear = this.units.some(
        (k) =>
          k.side === attacker.side &&
          k.state !== "dead" &&
          k.def.abilities?.some((a) => a.kind === "damage-aura") &&
          Math.hypot(k.x - attacker.x, k.z - attacker.z) <= 6,
      );
      if (kingNear) dealt *= 1.25;
      if (
        victim.def.body.projectileArmor &&
        attacker.def.weapon.kind === "projectile"
      ) {
        dealt *= 1 - victim.def.body.projectileArmor;
      }
    }
    victim.hp -= dealt;
    if (attacker) attacker.damageDealt += dealt;
    victim.flash = 0.08;
    victim.hurtT = 0.25;
    victim.face = "hurt";
    victim.lastHitBy = attacker ? attacker.id : null;
    this.noDamageT = 0;
    const dirx = attacker ? victim.x - attacker.x : 0;
    const dirz = attacker ? victim.z - attacker.z : 0;
    const len = Math.hypot(dirx, dirz) || 1;
    const ix = (dirx / len) * knockback;
    const iz = (dirz / len) * knockback;
    const iy = knockback * 0.35;
    this.physics.applyImpulse(victim.ragdoll.bodyIds.torso, ix, iy, iz);
    this.events.push({
      type: "hit",
      attackerId: attacker?.id ?? -1,
      victimId: victim.id,
      damage: dealt,
      impulse: knockback,
    });
    if (knockback > victim.def.body.launchThreshold * 0.35) {
      victim.state = "stunned";
      victim.stunT = 0.35;
    }
    if (knockback >= victim.def.body.launchThreshold) {
      victim.state = "launched";
      victim.launchT = 1.4;
      this.events.push({ type: "launch", unitId: victim.id });
    }
    if (victim.hp <= 0) this.kill(victim, attacker?.id ?? null);
  }

  private kill(u: UnitInternal, killerId: number | null) {
    if (u.state === "dead") return;
    u.state = "dead";
    u.face = "dead";
    u.hp = 0;
    this.physics.applyImpulse(u.ragdoll.bodyIds.torso, (this.rng() - 0.5) * 8, 10, (this.rng() - 0.5) * 8);
    this.physics.removeBody(u.ragdoll.rootBody);
    this.events.push({ type: "death", unitId: u.id, killerId });
  }

  private checkVictory() {
    if (this.phase !== "battle") return;
    const alive: [number, number] = [0, 0];
    const hp: [number, number] = [0, 0];
    for (const u of this.units) {
      if (u.state !== "dead") {
        alive[u.side]++;
        hp[u.side] += u.hp;
      }
    }
    if (alive[0] === 0 && alive[1] === 0) {
      this.finish("draw");
      return;
    }
    if (alive[0] === 0) {
      this.finish(1);
      return;
    }
    if (alive[1] === 0) {
      this.finish(0);
      return;
    }
    if (this.time >= 120) {
      const p0 = this.startingHp[0] ? hp[0] / this.startingHp[0] : 0;
      const p1 = this.startingHp[1] ? hp[1] / this.startingHp[1] : 0;
      this.finish(p0 === p1 ? "draw" : p0 > p1 ? 0 : 1);
    }
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
        hp[u.side] += u.hp;
      }
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
      if (u.state === "dead") lost[u.side]++;
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
