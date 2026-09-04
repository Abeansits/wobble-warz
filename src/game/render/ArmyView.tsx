import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { session } from "@/game/session";
import { UNIT_CAP, duplicatePlacement } from "@/game/setup";
import { getHat, HAT_BRIM_Y } from "@/game/data/hats";
import { getUnit } from "@/game/data/units";
import type { UnitView, WorldSnapshot } from "@/game/sim/World";
import { useProfiles } from "@/game/meta/profiles";
import { useGame } from "@/store/gameStore";
import { rootLift } from "@/game/sim/physics/skeletons";
import { posedSnapshot } from "./interp";
import { COSMETIC_PALETTES, METAL, TEAM, WOOD } from "./palette";
import { renderFrame, type TeamRing } from "./renderFrame";
import { useSettings } from "@/routes/settings";
import { getCloth, getFace, getMetalTex, getRamp, getWood, type FaceMood } from "./textures";

const EMPTY_UNITS: UnitView[] = [];

function tryDuplicate(id: number) {
  const st = useGame.getState();
  const world = session.world;
  if (!world || st.snapshot?.phase !== "setup") return;
  const u = world.units.find((n) => n.id === id);
  if (!u || u.mounted || u.summoned) return;
  if (u.side !== st.placingSide) return;
  if (st.spent[u.side] + u.def.cost > st.budget) {
    st.setMessage("Over budget.");
    return;
  }
  if (world.units.filter((n) => n.side === u.side).length >= UNIT_CAP) {
    st.setMessage("Unit cap (60) reached.");
    return;
  }
  const next = duplicatePlacement(
    { defId: u.def.id, x: u.x, z: u.z, yaw: u.yaw, side: u.side },
    world.units.map((n) => ({ x: n.x, z: n.z })),
  );
  if (!next) {
    st.setMessage("No room to copy.");
    return;
  }
  try {
    world.place(next);
    st.addSpend(u.side, u.def.cost);
    st.pushPlace(next);
    st.setSnapshot(world.snapshot());
    st.setMessage(`Copied ${u.def.name}.`);
  } catch {
    st.setMessage("Could not copy that unit.");
  }
}

const geoCache = new Map<string, THREE.BufferGeometry>();
const _q = new THREE.Quaternion();
const _yawQ = new THREE.Quaternion();
const _off = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

const PARENT: Record<string, string> = {
  weapon: "armR",
  scarf: "torso",
  belt: "torso",
  shield: "armL",
  hat: "head",
  extra: "armR",
};

function geom(shape: string, size: [number, number, number]) {
  const key = `${shape}:${size[0]}:${size[1]}:${size[2]}`;
  let g = geoCache.get(key);
  if (!g) {
    if (shape === "sphere") g = new THREE.SphereGeometry(Math.max(size[0], 0.07), 10, 8);
    else if (shape === "capsule") g = new THREE.CapsuleGeometry(Math.max(size[0], 0.06), Math.max(size[1], 0.16), 3, 6);
    else g = new THREE.BoxGeometry(Math.max(size[0], 0.08), Math.max(size[1], 0.08), Math.max(size[2], 0.08));
    geoCache.set(key, g);
  }
  return g;
}

function tokenColor(token: string, defId: string, side: 0 | 1, cosmetic?: string | null): string {
  if (token === "team") return TEAM[side];
  if (token === "wood") return WOOD;
  if (token === "metal") return METAL;
  const pal = (cosmetic && COSMETIC_PALETTES[cosmetic]) || getUnit(defId).palette;
  if (token === "primary") return pal.primary;
  if (token === "secondary") return pal.secondary;
  if (token === "accent") return pal.accent;
  return pal.skin;
}

function kindFor(token: string): "plain" | "wood" | "metal" | "cloth" {
  if (token === "wood") return "wood";
  if (token === "metal") return "metal";
  if (token === "primary" || token === "secondary" || token === "team") return "cloth";
  return "plain";
}

const kindMat = new Map<string, THREE.MeshToonMaterial>();
function material(kind: string) {
  let m = kindMat.get(kind);
  if (!m) {
    m = new THREE.MeshToonMaterial({
      gradientMap: getRamp(),
      map: kind === "wood" ? getWood() : kind === "metal" ? getMetalTex() : kind === "cloth" ? getCloth() : null,
    });
    kindMat.set(kind, m);
  }
  return m;
}

