import { unitForBody } from "./combat";
import { ARENA_HALF_X, ARENA_HALF_Z, FIXED_DT } from "./constants";
import { lookYaw } from "./facing";
import { rootLift } from "./physics/skeletons";
import type { SimCtx, UnitInternal } from "./unitTypes";

export function retarget(sim: SimCtx, u: UnitInternal) {
  const rule = u.def.ai.targeting;
  let best: UnitInternal | null = null;
  let bestScore = Infinity;
  const king = sim.units.find(
    (o) =>
      o.side !== u.side &&
      o.state !== "dead" &&
      o.def.abilities?.some((a) => a.kind === "taunt") &&
      Math.hypot(o.x - u.x, o.z - u.z) <=
        (o.def.weapon.kind === "aura" ? o.def.weapon.tauntRange ?? 10 : 10),
  );
  if (king && u.def.weapon.kind !== "aura") {
    u.targetId = king.id;
    if (u.state !== "attack" && u.state !== "stunned" && u.state !== "launched") u.state = "seek";
    return;
  }
  for (const o of sim.units) {
    if (o.side === u.side || o.state === "dead" || o.gone) continue;
    const d = Math.hypot(o.x - u.x, o.z - u.z);
    let score = d;
    if (rule === "prefer:large") score = d / Math.max(1, o.def.body.scale);
    if (rule === "prefer:weakest") score = d + o.hp / 80;
    if (rule === "prefer:ranged") {
      const ranged =
        o.def.weapon.kind === "projectile" ||
        o.def.weapon.kind === "explosive" ||
        o.def.weapon.kind === "hitscan";
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

export function steer(sim: SimCtx, u: UnitInternal, rush: boolean) {
  if (u.frozenT > 0) return;
  const target = sim.units.find((o) => o.id === u.targetId && o.state !== "dead" && !o.gone);
  if (u.mounted) {
    if (target) u.yaw = lookYaw(target.x - u.x, target.z - u.z);
    return;
  }
  if (!target) return;
  let dx = target.x - u.x;
  let dz = target.z - u.z;
  const dist = Math.hypot(dx, dz) || 1;
  dx /= dist;
  dz /= dist;

  let sepX = 0;
  let sepZ = 0;
  let cheerBonus = 0;
  for (const o of sim.units) {
    if (o.state === "dead" || o.gone || o.side !== u.side) continue;
    const aura = o.def.abilities?.find((a) => a.kind === "speed-aura");
    if (aura && Math.hypot(o.x - u.x, o.z - u.z) <= aura.radius) {
      cheerBonus = Math.max(cheerBonus, aura.amount);
    }
    if (o.id === u.id) continue;
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
    if (u.slowT > 0) speed *= 0.6;
    if (cheerBonus > 0) speed *= 1 + cheerBonus;
    if (sim.arena === "meadow" && u.def.weapon.kind === "charge" && dx * (u.side === 0 ? 1 : -1) > 0) {
      speed *= 1.2;
    }
    if (sim.arena === "canyon") {
      if (Math.abs(u.x) < 3.2) speed *= 0.72;
      else if (u.def.weapon.kind === "projectile" || u.def.weapon.kind === "hitscan") {
        /* rim bonus applied in weapons via range */
      }
    }
    if (sim.arena === "graveyard") speed *= 0.9;
    if (sim.bananaSide === u.side && Math.abs(u.x) > 8) speed *= 0.55;
    if (u.def.weapon.kind === "charge" && dist > 3) {
      speed *= 2.6;
      u.charging = true;
    }
    const tooClose = keep > 0 && dist < keep;
    const wantClose = dist > range * 0.85 && !tooClose;
    if (tooClose) {
      const heading = avoidObstacles(sim, u, -dx, -dz);
      u.x += (heading.dx * 0.7 + sepX * 0.2) * speed * FIXED_DT;
      u.z += (heading.dz * 0.7 + sepZ * 0.2) * speed * FIXED_DT;
    } else if (wantClose) {
      const heading = avoidObstacles(sim, u, dx, dz);
      u.x += (heading.dx * 0.85 + sepX * 0.25) * speed * FIXED_DT;
      u.z += (heading.dz * 0.85 + sepZ * 0.25) * speed * FIXED_DT;
    }
  }
  u.yaw = lookYaw(dx, dz);
  u.y = sim.groundY(u.x, u.z) + rootLift(u.def.body.kind, u.def.body.scale);
  u.x = Math.max(-ARENA_HALF_X + 1, Math.min(ARENA_HALF_X - 1, u.x));
  u.z = Math.max(-ARENA_HALF_Z + 1, Math.min(ARENA_HALF_Z - 1, u.z));
}

/** One short feeler + a ground-height sample. No navmesh. */
function avoidObstacles(sim: SimCtx, u: UnitInternal, dx: number, dz: number) {
  const look = 1.7;
  const hereY = sim.groundY(u.x, u.z);
  const aheadY = sim.groundY(u.x + dx * look, u.z + dz * look);
  let ax = dx;
  let az = dz;
  if (hereY - aheadY > 0.55) {
    const lx = -dz;
    const lz = dx;
    const leftDrop = hereY - sim.groundY(u.x + lx * look, u.z + lz * look);
    const rightDrop = hereY - sim.groundY(u.x - lx * look, u.z - lz * look);
    const side = leftDrop <= rightDrop ? 1 : -1;
    ax = dx * 0.25 + lx * side;
    az = dz * 0.25 + lz * side;
    const n = Math.hypot(ax, az) || 1;
    ax /= n;
    az /= n;
  }
  const start = 0.55 * u.def.body.scale;
  const feel = 1.6;
  const hit = sim.physics.raycast(u.x + ax * start, u.y + 0.4, u.z + az * start, ax * feel, 0.06, az * feel);
  if (hit && hit.fraction < 0.92 && !unitForBody(sim, hit.handle)) {
    const lx = -az;
    const lz = ax;
    const side = (u.id & 1) === 0 ? 1 : -1;
    ax = ax * 0.2 + lx * side;
    az = az * 0.2 + lz * side;
    const n = Math.hypot(ax, az) || 1;
    ax /= n;
    az /= n;
  }
  return { dx: ax, dz: az };
}
