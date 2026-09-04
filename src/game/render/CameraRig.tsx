import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useGame } from "@/store/gameStore";

const MIN_PITCH = THREE.MathUtils.degToRad(18);
const MAX_PITCH = THREE.MathUtils.degToRad(80);
const MIN_DIST = 8;
const MAX_DIST = 55;

export function CameraRig() {
  const { camera, gl } = useThree();
  const yaw = useRef(0.2);
  const pitch = useRef(0.72);
  const dist = useRef(32);
  const target = useRef(new THREE.Vector3(0, 1.2, 0));
  const dragging = useRef<"orbit" | "pan" | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const followId = useGame((s) => s.followId);
  const snapshot = useGame((s) => s.snapshot);
  const camBump = useGame((s) => s.camBump);
  const lastPhase = useRef(snapshot?.phase);

  useEffect(() => {
    if (!camBump) return;
    if (camBump.kind === "yaw") yaw.current += camBump.value;
    if (camBump.kind === "pitch") {
      pitch.current = THREE.MathUtils.clamp(pitch.current + camBump.value, MIN_PITCH, MAX_PITCH);
    }
    if (camBump.kind === "zoom") {
      dist.current = THREE.MathUtils.clamp(dist.current + camBump.value, MIN_DIST, MAX_DIST);
    }
    if (camBump.kind === "reset") {
      yaw.current = 0.2;
      pitch.current = 0.72;
      dist.current = 32;
      target.current.set(0, 1.2, 0);
    }
  }, [camBump]);

  useEffect(() => {
    const el = gl.domElement;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("button, a, input, textarea, select, [data-ui]")) return;
      if (e.target !== el && !el.contains(e.target as Node)) return;
      const setup = useGame.getState().snapshot?.phase === "setup";
      if (e.button === 0 && setup && !e.altKey && !e.shiftKey) return;
      if (e.button === 2 || e.altKey || e.button === 1 || (!setup && e.button === 0 && !e.shiftKey)) {
        dragging.current = e.shiftKey ? "pan" : "orbit";
      } else if (e.shiftKey) {
        dragging.current = "pan";
      } else {
        return;
      }
      last.current = { x: e.clientX, y: e.clientY };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      if (dragging.current === "orbit") {
        yaw.current -= dx * 0.007;
        pitch.current = THREE.MathUtils.clamp(pitch.current + dy * 0.005, MIN_PITCH, MAX_PITCH);
      } else {
        const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
        const fwd = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
        target.current.addScaledVector(right, -dx * 0.03);
        target.current.addScaledVector(fwd, dy * 0.03);
        target.current.x = THREE.MathUtils.clamp(target.current.x, -28, 28);
        target.current.z = THREE.MathUtils.clamp(target.current.z, -18, 18);
      }
    };
    const onUp = () => {
      dragging.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      dist.current = THREE.MathUtils.clamp(dist.current + e.deltaY * 0.025, MIN_DIST, MAX_DIST);
    };
    const onCtx = (e: Event) => e.preventDefault();
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("contextmenu", onCtx);
    window.addEventListener("contextmenu", onCtx);
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.code);
      if (e.code === "KeyF") {
        const s = useGame.getState();
        const id = s.followId;
        if (id != null) s.setFollowId(null);
        else {
          const u = s.snapshot?.units.find((n) => n.state !== "dead");
          if (u) s.setFollowId(u.id);
        }
      }
      if (e.code === "KeyC") {
        const presets = [
          { yaw: 0.2, pitch: 0.72, dist: 32, x: 0, z: 0 },
          { yaw: Math.PI / 2, pitch: 0.55, dist: 28, x: -10, z: 0 },
          { yaw: -Math.PI / 2, pitch: 0.55, dist: 28, x: 10, z: 0 },
          { yaw: 0, pitch: 1.2, dist: 36, x: 0, z: 0 },
        ];
        const i = ((window as unknown as { __camPreset?: number }).__camPreset ?? 0) + 1;
        (window as unknown as { __camPreset?: number }).__camPreset = i;
        const p = presets[i % presets.length];
        yaw.current = p.yaw;
        pitch.current = p.pitch;
        dist.current = p.dist;
        target.current.set(p.x, 1.2, p.z);
        useGame.getState().setFollowId(null);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const phase = snapshot?.phase;
    if (phase !== lastPhase.current) {
      if (phase === "countdown") {
        dist.current = 44;
        pitch.current = 0.95;
        yaw.current = 0.15;
        target.current.set(0, 1.4, 0);
      }
      if (phase === "battle" && lastPhase.current === "countdown") {
        dist.current = 34;
        pitch.current = 0.7;
      }
      lastPhase.current = phase;
    }
    const k = keys.current;
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
    const fwd = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const pan = 12 * dt;
    if (k.has("KeyW") || k.has("ArrowUp")) target.current.addScaledVector(fwd, pan);
    if (k.has("KeyS") || k.has("ArrowDown")) target.current.addScaledVector(fwd, -pan);
    if (k.has("KeyD") || k.has("ArrowRight")) target.current.addScaledVector(right, pan);
    if (k.has("KeyA") || k.has("ArrowLeft")) target.current.addScaledVector(right, -pan);
    if (k.has("KeyQ")) yaw.current -= 1.4 * dt;
    if (k.has("KeyE")) yaw.current += 1.4 * dt;
    if (k.has("KeyZ")) pitch.current = THREE.MathUtils.clamp(pitch.current + 1.1 * dt, MIN_PITCH, MAX_PITCH);
    if (k.has("KeyX")) pitch.current = THREE.MathUtils.clamp(pitch.current - 1.1 * dt, MIN_PITCH, MAX_PITCH);
    if (k.has("KeyR")) {
      yaw.current = 0.2;
      pitch.current = 0.72;
      dist.current = 32;
      target.current.set(0, 1.2, 0);
    }

    if (followId != null && snapshot) {
      const u = snapshot.units.find((n) => n.id === followId);
      const p = u?.parts.torso ?? u?.root;
      if (p && Number.isFinite(p.x)) {
        target.current.lerp(new THREE.Vector3(p.x, p.y + 0.4, p.z), 1 - Math.pow(0.002, dt));
        dist.current = THREE.MathUtils.lerp(dist.current, 16, 0.04);
      }
    }

    const cp = Math.cos(pitch.current);
    const desired = new THREE.Vector3(
      target.current.x + Math.sin(yaw.current) * cp * dist.current,
      target.current.y + Math.sin(pitch.current) * dist.current,
      target.current.z + Math.cos(yaw.current) * cp * dist.current,
    );
    camera.position.lerp(desired, 1 - Math.pow(0.0008, dt));
    camera.lookAt(target.current);
  });

  return null;
}
