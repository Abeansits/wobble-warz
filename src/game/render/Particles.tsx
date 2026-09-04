import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "@/store/gameStore";

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
};

const pool: Spark[] = [];
const MAX = 280;

export function burst(x: number, y: number, z: number, n: number, hex: string, speed = 4) {
  const c = new THREE.Color(hex);
  for (let i = 0; i < n; i++) {
    if (pool.length >= MAX) pool.shift();
    pool.push({
      x,
      y,
      z,
      vx: (Math.random() - 0.5) * speed,
      vy: Math.random() * speed * 0.8 + 1,
      vz: (Math.random() - 0.5) * speed,
      life: 0.45 + Math.random() * 0.35,
      max: 0.7,
      size: 0.06 + Math.random() * 0.08,
      color: c.clone(),
    });
  }
}

export function Particles() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const phase = useGame((s) => s.snapshot?.phase);

  useFrame((_, dt) => {
    if (!mesh.current) return;
    if (phase === "setup") {
      pool.length = 0;
      mesh.current.count = 0;
      return;
    }
    let live = 0;
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];
      p.life -= dt;
      if (p.life <= 0) {
        pool.splice(i, 1);
        continue;
      }
      p.vy -= 9 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      dummy.position.set(p.x, p.y, p.z);
      const s = p.size * (p.life / p.max);
      dummy.scale.setScalar(Math.max(0.01, s));
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
    t.offset.set(0, 0.5);
    return t;
  }, []);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} transparent toneMapped={false} depthWrite={false} />
    </instancedMesh>
  );
}
