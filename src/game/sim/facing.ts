import type { Side } from "@/game/data/types";

/** Yaw so a +Z-facing mesh looks toward the other pad. P1 faces +X, P2 faces −X. */
export function deployYaw(side: Side): number {
  return side === 0 ? Math.PI / 2 : -Math.PI / 2;
}

/** Yaw so a +Z-facing mesh looks toward (dx, dz) on the XZ plane. */
export function lookYaw(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}
