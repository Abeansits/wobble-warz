import { yawOffset } from "./facing";
import { rootLift } from "./physics/skeletons";
import type { TransformSnap } from "./physics/joltWorld";
import { FIXED_DT } from "./constants";
import type { SimCtx, UnitInternal } from "./unitTypes";

const COACH_ID = "frontier.stagecoach";
const RIDER_ID = "frontier.gunslinger";
const SEATS: { x: number; z: number }[] = [
  { x: 0.42, z: 0.1 },
  { x: -0.42, z: 0.1 },
];

export function isCoach(u: UnitInternal): boolean {
  return u.def.id === COACH_ID;
}

export function spawnCoachRiders(sim: SimCtx, coach: UnitInternal) {
  if (!isCoach(coach)) return;
  const s = coach.def.body.scale;
  for (const seat of SEATS) {
    const off = yawOffset(seat.x * s, seat.z * s, coach.yaw);
    const id = sim.place(
      {
        defId: RIDER_ID,
        x: coach.x + off.x,
        z: coach.z + off.z,
        yaw: coach.yaw,
        side: coach.side,
      },
      { free: true, mounted: true },
    );
    const rider = sim.units.find((u) => u.id === id);
    if (!rider) continue;
    rider.mounted = true;
    rider.mountId = coach.id;
    rider.mountSeat = seat;
    rider.y = coach.y + 0.55 * s;
    try {
      sim.physics.setPosition(rider.ragdoll.rootBody, rider.x, rider.y, rider.z);
      rider.mountSpring = sim.physics.createDistanceSpring(
        rider.ragdoll.bodyIds.pelvis,
        coach.ragdoll.bodyIds.torso,
        0.22,
        0.9,
        11,
      );
    } catch {
      /* spring optional — kinematic follow still holds them */
    }
  }
}

export function dropMountSpring(sim: SimCtx, u: UnitInternal) {
  if (!u.mountSpring) return;
  try {
    sim.physics.dropConstraint(u.mountSpring);
  } catch {
    /* */
  }
  u.mountSpring = undefined;
}

export function spillRiders(sim: SimCtx, coach: UnitInternal) {
  for (const u of sim.units) {
    if (u.mountId !== coach.id || !u.mounted) continue;
    detachRider(sim, u, coach);
  }
}

function detachRider(sim: SimCtx, u: UnitInternal, coach: UnitInternal | null) {
  dropMountSpring(sim, u);
  u.mounted = false;
  u.mountId = null;
  if (u.state === "dead" || u.gone) return;
  u.state = "seek";
  const side = coach && u.x >= coach.x ? 1 : -1;
  const ix = side * (10 + sim.rng() * 8);
  const iz = (sim.rng() - 0.5) * 10;
  try {
    sim.physics.applyImpulse(u.ragdoll.bodyIds.torso, ix, 14, iz);
  } catch {
    /* */
  }
  sim.events.push({ type: "launch", unitId: u.id });
}

export function coachFlipped(sim: SimCtx, coach: UnitInternal): boolean {
  if (coach.state === "dead" || coach.state === "launched" || coach.gone) return true;
  const t: TransformSnap = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
  try {
    sim.physics.getTransform(coach.ragdoll.bodyIds.pelvis, t);
  } catch {
    return false;
  }
  const upY = 1 - 2 * (t.qx * t.qx + t.qz * t.qz);
  return upY < 0.35;
}

/** Snap riders onto their seats; spill if the coach flips, launches, or dies. */
export function syncMounts(sim: SimCtx) {
  for (const u of sim.units) {
    if (!u.mounted || u.mountId == null || u.state === "dead" || u.gone) continue;
    const coach = sim.units.find((o) => o.id === u.mountId) ?? null;
    if (!coach || coachFlipped(sim, coach)) {
      detachRider(sim, u, coach);
      continue;
    }
    const s = coach.def.body.scale;
    const seat = u.mountSeat ?? { x: 0, z: 0 };
    const off = yawOffset(seat.x * s, seat.z * s, coach.yaw);
    u.x = coach.x + off.x;
    u.z = coach.z + off.z;
    u.y = coach.y + 0.55 * s;
    try {
      sim.physics.moveKinematic(u.ragdoll.rootBody, u.x, u.y, u.z, u.yaw, FIXED_DT);
    } catch {
      /* */
    }
  }
}

export { rootLift };
