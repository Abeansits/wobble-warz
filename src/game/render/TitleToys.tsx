import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { startMeadow, stopMeadow } from "@/game/audio";

function Doll({
  x,
  z,
  color,
  delay,
}: {
  x: number;
  z: number;
  color: string;
  delay: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + delay;
    if (!ref.current) return;
    ref.current.position.y = 0.35 + Math.abs(Math.sin(t * 3.2)) * 0.12;
    ref.current.rotation.z = Math.sin(t * 2.4) * 0.18;
    ref.current.rotation.y = Math.sin(t * 0.7) * 0.4;
  });
  return (
    <group ref={ref} position={[x, 0.4, z]}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.38, 0.4, 0.26]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.68, 0]} castShadow>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshToonMaterial color="#e6c2a0" />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[0.28, 0.28, 0.2]} />
        <meshToonMaterial color="#6b4a28" />
      </mesh>
    </group>
  );
}

function Rig() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.18;
    camera.position.set(Math.sin(t) * 8, 5.2, Math.cos(t) * 8);
    camera.lookAt(0, 0.6, 0);
  });
  return null;
}

export function TitleToys() {
  useEffect(() => {
    startMeadow(0.25);
    return () => stopMeadow();
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0">
      <Canvas camera={{ position: [6, 5, 8], fov: 42 }} dpr={[1, 1.25]} gl={{ antialias: true, alpha: true }}>
        <color attach="background" args={["#2E5A2C"]} />
        <hemisphereLight args={["#cfe8ff", "#4a6a32", 0.8]} />
        <directionalLight position={[6, 10, 4]} intensity={1.1} color="#ffe6b8" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[40, 28]} />
          <meshToonMaterial color="#4f8a4a" />
        </mesh>
        <Doll x={-1.4} z={0.4} color="#3a5f8a" delay={0} />
        <Doll x={1.3} z={-0.2} color="#b33a2b" delay={0.7} />
        <Doll x={-0.2} z={1.4} color="#c48a3a" delay={1.3} />
        <Doll x={0.6} z={-1.3} color="#5a3a6a" delay={1.9} />
        <Rig />
      </Canvas>
    </div>
  );
}
