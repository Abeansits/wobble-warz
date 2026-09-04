import type { Placement, Side } from "@/game/data/types";

export const BUDGET_MIN = 500;
export const BUDGET_MAX = 8000;
export const BUDGET_WARN = 6000;
export const UNIT_CAP = 60;

export function clampBudget(n: number): number {
  if (!Number.isFinite(n)) return 3000;
  return Math.max(BUDGET_MIN, Math.min(BUDGET_MAX, Math.round(n)));
}

const DUP_STEPS: [number, number][] = [
  [1.25, 0],
  [-1.25, 0],
  [0, 1.25],
  [0, -1.25],
  [1.25, 1.25],
  [-1.25, 1.25],
  [1.25, -1.25],
  [-1.25, -1.25],
  [2.4, 0],
  [-2.4, 0],
  [0, 2.4],
  [0, -2.4],
];

function inPad(x: number, z: number, side: Side): boolean {
  if (Math.abs(z) > 18) return false;
  if (side === 0 && x > -8) return false;
  if (side === 1 && x < 8) return false;
  return true;
}

/** Find a free neighbor in the same deployment pad. */
export function duplicatePlacement(
  src: Placement,
  occupied: { x: number; z: number }[],
  spacing = 0.7,
): Placement | null {
  const min2 = spacing * spacing;
  for (const [dx, dz] of DUP_STEPS) {
    const x = src.x + dx;
    const z = src.z + dz;
    if (!inPad(x, z, src.side)) continue;
    const blocked = occupied.some((o) => {
      const ax = o.x - x;
      const az = o.z - z;
      return ax * ax + az * az < min2;
    });
    if (!blocked) return { defId: src.defId, x, z, yaw: src.yaw, side: src.side };
  }
  return null;
}
