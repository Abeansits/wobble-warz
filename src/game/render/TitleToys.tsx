import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { setListener, setMixer, sfx, startMusic, stopMusic } from "@/game/audio";
import { deployYaw } from "@/game/sim/facing";
import { World, type WorldSnapshot } from "@/game/sim/World";
import { useSettings } from "@/routes/settings";
import { ArmyView } from "./ArmyView";
import { posedSnapshot } from "./interp";
import { Clouds, SkyDome } from "./SkyBits";
import { MeadowProps, Terrain } from "./Terrain";
import { hitJuice } from "./hitJuice";

const DEMO: { defId: string; x: number; z: number; side: 0 | 1 }[] = [
  { defId: "stoneage.clubber", x: -12, z: -6, side: 0 },
  { defId: "stoneage.clubber", x: -13, z: -3, side: 0 },
  { defId: "stoneage.rocklobber", x: -15, z: 0, side: 0 },
  { defId: "stoneage.mammoth", x: -14, z: 4, side: 0 },
  { defId: "medieval.squire", x: 12, z: -6, side: 1 },
  { defId: "medieval.archer", x: 15, z: -2, side: 1 },
  { defId: "medieval.squire", x: 12, z: 1, side: 1 },
  { defId: "pirate.deckhand", x: 13, z: 5, side: 1 },
];

function plant(world: World) {
  world.clearUnits();
  for (const p of DEMO) {
    world.place({ defId: p.defId, x: p.x, z: p.z, yaw: deployYaw(p.side), side: p.side });
  }
  world.startCountdown();
}

function DemoLoop({ world, onSnap }: { world: World; onSnap: (s: WorldSnapshot) => void }) {
  const last = useRef(performance.now());
  useFrame(() => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last.current) / 1000);
    last.current = now;
    if (world.phase !== "over") world.step(dt, 1, false);
    else plant(world);
    for (const e of world.drainEvents()) {
      if (e.type === "death") {
        const u = world.units.find((n) => n.id === e.unitId);
        sfx("yelp", 0.22, u ? { x: u.x, y: u.y, z: u.z } : undefined);
      } else if (e.type === "launch") {
        const u = world.units.find((n) => n.id === e.unitId);
        if (u) sfx("yelp", 0.16, { x: u.x, y: u.y, z: u.z });
      } else if (e.type === "hit") {
        const v = world.units.find((n) => n.id === e.victimId);
        sfx("hit", hitJuice(e.impulse).volume * 0.4, v ? { x: v.x, y: v.y, z: v.z } : undefined);
      } else if (e.type === "swing") {
        const u = world.units.find((n) => n.id === e.unitId);
        if (u) sfx("swing", 0.1, { x: u.x, y: u.y, z: u.z });
      }
    }
    onSnap(world.phase === "setup" || !world.currSnap ? world.snapshot() : posedSnapshot(world));
  });
  return null;
}

function Rig() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.12;
    const x = Math.sin(t) * 15;
    const y = 8.5;
    const z = Math.cos(t) * 15;
    camera.position.set(x, y, z);
    camera.lookAt(0, 0.8, 0);
    const fx = -x;
    const fy = 0.8 - y;
    const fz = -z;
    const len = Math.hypot(fx, fy, fz) || 1;
    setListener(x, y, z, fx / len, fy / len, fz / len);
  });
  return null;
}

export function TitleToys() {
  const [world, setWorld] = useState<World | null>(null);
  const [snap, setSnap] = useState<WorldSnapshot | null>(null);

  useEffect(() => {
    const s = useSettings.getState();
    setMixer(s.master ?? 0.7, s.music ?? 0.6, s.sfx ?? 0.8);
    startMusic("menu");
    let alive = true;
    const w = new World(44);
    void w.init().then(() => {
      if (!alive) {
        w.dispose();
        return;
      }
      plant(w);
      setWorld(w);
      setSnap(w.snapshot());
    });
    return () => {
      alive = false;
      stopMusic();
      try {
        w.dispose();
      } catch {
        /* */
      }
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0">
      <Canvas
        camera={{ position: [12, 8.5, 12], fov: 42 }}
        dpr={[1, 1.25]}
        gl={{ antialias: true, alpha: true }}
        // R3F's wrapper defaults to pointer-events: auto and would eat title clicks.
        style={{ pointerEvents: "none" }}
      >
        <SkyDome sky="#8ec6e8" />
        <Clouds />
        <fog attach="fog" args={["#9fd0ee", 40, 110]} />
        <hemisphereLight args={["#cfe8ff", "#4a6a32", 0.8]} />
        <directionalLight position={[18, 28, 10]} intensity={1.2} color="#ffe6b8" />
        <Terrain />
        <MeadowProps />
        <ArmyView snapshot={snap} />
        {world ? <DemoLoop world={world} onSnap={setSnap} /> : null}
        <Rig />
      </Canvas>
    </div>
  );
}
