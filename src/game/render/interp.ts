import type { TransformSnap, UnitView, World, WorldSnapshot } from "@/game/sim/World";

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function lerpTransform(a: TransformSnap, b: TransformSnap, t: number): TransformSnap {
  let bx = b.qx;
  let by = b.qy;
  let bz = b.qz;
  let bw = b.qw;
  if (a.qx * bx + a.qy * by + a.qz * bz + a.qw * bw < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let qx = lerp(a.qx, bx, t);
  let qy = lerp(a.qy, by, t);
  let qz = lerp(a.qz, bz, t);
  let qw = lerp(a.qw, bw, t);
  const mag = Math.hypot(qx, qy, qz, qw) || 1;
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    qx: qx / mag,
    qy: qy / mag,
    qz: qz / mag,
    qw: qw / mag,
  };
}

function lerpUnit(a: UnitView, b: UnitView, t: number): UnitView {
  const parts: UnitView["parts"] = {};
  for (const key of Object.keys(b.parts)) {
    const pb = b.parts[key];
    const pa = a.parts[key];
    parts[key] = pa ? lerpTransform(pa, pb, t) : pb;
  }
  return {
    ...b,
    root: lerpTransform(a.root, b.root, t),
    parts,
    yaw: lerpAngle(a.yaw, b.yaw, t),
    flash: lerp(a.flash, b.flash, t),
    fade: lerp(a.fade, b.fade, t),
  };
}

/** Gaffer-style: pose = lerp(previous, current, accumulator alpha). */
export function interpolateSnapshot(prev: WorldSnapshot, curr: WorldSnapshot, alpha: number): WorldSnapshot {
  const t = Math.max(0, Math.min(1, alpha));
  if (t <= 0) return prev;
  if (t >= 1) return curr;
  const prevById = new Map(prev.units.map((u) => [u.id, u]));
  const units = curr.units.map((u) => {
    const p = prevById.get(u.id);
    return p ? lerpUnit(p, u, t) : u;
  });
  const projectiles = curr.projectiles.map((s, i) => {
    const p = prev.projectiles[i];
    if (!p) return s;
    return { ...s, x: lerp(p.x, s.x, t), y: lerp(p.y, s.y, t), z: lerp(p.z, s.z, t) };
  });
  return { ...curr, units, projectiles };
}

export function posedSnapshot(world: World): WorldSnapshot {
  if (world.phase === "setup" || !world.currSnap) return world.snapshot();
  if (!world.prevSnap) return world.currSnap;
  return interpolateSnapshot(world.prevSnap, world.currSnap, world.renderAlpha);
}
