import { applyDamage, smashStones, unitForBody } from "./combat";
import { FIXED_DT, SUMMON_CAP } from "./constants";
import type { Flying, SimCtx, UnitInternal } from "./unitTypes";

export function tryAttack(sim: SimCtx, u: UnitInternal) {
  const target = sim.units.find((o) => o.id === u.targetId && o.state !== "dead" && !o.gone);
  if (!target || u.cooldown > 0 || u.frozenT > 0) return;
  const dist = Math.hypot(target.x - u.x, target.z - u.z);
  const w = u.def.weapon;
  let range = w.range;
  if (sim.arena === "canyon" && Math.abs(u.x) > 3.2 && (w.kind === "projectile" || w.kind === "hitscan")) {
    range *= 1.15;
  }

  if (w.kind === "summon") {
    u.cooldown = w.cooldown;
    u.state = "attack";
    const aliveSummons = sim.units.filter((o) => o.side === u.side && o.summoned && o.state !== "dead").length;
    const n = Math.min(6, SUMMON_CAP - aliveSummons);
    for (let i = 0; i < n; i++) {
      const ang = sim.rng() * Math.PI * 2;
      try {
        sim.place(
          {
            defId: "summon.chicken",
            x: u.x + Math.cos(ang) * (1.4 + i * 0.15),
            z: u.z + Math.sin(ang) * (1.4 + i * 0.15),
            yaw: u.yaw,
            side: u.side,
          },
          { free: true, summoned: true },
        );
      } catch {
        /* cap */
      }
    }
    return;
  }

  if (w.kind === "charge") {
    if (dist <= w.range) resolveCharge(sim, u, target);
    return;
  }

  if (w.kind === "hitscan") {
    if (dist <= range) {
      const dx = target.x - u.x;
      const dz = target.z - u.z;
      const len = Math.hypot(dx, dz) || 1;
      const hit = sim.physics.raycast(u.x, u.y + 0.4, u.z, (dx / len) * range, 0.1, (dz / len) * range);
      const victim = hit ? unitForBody(sim, hit.handle) : target;
      const who = victim && victim.side !== u.side ? victim : target;
      applyDamage(sim, who, w.damage, shatterKb(who, w.knockback), u);
      u.cooldown = w.cooldown;
      u.state = "attack";
      u.face = "angry";
      sim.events.push({ type: "shot", unitId: u.id });
    }
    return;
  }

  if (w.kind === "tether") {
    if (dist <= range) {
      const spring = sim.physics.createDistanceSpring(
        u.ragdoll.bodyIds.torso,
        target.ragdoll.bodyIds.torso,
        0.4,
        Math.max(1.2, dist),
        5,
      );
      sim.tethers.push({ constraint: spring, attackerId: u.id, victimId: target.id, until: sim.time + 1.5 });
      applyDamage(sim, target, w.damage, shatterKb(target, w.knockback * 0.4), u);
      u.cooldown = w.cooldown;
      u.state = "attack";
      u.face = "angry";
    }
    return;
  }

  if (w.kind === "status") {
    if (dist <= range) {
      fireShot(sim, u, target);
      const freeze = u.def.id === "anomaly.ice" ? 3 : 0;
      if (freeze > 0) {
        target.frozenT = Math.max(target.frozenT, freeze);
        target.state = "stunned";
        target.stunT = freeze;
      } else {
        target.slowT = Math.max(target.slowT, w.slowT ?? 2);
      }
      u.cooldown = w.cooldown;
      u.state = "attack";
      u.face = "angry";
      sim.events.push({ type: "shot", unitId: u.id });
    }
    return;
  }

  if (w.kind === "projectile" || w.kind === "explosive") {
    const minR = w.minRange ?? 0;
    if (dist <= range && dist >= minR) {
      fireShot(sim, u, target);
      u.cooldown = w.cooldown;
      u.state = "attack";
      u.face = "angry";
      sim.events.push({ type: "shot", unitId: u.id });
    }
    return;
  }

  if (w.kind === "aura" && (w.damage ?? 0) > 12) {
    if (dist <= range && u.swingT <= 0) {
      u.state = "attack";
      u.face = "angry";
      u.swingT = 0.35;
      u.cooldown = w.cooldown;
      u.swingHits.clear();
      sim.events.push({ type: "swing", unitId: u.id });
    }
    return;
  }

  if (w.kind === "melee" || w.kind === "melee-reach") {
    if (dist <= range + 0.35 && u.swingT <= 0) {
      u.state = "attack";
      u.face = "angry";
      u.swingT = w.swingSeconds;
      u.cooldown = w.cooldown;
      u.swingHits.clear();
      sim.events.push({ type: "swing", unitId: u.id });
    }
  }
}

