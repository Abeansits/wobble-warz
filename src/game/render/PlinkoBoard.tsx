import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Prize } from "@/game/data/rolls";
import { PRIZE_COLOR } from "@/game/data/rolls";
import { BALL_R, PlinkoSim, plinkoPegs } from "@/game/sim/plinko";
import { WOOD } from "./palette";
import { getRamp, getWood } from "./textures";

const PEGS = plinkoPegs();
const pegGeo = new THREE.SphereGeometry(1, 10, 8);
const ballGeo = new THREE.SphereGeometry(1, 16, 12);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function WoodMat({ color = WOOD }: { color?: string }) {
  return <meshToonMaterial color={color} gradientMap={getRamp()} map={getWood()} />;
}

function Board() {
  return (
    <group>
      <mesh position={[0, 3.15, -0.38]} scale={[5.3, 6.5, 0.08]} geometry={boxGeo} receiveShadow>
        <WoodMat color="#5a3a1c" />
      </mesh>
      <mesh position={[-2.62, 3.15, 0]} scale={[0.16, 6.5, 0.7]} geometry={boxGeo} castShadow>
        <WoodMat />
      </mesh>
      <mesh position={[2.62, 3.15, 0]} scale={[0.16, 6.5, 0.7]} geometry={boxGeo} castShadow>
        <WoodMat />
      </mesh>
      <mesh position={[0, 0.04, 0]} scale={[5.3, 0.16, 0.7]} geometry={boxGeo} receiveShadow>
        <WoodMat color="#4a2e14" />
      </mesh>
      {[-1.5, -0.5, 0.5, 1.5].map((x) => (
        <mesh key={x} position={[x, 0.28, 0]} scale={[0.08, 0.44, 0.5]} geometry={boxGeo}>
          <WoodMat color="#3a2410" />
        </mesh>
      ))}
      {PEGS.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]} scale={p.r} geometry={pegGeo} castShadow>
          <meshToonMaterial color="#c48a3a" gradientMap={getRamp()} />
        </mesh>
      ))}
    </group>
  );
}

function Capsule({
  sim,
  color,
  cracked,
  glow,
}: {
  sim: PlinkoSim;
  color: string;
  cracked: boolean;
  glow: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const crackT = useRef(0);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const p = sim.scratch;
    if (!cracked) {
      crackT.current = 0;
      g.position.set(p.x, p.y, p.z);
      g.quaternion.set(p.qx, p.qy, p.qz, p.qw);
      g.scale.setScalar(BALL_R);
      g.visible = sim.phase !== "idle";
      return;
    }
    crackT.current += dt;
    const u = Math.min(1, crackT.current / 0.35);
    g.position.set(p.x, p.y + u * 0.15, p.z);
    g.scale.setScalar(BALL_R * (1 + u * 0.35));
    g.visible = u < 1;
  });
  return (
    <group ref={ref}>
      <mesh geometry={ballGeo}>
        <meshToonMaterial
          color={color}
          gradientMap={getRamp()}
          emissive={glow ? color : "#000000"}
          emissiveIntensity={glow ? 0.45 : 0}
        />
      </mesh>
      <mesh position={[0, 0, 0.55]} scale={[0.35, 0.12, 0.12]} geometry={boxGeo}>
        <meshToonMaterial color="#1c1710" gradientMap={getRamp()} />
      </mesh>
      {glow && <pointLight color={color} intensity={2.2} distance={3.5} />}
    </group>
  );
}

function Burst({ color, origin, on }: { color: string; origin: [number, number, number]; on: boolean }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return { a, s: 0.06 + (i % 3) * 0.03, r: 0.4 + (i % 5) * 0.08 };
      }),
    [],
  );
  const ref = useRef<THREE.Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!on) {
      t.current = 0;
      if (ref.current) ref.current.visible = false;
      return;
    }
    t.current += dt;
    const g = ref.current;
    if (!g) return;
    g.visible = true;
    g.position.set(...origin);
    const u = Math.min(1, t.current / 0.55);
    g.children.forEach((ch, i) => {
      const b = bits[i];
      ch.position.set(Math.cos(b.a) * b.r * u, Math.sin(b.a) * b.r * u + u * 0.2, Math.sin(b.a * 2) * 0.12);
      ch.scale.setScalar(1 - u * 0.7);
    });
    g.visible = u < 1;
  });
  if (!on) return null;
  return (
    <group ref={ref}>
      {bits.map((b, i) => (
        <mesh key={i}>
          <sphereGeometry args={[b.s, 6, 5]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function Loop({
  sim,
  dropNonce,
  prize,
  onSettled,
}: {
  sim: PlinkoSim;
  dropNonce: number;
  prize: Prize | null;
  onSettled: () => void;
}) {
  const last = useRef(performance.now());
  const nonce = useRef(0);
  const fired = useRef(false);
  useFrame(() => {
    if (dropNonce !== nonce.current && prize) {
      nonce.current = dropNonce;
      fired.current = false;
      sim.drop((Math.random() - 0.5) * 0.7);
    }
    const now = performance.now();
    const dt = Math.min(0.05, (now - last.current) / 1000);
    last.current = now;
    sim.step(dt);
    if (sim.phase === "settled" && !fired.current) {
      fired.current = true;
      onSettled();
    }
  });
  return null;
}

function Rig() {
  useFrame(({ camera }) => {
    camera.position.set(0.15, 3.15, 8.1);
    camera.lookAt(0, 2.9, 0);
  });
  return null;
}

export function PlinkoBoard({
  prize,
  dropNonce,
  onSettled,
}: {
  prize: Prize | null;
  dropNonce: number;
  onSettled: () => void;
}) {
  const [sim, setSim] = useState<PlinkoSim | null>(null);
  const [cracked, setCracked] = useState(false);
  const color = prize ? PRIZE_COLOR[prize.kind] : "#c48a3a";

  useEffect(() => {
    let alive = true;
    const p = new PlinkoSim();
    void p.init().then(() => {
      if (!alive) {
        p.dispose();
        return;
      }
      setSim(p);
    });
    return () => {
      alive = false;
      try {
        p.dispose();
      } catch {
        /* */
      }
    };
  }, []);

  useEffect(() => {
    setCracked(false);
  }, [dropNonce]);

  const settled = () => {
    setCracked(true);
    onSettled();
  };

  const origin: [number, number, number] = sim
    ? [sim.scratch.x, sim.scratch.y, sim.scratch.z]
    : [0, 0.4, 0];

  return (
    <div className="relative h-[28rem] w-full overflow-hidden rounded-card border-[3px] border-ink bg-[#2a1c12]">
      {!sim && (
        <p className="absolute inset-0 z-10 flex items-center justify-center font-display text-xl text-cream">
          Winding the machine…
        </p>
      )}
      <Canvas camera={{ position: [0.2, 3.2, 8], fov: 36 }} dpr={[1, 1.5]} shadows>
        <color attach="background" args={["#2a1c12"]} />
        <hemisphereLight args={["#f4e8c8", "#3a2410", 0.7]} />
        <directionalLight position={[4, 8, 6]} intensity={1.15} color="#ffe6b8" castShadow />
        <Board />
        {sim && (
          <>
            <Loop sim={sim} dropNonce={dropNonce} prize={prize} onSettled={settled} />
            <Capsule sim={sim} color={color} cracked={cracked} glow={prize?.kind === "anomaly"} />
            <Burst color={color} origin={origin} on={cracked} />
          </>
        )}
        <Rig />
      </Canvas>
    </div>
  );
}
