/** Scale combat feedback by impulse. Small ticks at kb 8, meaty at 40. */

export const HIT_REF = 40;
export const TRAUMA_DECAY = 2;
export const TRAUMA_CAP = 1;

export type HitJuice = {
  volume: number;
  particles: number;
  speed: number;
  trauma: number;
};

export function hitJuice(impulse: number): HitJuice {
  const n = Math.max(0, impulse) / HIT_REF;
  return {
    volume: Math.min(0.55, 0.12 + n * 0.35),
    particles: Math.round(Math.min(16, 2 + n * 10)),
    speed: Math.min(7, 3 + n * 3),
    trauma: Math.min(TRAUMA_CAP, n * 0.45),
  };
}

export function addTrauma(current: number, punch: number): number {
  return Math.min(TRAUMA_CAP, Math.max(0, current) + Math.max(0, punch));
}

export function stepTrauma(trauma: number, dt: number, decay = TRAUMA_DECAY): number {
  return Math.max(0, trauma - decay * dt);
}

/** Squared falloff so a fading punch dies quietly. */
export function traumaOffset(trauma: number, t: number): { x: number; y: number; z: number } {
  const mag = trauma * trauma;
  if (mag <= 1e-6) return { x: 0, y: 0, z: 0 };
  return {
    x: (Math.sin(t * 37.1) + Math.sin(t * 19.7)) * 0.5 * mag * 0.38,
    y: (Math.sin(t * 29.3) + Math.cos(t * 13.1)) * 0.5 * mag * 0.24,
    z: (Math.cos(t * 23.9) + Math.sin(t * 41.2)) * 0.5 * mag * 0.38,
  };
}
