/** Live ordnance. Arm on throw; boom on contact, ground, or the timer. */

export const FUSE_ARM = 0.35;
export const FUSE_DEFAULT = 2;
export const GROUND_SLOP = 0.5;

export type FuseShot = {
  explosive: boolean;
  fuse: number;
  armed: number;
  fuseOnGround: boolean;
};

export type BoomReason = "fuse" | "life" | "void" | "ground" | null;

export function tickFuse(shot: FuseShot, dt: number): Pick<FuseShot, "fuse" | "armed"> {
  if (!shot.explosive) return { fuse: shot.fuse, armed: shot.armed };
  return { fuse: shot.fuse - dt, armed: Math.max(0, shot.armed - dt) };
}

export function fuseBoom(shot: FuseShot & { life: number }, py: number, groundY: number): BoomReason {
  if (!shot.explosive) return null;
  if (shot.fuse <= 0) return "fuse";
  if (shot.life <= 0) return "life";
  if (py < -2) return "void";
  if (shot.fuseOnGround && shot.armed <= 0 && py <= groundY + GROUND_SLOP) return "ground";
  return null;
}

/** Once armed, any living body — friend, foe, or thrower — can cook it. */
export function fuseHitsUnit(
  shot: FuseShot,
  unit: { gone: boolean; state: string },
): boolean {
  if (!shot.explosive) return false;
  if (shot.armed > 0) return false;
  if (unit.gone || unit.state === "dead") return false;
  return true;
}
