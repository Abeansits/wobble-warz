import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { SplatKind } from "@/game/sim/events";
import { useGame } from "@/store/gameStore";
import { ATLAS, TILE_U, TILE_V, type ParticleKind } from "./particleAtlas";
import { TEAM } from "./palette";

type Kind = ParticleKind;

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
    const cap = useGame.getState().snapshot?.degraded ? MAX / 2 : MAX;
    if (pool.length >= cap) pool.shift();
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
    spawn(x, y, z, 28, "#eef8ff", 2.8, "ice", 0.22);
    spawn(x, y, z, 12, "#7ec8e0", 1.4, "snow", 0.16);
    spawn(x, y, z, 1, "#c8e8f8", 0.05, "ring", 1.1);
  } else if (kind === "pumpkin") {
    spawn(x, y, z, 36, "#c45a18", 4.2, "goo", 0.24);
    spawn(x, y, z, 14, "#d4a017", 2.6, "confetti", 0.16);
  } else {
    spawn(x, y, z, 22, "#b6e06a", 1.8, "heal", 0.16);
    spawn(x, y, z, 10, "#efe0b4", 1.1, "star", 0.12);
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

  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.setAttribute("instanceUvOffset", new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2));
    return g;
  }, []);

  const map = useMemo(() => {
    const t = new THREE.TextureLoader().load("/assets/particles.png");
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }, []);

  const mat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           attribute vec2 instanceUvOffset;
           varying vec2 vParticleUv;`,
        )
        .replace(
          "#include <uv_vertex>",
          `#include <uv_vertex>
           vParticleUv = uv * vec2(${TILE_U}, ${TILE_V}) + instanceUvOffset;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           varying vec2 vParticleUv;`,
        )
        .replace(
          "#include <map_fragment>",
          `vec4 sampledDiffuseColor = texture2D( map, vParticleUv );
           diffuseColor *= sampledDiffuseColor;`,
        );
    };
    m.customProgramCacheKey = () => "ww-particle-atlas";
    return m;
  }, [map]);

  useFrame((state, dt) => {
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
    const uvAttr = mesh.current.geometry.getAttribute("instanceUvOffset") as THREE.InstancedBufferAttribute;
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
      dummy.lookAt(state.camera.position);
      const t = p.life / p.max;
      const scale = p.kind === "ring" ? p.size * (0.35 + (1 - t) * 1.4) : Math.max(0.01, p.size * t);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(live, dummy.matrix);
      mesh.current.setColorAt(live, p.color);
      const tile = ATLAS[p.kind];
      uvAttr.setXY(live, tile[0], tile[1]);
      live++;
    }
    mesh.current.count = live;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    uvAttr.needsUpdate = true;

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

  return (
    <>
      <instancedMesh ref={mesh} args={[geo, mat, MAX]} frustumCulled={false} dispose={null} />
      <instancedMesh ref={beamMesh} args={[undefined, undefined, BEAM_MAX]} frustumCulled={false} dispose={null}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshBasicMaterial transparent opacity={0.85} toneMapped={false} depthWrite={false} />
      </instancedMesh>
    </>
  );
}
