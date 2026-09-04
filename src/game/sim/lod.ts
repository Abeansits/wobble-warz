export const LOD_ALIVE = 60;
export const LOD_ALIVE_DEGRADED = 40;
export const CORPSE_CAP = 80;
export const DEGRADE_MS = 8;
export const DEGRADE_RECOVER_MS = 6;
export const DEGRADE_WINDOW = 120;

/** Summons (not player-placed) drop to 4-body ragdolls past the alive threshold. */
export function shouldLod(alive: number, summoned: boolean, degraded: boolean): boolean {
  if (!summoned) return false;
  return alive >= (degraded ? LOD_ALIVE_DEGRADED : LOD_ALIVE);
}

export function cullCorpses(
  units: { state: string; gone: boolean; deadT: number }[],
  cap = CORPSE_CAP,
  life = 6,
): number {
  const corpses = units.filter((u) => u.state === "dead" && !u.gone);
  if (corpses.length <= cap) return 0;
  corpses.sort((a, b) => b.deadT - a.deadT);
  let n = 0;
  for (let i = cap; i < corpses.length; i++) {
    if (corpses[i].deadT < life) {
      corpses[i].deadT = life;
      n++;
    }
  }
  return n;
}

export function updateDegrade(
  samples: number[],
  nextMs: number,
  degraded: boolean,
): { samples: number[]; degraded: boolean } {
  const s = samples.length >= DEGRADE_WINDOW ? samples.slice(1) : samples.slice();
  s.push(nextMs);
  if (s.length < 60) return { samples: s, degraded };
  let sum = 0;
  for (const v of s) sum += v;
  const avg = sum / s.length;
  if (avg > DEGRADE_MS) return { samples: s, degraded: true };
  if (avg < DEGRADE_RECOVER_MS) return { samples: s, degraded: false };
  return { samples: s, degraded };
}
