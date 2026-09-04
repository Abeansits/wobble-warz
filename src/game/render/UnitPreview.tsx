import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { UnitDef } from "@/game/data/types";
import { RecipeMesh, fitPreviewScale } from "./RecipeMesh";
import { getRamp } from "./textures";

function Spinning({
  def,
  cosmetic,
  hat,
}: {
  def: UnitDef;
  cosmetic: string | null;
  hat: string | null;
}) {
  const ref = useRef<THREE.Group>(null);
  const facing = useRef(false);
  const fit = useMemo(() => fitPreviewScale(def), [def]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    if (!facing.current) {
      ref.current.rotation.y = Math.PI / 2;
      facing.current = true;
    }
    ref.current.rotation.y += dt * 0.7;
  });
  return (
    <group ref={ref}>
      <RecipeMesh
        key={def.id}
        def={def}
        scale={fit}
        cosmetic={cosmetic}
        hat={hat}
        align="center"
        castShadow
      />
    </group>
  );
}

export function UnitPreview({
  def,
  cosmetic,
  hat = null,
}: {
  def: UnitDef;
  cosmetic: string | null;
  hat?: string | null;
}) {
  return (
    <div className="h-56 w-full overflow-hidden rounded-card border-[3px] border-ink bg-meadow">
      <Canvas camera={{ position: [2.2, 1.15, 1.6], fov: 38 }} dpr={[1, 1.5]}>
        <color attach="background" args={["#4f8a4a"]} />
        <hemisphereLight args={["#cfe8ff", "#4a6a32", 0.85]} />
        <directionalLight position={[4, 6, 3]} intensity={1.25} color="#ffe6b8" castShadow />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.78, 0]} receiveShadow>
          <circleGeometry args={[1.55, 24]} />
          <meshToonMaterial color="#3f7a3c" gradientMap={getRamp()} />
        </mesh>
        <Spinning def={def} cosmetic={cosmetic} hat={hat} />
      </Canvas>
    </div>
  );
}
