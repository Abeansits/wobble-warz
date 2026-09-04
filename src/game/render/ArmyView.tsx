import { getUnit } from "@/game/data/units";
import type { WorldSnapshot } from "@/game/sim/World";
import { useGame } from "@/store/gameStore";
import { METAL, TEAM, WOOD } from "./palette";

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

export function ArmyView({ snapshot }: { snapshot: WorldSnapshot | null }) {
  const units = snapshot?.units ?? [];
  const shots = snapshot?.projectiles ?? [];
  const seat = useGame((s) => s.seat);
  const placingSide = useGame((s) => s.placingSide);
  const phase = snapshot?.phase ?? "setup";
  const blind = phase === "setup" && seat === "setupP2";

  return (
    <group>
      {units.map((u) => {
        const hidden = blind && u.side !== placingSide;
        if (hidden) {
          const p = u.parts.torso ?? u.parts.pelvis;
          if (!p) return null;
          return (
            <mesh key={u.id} position={[p.x, p.y + 0.2, p.z]}>
              <boxGeometry args={[0.45, 1.1, 0.35]} />
              <meshStandardMaterial color="#1c1710" opacity={0.35} transparent />
            </mesh>
          );
        }
        const def = getUnit(u.defId);
        return (
          <group key={u.id}>
            {def.recipe.parts.map((part) => {
              const src =
                part.slot === "weapon"
                  ? u.parts.armR
                  : part.slot === "scarf"
                    ? u.parts.torso
                    : u.parts[part.slot];
              if (!src) return null;
              const color = tokenColor(part.color, u.defId, u.side);
              const s = def.body.scale;
              return (
                <mesh
                  key={part.slot}
                  position={[src.x, src.y, src.z]}
                  quaternion={[src.qx, src.qy, src.qz, src.qw]}
                  scale={s}
                  castShadow
                >
                  {part.shape === "sphere" ? (
                    <sphereGeometry args={[Math.max(part.size[0], 0.14), 10, 8]} />
                  ) : part.shape === "capsule" ? (
                    <capsuleGeometry
                      args={[Math.max(part.size[0], 0.07), Math.max(part.size[1], 0.18), 4, 8]}
                    />
                  ) : (
                    <boxGeometry
                      args={[
                        Math.max(part.size[0], 0.14),
                        Math.max(part.size[1], 0.14),
                        Math.max(part.size[2], 0.14),
                      ]}
                    />
                  )}
                  <meshStandardMaterial
                    color={u.flash > 0 ? "#ffffff" : color}
                    roughness={0.88}
                    metalness={part.color === "metal" ? 0.35 : 0}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
      {shots.map((s, i) => (
        <mesh key={`shot-${i}`} position={[s.x, s.y, s.z]}>
          <sphereGeometry args={[s.r, 8, 6]} />
          <meshStandardMaterial color={s.kind === "boom" ? "#5a3a20" : s.kind === "arrow" ? "#c9cdd3" : "#6b4a28"} />
        </mesh>
      ))}
    </group>
  );
}
