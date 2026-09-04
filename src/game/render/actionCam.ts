/** Action-cam framing for a live scrum. Dist is metres from target. */

export const ACTION_DIST_MIN = 16;
export const ACTION_DIST_MAX = 32;
export const ACTION_SPREAD_GAIN = 1.55;
export const ACTION_DIST_BASE = 10;
export const ACTION_BOUNDS = { x: 28, z: 18 } as const;

export type FightPoint = { x: number; z: number };

export type FightFocus = {
  x: number;
  z: number;
  spread: number;
  dist: number;
};

/**
 * Centroid of living units + a distance that tightens as the fight piles up.
 * Two armies still walking in → wide; one scrum → close enough to read faces.
 */
export function fightFocus(points: FightPoint[]): FightFocus | null {
  const n = points.length;
  if (n === 0) return null;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    cx += points[i].x;
    cz += points[i].z;
  }
  cx /= n;
  cz /= n;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const dx = points[i].x - cx;
    const dz = points[i].z - cz;
    acc += dx * dx + dz * dz;
  }
  const spread = Math.sqrt(acc / n);
  const dist = Math.min(
    ACTION_DIST_MAX,
    Math.max(ACTION_DIST_MIN, spread * ACTION_SPREAD_GAIN + ACTION_DIST_BASE),
  );
  return {
    x: Math.max(-ACTION_BOUNDS.x, Math.min(ACTION_BOUNDS.x, cx)),
    z: Math.max(-ACTION_BOUNDS.z, Math.min(ACTION_BOUNDS.z, cz)),
    spread,
    dist,
  };
}
