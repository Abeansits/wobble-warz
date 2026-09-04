import { useMemo } from "react";
import * as THREE from "three";
import { getHat, HAT_BRIM_Y, type HatPart } from "@/game/data/hats";
import type { MeshPart, UnitDef } from "@/game/data/types";
import { COSMETIC_PALETTES, METAL, TEAM, WOOD } from "./palette";
import { getRamp } from "./textures";

/** Same parent map as ArmyView — child slots ride their bone in humanoid recipes. */
export const RECIPE_PARENT: Record<string, string> = {
  weapon: "armR",
  scarf: "torso",
  belt: "torso",
  shield: "armL",
  hat: "head",
  extra: "armR",
};

export function isClustered(def: UnitDef): boolean {
  return def.body.kind !== "humanoid";
}

export function partLocalOffset(
  part: MeshPart,
  parts: MeshPart[],
  clustered: boolean,
  memo?: Map<MeshPart, [number, number, number]>,
): [number, number, number] {
  if (clustered) return part.offset;
  const cache = memo ?? new Map();
  const hit = cache.get(part);
  if (hit) return hit;
  const parentSlot = part.parent ?? RECIPE_PARENT[part.slot];
  if (!parentSlot || parentSlot === part.slot) {
    cache.set(part, part.offset);
    return part.offset;
  }
  const parent = parts.find((p) => p !== part && p.slot === parentSlot);
  if (!parent) {
    cache.set(part, part.offset);
    return part.offset;
  }
  const [px, py, pz] = partLocalOffset(parent, parts, false, cache);
  const pos: [number, number, number] = [px + part.offset[0], py + part.offset[1], pz + part.offset[2]];
  cache.set(part, pos);
  return pos;
}

function halfY(part: MeshPart): number {
  if (part.shape === "sphere") return Math.max(part.size[0], 0.07);
  if (part.shape === "capsule") return Math.max(part.size[0], 0.06) + Math.max(part.size[1], 0.16) * 0.5;
  return Math.max(part.size[1], 0.08) * 0.5;
}

function halfXZ(part: MeshPart): number {
  if (part.shape === "sphere") return Math.max(part.size[0], 0.07);
  if (part.shape === "capsule") return Math.max(part.size[0], 0.06);
  return Math.max(part.size[0], part.size[2], 0.08) * 0.5;
}

export type RecipeBounds = { minY: number; maxY: number; maxR: number; height: number };

export function recipeBounds(def: UnitDef): RecipeBounds {
  const clustered = isClustered(def);
  const memo = new Map<MeshPart, [number, number, number]>();
  let minY = Infinity;
  let maxY = -Infinity;
  let maxR = 0;
  for (const part of def.recipe.parts) {
    const [x, y, z] = partLocalOffset(part, def.recipe.parts, clustered, memo);
    const hy = halfY(part);
    minY = Math.min(minY, y - hy);
    maxY = Math.max(maxY, y + hy);
    maxR = Math.max(maxR, Math.hypot(x, z) + halfXZ(part));
  }
  if (!Number.isFinite(minY)) {
    minY = -0.4;
    maxY = 0.7;
    maxR = 0.4;
  }
  return { minY, maxY, maxR, height: maxY - minY };
}

/** Scale so the recipe fills a portrait frame. Beasts shrink; tiny toys grow. */
export function fitPreviewScale(def: UnitDef, targetH = 1.55, targetW = 1.9): number {
  const b = recipeBounds(def);
  const h = Math.max(b.height, 0.2);
  const w = Math.max(b.maxR * 2, 0.2);
  return Math.min(targetH / h, targetW / w);
}

export function tokenColor(
  token: string,
  def: UnitDef,
  team: 0 | 1,
  cosmetic: string | null,
): string {
  if (token === "team") return TEAM[team];
  if (token === "wood") return WOOD;
  if (token === "metal") return METAL;
  const pal = (cosmetic && COSMETIC_PALETTES[cosmetic]) || def.palette;
  if (token === "primary") return pal.primary;
  if (token === "secondary") return pal.secondary;
  if (token === "accent") return pal.accent;
  return pal.skin;
}

function skipRaycast() {}

function PartGeom({ part }: { part: MeshPart | HatPart }) {
  if (part.shape === "sphere") {
    return <sphereGeometry args={[Math.max(part.size[0], 0.04), 10, 8]} />;
  }
  if (part.shape === "capsule") {
    return <capsuleGeometry args={[Math.max(part.size[0], 0.03), Math.max(part.size[1], 0.08), 3, 6]} />;
  }
  return (
    <boxGeometry
      args={[Math.max(part.size[0], 0.04), Math.max(part.size[1], 0.03), Math.max(part.size[2], 0.04)]}
    />
  );
}

type RecipeMeshProps = {
  def: UnitDef;
  /** World scale. Ghost uses `def.body.scale`; portraits pass `fitPreviewScale`. */
  scale?: number;
  team?: 0 | 1;
  cosmetic?: string | null;
  hat?: string | null;
  /** When set, every part is this color (placement ghost). */
  tint?: string;
  opacity?: number;
  align?: "origin" | "ground" | "center";
  ghost?: boolean;
  castShadow?: boolean;
};

export function RecipeMesh({
  def,
  scale,
  team = 0,
  cosmetic = null,
  hat = null,
  tint,
  opacity = 1,
  align = "origin",
  ghost = false,
  castShadow = false,
}: RecipeMeshProps) {
  const clustered = isClustered(def);
  const s = scale ?? def.body.scale;
  const transparent = opacity < 1;
  const laid = useMemo(() => {
    const memo = new Map<MeshPart, [number, number, number]>();
    return def.recipe.parts.map((part, i) => ({
      key: `${part.slot}-${i}`,
      part,
      pos: partLocalOffset(part, def.recipe.parts, clustered, memo),
      color: tint ?? tokenColor(part.color, def, team, cosmetic),
    }));
  }, [def, clustered, tint, team, cosmetic]);

  const bounds = useMemo(() => recipeBounds(def), [def]);
  const yOff = align === "ground" ? -bounds.minY : align === "center" ? -(bounds.minY + bounds.maxY) * 0.5 : 0;

  const head = laid.find((p) => p.part.slot === "head");
  const hatDef = def.body.kind === "humanoid" ? getHat(hat) : null;

  const mat = {
    gradientMap: getRamp(),
    transparent,
    opacity,
    depthWrite: !transparent,
    side: THREE.FrontSide,
  };

  return (
    <group scale={s} position={[0, yOff * s, 0]}>
      {laid.map((p) => (
        <mesh
          key={p.key}
          position={p.pos}
          castShadow={castShadow && !ghost}
          frustumCulled={!ghost}
          {...(ghost ? { raycast: skipRaycast } : {})}
        >
          <PartGeom part={p.part} />
          <meshToonMaterial color={p.color} {...mat} />
        </mesh>
      ))}
      {head &&
        hatDef?.parts.map((part, i) => (
          <mesh
            key={`hat-${hatDef.id}-${i}`}
            position={[
              head.pos[0] + part.offset[0],
              head.pos[1] + HAT_BRIM_Y + part.offset[1],
              head.pos[2] + part.offset[2],
            ]}
            castShadow={castShadow && !ghost}
            frustumCulled={!ghost}
            {...(ghost ? { raycast: skipRaycast } : {})}
          >
            <PartGeom part={part} />
            <meshToonMaterial color={tint ?? part.color} {...mat} />
          </mesh>
        ))}
    </group>
  );
}
