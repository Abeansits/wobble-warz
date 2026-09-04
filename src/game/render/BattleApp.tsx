import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { getWorld, resetWorld } from "@/game/session";
import type { World } from "@/game/sim/World";
import { useGame } from "@/store/gameStore";
import { ArmyView } from "./ArmyView";
import { CameraRig } from "./CameraRig";
import { Clouds, SkyDome } from "./SkyBits";
import { DeployPads, MeadowProps, Terrain } from "./Terrain";
import { Particles, burst } from "./Particles";
import { BattleFx } from "./Fx";
import { sfx, startMeadow, stopMeadow, duckMeadow } from "@/game/audio";
import { useSettings } from "@/routes/settings";
import { getArena } from "@/game/data/arenas";
import { deployYaw } from "@/game/sim/facing";
import { Hud } from "@/ui/Hud";

function SetupInput({ world }: { world: World }) {
  const selected = useGame((s) => s.selected);
  const budget = useGame((s) => s.budget);
  const addSpend = useGame((s) => s.addSpend);
  const setMessage = useGame((s) => s.setMessage);
  const lastPlace = useRef(0);
  const busy = useRef(false);
  const dragging = useRef(false);
  const handler = useRef<(x: number, z: number, brush: boolean) => void>(() => {});

  handler.current = (x: number, z: number, brush: boolean) => {
    if (busy.current) return;
    const now = performance.now();
    if (!brush && now - lastPlace.current < 220) return;
    const st = useGame.getState();
    if (st.snapshot?.phase && st.snapshot.phase !== "setup") return;
    if (st.seat !== "setupP1" && st.seat !== "setupP2") return;
    const side: 0 | 1 = st.placingSide;
    if (side === 0 && x > -8) {
      setMessage("P1 deploys on the blue side.");
      return;
    }
    if (side === 1 && x < 8) {
      setMessage("P2 deploys on the red side.");
      return;
    }
    if (Math.abs(z) > 18) return;
    if (st.spent[side] + selected.cost > st.budget) {
      setMessage("Over budget.");
      return;
    }
    if (world.units.filter((u) => u.side === side).length >= 60) {
      setMessage("Unit cap (60) reached.");
      return;
    }
    const tooClose = world.units.some((u) => {
      const dx = u.x - x;
      const dz = u.z - z;
      return dx * dx + dz * dz < (brush ? 1.05 * 1.05 : 0.7 * 0.7);
    });
    if (tooClose) return;
    busy.current = true;
    lastPlace.current = now;
    const yaw = deployYaw(side) + st.yawOffset;
    try {
      world.place({ defId: selected.id, x, z, yaw, side });
      addSpend(side, selected.cost);
      st.pushPlace({ defId: selected.id, x, z, yaw, side });
      useGame.getState().setSnapshot(world.snapshot());
      setMessage(`${selected.name} planted for P${side + 1}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not plant that unit.");
    } finally {
      busy.current = false;
    }
  };

  return (
    <DeploymentZones
      onPlace={(x, z) => handler.current(x, z, false)}
      onBrush={(x, z) => handler.current(x, z, true)}
      dragging={dragging}
    />
  );
}

function SimLoop({ world }: { world: World }) {
  const speedRef = useRef(useGame.getState().speed);
  const pausedRef = useRef(useGame.getState().paused);
  const setSnapshot = useGame((s) => s.setSnapshot);
  const last = useRef(performance.now());
  const frame = useRef(0);

  useEffect(() =>
    useGame.subscribe((s) => {
      speedRef.current = s.speed;
      pausedRef.current = s.paused;
    }),
  []);

  useEffect(() => {
    let raf = 0;
    let alive = true;
    const tick = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last.current) / 1000);
      last.current = now;
      try {
        const before = world.phase;
        if (before !== "setup" && before !== "over") {
          world.step(dt, speedRef.current, pausedRef.current || speedRef.current === 0);
          frame.current++;
        }
        const ended = before !== "over" && world.phase === "over";
        const ticking = world.phase !== "setup" && world.phase !== "over";
        if (ended || (ticking && frame.current % 2 === 0)) {
          setSnapshot(world.snapshot());
          const ev = world.drainEvents();
          for (const e of ev) {
            if (e.type === "death") {
              const victim = world.units.find((u) => u.id === e.unitId);
              const killer = e.killerId != null ? world.units.find((u) => u.id === e.killerId) : undefined;
              useGame.getState().pushKill(
                `${killer?.def.name ?? "The meadow"} dropped ${victim?.def.name ?? "someone"}`,
              );
              sfx("yelp", useSettings.getState().sfx);
              if (victim) burst(victim.x, victim.y + 0.6, victim.z, 18, victim.side === 0 ? "#3a5f8a" : "#b33a2b", 6);
            }
            if (e.type === "hit" && e.impulse > 18) {
              sfx("hit", useSettings.getState().sfx);
              if (useSettings.getState().shake) useGame.getState().bumpCam("pitch", 0.02);
              const v = world.units.find((u) => u.id === e.victimId);
              if (v) burst(v.x, v.y + 0.5, v.z, 8, "#ffe6b8", 5);
            }
            if (e.type === "shot") {
              const u = world.units.find((n) => n.id === e.unitId);
              if (u) burst(u.x, u.y + 0.7, u.z, 4, "#f0d090", 3);
            }
            if (e.type === "victory") {
              sfx("win", useSettings.getState().sfx);
              duckMeadow(true);
            }
          }
        }
      } catch (err) {
        console.error("[sim]", err);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [world, setSnapshot]);

  return null;
}

function SkyMood() {
  const arena = getArena(useGame((s) => s.arena));
  return (
    <>
      <color attach="background" args={[arena.sky]} />
      <fog attach="fog" args={[arena.fog, arena.night ? 20 : 48, arena.night ? 72 : 95]} />
    </>
  );
}

function Lights() {
  const shadows = useSettings((s) => s.shadows) ?? "high";
  const map = shadows === "low" ? 1024 : 2048;
  useFrame(({ gl, camera }) => {
    const w = window as unknown as {
      __draw?: number;
      __cam?: number[];
      __ndc?: number[];
    };
    w.__draw = gl.info.render.calls;
    w.__cam = [camera.position.x, camera.position.y, camera.position.z];
    const ww = (window as unknown as { __ww?: { first?: { torso?: { x: number; y: number; z: number } } } }).__ww;
    if (ww?.first?.torso) {
      const v = new THREE.Vector3(ww.first.torso.x, ww.first.torso.y, ww.first.torso.z);
      v.project(camera);
      w.__ndc = [v.x, v.y, v.z];
    }
  });
  return (
    <>
      <SkyMood />
      <SkyDome />
      <Clouds />
      <hemisphereLight args={["#9ec4e8", "#3a5a32", 0.75]} />
      <directionalLight
        key={map}
        castShadow
        position={[18, 28, 10]}
        intensity={1.35}
        color="#ffe6b8"
        shadow-mapSize-width={map}
        shadow-mapSize-height={map}
        shadow-bias={-0.00035}
        shadow-radius={2}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
      />
    </>
  );
}

export function BattleApp() {
  const [world, setWorld] = useState<World | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const setSnapshot = useGame((s) => s.setSnapshot);

  useEffect(() => {
    if (!world) return;
    const bag = window as unknown as {
      __wobble?: { world: World; startDemo: () => void };
    };
    bag.__wobble = {
      world,
      startDemo: () => {
        world.clearUnits();
        for (let i = 0; i < 6; i++) {
          world.place({
            defId: "stoneage.clubber",
            x: -16,
            z: -6 + i * 2.2,
            yaw: deployYaw(0),
            side: 0,
          });
          world.place({
            defId: "medieval.squire",
            x: 16,
            z: -6 + i * 2.2,
            yaw: deployYaw(1),
            side: 1,
          });
        }
        world.startCountdown();
        useGame.getState().setSeat("fight");
        useGame.getState().setSnapshot(world.snapshot());
      },
    };
    return () => {
      delete bag.__wobble;
    };
  }, [world]);

  useEffect(() => {
    let alive = true;
    let booted = false;
    const timeout = window.setTimeout(() => {
      if (!alive || booted) return;
      setErr((prev) => prev ?? "Physics is taking too long to wake up.");
    }, 15000);
    getWorld()
      .then((w) => {
        if (!alive) return;
        booted = true;
        w.clearUnits();
        w.setArena(useGame.getState().arena);
        setWorld(w);
        setSnapshot(w.snapshot());
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [setSnapshot]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const st = useGame.getState();
      if (st.snapshot?.phase !== "setup") return;
      st.setYawOffset(st.yawOffset + (e.deltaY > 0 ? Math.PI / 12 : -Math.PI / 12));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        const s = useGame.getState();
        s.setPaused(!s.paused);
      }
      if (e.code === "Digit1") useGame.getState().setSpeed(0.25);
      if (e.code === "Digit2") useGame.getState().setSpeed(0.5);
      if (e.code === "Digit3") useGame.getState().setSpeed(1);
      if (e.code === "Digit4") useGame.getState().setSpeed(2);
      if (e.code === "Escape") useGame.getState().setMenuOpen(!useGame.getState().menuOpen);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (err) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-meadow-deep p-8 text-cream">
        <p className="font-display text-2xl">Physics failed to boot</p>
        <p className="max-w-md text-center text-cream/80">{err}</p>
        <button
          type="button"
          className="toy-shadow rounded-btn border-[3px] border-ink bg-ochre-hot px-5 py-2 font-display text-xl text-ink"
          onClick={() => {
            resetWorld();
            window.location.reload();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!world) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-meadow-deep text-cream">
        <p className="font-display text-4xl">Wobble Wars</p>
        <p className="text-lg">Warming up the ragdolls…</p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 w-full">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 36, 24], fov: 42, near: 0.3, far: 400 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.1;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <Suspense fallback={null}>
        <Lights />
          <Terrain />
          <MeadowProps />
          <SnapshotBridge />
          <CameraRig />
          <SetupInput world={world} />
          <SimLoop world={world} />
          <Particles />
          <BattleFx />
        </Suspense>
      </Canvas>
      <Hud world={world} />
      <MusicBed />
    </div>
  );
}

function MusicBed() {
  const phase = useGame((s) => s.snapshot?.phase ?? "setup");
  useEffect(() => {
    const vol = useSettings.getState().music;
    if (phase === "setup") stopMeadow();
    else startMeadow(vol);
    return () => stopMeadow();
  }, [phase]);
  return null;
}

function GhostPreview() {
  const ghost = useGame((s) => s.ghost);
  const selected = useGame((s) => s.selected);
  const side = useGame((s) => s.placingSide);
  const yawOffset = useGame((s) => s.yawOffset);
  if (!ghost) return null;
  const ok = side === 0 ? ghost.x < -8 : ghost.x > 8;
  return (
    <mesh position={[ghost.x, 1.1, ghost.z]} rotation={[0, deployYaw(side) + yawOffset, 0]} scale={selected.body.scale}>
      <capsuleGeometry args={[0.22, 0.7, 4, 8]} />
      <meshBasicMaterial color={ok ? (side === 0 ? "#3a5f8a" : "#b33a2b") : "#1c1710"} transparent opacity={0.35} />
    </mesh>
  );
}

function SnapshotBridge() {
  const snap = useGame((s) => s.snapshot);
  return <ArmyView snapshot={snap} />;
}

function DeploymentZones({
  onPlace,
  onBrush,
  dragging,
}: {
  onPlace: (x: number, z: number) => void;
  onBrush: (x: number, z: number) => void;
  dragging: { current: boolean };
}) {
  const phase = useGame((s) => s.snapshot?.phase ?? "setup");
  const seat = useGame((s) => s.seat);
  const side = useGame((s) => s.placingSide);
  const place = useRef(onPlace);
  const brush = useRef(onBrush);
  place.current = onPlace;
  brush.current = onBrush;
  if (phase !== "setup" || (seat !== "setupP1" && seat !== "setupP2")) return null;

  const handlers = {
    onPointerDown: (e: { button: number; stopPropagation: () => void; point: { x: number; z: number } }) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      dragging.current = true;
      place.current(e.point.x, e.point.z);
    },
    onPointerMove: (e: { buttons: number; point: { x: number; z: number } }) => {
      useGame.getState().setGhost({ x: e.point.x, z: e.point.z });
      if (!dragging.current || e.buttons !== 1) return;
      brush.current(e.point.x, e.point.z);
    },
    onPointerUp: () => {
      dragging.current = false;
    },
  };

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 2.4, 0]}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
      >
        <planeGeometry args={[62, 42]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <DeployPads active={side} />
      <GhostPreview />
    </group>
  );
}
