import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { startMeadow, stopMeadow } from "@/game/audio";
import { deployYaw } from "@/game/sim/facing";
import { World, type WorldSnapshot } from "@/game/sim/World";
import { ArmyView } from "./ArmyView";
import { Clouds, SkyDome } from "./SkyBits";
import { MeadowProps, Terrain } from "./Terrain";

function plant(world: World) {
  world.clearUnits();
  for (let i = 0; i < 4; i++) {
    world.place({
      defId: "stoneage.clubber",
      x: -11,
      z: -4.5 + i * 2.8,
      yaw: deployYaw(0),
      side: 0,
    });
    world.place({
      defId: "medieval.squire",
      x: 11,
      z: -4.5 + i * 2.8,
      yaw: deployYaw(1),
      side: 1,
    });
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
    onSnap(world.snapshot());
  });
  return null;
}

function Rig() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.12;
    camera.position.set(Math.sin(t) * 28, 16, Math.cos(t) * 28);
    camera.lookAt(0, 1.2, 0);
  });
  return null;
}

export function TitleToys() {
  const [world, setWorld] = useState<World | null>(null);
  const [snap, setSnap] = useState<WorldSnapshot | null>(null);

  useEffect(() => {
    startMeadow(0.25);
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
      stopMeadow();
      try {
        w.dispose();
      } catch {
        /* */
      }
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0">
      <Canvas camera={{ position: [22, 16, 22], fov: 42 }} dpr={[1, 1.25]} gl={{ antialias: true, alpha: true }}>
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
