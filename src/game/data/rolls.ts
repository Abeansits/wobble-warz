import { HATS } from "./hats";

export const ROLL_COST = 200;
export const ROLL_BUNDLE_COUNT = 10;
export const ROLL_BUNDLE_COST = 1800;

export const POWERUPS = [
  { id: "pockets", name: "Deep Pockets", blurb: "+15% budget this fight.", rarity: "common" },
  { id: "iron", name: "Iron Skin", blurb: "Your toys get +20% HP.", rarity: "common" },
  { id: "boots", name: "Big Boots", blurb: "Harder to knock down.", rarity: "common" },
  { id: "reinforce", name: "Reinforcements", blurb: "Five skeletons at 0:20.", rarity: "common" },
  { id: "wind", name: "Second Wind", blurb: "Heal 30% at 0:30.", rarity: "rare" },
  { id: "giant", name: "Giant", blurb: "One random toy is huge.", rarity: "rare" },
  { id: "potato", name: "Hot Potato", blurb: "Their priciest toy is ticking.", rarity: "rare" },
  { id: "banana", name: "Banana Peel", blurb: "Their side turns into a slip-n-slide.", rarity: "rare" },
] as const;

export const ANOMALIES = [
  { id: "anomaly.jelly", name: "Jelly Titan", blurb: "Bouncy giant. Hits launch everyone." },
  { id: "anomaly.boulder", name: "Boulder Boy", blurb: "It's just a boulder." },
  { id: "anomaly.cheer", name: "The Cheerleader", blurb: "Allies nearby hit harder." },
  { id: "anomaly.ice", name: "Ice Wizard", blurb: "Shots that freeze a crowd." },
  { id: "anomaly.tax", name: "Tax Collector", blurb: "Steals max HP on hit." },
  { id: "anomaly.chicken", name: "Chicken Storm", blurb: "Lays angry hens." },
  { id: "anomaly.mirror", name: "Mirror Knight", blurb: "Hits bounce back." },
  { id: "anomaly.bard", name: "Black Hole Bard", blurb: "Pulls the scrum inward." },
] as const;

export const PALETTES = [
  { id: "pal.midnight", name: "Midnight steel" },
  { id: "pal.ghost", name: "Ghost fleet" },
  { id: "pal.pumpkin", name: "Pumpkin patch" },
  { id: "pal.bone", name: "Bone pile" },
  { id: "pal.royal", name: "Royal" },
  { id: "pal.rust", name: "Rust bucket" },
  { id: "pal.moss", name: "Mossy" },
  { id: "pal.ink", name: "Ink" },
] as const;

export const COSMETICS = [
  ...HATS.map((h) => ({ id: h.id, name: h.name })),
  ...PALETTES.map((p) => ({ id: p.id, name: p.name })),
] as const;

export type Prize =
  | { kind: "powerup"; id: string; name: string }
  | { kind: "cosmetic"; id: string; name: string }
  | { kind: "credits"; amount: number }
  | { kind: "anomaly"; id: string; name: string };

/** Capsule leak + burst. Decided with the prize, before the drop. */
export const PRIZE_COLOR: Record<Prize["kind"], string> = {
  powerup: "#c48a3a",
  cosmetic: "#3a5f8a",
  credits: "#efe0b4",
  anomaly: "#d4a017",
};

export function prizeLabel(prize: Prize): string {
  if (prize.kind === "credits") return `+${prize.amount} credits bounced back`;
  if (prize.kind === "anomaly") return `ANOMALY — ${prize.name}`;
  return prize.name;
}

export function rollPrize(pity: number): Prize {
  if (pity >= 19) {
    const a = ANOMALIES[Math.floor(Math.random() * ANOMALIES.length)];
    return { kind: "anomaly", id: a.id, name: a.name };
  }
  const n = Math.random();
  if (n < 0.05) {
    const a = ANOMALIES[Math.floor(Math.random() * ANOMALIES.length)];
    return { kind: "anomaly", id: a.id, name: a.name };
  }
  if (n < 0.2) {
    const amount = 50 + Math.floor(Math.random() * 6) * 50;
    return { kind: "credits", amount };
  }
  if (n < 0.5) {
    const c = COSMETICS[Math.floor(Math.random() * COSMETICS.length)];
    return { kind: "cosmetic", id: c.id, name: c.name };
  }
  const p = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
  return { kind: "powerup", id: p.id, name: p.name };
}

export function rollMany(count: number, startPity: number): Prize[] {
  const out: Prize[] = [];
  let pity = startPity;
  for (let i = 0; i < count; i++) {
    const prize = rollPrize(pity);
    out.push(prize);
    pity = prize.kind === "anomaly" ? 0 : pity + 1;
  }
  return out;
}
