import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "@/store/gameStore";
import { TEAM } from "./palette";

type Kind = "dust" | "spark" | "smoke" | "star" | "ring" | "confetti" | "snow" | "feather";

type Spark = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  color: THREE.Color;
  kind: Kind;
  billboard: boolean;
};

const pool: Spark[] = [];
const MAX = 1200;
const _c = new THREE.Color();

function spawn(x: number, y: number, z: number, n: number, hex: string, speed: number, kind: Kind, size = 0.08) {
  _c.set(hex);
  for (let i = 0; i < n; i++) {
    if (pool.length >= MAX) pool.shift();
    pool.push({
      x,
      y,
      z,
      vx: (Math.random() - 0.5) * speed,
      vy: Math.random() * speed * 0.8 + (kind === "dust" ? 0.2 : 1),
      vz: (Math.random() - 0.5) * speed,
      life: 0.35 + Math.random() * 0.45,
      max: 0.8,
      size: size * (0.7 + Math.random() * 0.6),
      color: _c.clone(),
      kind,
      billboard: true,
    });
  }
}

export function burst(x: number, y: number, z: number, n: number, hex: string, speed = 4) {
  spawn(x, y, z, n, hex, speed, n > 10 ? "smoke" : "spark", n > 10 ? 0.16 : 0.08);
}

export function puff(x: number, y: number, z: number, hex: string, kind: Kind = "dust") {
  spawn(x, y, z, 4, hex, 1.6, kind, 0.12);
}

export function Particles() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const phase = useGame((s) => s.snapshot?.phase);
  const units = useGame((s) => s.snapshot?.units);
  const trailTick = useRef(0);

  useFrame((_, dt) => {
    if (!mesh.current) return;
    if (phase === "setup") {
      pool.length = 0;
      mesh.current.count = 0;
      return;
    }
    trailTick.current += dt;
    if (trailTick.current > 0.045 && units) {
      trailTick.current = 0;
      for (const u of units) {
        if (u.state !== "launched") continue;
        const src = u.parts.torso ?? u.root;
        if (!Number.isFinite(src.x)) continue;
        puff(src.x, src.y + 0.2, src.z, TEAM[u.side], "feather");
      }
    }
    let live = 0;
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];
      p.life -= dt;
      if (p.life <= 0) {
        pool.splice(i, 1);
        continue;
      }
      p.vy -= (p.kind === "smoke" || p.kind === "dust" ? 2 : 9) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(Math.max(0.01, p.size * (p.life / p.max)));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(live, dummy.matrix);
      mesh.current.setColorAt(live, p.color);
      live++;
    }
    mesh.current.count = live;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });

  const map = useMemo(() => {
    const t = new THREE.TextureLoader().load("/assets/particles.png");
    t.colorSpace = THREE.SRGBColorSpace;
    t.repeat.set(0.25, 0.5);
    t.offset.set(0.25, 0.5);
    return t;
  }, []);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false} dispose={null}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} transparent toneMapped={false} depthWrite={false} />
    </instancedMesh>
  );
}
