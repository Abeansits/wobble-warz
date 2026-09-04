import { useMemo } from "react";
import * as THREE from "three";
import { getArena } from "@/game/data/arenas";
import { useGame } from "@/store/gameStore";

export function SkyDome({ sky }: { sky?: string }) {
  const arenaSky = useGame((s) => getArena(s.arena).sky);
  const color = sky ?? arenaSky;
  return (
    <mesh>
      <sphereGeometry args={[180, 20, 12]} />
      <meshBasicMaterial color={color} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

const CLOUDS = ["/assets/cloud-1.png", "/assets/cloud-2.png", "/assets/cloud-3.png", "/assets/cloud-4.png"];

export function Clouds() {
  const maps = useMemo(
    () =>
      CLOUDS.map((src) => {
        const t = new THREE.TextureLoader().load(src);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      }),
    [],
  );
  const puffs = useMemo(
    () =>
      [
        [22, 24, -30, 14, 0],
        [-26, 22, -16, 12, 1],
        [10, 26, 32, 13, 2],
        [-32, 20, 14, 10, 3],
        [34, 23, 6, 11, 0],
      ] as [number, number, number, number, number][],
    [],
  );
  return (
    <group>
      {puffs.map(([x, y, z, s, i], n) => (
        <sprite key={n} position={[x, y, z]} scale={[s * 1.8, s, 1]} renderOrder={-1}>
          <spriteMaterial map={maps[i]} transparent depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}
