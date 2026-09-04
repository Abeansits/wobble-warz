import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { session } from "@/game/session";
import { getUnit } from "@/game/data/units";
import type { WorldSnapshot } from "@/game/sim/World";
import { useProfiles } from "@/game/meta/profiles";
import { useGame } from "@/store/gameStore";
import { COSMETIC_PALETTES, METAL, TEAM, WOOD } from "./palette";
import { useSettings } from "@/routes/settings";
import { getCloth, getFace, getMetalTex, getRamp, getWood, type FaceMood } from "./textures";

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

function BatchMesh({ batch }: { batch: Batch }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const n = batch.color.length;
  const capRef = useRef(Math.max(8, n));
  if (n > capRef.current) capRef.current = Math.max(n, capRef.current * 2);
  const cap = capRef.current;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < n; i++) {
      _off.set(batch.pos[i * 3], batch.pos[i * 3 + 1], batch.pos[i * 3 + 2]);
      _q.set(batch.quat[i * 4], batch.quat[i * 4 + 1], batch.quat[i * 4 + 2], batch.quat[i * 4 + 3]);
      _s.setScalar(batch.scale[i]);
      _m.compose(_off, _q, _s);
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _c.set(batch.color[i]));
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [batch, n]);
  return (
    <instancedMesh
      key={cap}
      ref={ref}
      args={[geom(batch.shape, batch.size), material(batch.kind), cap]}
      dispose={null}
      frustumCulled={false}
      castShadow={n < 80}
    />
  );
}

const shotGeo = new THREE.SphereGeometry(1, 8, 6);
const shotMat = new THREE.MeshBasicMaterial({ color: "#6b4a28" });

export function ArmyView({ snapshot }: { snapshot: WorldSnapshot | null }) {
  const units = snapshot?.units ?? [];
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

  const { batches, picks, faces } = useMemo(() => {
    const bag = new Map<string, Batch>();
    const picks: { id: number; x: number; y: number; z: number; side: 0 | 1 }[] = [];
    const faces: { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number; mood: FaceMood; s: number }[] = [];

    for (const u of units) {
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
            ? "#e8c090"
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
      if (worn?.startsWith("hat") && u.parts.head) {
        const src = u.parts.head;
        const key = worn === "hat.crown" ? "crown" : "cone";
        let b = bag.get(key);
        if (!b) {
          b = {
            key,
            shape: worn === "hat.crown" ? "box" : "capsule",
            size: worn === "hat.crown" ? [0.16, 0.12, 0.16] : [0.08, 0.22, 0.08],
            kind: "plain",
            pos: [],
            quat: [],
            scale: [],
            color: [],
          };
          bag.set(key, b);
        }
        if (tumbling) {
          _q.set(src.qx, src.qy, src.qz, src.qw);
          _rel.set(0, 0.28 * def.body.scale, 0);
          b.pos.push(src.x + _rel.x, src.y + _rel.y - sink, src.z + _rel.z);
        } else {
          _q.set(src.qx, src.qy, src.qz, src.qw).premultiply(_yawQ);
          _rel.set(src.x - pivot.x, src.y - pivot.y + 0.28 * def.body.scale, src.z - pivot.z).applyQuaternion(_yawQ);
          b.pos.push(pivot.x + _rel.x, pivot.y + _rel.y - sink, pivot.z + _rel.z);
        }
        b.quat.push(_q.x, _q.y, _q.z, _q.w);
        b.scale.push(shrink);
        b.color.push(worn === "hat.crown" ? "#d4a017" : "#c45a32");
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
    return { batches: [...bag.values()], picks, faces };
  }, [units, blind, placingSide, hat0, hat1, pal0, pal1]);

  return (
    <group>
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
            const cur = useGame.getState().followId;
            useGame.getState().setFollowId(cur === p.id ? null : p.id);
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
        Number.isFinite(s.x) ? <mesh key={`shot-${i}`} position={[s.x, s.y, s.z]} scale={s.r} geometry={shotGeo} material={shotMat} /> : null,
      )}
    </group>
  );
}
