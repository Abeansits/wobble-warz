import { getUnit } from "@/game/data/units";
import { deployYaw } from "./facing";
import { World } from "./World";

/** Headless equal-cost mirror. Flag anything above 65% as spec §10.6. */
export async function mirrorMatch(
  a: string,
  b: string,
  rounds = 6,
  seconds = 25,
): Promise<{ wins: [number, number, number]; rate: number }> {
  const wins: [number, number, number] = [0, 0, 0];
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
    world.dispose();
  }
  const decided = wins[0] + wins[1] || 1;
  return { wins, rate: wins[0] / decided };
}