export function resolveMelee(sim: SimCtx, u: UnitInternal) {
  const w = u.def.weapon;
  if (w.kind !== "melee" && w.kind !== "melee-reach" && w.kind !== "aura") return;
  sim.physics.getTransform(u.ragdoll.bodyIds.armR, sim.scratch);
  const ax = sim.scratch.x;
  const ay = sim.scratch.y;
  const az = sim.scratch.z;
  for (const o of sim.units) {
    if (o.side === u.side || o.state === "dead" || o.gone) continue;
    if (u.swingHits.has(o.id)) continue;
    sim.physics.getTransform(o.ragdoll.bodyIds.torso, sim.scratch);
    const dArm = Math.hypot(o.x - ax, o.z - az);
    const dRoot = Math.hypot(o.x - u.x, o.z - u.z);
    const reach = w.range + 0.35 * o.def.body.scale;
    if (dArm > reach && dRoot > w.range) continue;
    if (Math.abs(o.y - ay) > 2.4 && Math.abs(o.y - u.y) > 2.4) continue;
    u.swingHits.add(o.id);
    let dmg = w.damage;
    if (w.kind === "melee-reach" && w.vsChargeMult && o.charging) dmg *= w.vsChargeMult;
    if (w.kind !== "aura" && (w.instakill || u.def.id === "haunted.reaper")) dmg = Math.max(dmg, o.hp);
    applyDamage(sim, o, dmg, shatterKb(o, w.knockback), u);
  }
}

export function resolveCharge(sim: SimCtx, u: UnitInternal, target: UnitInternal) {
  if (u.cooldown > 0) return;
  u.cooldown = u.def.weapon.cooldown;
  applyDamage(sim, target, u.def.weapon.damage, shatterKb(target, u.def.weapon.knockback), u);
}

export function tickChargeContacts(sim: SimCtx, u: UnitInternal) {
  if (!u.charging) {
    u.chargeHits.clear();
    return;
  }
  const w = u.def.weapon;
  const speed = u.def.body.speed * 2.6;
  for (const o of sim.units) {
    if (o.side === u.side || o.state === "dead" || o.gone) continue;
    if (u.chargeHits.has(o.id)) continue;
    const d = Math.hypot(o.x - u.x, o.z - u.z);
    if (d > w.range + 0.4 * o.def.body.scale) continue;
    u.chargeHits.add(o.id);
    const scale = Math.min(2.2, speed / 3);
    applyDamage(sim, o, w.damage * scale, shatterKb(o, w.knockback * scale), u);
  }
}

export function tickAura(sim: SimCtx, u: UnitInternal) {
  const abs = u.def.abilities;
  if (!abs) return;
  for (const a of abs) {
    if (a.kind === "heal-aura") {
      for (const o of sim.units) {
        if (o.side !== u.side || o.state === "dead" || o.gone) continue;
        if (Math.hypot(o.x - u.x, o.z - u.z) <= a.radius) {
          o.hp = Math.min(o.maxHp, o.hp + a.amount * 0.5);
        }
      }
    }
    // speed-aura is applied in steer; spring stiffness cannot change at runtime.
  }
}

function shatterKb(victim: UnitInternal, knockback: number) {
  return victim.frozenT > 0 ? knockback * 1.5 : knockback;
}

export function fireShot(sim: SimCtx, u: UnitInternal, target: UnitInternal) {
  const w = u.def.weapon;
  if (w.kind !== "projectile" && w.kind !== "explosive" && w.kind !== "status") return;
  const dx = target.x - u.x;
  const dz = target.z - u.z;
  const dist = Math.hypot(dx, dz) || 1;
  const y = u.y + 0.6 * u.def.body.scale;
  const body = sim.physics.createDynamicSphere(
    u.x + (dx / dist) * 0.6,
    y,
    u.z + (dz / dist) * 0.6,
    w.kind === "explosive" ? 0.28 : 0.16,
    1.4,
  );
  const flight = dist / Math.max(4, w.speed);
  const vy = w.arc + 0.5 * 18 * flight * 0.35;
  sim.physics.setLinearVelocity(body, (dx / dist) * w.speed, vy, (dz / dist) * w.speed);
  const kind: Flying["kind"] =
    w.kind === "explosive"
      ? "boom"
      : u.def.id.includes("pumpkin")
        ? "rock"
        : u.def.id.includes("spear")
          ? "spear"
          : u.def.id.includes("archer")
            ? "arrow"
            : "rock";
  if (sim.flying.length > 24) {
    const extra = sim.flying.shift();
    if (extra) sim.physics.removeBody(extra.body);
  }
  sim.flying.push({
    id: sim.nextShot++,
    body,
    ownerId: u.id,
    side: u.side,
    damage: w.damage,
    knockback: w.knockback,
    radius: ("radius" in w ? w.radius : undefined) ?? 0.45,
    life: 6,
    linger: ("linger" in w ? w.linger : undefined) ?? 0,
    explosive: w.kind === "explosive",
    kind,
    hit: new Set(),
    slow: w.kind === "status" ? w.slow : undefined,
    slowT: w.kind === "status" ? w.slowT : undefined,
    freeze: u.def.id === "anomaly.ice" ? 3 : undefined,
  });
}

