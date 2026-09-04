import { z } from "zod";
import { AUDIO_KEYS, FACTIONS, type AudioKey, type UnitAudio, type UnitDef, type WeaponDef } from "./types";

const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "hex color");

const MeshPartSchema = z.object({
  slot: z.enum([
    "pelvis",
    "torso",
    "head",
    "armL",
    "armR",
    "legs",
    "weapon",
    "scarf",
    "hat",
    "belt",
    "shield",
    "extra",
    "legFL",
    "legFR",
    "legBL",
    "legBR",
    "wheelFL",
    "wheelFR",
    "wheelBL",
    "wheelBR",
  ]),
  shape: z.enum(["box", "capsule", "sphere"]),
  size: vec3,
  offset: vec3,
  color: z.enum(["primary", "secondary", "accent", "skin", "team", "wood", "metal"]),
  parent: z
    .enum([
      "pelvis",
      "torso",
      "head",
      "armL",
      "armR",
      "legs",
      "weapon",
      "scarf",
      "hat",
      "belt",
      "shield",
      "extra",
      "legFL",
      "legFR",
      "legBL",
      "legBR",
      "wheelFL",
      "wheelFR",
      "wheelBL",
      "wheelBR",
    ])
    .optional(),
});

const combat = {
  damage: z.number(),
  knockback: z.number(),
  range: z.number(),
  cooldown: z.number(),
};

const WeaponSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("melee"),
    ...combat,
    swingSeconds: z.number(),
    vsChargeMult: z.number().optional(),
    instakill: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("melee-reach"),
    ...combat,
    swingSeconds: z.number(),
    vsChargeMult: z.number().optional(),
    instakill: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("projectile"),
    ...combat,
    speed: z.number(),
    arc: z.number(),
    radius: z.number().optional(),
    linger: z.number().optional(),
    minRange: z.number().optional(),
  }),
  z.object({
    kind: z.literal("explosive"),
    ...combat,
    speed: z.number(),
    arc: z.number(),
    radius: z.number().optional(),
    linger: z.number().optional(),
    minRange: z.number().optional(),
  }),
  z.object({ kind: z.literal("charge"), ...combat }),
  z.object({
    kind: z.literal("aura"),
    ...combat,
    healPerSec: z.number().optional(),
    damageBonus: z.number().optional(),
    speedBonus: z.number().optional(),
    tauntRange: z.number().optional(),
  }),
  z.object({ kind: z.literal("hitscan"), ...combat }),
  z.object({ kind: z.literal("tether"), ...combat }),
  z.object({
    kind: z.literal("status"),
    ...combat,
    speed: z.number(),
    arc: z.number(),
    slow: z.number().optional(),
    slowT: z.number().optional(),
  }),
  z.object({ kind: z.literal("summon"), ...combat }),
]);

const AudioSchema = z.object({
  attack: z.enum(AUDIO_KEYS),
  hit: z.enum(AUDIO_KEYS),
  death: z.enum(AUDIO_KEYS),
});

export function defaultAudio(weapon: WeaponDef): UnitAudio {
  if (weapon.kind === "explosive") return { attack: "boom", hit: "boom", death: "yelp" };
  if (weapon.kind === "hitscan" || weapon.kind === "projectile" || weapon.kind === "status") {
    return { attack: "shot", hit: "hit", death: "yelp" };
  }
  if (weapon.kind === "melee" || weapon.kind === "melee-reach") {
    return { attack: "swing", hit: "hit", death: "yelp" };
  }
  return { attack: "hit" satisfies AudioKey, hit: "hit", death: "yelp" };
}

export const UnitDefSchema = z
  .object({
    id: z.string().min(1),
    faction: z.enum(FACTIONS),
    name: z.string().min(1),
    blurb: z.string().min(1),
    cost: z.number().nonnegative(),
    body: z.object({
      kind: z.enum(["humanoid", "quadruped", "vehicle", "static"]),
      scale: z.number().positive(),
      massMult: z.number().positive(),
      hp: z.number().positive(),
      speed: z.number().nonnegative(),
      springStiffness: z.number().positive(),
      launchThreshold: z.number().positive(),
      projectileArmor: z.number().min(0).max(1).optional(),
    }),
    weapon: WeaponSchema,
    abilities: z
      .array(
        z.object({
          kind: z.enum(["heal-aura", "damage-aura", "taunt", "speed-aura"]),
          radius: z.number().nonnegative(),
          amount: z.number(),
          spring: z.number().nonnegative().optional(),
        }),
      )
      .optional(),
    ai: z.object({
      targeting: z.enum(["nearest", "prefer:large", "prefer:ranged", "prefer:weakest"]),
      keepAway: z.number().optional(),
    }),
    recipe: z.object({ parts: z.array(MeshPartSchema).min(1) }),
    palette: z.object({
      primary: hex,
      secondary: hex,
      accent: hex,
      skin: hex,
    }),
    audio: AudioSchema.optional(),
  })
  .transform((u): UnitDef => ({
    ...u,
    audio: u.audio ?? defaultAudio(u.weapon),
  }));

export function parseRoster(raw: Record<string, unknown>): Record<string, UnitDef> {
  const out: Record<string, UnitDef> = {};
  for (const [key, val] of Object.entries(raw)) {
    const unit = UnitDefSchema.parse(val, { reportInput: true });
    if (unit.id !== key) throw new Error(`Unit key "${key}" does not match id "${unit.id}"`);
    out[key] = unit;
  }
  return out;
}
