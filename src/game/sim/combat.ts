import type { SimCtx, UnitInternal } from "./unitTypes";

export function applyDamage(
  sim: SimCtx,
  victim: UnitInternal,
  amount: number,
  knockback: number,
  attacker: UnitInternal | null,
) {
  if (victim.state === "dead" || victim.gone) return;
  let dealt = amount;
  if (victim.frozenT > 0) dealt *= 2;
  if (attacker) {
    const kingNear = sim.units.some(
      (k) =>
        k.side === attacker.side &&
        k.state !== "dead" &&
        k.def.abilities?.some((a) => a.kind === "damage-aura") &&
        Math.hypot(k.x - attacker.x, k.z - attacker.z) <= 6,
    );
    if (kingNear) dealt *= 1.25;
    if (victim.def.body.projectileArmor && attacker.def.weapon.kind === "projectile") {
      dealt *= 1 - victim.def.body.projectileArmor;
    }
  }
  victim.hp -= dealt;
  if (attacker) {
    attacker.damageDealt += dealt;
    if (attacker.def.id === "haunted.vampire") {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + dealt);
    }
    if (attacker.def.id === "anomaly.tax") {
      const steal = Math.max(4, Math.round(victim.maxHp * 0.05));
      victim.maxHp = Math.max(10, victim.maxHp - steal);
      attacker.maxHp += steal;
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + steal);
    }
  }
  victim.flash = 0.08;
  victim.hurtT = 0.25;
  victim.face = "hurt";
  victim.lastHitBy = attacker ? attacker.id : null;
  sim.noDamageT = 0;
  const dirx = attacker ? victim.x - attacker.x : 0;
  const dirz = attacker ? victim.z - attacker.z : 0;
  const len = Math.hypot(dirx, dirz) || 1;
  const ix = (dirx / len) * knockback;
  const iz = (dirz / len) * knockback;
  const iy = knockback * 0.35;
  try {
    sim.physics.applyImpulse(victim.ragdoll.bodyIds.torso, ix, iy, iz);
  } catch {
    /* body gone */
  }
  if (knockback > 16) sim.hitStop = Math.min(0.06, 0.02 + knockback * 0.001);
  sim.events.push({
    type: "hit",
    attackerId: attacker?.id ?? -1,
    victimId: victim.id,
    damage: dealt,
    impulse: knockback,
  });
  smashStones(sim, victim.x, victim.z, knockback);

  if (victim.hp <= 0) {
    sim.kill(victim, attacker?.id ?? null);
    return;
  }
  if (knockback > victim.def.body.launchThreshold * 0.35) {
    victim.state = "stunned";
    victim.stunT = 0.35;
  }
  if (knockback >= victim.def.body.launchThreshold) {
    victim.state = "launched";
    victim.launchT = 1.4;
    sim.physics.setActive(victim.ragdoll.rootBody, false);
    sim.physics.beginLaunch(victim.ragdoll);
    sim.events.push({ type: "launch", unitId: victim.id });
  }
  if (victim.def.id === "anomaly.mirror" && attacker && attacker.id !== victim.id) {
    applyDamage(sim, attacker, dealt * 0.35, knockback * 0.4, null);
  }
}

export function killUnit(sim: SimCtx, u: UnitInternal, killerId: number | null) {
  if (u.state === "dead") return;
  u.state = "dead";
  u.face = "dead";
  u.hp = 0;
  u.deadT = 0;
  u.charging = false;
  try {
    sim.physics.applyImpulse(u.ragdoll.bodyIds.torso, (sim.rng() - 0.5) * 8, 10, (sim.rng() - 0.5) * 8);
  } catch {
    /* */
  }
  try {
    // Leave the root in the world so destroyRagdoll can free it later.
    // Destroying it here double-frees and wasm-aborts at corpse despawn.
    sim.physics.setActive(u.ragdoll.rootBody, false);
  } catch {
    /* */
  }
  sim.events.push({ type: "death", unitId: u.id, killerId });
}

export function smashStones(sim: SimCtx, x: number, z: number, force: number) {
  if (force < 18) return;
  const keep = [];
  for (const s of sim.stones) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < 2.4) {
      s.hp -= force;
      if (s.hp <= 0) {
        try {
          sim.physics.removeBody(s.handle);
        } catch {
          /* */
        }
        sim.physics.createDynamicSphere(s.x, s.y, s.z, 0.22, 4);
        continue;
      }
    }
    keep.push(s);
  }
  sim.stones = keep;
}

export function unitForBody(sim: SimCtx, handle: number): UnitInternal | null {
  for (const u of sim.units) {
    if (u.gone) continue;
    if (u.ragdoll.rootBody === handle) return u;
    for (const id of u.ragdoll.orderedIds) {
      if (id === handle) return u;
    }
  }
  return null;
}
