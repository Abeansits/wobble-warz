import { deployYaw } from "@/game/sim/facing";
import type { Placement } from "./types";

export type LadderLevel = {
  id: number;
  name: string;
  budget: number;
  blurb: string;
  army: { defId: string; count: number }[];
};

export const LADDER: LadderLevel[] = [
  { id: 1, name: "Club night", budget: 950, blurb: "Stone Age warm-up.", army: [{ defId: "stoneage.clubber", count: 8 }] },
  { id: 2, name: "Sticks and stones", budget: 1100, blurb: "Lobbers join in.", army: [{ defId: "stoneage.clubber", count: 6 }, { defId: "stoneage.rocklobber", count: 4 }] },
  { id: 3, name: "Steel lesson", budget: 1250, blurb: "Squires hold a line.", army: [{ defId: "medieval.squire", count: 10 }] },
  { id: 4, name: "Volley", budget: 1400, blurb: "Archers in the back.", army: [{ defId: "medieval.squire", count: 6 }, { defId: "medieval.archer", count: 4 }] },
  { id: 5, name: "Bone boss", budget: 1550, blurb: "A Brute and friends.", army: [{ defId: "stoneage.bonebrute", count: 1 }, { defId: "stoneage.clubber", count: 8 }] },
  { id: 6, name: "Deck swarm", budget: 1700, blurb: "Pirates arrive.", army: [{ defId: "pirate.deckhand", count: 12 }] },
  { id: 7, name: "Powder", budget: 1850, blurb: "Bombs bounce.", army: [{ defId: "pirate.deckhand", count: 6 }, { defId: "pirate.bomber", count: 4 }] },
  { id: 8, name: "Dust-up", budget: 2000, blurb: "Frontier fists.", army: [{ defId: "frontier.brawler", count: 10 }] },
  { id: 9, name: "Gun line", budget: 2150, blurb: "Keep your head down.", army: [{ defId: "frontier.brawler", count: 4 }, { defId: "frontier.gunslinger", count: 4 }] },
  { id: 10, name: "Coach boss", budget: 2300, blurb: "Stagecoach plus riders.", army: [{ defId: "frontier.stagecoach", count: 1 }, { defId: "frontier.gunslinger", count: 4 }] },
  { id: 11, name: "Bone pile", budget: 2450, blurb: "Skeletons never stop.", army: [{ defId: "haunted.skeleton", count: 20 }] },
  { id: 12, name: "Pumpkin patch", budget: 2600, blurb: "Slow and swarm.", army: [{ defId: "haunted.skeleton", count: 10 }, { defId: "haunted.pumpkin", count: 4 }] },
  { id: 13, name: "Ghosts", budget: 2750, blurb: "They walk through you.", army: [{ defId: "haunted.ghost", count: 6 }, { defId: "haunted.scarecrow", count: 2 }] },
  { id: 14, name: "King's men", budget: 2900, blurb: "A King and a court.", army: [{ defId: "medieval.king", count: 1 }, { defId: "medieval.squire", count: 8 }] },
  { id: 15, name: "Cannon row", budget: 3050, blurb: "Don't stand still.", army: [{ defId: "pirate.cannon", count: 2 }, { defId: "pirate.deckhand", count: 8 }] },
  { id: 16, name: "Night hunt", budget: 3200, blurb: "Vampire leading bones.", army: [{ defId: "haunted.vampire", count: 1 }, { defId: "haunted.skeleton", count: 16 }] },
  { id: 17, name: "Mammoth walk", budget: 3350, blurb: "Bowling practice.", army: [{ defId: "stoneage.mammoth", count: 1 }, { defId: "stoneage.clubber", count: 10 }] },
  { id: 18, name: "Captain's table", budget: 3500, blurb: "Rally and shot.", army: [{ defId: "pirate.captain", count: 1 }, { defId: "pirate.musketeer", count: 4 }, { defId: "pirate.deckhand", count: 6 }] },
  { id: 19, name: "Long rifles", budget: 3650, blurb: "You will get poked.", army: [{ defId: "frontier.rifleman", count: 6 }, { defId: "frontier.lasso", count: 4 }] },
  { id: 20, name: "The Reaper", budget: 3800, blurb: "If it swings, duck.", army: [{ defId: "haunted.reaper", count: 1 }, { defId: "haunted.skeleton", count: 12 }, { defId: "haunted.ghost", count: 4 }] },
];

export function ladderArmy(level: LadderLevel, side: 0 | 1): Placement[] {
  const out: Placement[] = [];
  const x0 = side === 0 ? -22 : 22;
  const yaw = deployYaw(side);
  let i = 0;
  for (const pack of level.army) {
    for (let n = 0; n < pack.count; n++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      out.push({
        defId: pack.defId,
        x: x0 + (side === 0 ? row * 1.3 : -row * 1.3),
        z: -8 + col * 3.2 + (row % 2) * 0.4,
        yaw,
        side,
      });
      i += 1;
    }
  }
  return out;
}
