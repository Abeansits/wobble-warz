import { useMemo } from "react";
import * as THREE from "three";
import { getUnit } from "@/game/data/units";
import type { WorldSnapshot } from "@/game/sim/World";
import { useGame } from "@/store/gameStore";
import { METAL, TEAM, WOOD } from "./palette";

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.MeshStandardMaterial>();

function geom(shape: string, size: [number, number, number]) {
  const key = `${shape}:${size[0]}:${size[1]}:${size[2]}`;
  let g = geoCache.get(key);
  if (!g) {
    if (shape === "sphere") {
      g = new THREE.SphereGeometry(Math.max(size[0], 0.14), 8, 6);
    } else if (shape === "capsule") {
      g = new THREE.CapsuleGeometry(Math.max(size[0], 0.07), Math.max(size[1], 0.18), 3, 6);
    } else {
      g = new THREE.BoxGeometry(Math.max(size[0], 0.14), Math.max(size[1], 0.14), Math.max(size[2], 0.14));
    }
    geoCache.set(key, g);
  }
  return g;
}

function mat(color: string, flash: boolean, metal: boolean) {
  const key = `${color}:${flash ? 1 : 0}:${metal ? 1 : 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: flash ? "#ffffff" : color,
      roughness: 0.88,
      metalness: metal ? 0.35 : 0,
    });
    matCache.set(key, m);
  }
  return m;
}

function tokenColor(token: string, defId: string, side: 0 | 1): string {
  if (token === "team") return TEAM[side];
  if (token === "wood") return WOOD;
  if (token === "metal") return METAL;
  const pal = getUnit(defId).palette;
  if (token === "primary") return pal.primary;
  if (token === "secondary") return pal.secondary;
  if (token === "accent") return pal.accent;
  return pal.skin;
}

const shotGeo = new THREE.SphereGeometry(1, 8, 6);

export function ArmyView({ snapshot }: { snapshot: WorldSnapshot | null }) {
  const units = snapshot?.units ?? [];
  const shots = snapshot?.projectiles ?? [];
  const seat = useGame((s) => s.seat);
  const placingSide = useGame((s) => s.placingSide);
  const phase = snapshot?.phase ?? "setup";
  const blind = phase === "setup" && seat === "setupP2";

  const unitNodes = useMemo(() => {
    return units.map((u) => {
      const hidden = blind && u.side !== placingSide;
      if (hidden) {
        const p = u.parts.torso ?? u.parts.pelvis;
        if (!p) return null;
        return (
          <mesh key={u.id} position={[p.x, p.y + 0.2, p.z]} geometry={geom("box", [0.45, 1.1, 0.35])} material={mat("#1c1710", false, false)} />
        );
      }
      const def = getUnit(u.defId);
      return (
        <group
          key={u.id}
          onClick={(e) => {
            e.stopPropagation();
            useGame.getState().setFollowId(u.id);
          }}
        >
          {def.recipe.parts.map((part) => {
            const src =
              part.slot === "weapon"
                ? u.parts.armR
                : part.slot === "scarf"
                  ? u.parts.torso
                  : u.parts[part.slot];
            if (!src || !Number.isFinite(src.x)) return null;
            const color = tokenColor(part.color, u.defId, u.side);
            const s = def.body.scale;
            return (
              <mesh
                key={part.slot}
                position={[src.x, src.y, src.z]}
                quaternion={[src.qx, src.qy, src.qz, src.qw]}
                scale={s}
                castShadow={units.length < 40}
                geometry={geom(part.shape, part.size)}
                material={mat(color, u.flash > 0, part.color === "metal")}
              />
            );
          })}
        </group>
      );
    });
  }, [units, blind, placingSide]);

  return (
    <group>
      {unitNodes}
      {shots.map((s, i) =>
        Number.isFinite(s.x) ? (
          <mesh
            key={`shot-${i}`}
            position={[s.x, s.y, s.z]}
            scale={s.r}
            geometry={shotGeo}
            material={mat(s.kind === "boom" ? "#5a3a20" : s.kind === "arrow" ? "#c9cdd3" : "#6b4a28", false, false)}
          />
        ) : null,
      )}
    </group>
  );
}
