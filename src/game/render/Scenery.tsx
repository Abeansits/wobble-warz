import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { getArena, terrainHeight, type ArenaId } from "@/game/data/arenas";
import { useGame } from "@/store/gameStore";
import { getPropTex } from "./textures";
import { sceneryFor, type Scatter } from "./sceneryLayout";

const dummy = new THREE.Object3D();

function plant(items: Scatter[], arena: ArenaId, yOff: number, lie = false) {
  return (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      dummy.position.set(p.x, terrainHeight(p.x, p.z, arena) + yOff * p.s, p.z);
      dummy.rotation.set(lie ? Math.PI / 2 : 0, p.yaw, 0);
      dummy.scale.set(p.s, p.s, p.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
}

function Instanced({
  items,
  arena,
  yOff,
  cast,
  lie,
  children,
}: {
  items: Scatter[];
  arena: ArenaId;
  yOff: number;
  cast?: boolean;
  lie?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const apply = useMemo(() => plant(items, arena, yOff, lie), [items, arena, yOff, lie]);
  useLayoutEffect(() => {
    apply(ref.current);
  }, [apply]);
  if (items.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={!!cast} receiveShadow={!!cast} frustumCulled={false} raycast={() => {}}>
      {children}
    </instancedMesh>
  );
}

export function Scenery() {
  const arenaId = useGame((s) => s.arena);
  const kit = useMemo(() => sceneryFor(arenaId), [arenaId]);
  const stone = useMemo(() => getPropTex("stone"), []);
  const wood = useMemo(() => getPropTex("wood"), []);
  const grass = getArena(arenaId).grass;
  const secondCanopy = useMemo(
    () => (kit.kind === "meadow" ? kit.trees.map((t) => ({ ...t, x: t.x + 0.35, z: t.z - 0.2, s: t.s * 0.72 })) : []),
    [kit],
  );
  const pinkFlowers = useMemo(
    () => (kit.kind === "meadow" ? kit.flowers.filter((_, i) => i % 3 === 1) : []),
    [kit],
  );
  const creamFlowers = useMemo(
    () => (kit.kind === "meadow" ? kit.flowers.filter((_, i) => i % 3 === 2) : []),
    [kit],
  );

  if (kit.kind === "canyon") {
    return (
      <group>
        <Instanced items={kit.cacti} arena={arenaId} yOff={0.7} cast>
          <capsuleGeometry args={[0.12, 0.9, 3, 6]} />
          <meshToonMaterial color="#2e6a32" />
        </Instanced>
        {kit.mesas.map((m, i) => (
          <mesh key={i} position={[m.x, 1.2 * m.s * 0.25, m.z]} rotation={[0, m.yaw, 0]} castShadow receiveShadow raycast={() => {}}>
            <boxGeometry args={[m.s, m.s * 0.55, m.s * 0.7]} />
            <meshToonMaterial color={i % 2 ? "#c45a32" : "#a84828"} map={stone} />
          </mesh>
        ))}
      </group>
    );
  }

  if (kit.kind === "graveyard") {
    return (
      <group>
        <Instanced items={kit.trees} arena={arenaId} yOff={1.4} cast>
          <cylinderGeometry args={[0.12, 0.2, 2.8, 5]} />
          <meshToonMaterial color="#2a2218" map={wood} />
        </Instanced>
        <Instanced items={kit.trees} arena={arenaId} yOff={2.6}>
          <boxGeometry args={[1.6, 0.18, 0.18]} />
          <meshToonMaterial color="#3a3228" />
        </Instanced>
        {kit.lanterns.map((l, i) => {
          const y = terrainHeight(l.x, l.z, arenaId);
          return (
            <group key={i} position={[l.x, y, l.z]}>
              <mesh position={[0, 1.1, 0]} raycast={() => {}}>
                <cylinderGeometry args={[0.06, 0.08, 2.2, 5]} />
                <meshToonMaterial color="#2a241c" />
              </mesh>
              <mesh position={[0, 2.25, 0]} raycast={() => {}}>
                <sphereGeometry args={[0.16, 8, 6]} />
                <meshBasicMaterial color="#f0a040" />
              </mesh>
              <pointLight position={[0, 2.25, 0]} color="#f0a040" intensity={1.4} distance={8} />
            </group>
          );
        })}
      </group>
    );
  }

  return (
    <group>
      {kit.hills.map((h, i) => (
        <mesh key={i} position={[h.x, h.s * 0.18, h.z]} scale={[h.s, h.s * 0.38, h.s * 0.85]} rotation={[0, h.yaw, 0]} raycast={() => {}}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshToonMaterial color={i % 2 ? grass : "#3d6a3a"} />
        </mesh>
      ))}
      <mesh position={[0, -0.55, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
        <planeGeometry args={[160, 120]} />
        <meshToonMaterial color="#3a5a32" />
      </mesh>
      <Instanced items={kit.trees} arena={arenaId} yOff={1.15} cast>
        <cylinderGeometry args={[0.16, 0.24, 2.2, 6]} />
        <meshToonMaterial color="#6b4a28" map={wood} />
      </Instanced>
      <Instanced items={kit.trees} arena={arenaId} yOff={2.55} cast>
        <sphereGeometry args={[1.05, 7, 6]} />
        <meshToonMaterial color="#2e6a32" />
      </Instanced>
      <Instanced items={secondCanopy} arena={arenaId} yOff={2.85}>
        <sphereGeometry args={[1, 7, 6]} />
        <meshToonMaterial color="#3d7a38" />
      </Instanced>
      <Instanced items={kit.bushes} arena={arenaId} yOff={0.45} cast>
        <sphereGeometry args={[0.55, 6, 5]} />
        <meshToonMaterial color="#2a5a28" />
      </Instanced>
      <Instanced items={kit.tufts} arena={arenaId} yOff={0.32}>
        <coneGeometry args={[0.22, 0.64, 5]} />
        <meshToonMaterial color="#3a7a34" />
      </Instanced>
      <Instanced items={kit.flowers} arena={arenaId} yOff={0.38}>
        <coneGeometry args={[0.16, 0.52, 5]} />
        <meshToonMaterial color="#e8c84a" />
      </Instanced>
      <Instanced items={pinkFlowers} arena={arenaId} yOff={0.4}>
        <coneGeometry args={[0.15, 0.5, 5]} />
        <meshToonMaterial color="#d45a6a" />
      </Instanced>
      <Instanced items={creamFlowers} arena={arenaId} yOff={0.36}>
        <coneGeometry args={[0.14, 0.48, 5]} />
        <meshToonMaterial color="#f0e6c8" />
      </Instanced>
      <Instanced items={kit.rocks} arena={arenaId} yOff={0.28} cast>
        <sphereGeometry args={[0.55, 6, 5]} />
        <meshToonMaterial color="#8d7a5c" map={stone} />
      </Instanced>
      <Instanced items={kit.logs} arena={arenaId} yOff={0.2} cast lie>
        <cylinderGeometry args={[0.16, 0.18, 1.8, 6]} />
        <meshToonMaterial color="#6b4a28" map={wood} />
      </Instanced>
      <Instanced items={kit.fence} arena={arenaId} yOff={0.55}>
        <boxGeometry args={[0.16, 1.1, 0.16]} />
        <meshToonMaterial color="#5a3a22" map={wood} />
      </Instanced>
      <Instanced items={kit.fence} arena={arenaId} yOff={0.72}>
        <boxGeometry args={[2.2, 0.1, 0.08]} />
        <meshToonMaterial color="#6b4a28" />
      </Instanced>
    </group>
  );
}