export function stepShots(sim: SimCtx) {
  const keep: Flying[] = [];
  for (const shot of sim.flying) {
    shot.life -= FIXED_DT;
    sim.physics.getTransform(shot.body, sim.scratch);
    const px = sim.scratch.x;
    const py = sim.scratch.y;
    const pz = sim.scratch.z;
    let consumed = shot.life <= 0 || py < -2;
    const owner = sim.units.find((u) => u.id === shot.ownerId) ?? null;
    for (const o of sim.units) {
      if (o.side === shot.side || o.state === "dead" || o.gone) continue;
      if (shot.hit.has(o.id)) continue;
      const d = Math.hypot(o.x - px, o.z - pz);
      if (d < shot.radius + 0.55 * o.def.body.scale && Math.abs(o.y - py) < 1.6) {
        shot.hit.add(o.id);
        if (shot.explosive) {
          explode(sim, px, pz, shot, owner);
          consumed = true;
          break;
        }
        applyDamage(sim, o, shot.damage, shatterKb(o, shot.knockback), owner);
        if (shot.freeze) {
          o.frozenT = Math.max(o.frozenT, shot.freeze);
          o.state = "stunned";
          o.stunT = shot.freeze;
        } else if (shot.slowT) {
          o.slowT = Math.max(o.slowT, shot.slowT);
        }
        if (shot.linger <= 0) consumed = true;
      }
    }
    if (consumed && shot.linger > 0 && shot.life > 0) {
      shot.linger -= FIXED_DT;
      consumed = shot.linger <= 0;
    }
    if (consumed) sim.physics.removeBody(shot.body);
    else keep.push(shot);
  }
  sim.flying = keep;
}

export function explode(sim: SimCtx, x: number, z: number, shot: Flying, owner: UnitInternal | null) {
  smashStones(sim, x, z, shot.knockback + 20);
  for (const o of sim.units) {
    if (o.state === "dead" || o.gone) continue;
    const d = Math.hypot(o.x - x, o.z - z);
    if (d > shot.radius + 1.2) continue;
    const falloff = Math.max(0.25, 1 - d / (shot.radius + 1.2));
    applyDamage(sim, o, shot.damage * falloff, shatterKb(o, shot.knockback * falloff), owner);
  }
}

export function stepTethers(sim: SimCtx) {
  const keep = [];
  for (const t of sim.tethers) {
    if (sim.time >= t.until) {
      const a = sim.units.find((u) => u.id === t.attackerId);
      const v = sim.units.find((u) => u.id === t.victimId);
      try {
        sim.physics.dropConstraint(t.constraint);
      } catch {
        /* */
      }
      if (a && v && v.state !== "dead") {
        const dx = a.x - v.x;
        const dz = a.z - v.z;
        const d = Math.hypot(dx, dz) || 1;
        sim.physics.applyImpulse(v.ragdoll.bodyIds.torso, (dx / d) * 28, 8, (dz / d) * 28);
        v.x += (dx / d) * Math.min(4.5, d * 0.55);
        v.z += (dz / d) * Math.min(4.5, d * 0.55);
        sim.physics.setPosition(v.ragdoll.rootBody, v.x, v.y, v.z);
      }
      continue;
    }
    keep.push(t);
  }
  sim.tethers = keep;
}

export function clearShots(sim: SimCtx) {
  for (const s of sim.flying) {
    try {
      sim.physics.removeBody(s.body);
    } catch {
      /* */
    }
  }
  sim.flying = [];
  for (const t of sim.tethers) {
    try {
      sim.physics.dropConstraint(t.constraint);
    } catch {
      /* */
    }
  }
  sim.tethers = [];
}