const faceGeo = new THREE.PlaneGeometry(0.28, 0.28);
const ringGeo = new THREE.CircleGeometry(1, 20);
ringGeo.rotateX(-Math.PI / 2);
const ringMat0 = new THREE.MeshBasicMaterial({
  color: TEAM[0],
  transparent: true,
  opacity: 0.7,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});
const ringMat1 = new THREE.MeshBasicMaterial({
  color: TEAM[1],
  transparent: true,
  opacity: 0.7,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});

function ringScale(kind: string, scale: number) {
  if (kind === "quadruped") return scale * 1.15;
  if (kind === "vehicle") return scale * 1.25;
  if (kind === "static") return scale * 0.95;
  return scale * 0.52;
}

function writeRings(mesh: THREE.InstancedMesh | null, list: TeamRing[], side: 0 | 1) {
  if (!mesh) return;
  let n = 0;
  const cap = mesh.instanceMatrix.count;
  _q.identity();
  for (const r of list) {
    if (r.side !== side) continue;
    if (n >= cap) break;
    _off.set(r.x, r.y, r.z);
    _s.set(r.s, 1, r.s);
    _m.compose(_off, _q, _s);
    mesh.setMatrixAt(n, _m);
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
}

function TeamRings({ rings }: { rings: TeamRing[] }) {
  const r0 = useRef<THREE.InstancedMesh>(null);
  const r1 = useRef<THREE.InstancedMesh>(null);
  const n = rings.length;
  const capRef = useRef(Math.max(16, n));
  if (n > capRef.current) capRef.current = Math.max(n, capRef.current * 2);
  const cap = capRef.current;
  useLayoutEffect(() => {
    writeRings(r0.current, rings, 0);
    writeRings(r1.current, rings, 1);
  }, [rings, n, cap]);
  useFrame(() => {
    const live = renderFrame.rings;
    writeRings(r0.current, live, 0);
    writeRings(r1.current, live, 1);
  });
  return (
    <group>
      <instancedMesh key={`r0-${cap}`} ref={r0} args={[ringGeo, ringMat0, cap]} frustumCulled={false} dispose={null} />
      <instancedMesh key={`r1-${cap}`} ref={r1} args={[ringGeo, ringMat1, cap]} frustumCulled={false} dispose={null} />
    </group>
  );
}

const faceMats = new Map<string, THREE.MeshBasicMaterial>();
function faceMaterial(mood: FaceMood) {
  let m = faceMats.get(mood);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: getFace(mood), transparent: true, depthWrite: false });
    faceMats.set(mood, m);
  }
  return m;
}

type Batch = {
  key: string;
  shape: string;
  size: [number, number, number];
  kind: string;
  pos: number[];
  quat: number[];
  scale: number[];
  color: string[];
};

function applyBatch(mesh: THREE.InstancedMesh, batch: { pos: number[]; quat: number[]; scale: number[]; color: string[] }) {
  const n = batch.color.length;
  const cap = mesh.instanceMatrix.count;
  const count = Math.min(n, cap);
  for (let i = 0; i < count; i++) {
    _off.set(batch.pos[i * 3], batch.pos[i * 3 + 1], batch.pos[i * 3 + 2]);
    _q.set(batch.quat[i * 4], batch.quat[i * 4 + 1], batch.quat[i * 4 + 2], batch.quat[i * 4 + 3]);
    _s.setScalar(batch.scale[i]);
    _m.compose(_off, _q, _s);
    mesh.setMatrixAt(i, _m);
    mesh.setColorAt(i, _c.set(batch.color[i]));
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function BatchMesh({ batch }: { batch: Batch }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const n = batch.color.length;
  const capRef = useRef(Math.max(8, n));
  if (n > capRef.current) capRef.current = Math.max(n, capRef.current * 2);
  const cap = capRef.current;
  useLayoutEffect(() => {
    if (ref.current) applyBatch(ref.current, batch);
  }, [batch, n]);
  useFrame(() => {
    const live = renderFrame.batches.get(batch.key);
    if (live && ref.current) applyBatch(ref.current, live);
  });
  return (
    <instancedMesh
      key={cap}
      ref={ref}
      args={[geom(batch.shape, batch.size), material(batch.kind), cap]}
      dispose={null}
      frustumCulled={false}
      castShadow={n < 24}
    />
  );
}

const shotGeo = new THREE.SphereGeometry(1, 8, 6);
const SHOT_COLOR: Record<string, string> = {
  rock: "#6b4a28",
  spear: "#c9cdd3",
  arrow: "#8a6a3a",
  boom: "#c45a18",
  pumpkin: "#c45a18",
  ice: "#7ec8e0",
};
const shotMats = new Map<string, THREE.MeshBasicMaterial>();
function shotMat(kind: string) {
  let m = shotMats.get(kind);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: SHOT_COLOR[kind] ?? "#6b4a28" });
    shotMats.set(kind, m);
  }
  return m;
}

