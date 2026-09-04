import { getUnit } from "@/game/data/units";
import { deployYaw } from "./facing";
import { World } from "./World";

/** Spec §10.6: flag anything above 65% at equal cost. */
export const FLAG_RATE = 0.65;

export type MirrorResult = {
  a: string;
  b: string;
  wins: [number, number, number];
  /** Side-0 win rate among decided games (draws ignored). */
  rate: number;
  decided: number;
  avgTime: number;
  hot: boolean;
};

/** True when either side's decided win rate exceeds 65%. Draws are not hot. */
export function isHot(rate: number, decided = 1): boolean {
  if (decided <= 0) return false;
  return Math.max(rate, 1 - rate) > FLAG_RATE;
}

export const MIRROR_PAIRS: [string, string][] = [
  ["stoneage.clubber", "medieval.squire"],
  ["stoneage.rocklobber", "medieval.archer"],
  ["pirate.deckhand", "frontier.gunslinger"],
  ["haunted.skeleton", "stoneage.clubber"],
];

/** Headless equal-cost mirror. */
export async function mirrorMatch(
  a: string,
  b: string,
  rounds = 6,
  seconds = 25,
): Promise<MirrorResult> {
  const wins: [number, number, number] = [0, 0, 0];
  let timeSum = 0;
  const ca = getUnit(a).cost;
  const cb = getUnit(b).cost;
  const nA = Math.max(1, Math.min(12, Math.round(800 / ca)));
  const nB = Math.max(1, Math.min(12, Math.round(800 / cb)));
  for (let r = 0; r < rounds; r++) {
    const world = new World(1000 + r * 17);
    await world.init();
    for (let i = 0; i < nA; i++) {
      world.place({ defId: a, x: -8, z: -6 + i * 1.6, yaw: deployYaw(0), side: 0 });
    }
    for (let i = 0; i < nB; i++) {
      world.place({ defId: b, x: 8, z: -6 + i * 1.6, yaw: deployYaw(1), side: 1 });
    }
    world.startCountdown();
    const steps = Math.ceil(seconds * 60) + 180;
    for (let s = 0; s < steps; s++) {
      world.step(1 / 60, 1, false);
      if (world.phase === "over") break;
    }
    if (world.winner === 0) wins[0]++;
    else if (world.winner === 1) wins[1]++;
    else wins[2]++;
    timeSum += world.time;
    world.dispose();
  }
  const decided = wins[0] + wins[1];
  const rate = decided > 0 ? wins[0] / decided : 0;
  return {
    a,
    b,
    wins,
    rate,
    decided,
    avgTime: rounds > 0 ? timeSum / rounds : 0,
    hot: isHot(rate, decided),
  };
}

export async function runMirrors(
  pairs: [string, string][] = MIRROR_PAIRS,
  rounds = 2,
  seconds = 12,
): Promise<MirrorResult[]> {
  const rows: MirrorResult[] = [];
  for (const [a, b] of pairs) {
    rows.push(await mirrorMatch(a, b, rounds, seconds));
  }
  return rows;
}

export function formatReport(rows: MirrorResult[]): string {
  const lines = rows.map((r) => {
    const [wa, wb, wd] = r.wins;
    const share = r.decided > 0 ? Math.max(r.rate, 1 - r.rate) : 0;
    const pct = Math.round(share * 100);
    const tag = r.hot ? " FLAG" : "";
    return `${r.a} vs ${r.b}  ${wa}-${wb}-${wd}  ${pct}%  t=${r.avgTime.toFixed(1)}s${tag}`;
  });
  const hot = rows.filter((r) => r.hot);
  lines.push("");
  if (hot.length === 0) {
    lines.push("No matchup above 65%.");
  } else {
    for (const r of hot) {
      const share = Math.max(r.rate, 1 - r.rate);
      lines.push(`FLAG ${r.a} vs ${r.b} (${Math.round(share * 100)}%)`);
    }
  }
  return lines.join("\n");
}
