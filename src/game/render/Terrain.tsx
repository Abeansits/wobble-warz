import { useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";

function height(x: number, z: number) {
  return 0.12 + ((x + 30) / 60) * 1.6 + 0.28 * Math.sin(x * 0.14) * Math.cos(z * 0.18);
}

export function Terrain() {
  const geo = useMemo(() => {
    const w = 64;
    const d = 44;
    const segX = 48;
    const segZ = 32;
    const g = new THREE.PlaneGeometry(w, d, segX, segZ);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color("#4f8a4a");
    const dirt = new THREE.Color("#8a6a3a");
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = height(x, z);
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
  }, []);

  return (
    <mesh geometry={geo} receiveShadow raycast={() => {}}>
      <meshToonMaterial vertexColors />
    </mesh>
  );
}

export function MeadowProps() {
  const rocks = useMemo(
    () =>
      [
        [-8, 0.55, 6, 0.7],
        [6, 0.9, -7, 1.1],
        [14, 0.45, 8, 0.55],
        [-16, 0.65, -5, 0.8],
        [2, 0.35, 12, 0.4],
        [-12, 0.4, 11, 0.45],
      ] as [number, number, number, number][],
    [],
  );
  return (
    <group>
      {rocks.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow receiveShadow raycast={() => {}}>
          <sphereGeometry args={[r, 6, 5]} />
          <meshToonMaterial color={i % 2 ? "#7a6a52" : "#8d7a5c"} />
        </mesh>
      ))}
    </group>
  );
}

function zoneGeometry(x0: number, x1: number, z0: number, z1: number) {
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
    pos.setY(i, height(x, z) + 0.14);
  }
  g.computeVertexNormals();
  return g;
}

export function DeployPads({ active }: { active: 0 | 1 }) {
  const blue = useMemo(() => zoneGeometry(-28, -8, -18, 18), []);
  const red = useMemo(() => zoneGeometry(8, 28, -18, 18), []);
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
      <ZonePosts side={0} lit={active === 0} />
      <ZonePosts side={1} lit={active === 1} />
    </group>
  );
}

function ZonePosts({ side, lit }: { side: 0 | 1; lit: boolean }) {
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
        <mesh key={i} position={[cx, height(cx, cz) + 0.55, cz]} raycast={() => {}}>
          <boxGeometry args={[0.22, 1.15, 0.22]} />
          <meshBasicMaterial color={lit ? color : "#2a241c"} />
        </mesh>
      ))}
      <Text
        position={[x, height(x, 0) + 2.2, 0]}
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

