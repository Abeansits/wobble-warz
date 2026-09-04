import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { ProjectileView } from "@/game/sim/World";
import { renderFrame } from "./renderFrame";

const KINDS: ProjectileView["kind"][] = ["rock", "spear", "arrow", "boom", "pumpkin", "ice"];
const CAP = 24;
const _dir = new THREE.Vector3();
const _y = new THREE.Vector3(0, 1, 0);
const dummy = new THREE.Object3D();

const COLOR: Record<ProjectileView["kind"], string> = {
  rock: "#d4b896",
  spear: "#f4efe4",
  arrow: "#ffe6b8",
  boom: "#2a241c",
  pumpkin: "#e07020",
  ice: "#c8f0ff",
};

function geo(kind: ProjectileView["kind"]) {
  if (kind === "spear") return new THREE.CapsuleGeometry(0.07, 0.85, 3, 6);
  if (kind === "arrow") return new THREE.CapsuleGeometry(0.045, 0.95, 3, 6);
  return new THREE.SphereGeometry(1, 8, 6);
}

function scaleOf(s: ProjectileView): [number, number, number] {
  if (s.kind === "spear" || s.kind === "arrow") return [1, 1, 1];
  return [s.r, s.r, s.r];
}

function ShotBatch({ kind }: { kind: ProjectileView["kind"] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => geo(kind), [kind]);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: COLOR[kind], toneMapped: false }),
    [kind],
  );
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const shots = (renderFrame.snap?.projectiles ?? []).filter((s) => s.kind === kind && Number.isFinite(s.x));
    const n = Math.min(shots.length, CAP);
    for (let i = 0; i < n; i++) {
      const s = shots[i];
      dummy.position.set(s.x, s.y, s.z);
      const speed = Math.hypot(s.vx, s.vy, s.vz);
      if (speed > 0.4 && (kind === "spear" || kind === "arrow")) {
        _dir.set(s.vx, s.vy, s.vz).normalize();
        dummy.quaternion.setFromUnitVectors(_y, _dir);
      } else {
        dummy.quaternion.identity();
      }
      dummy.scale.set(...scaleOf(s));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geometry, material, CAP]} frustumCulled={false} raycast={() => {}} />
  );
}

export function Shots() {
  return (
    <group>
      {KINDS.map((k) => (
        <ShotBatch key={k} kind={k} />
      ))}
    </group>
  );
}
