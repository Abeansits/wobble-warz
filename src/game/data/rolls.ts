export const ROLL_COST = 200;

export const POWERUPS = [
  { id: "pockets", name: "Deep Pockets", blurb: "+15% budget this fight.", rarity: "common" },
  { id: "iron", name: "Iron Skin", blurb: "Your toys get +20% HP.", rarity: "common" },
  { id: "boots", name: "Big Boots", blurb: "Harder to knock down.", rarity: "common" },
  { id: "reinforce", name: "Reinforcements", blurb: "Five skeletons at 0:20.", rarity: "common" },
  { id: "wind", name: "Second Wind", blurb: "Heal 30% at 0:30.", rarity: "rare" },
  { id: "giant", name: "Giant", blurb: "One random toy is huge.", rarity: "rare" },
  { id: "potato", name: "Hot Potato", blurb: "Their priciest toy is ticking.", rarity: "rare" },
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

export const COSMETICS = [
  { id: "hat.cone", name: "Traffic cone hat" },
  { id: "hat.crown", name: "Tiny crown" },
  { id: "pal.midnight", name: "Midnight steel" },
  { id: "pal.ghost", name: "Ghost fleet" },
] as const;

export type Prize =
  | { kind: "powerup"; id: string; name: string }
  | { kind: "cosmetic"; id: string; name: string }
  | { kind: "credits"; amount: number }
  | { kind: "anomaly"; id: string; name: string };

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
