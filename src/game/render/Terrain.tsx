import { useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import {
  BRIDGE_Z,
  GRAVEYARD_STONES,
  MEADOW_BOULDERS,
  getArena,
  terrainHeight,
  type ArenaId,
} from "@/game/data/arenas";
import { useGame } from "@/store/gameStore";
import { getPropTex } from "./textures";

function height(x: number, z: number, arena: ArenaId = "meadow") {
  return terrainHeight(x, z, arena);
}

export function Terrain() {
  const arenaId = useGame((s) => s.arena);
  const arena = getArena(arenaId);
  const geo = useMemo(() => {
    const w = 64;
    const d = 44;
    const g = new THREE.PlaneGeometry(w, d, 48, 32);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(arena.grass);
    const dirt = new THREE.Color(arena.dirt);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = height(x, z, arenaId);
      pos.setY(i, y);
      const slope = Math.min(1, Math.abs(Math.sin(x * 0.14) * Math.cos(z * 0.18)) * 1.4);
      tmp.copy(grass).lerp(dirt, slope * 0.45);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [arenaId, arena.grass, arena.dirt]);

  return (
    <mesh geometry={geo} receiveShadow raycast={() => {}}>
      <meshToonMaterial vertexColors />
    </mesh>
  );
}

export function MeadowProps() {
  const arenaId = useGame((s) => s.arena);
  const stone = useMemo(() => getPropTex("stone"), []);
  const wood = useMemo(() => getPropTex("wood"), []);
  const rocks = MEADOW_BOULDERS;
  const flowers = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => {
        const x = ((i * 17) % 50) - 25;
        const z = ((i * 13) % 34) - 17;
        return [x, z, 0.12 + (i % 5) * 0.04, i % 3] as [number, number, number, number];
      }),
    [],
  );
  const bloom = ["#e8c84a", "#d45a6a", "#f0e6c8"] as const;
  return (
    <group>
      {arenaId === "meadow" &&
        rocks.map(([x, y, z, r], i) => (
          <mesh key={`r${i}`} position={[x, y, z]} castShadow receiveShadow raycast={() => {}}>
            <sphereGeometry args={[r, 6, 5]} />
            <meshToonMaterial color={i % 2 ? "#7a6a52" : "#8d7a5c"} map={stone} />
          </mesh>
        ))}
      {arenaId === "meadow" &&
        flowers.map(([x, z, h, c], i) => (
          <mesh key={`f${i}`} position={[x, height(x, z, "meadow") + h, z]} raycast={() => {}}>
            <coneGeometry args={[0.08, h * 2, 5]} />
            <meshToonMaterial color={bloom[c]} />
          </mesh>
        ))}
      {arenaId === "canyon" && (
        <>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
            <planeGeometry args={[6.4, 40]} />
            <meshToonMaterial color="#7a3a22" />
          </mesh>
          {BRIDGE_Z.map((z) => (
            <mesh key={`b${z}`} position={[0, 0.28, z]} castShadow receiveShadow raycast={() => {}}>
              <boxGeometry args={[6.8, 0.12, 1.1]} />
              <meshToonMaterial color="#6a3a22" map={wood} />
            </mesh>
          ))}
        </>
      )}
      {arenaId === "graveyard" &&
        GRAVEYARD_STONES.map(([x, z], i) => (
          <mesh key={`t${i}`} position={[x, height(x, z, "graveyard") + 0.55, z]} castShadow raycast={() => {}}>
            <boxGeometry args={[0.45, 1.1, 0.18]} />
            <meshToonMaterial color="#6a6a68" map={stone} />
          </mesh>
        ))}
    </group>
  );
}

function zoneGeometry(x0: number, x1: number, z0: number, z1: number, arena: ArenaId) {
  const segX = 18;
  const segZ = 16;
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, segX, segZ);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + (x0 + x1) / 2;
    const z = pos.getZ(i) + (z0 + z1) / 2;
    pos.setX(i, x);
    pos.setZ(i, z);
    pos.setY(i, height(x, z, arena) + 0.14);
  }
  g.computeVertexNormals();
  return g;
}

export function DeployPads({ active }: { active: 0 | 1 }) {
  const arenaId = useGame((s) => s.arena);
  const blue = useMemo(() => zoneGeometry(-28, -8, -18, 18, arenaId), [arenaId]);
  const red = useMemo(() => zoneGeometry(8, 28, -18, 18, arenaId), [arenaId]);
  return (
    <group>
      <mesh geometry={blue} raycast={() => {}}>
        <meshBasicMaterial
          color="#3a6fbc"
          transparent
          opacity={active === 0 ? 0.42 : 0.12}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={red} raycast={() => {}}>
        <meshBasicMaterial
          color="#d44532"
          transparent
          opacity={active === 1 ? 0.42 : 0.12}
          depthWrite={false}
        />
      </mesh>
      <ZonePosts side={0} lit={active === 0} arena={arenaId} />
      <ZonePosts side={1} lit={active === 1} arena={arenaId} />
    </group>
  );
}

function ZonePosts({ side, lit, arena }: { side: 0 | 1; lit: boolean; arena: ArenaId }) {
  const x = side === 0 ? -18 : 18;
  const label = side === 0 ? "P1 PLANTS HERE" : "P2 PLANTS HERE";
  const color = side === 0 ? "#cfe8ff" : "#ffd0c8";
  const corners: [number, number][] =
    side === 0
      ? [
          [-28, -18],
          [-8, -18],
          [-8, 18],
          [-28, 18],
        ]
      : [
          [8, -18],
          [28, -18],
          [28, 18],
          [8, 18],
        ];
  return (
    <group>
      {corners.map(([cx, cz], i) => (
        <mesh key={i} position={[cx, height(cx, cz, arena) + 0.55, cz]} raycast={() => {}}>
          <boxGeometry args={[0.22, 1.15, 0.22]} />
          <meshBasicMaterial color={lit ? color : "#2a241c"} />
        </mesh>
      ))}
      <Text
        position={[x, height(x, 0, arena) + 2.2, 0]}
        fontSize={1.15}
        color={lit ? color : "#8a7a62"}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.06}
        outlineColor="#1c1710"
        raycast={() => {}}
      >
        {label}
      </Text>
    </group>
  );
}
