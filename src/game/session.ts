import { World } from "@/game/sim/World";

/** Module singleton — sim lives outside React. */
export const session: { world: World | null; ready: Promise<World> | null } = {
  world: null,
  ready: null,
};

export function resetWorld() {
  try {
    session.world?.physics.dispose();
  } catch {
    /* wasm may already be dead */
  }
  session.world = null;
  session.ready = null;
}

export function getWorld(): Promise<World> {
  if (session.world) return Promise.resolve(session.world);
  if (!session.ready) {
    session.ready = (async () => {
      const w = new World(2026);
      await w.init();
      session.world = w;
      return w;
    })().catch((err) => {
      session.ready = null;
      session.world = null;
      throw err;
    });
  }
  return session.ready;
}
