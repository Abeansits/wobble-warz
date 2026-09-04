import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { UnitDef } from "@/game/data/types";
import { COSMETIC_PALETTES, METAL, TEAM, WOOD } from "./palette";

function colorOf(def: UnitDef, token: string, cosmetic: string | null) {
  if (token === "team") return TEAM[0];
  if (token === "wood") return WOOD;
  if (token === "metal") return METAL;
  const pal = (cosmetic && COSMETIC_PALETTES[cosmetic]) || def.palette;
  if (token === "primary") return pal.primary;
  if (token === "secondary") return pal.secondary;
  if (token === "accent") return pal.accent;
  return pal.skin;
}

function Spinning({ def, cosmetic }: { def: UnitDef; cosmetic: string | null }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.7;
  });
  const parts = useMemo(() => def.recipe.parts, [def]);
  return (
    <group ref={ref} position={[0, -0.2, 0]}>
      {parts.map((p, i) => (
        <mesh key={i} position={p.offset} castShadow>
          {p.shape === "sphere" ? (
            <sphereGeometry args={[Math.max(p.size[0], 0.06), 10, 8]} />
          ) : p.shape === "capsule" ? (
            <capsuleGeometry args={[Math.max(p.size[0], 0.05), Math.max(p.size[1], 0.12), 3, 6]} />
          ) : (
            <boxGeometry args={p.size} />
          )}
          <meshToonMaterial color={colorOf(def, p.color, cosmetic)} />
        </mesh>
      ))}
    </group>
  );
}

export function UnitPreview({ def, cosmetic }: { def: UnitDef; cosmetic: string | null }) {
  return (
    <div className="h-48 w-full overflow-hidden rounded-card border-[3px] border-ink bg-meadow">
      <Canvas camera={{ position: [1.6, 1.4, 2.2], fov: 40 }} dpr={[1, 1.5]}>
        <color attach="background" args={["#4f8a4a"]} />
        <hemisphereLight args={["#cfe8ff", "#4a6a32", 0.8]} />
        <directionalLight position={[4, 6, 3]} intensity={1.2} color="#ffe6b8" />
        <Spinning def={def} cosmetic={cosmetic} />
      </Canvas>
    </div>
  );
}