export function ArmyView({ snapshot }: { snapshot: WorldSnapshot | null }) {
  const units = snapshot?.units ?? EMPTY_UNITS;
  const shots = snapshot?.projectiles ?? [];
  const seat = useGame((s) => s.seat);
  const placingSide = useGame((s) => s.placingSide);
  const hat0 = useProfiles((s) => s.profiles.find((p) => p.id === s.p1)?.hat);
  const hat1 = useProfiles((s) => s.profiles.find((p) => p.id === s.p2)?.hat);
  const pal0 = useProfiles((s) => s.profiles.find((p) => p.id === s.p1)?.palette);
  const pal1 = useProfiles((s) => s.profiles.find((p) => p.id === s.p2)?.palette);
  const phase = snapshot?.phase ?? "setup";
  const hideEnemy = useSettings((s) => s.blind);
  const blind = phase === "setup" && seat === "setupP2" && hideEnemy;

  function layoutFromUnits(
    list: typeof units,
    opts: {
      blind: boolean;
      placingSide: 0 | 1;
      hat0?: string | null;
      hat1?: string | null;
      pal0?: string | null;
      pal1?: string | null;
    },
  ) {
    const { blind, placingSide, hat0, hat1, pal0, pal1 } = opts;
    const bag = new Map<string, Batch>();
    const picks: { id: number; x: number; y: number; z: number; side: 0 | 1 }[] = [];
    const faces: { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number; mood: FaceMood; s: number }[] = [];
    const rings: TeamRing[] = [];

    for (const u of list) {
      const hidden = blind && u.side !== placingSide;
      const p0 = u.parts.torso ?? u.parts.pelvis ?? u.root;
      if (p0 && Number.isFinite(p0.x)) picks.push({ id: u.id, x: p0.x, y: p0.y, z: p0.z, side: u.side });
      if (hidden || (u.fade ?? 0) >= 0.98) {
        if (hidden && p0) {
          const key = "sil";
          let b = bag.get(key);
          if (!b) {
            b = { key, shape: "box", size: [0.45, 1.1, 0.35], kind: "plain", pos: [], quat: [], scale: [], color: [] };
            bag.set(key, b);
          }
          b.pos.push(p0.x, p0.y + 0.2, p0.z);
          b.quat.push(0, 0, 0, 1);
          b.scale.push(1);
          b.color.push("#1c1710");
        }
        continue;
      }
      const def = getUnit(u.defId);
      const fade = u.fade ?? 0;
      const sink = fade * 0.55;
      const shrink = (u.scale ?? def.body.scale) * (1 - fade * 0.85);
      if (Number.isFinite(u.root.x) || Number.isFinite((u.parts.pelvis ?? u.root).x)) {
        const hip = u.parts.pelvis ?? u.root;
        const lift = rootLift(def.body.kind, u.scale ?? def.body.scale);
        const gy =
          u.state !== "dead" && Number.isFinite(u.root.y)
            ? u.root.y - lift + 0.05
            : (hip.y ?? 0.4) - 0.38 * (u.scale ?? def.body.scale);
        rings.push({
          x: hip.x,
          y: gy,
          z: hip.z,
          side: u.side,
          s: ringScale(def.body.kind, shrink),
        });
      }
      const clustered = def.body.kind !== "humanoid";
      const tumbling = u.state === "dead" || u.state === "launched";
      const pivot = u.parts.pelvis ?? u.root;
      const anchor = clustered
        ? tumbling
          ? (u.parts.torso ?? u.parts.pelvis)
          : Number.isFinite(u.root.x)
            ? u.root
            : (u.parts.pelvis ?? u.root)
        : null;
      const half = (u.yaw ?? 0) * 0.5;
      _yawQ.set(0, Math.sin(half), 0, Math.cos(half));
      const scale = u.scale ?? def.body.scale;
      for (const part of def.recipe.parts) {
        const boneName = part.parent ?? PARENT[part.slot] ?? part.slot;
        const ownBone = clustered ? u.parts[part.slot] : undefined;
        const bound = ownBone && Number.isFinite(ownBone.x) ? ownBone : null;
        const src = clustered ? (bound ?? anchor) : u.parts[boneName];
        if (!src || !Number.isFinite(src.x)) continue;
        _off.set(part.offset[0], part.offset[1], part.offset[2]).multiplyScalar(scale);
        let px: number;
        let py: number;
        let pz: number;
        if (bound) {
          _q.set(src.qx, src.qy, src.qz, src.qw);
          px = src.x;
          py = src.y;
          pz = src.z;
        } else if (tumbling) {
          _q.set(src.qx, src.qy, src.qz, src.qw);
          if (clustered || PARENT[part.slot] || part.parent) _off.applyQuaternion(_q);
          else _off.set(0, 0, 0);
          px = src.x + _off.x;
          py = src.y + _off.y;
          pz = src.z + _off.z;
        } else if (clustered) {
          _q.copy(_yawQ);
          _off.applyQuaternion(_q);
          px = src.x + _off.x;
          py = src.y + _off.y;
          pz = src.z + _off.z;
        } else {
          _q.set(src.qx, src.qy, src.qz, src.qw).premultiply(_yawQ);
          _rel.set(src.x - pivot.x, src.y - pivot.y, src.z - pivot.z).applyQuaternion(_yawQ);
          if (PARENT[part.slot] || part.parent) _off.applyQuaternion(_q);
          else _off.set(0, 0, 0);
          px = pivot.x + _rel.x + _off.x;
          py = pivot.y + _rel.y + _off.y;
          pz = pivot.z + _rel.z + _off.z;
        }
        const kind = kindFor(part.color);
        const color =
          u.flash > 0
            ? "#ffffff"
            : tokenColor(part.color, u.defId, u.side, u.side === 0 ? pal0 : pal1);
        const key = `${part.shape}:${part.size.join("x")}:${kind}`;
        let b = bag.get(key);
        if (!b) {
          b = { key, shape: part.shape, size: part.size, kind, pos: [], quat: [], scale: [], color: [] };
          bag.set(key, b);
        }
        b.pos.push(px, py - sink, pz);
        b.quat.push(_q.x, _q.y, _q.z, _q.w);
        b.scale.push(shrink);
        b.color.push(color);
      }
      const worn = u.side === 0 ? hat0 : hat1;
      const hat = def.body.kind === "humanoid" ? getHat(worn) : null;
      if (hat && u.parts.head) {
        const src = u.parts.head;
        let hx: number;
        let hy: number;
        let hz: number;
        if (tumbling) {
          _q.set(src.qx, src.qy, src.qz, src.qw);
          hx = src.x;
          hy = src.y;
          hz = src.z;
        } else {
          _q.set(src.qx, src.qy, src.qz, src.qw).premultiply(_yawQ);
          _rel.set(src.x - pivot.x, src.y - pivot.y, src.z - pivot.z).applyQuaternion(_yawQ);
          hx = pivot.x + _rel.x;
          hy = pivot.y + _rel.y;
          hz = pivot.z + _rel.z;
        }
        for (const part of hat.parts) {
          const key = `${part.shape}:${part.size.join("x")}:plain`;
          let b = bag.get(key);
          if (!b) {
            b = { key, shape: part.shape, size: part.size, kind: "plain", pos: [], quat: [], scale: [], color: [] };
            bag.set(key, b);
          }
          _off.set(part.offset[0], HAT_BRIM_Y + part.offset[1], part.offset[2]).multiplyScalar(scale);
          _off.applyQuaternion(_q);
          b.pos.push(hx + _off.x, hy + _off.y - sink, hz + _off.z);
          b.quat.push(_q.x, _q.y, _q.z, _q.w);
          b.scale.push(shrink);
          b.color.push(part.color);
        }
      }
      const head = u.parts.head;
      if (head && Number.isFinite(head.x) && def.body.kind === "humanoid") {
        if (tumbling) {
          _q.set(head.qx, head.qy, head.qz, head.qw);
          _rel.set(head.x, head.y, head.z);
        } else {
          _q.set(head.qx, head.qy, head.qz, head.qw).premultiply(_yawQ);
          _rel.set(head.x - pivot.x, head.y - pivot.y, head.z - pivot.z).applyQuaternion(_yawQ);
          _rel.x += pivot.x;
          _rel.y += pivot.y;
          _rel.z += pivot.z;
        }
        _off.set(0, 0.02, 0.23 * def.body.scale).applyQuaternion(_q);
        const mood: FaceMood = u.face === "angry" || u.face === "hurt" || u.face === "dead" ? u.face : "idle";
        faces.push({
          x: _rel.x + _off.x,
          y: _rel.y + _off.y - sink,
          z: _rel.z + _off.z,
          qx: _q.x,
          qy: _q.y,
          qz: _q.z,
          qw: _q.w,
          mood,
          s: def.body.scale * shrink,
        });
      }
    }
    return { batches: [...bag.values()], picks, faces, rings };
  }

  const { batches, picks, faces, rings } = useMemo(
    () => layoutFromUnits(units, { blind, placingSide, hat0, hat1, pal0, pal1 }),
    [units, blind, placingSide, hat0, hat1, pal0, pal1],
  );

  useFrame(() => {
    const world = session.world;
    if (!world || (snapshot?.phase ?? "setup") === "setup") {
      renderFrame.snap = snapshot;
      renderFrame.batches = new Map();
      renderFrame.rings = rings;
      return;
    }
    const posed = posedSnapshot(world);
    renderFrame.snap = posed;
    const laid = layoutFromUnits(posed.units, {
      blind: false,
      placingSide,
      hat0,
      hat1,
      pal0,
      pal1,
    });
    renderFrame.batches = new Map(laid.batches.map((b) => [b.key, b]));
    renderFrame.rings = laid.rings;
  });

  return (
    <group>
      <TeamRings rings={rings} />
      {batches.map((b) => (
        <BatchMesh key={b.key} batch={b} />
      ))}
      {faces.map((f, i) => (
        <mesh key={`f${i}`} position={[f.x, f.y, f.z]} quaternion={[f.qx, f.qy, f.qz, f.qw]} scale={f.s} geometry={faceGeo} material={faceMaterial(f.mood)} dispose={null} />
      ))}
      {picks.map((p) => (
        <mesh
          key={`p${p.id}`}
          position={[p.x, p.y, p.z]}
          onPointerOver={(e) => {
            e.stopPropagation();
            useGame.getState().setHoverId(p.id);
          }}
          onPointerOut={() => useGame.getState().setHoverId(null)}
          onClick={(e) => {
            e.stopPropagation();
            const st = useGame.getState();
            if (st.snapshot?.phase === "setup" && e.shiftKey) {
              tryDuplicate(p.id);
              return;
            }
            const cur = st.followId;
            st.setFollowId(cur === p.id ? null : p.id);
          }}
          onContextMenu={(e) => {
            e.stopPropagation();
            const st = useGame.getState();
            if (st.snapshot?.phase !== "setup") return;
            if (p.side !== st.placingSide) return;
            const world = session.world;
            if (!world) return;
            const gone = world.removeById(p.id);
            if (!gone) return;
            st.addSpend(gone.side, -gone.def.cost);
            st.setSnapshot(world.snapshot());
          }}
        >
          <sphereGeometry args={[0.45, 6, 4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {shots.map((s, i) =>
        Number.isFinite(s.x) ? (
          <mesh key={`shot-${i}`} position={[s.x, s.y, s.z]} scale={s.r} geometry={shotGeo} material={shotMat(s.kind)} />
        ) : null,
      )}
    </group>
  );
}
