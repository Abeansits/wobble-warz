import { mulberry32 } from "@/game/sim/rng";
import type { ArenaId } from "@/game/data/arenas";

export type Scatter = {
  x: number;
  z: number;
  s: number;
  yaw: number;
  variant: number;
};

/** Charge corridor — tall props stay out so fights stay readable. */
export function inChargeLane(x: number, z: number) {
  return Math.abs(z) < 9.5 && Math.abs(x) < 25;
}

function scatter(
  seed: number,
  count: number,
  opts: { x0: number; x1: number; z0: number; z1: number; s0: number; s1: number; tall?: boolean },
): Scatter[] {
  const rng = mulberry32(seed);
  const out: Scatter[] = [];
  let tries = 0;
  while (out.length < count && tries < count * 10) {
    tries++;
    const x = opts.x0 + rng() * (opts.x1 - opts.x0);
    const z = opts.z0 + rng() * (opts.z1 - opts.z0);
    if (opts.tall && inChargeLane(x, z)) continue;
    out.push({
      x,
      z,
      s: opts.s0 + rng() * (opts.s1 - opts.s0),
      yaw: rng() * Math.PI * 2,
      variant: (rng() * 3) | 0,
    });
  }
  return out;
}

function rim(seed: number, count: number, r0: number, r1: number, s0: number, s1: number): Scatter[] {
  const rng = mulberry32(seed);
  const out: Scatter[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.28;
    const r = r0 + rng() * (r1 - r0);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (inChargeLane(x, z) && r < 28) continue;
    out.push({ x, z, s: s0 + rng() * (s1 - s0), yaw: a + Math.PI / 2, variant: i % 3 });
  }
  return out;
}

function sideline(seed: number, countEach: number, z0: number, z1: number, s0: number, s1: number): Scatter[] {
  const rng = mulberry32(seed);
  const out: Scatter[] = [];
  for (const sign of [-1, 1]) {
    for (let i = 0; i < countEach; i++) {
      const x = -27 + (i + rng() * 0.6) * (54 / countEach);
      const z = sign * (z0 + rng() * (z1 - z0));
      out.push({ x, z, s: s0 + rng() * (s1 - s0), yaw: rng() * Math.PI * 2, variant: i % 3 });
    }
  }
  return out;
}

export function meadowTrees() {
  return [...rim(11, 20, 32, 42, 0.9, 1.5), ...sideline(47, 9, 13.2, 18.5, 0.75, 1.25)];
}

export function meadowBushes() {
  return [
    ...scatter(17, 24, { x0: -34, x1: 34, z0: -24, z1: 24, s0: 0.55, s1: 1.15, tall: true }),
    ...sideline(53, 8, 11.5, 16, 0.5, 0.95),
  ];
}

export function meadowTufts() {
  return scatter(23, 220, { x0: -30, x1: 30, z0: -20, z1: 20, s0: 0.55, s1: 1.15 });
}

export function meadowFlowers() {
  return scatter(29, 90, { x0: -28, x1: 28, z0: -18, z1: 18, s0: 0.7, s1: 1.3 });
}

export function meadowRocks() {
  return scatter(31, 18, { x0: -34, x1: 34, z0: -24, z1: 24, s0: 0.35, s1: 0.85, tall: true });
}

export function meadowLogs() {
  return scatter(37, 8, { x0: -32, x1: 32, z0: -22, z1: 22, s0: 0.8, s1: 1.3, tall: true });
}

export function meadowFence(): Scatter[] {
  const posts: Scatter[] = [];
  for (let i = 0; i < 28; i++) {
    const x = -29 + i * 2.15;
    posts.push({ x, z: -20.6, s: 1, yaw: 0, variant: 0 });
    posts.push({ x, z: 20.6, s: 1, yaw: 0, variant: 1 });
  }
  return posts;
}

export function meadowHills(): Scatter[] {
  return [
    { x: -48, z: -28, s: 14, yaw: 0.2, variant: 0 },
    { x: 50, z: -30, s: 16, yaw: -0.1, variant: 1 },
    { x: -46, z: 32, s: 13, yaw: 0.4, variant: 2 },
    { x: 52, z: 26, s: 15, yaw: 0.15, variant: 0 },
    { x: 0, z: -38, s: 18, yaw: 0, variant: 1 },
    { x: -8, z: 40, s: 17, yaw: 0.3, variant: 2 },
  ];
}

export function canyonCacti() {
  return [
    ...scatter(41, 20, { x0: -32, x1: 32, z0: -22, z1: 22, s0: 0.7, s1: 1.4, tall: true }),
    ...sideline(61, 6, 12, 18, 0.85, 1.35),
  ];
}

export function canyonMesas(): Scatter[] {
  return [
    { x: -36, z: -18, s: 5.5, yaw: 0.2, variant: 0 },
    { x: -38, z: 16, s: 6.2, yaw: -0.15, variant: 1 },
    { x: 37, z: -14, s: 5.8, yaw: 0.1, variant: 2 },
    { x: 39, z: 20, s: 6.5, yaw: 0.25, variant: 0 },
    { x: -22, z: -28, s: 4.4, yaw: 0, variant: 1 },
    { x: 24, z: 30, s: 4.8, yaw: 0.3, variant: 2 },
  ];
}

export function graveyardTrees() {
  return [...rim(43, 14, 30, 40, 0.9, 1.5), ...sideline(59, 7, 13, 18, 0.85, 1.3)];
}

export function graveyardLanterns(): Scatter[] {
  return [
    { x: -14, z: -12, s: 1, yaw: 0, variant: 0 },
    { x: 14, z: -12, s: 1, yaw: 0, variant: 1 },
    { x: -14, z: 12, s: 1, yaw: 0, variant: 2 },
    { x: 14, z: 12, s: 1, yaw: 0, variant: 0 },
    { x: -22, z: 0, s: 1, yaw: 0, variant: 1 },
    { x: 22, z: 0, s: 1, yaw: 0, variant: 2 },
  ];
}

export function sceneryFor(arena: ArenaId) {
  if (arena === "canyon") {
    return { kind: "canyon" as const, cacti: canyonCacti(), mesas: canyonMesas() };
  }
  if (arena === "graveyard") {
    return { kind: "graveyard" as const, trees: graveyardTrees(), lanterns: graveyardLanterns() };
  }
  return {
    kind: "meadow" as const,
    trees: meadowTrees(),
    bushes: meadowBushes(),
    tufts: meadowTufts(),
    flowers: meadowFlowers(),
    rocks: meadowRocks(),
    logs: meadowLogs(),
    fence: meadowFence(),
    hills: meadowHills(),
  };
}
