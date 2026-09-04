import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { SplatKind } from "@/game/sim/events";
import { useGame } from "@/store/gameStore";
import { TEAM } from "./palette";

type Kind = "dust" | "spark" | "smoke" | "star" | "ring" | "confetti" | "snow" | "feather" | "flash" | "ice" | "goo" | "heal";

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

type Beam = {
  ox: number;
  oy: number;
  oz: number;
  tx: number;
  ty: number;
  tz: number;
  life: number;
  max: number;
  color: THREE.Color;
};

const pool: Spark[] = [];
const beams: Beam[] = [];
const MAX = 1200;
const BEAM_MAX = 28;
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _quat = new THREE.Quaternion();

function spawn(x: number, y: number, z: number, n: number, hex: string, speed: number, kind: Kind, size = 0.08) {
  _c.set(hex);
  for (let i = 0; i < n; i++) {
    if (pool.length >= MAX) pool.shift();
    const life =
      kind === "flash" ? 0.08 + Math.random() * 0.06 : kind === "heal" ? 0.45 + Math.random() * 0.25 : 0.35 + Math.random() * 0.45;
    pool.push({
      x,
      y,
      z,
      vx: (Math.random() - 0.5) * speed,
      vy:
        kind === "heal"
          ? 1.2 + Math.random() * 1.6
          : kind === "flash"
            ? (Math.random() - 0.2) * speed
            : Math.random() * speed * 0.8 + (kind === "dust" ? 0.2 : 1),
      vz: (Math.random() - 0.5) * speed,
      life,
      max: life,
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

export function muzzleFlash(x: number, y: number, z: number) {
  spawn(x, y, z, 12, "#fff6c8", 8, "flash", 0.16);
  spawn(x, y, z, 5, "#e09a2c", 3.2, "spark", 0.1);
}

export function addTracer(ox: number, oy: number, oz: number, tx: number, ty: number, tz: number, hex = "#fff3c0") {
  if (beams.length >= BEAM_MAX) beams.shift();
  _c.set(hex);
  beams.push({ ox, oy, oz, tx, ty, tz, life: 0.16, max: 0.16, color: _c.clone() });
}

export function splat(kind: SplatKind, x: number, y: number, z: number) {
  if (kind === "freeze") {
    spawn(x, y, z, 18, "#d8eef8", 2.4, "ice", 0.11);
    spawn(x, y, z, 8, "#7ec8e0", 1.6, "ice", 0.16);
  } else if (kind === "pumpkin") {
    spawn(x, y, z, 20, "#c45a18", 3.4, "goo", 0.18);
    spawn(x, y, z, 6, "#d4a017", 2.2, "goo", 0.12);
  } else {
    spawn(x, y, z, 12, "#8fbf5a", 1.5, "heal", 0.1);
    spawn(x, y, z, 4, "#efe0b4", 0.8, "heal", 0.08);
  }
}

function grav(kind: Kind): number {
  if (kind === "flash") return 0;
  if (kind === "heal") return -3.2;
  if (kind === "ice") return 3.4;
  if (kind === "goo") return 14;
  if (kind === "smoke" || kind === "dust") return 2;
  return 9;
}

export function Particles() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const beamMesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const phase = useGame((s) => s.snapshot?.phase);
  const units = useGame((s) => s.snapshot?.units);
  const trailTick = useRef(0);

  useFrame((_, dt) => {
    if (!mesh.current) return;
    if (phase === "setup") {
      pool.length = 0;
      beams.length = 0;
      mesh.current.count = 0;
      if (beamMesh.current) beamMesh.current.count = 0;
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
      p.vy -= grav(p.kind) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      dummy.position.set(p.x, p.y, p.z);
      dummy.quaternion.identity();
      dummy.scale.setScalar(Math.max(0.01, p.size * (p.life / p.max)));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(live, dummy.matrix);
      mesh.current.setColorAt(live, p.color);
      live++;
    }
    mesh.current.count = live;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;

    if (!beamMesh.current) return;
    let bLive = 0;
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      b.life -= dt;
      if (b.life <= 0) {
        beams.splice(i, 1);
        continue;
      }
      _dir.set(b.tx - b.ox, b.ty - b.oy, b.tz - b.oz);
      const len = Math.max(0.2, _dir.length());
      _dir.normalize();
      _mid.set((b.ox + b.tx) * 0.5, (b.oy + b.ty) * 0.5, (b.oz + b.tz) * 0.5);
      _quat.setFromUnitVectors(_up, _dir);
      dummy.position.copy(_mid);
      dummy.quaternion.copy(_quat);
      const fade = b.life / b.max;
      dummy.scale.set(0.045 * fade, len, 0.045 * fade);
      dummy.updateMatrix();
      beamMesh.current.setMatrixAt(bLive, dummy.matrix);
      beamMesh.current.setColorAt(bLive, b.color);
      bLive++;
    }
    beamMesh.current.count = bLive;
    beamMesh.current.instanceMatrix.needsUpdate = true;
    if (beamMesh.current.instanceColor) beamMesh.current.instanceColor.needsUpdate = true;
  });

  const map = useMemo(() => {
    const t = new THREE.TextureLoader().load("/assets/particles.png");
    t.colorSpace = THREE.SRGBColorSpace;
    t.repeat.set(0.25, 0.5);
    t.offset.set(0.25, 0.5);
    return t;
  }, []);

  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false} dispose={null}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={map} transparent toneMapped={false} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={beamMesh} args={[undefined, undefined, BEAM_MAX]} frustumCulled={false} dispose={null}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshBasicMaterial transparent opacity={0.85} toneMapped={false} depthWrite={false} />
      </instancedMesh>
    </>
  );
}
