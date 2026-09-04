export const FACTIONS = [
  "stoneage",
  "medieval",
  "pirate",
  "frontier",
  "haunted",
  "anomaly",
] as const;

export type FactionId = (typeof FACTIONS)[number];

export type TargetRule = "nearest" | "prefer:large" | "prefer:ranged" | "prefer:weakest";

export type PartShape = "box" | "capsule" | "sphere";
export type PartSlot =
  | "pelvis"
  | "torso"
  | "head"
  | "armL"
  | "armR"
  | "legs"
  | "weapon"
  | "scarf"
  | "hat"
  | "belt"
  | "shield"
  | "extra"
  | "legFL"
  | "legFR"
  | "legBL"
  | "legBR"
  | "wheelFL"
  | "wheelFR"
  | "wheelBL"
  | "wheelBR";
export type ColorToken = "primary" | "secondary" | "accent" | "skin" | "team" | "wood" | "metal";

export type MeshPart = {
  slot: PartSlot;
  shape: PartShape;
  size: [number, number, number];
  offset: [number, number, number];
  color: ColorToken;
  parent?: PartSlot;
};

export type MeshRecipe = {
  parts: MeshPart[];
};

export type MeleeWeapon = {
  kind: "melee" | "melee-reach";
  damage: number;
  knockback: number;
  range: number;
  cooldown: number;
  swingSeconds: number;
  vsChargeMult?: number;
  instakill?: boolean;
};

export type ProjectileWeapon = {
  kind: "projectile" | "explosive";
  damage: number;
  knockback: number;
  range: number;
  cooldown: number;
  speed: number;
  arc: number;
  radius?: number;
  linger?: number;
  minRange?: number;
};

export type ChargeWeapon = {
  kind: "charge";
  damage: number;
  knockback: number;
  range: number;
  cooldown: number;
};

export type AuraWeapon = {
  kind: "aura";
  damage: number;
  knockback: number;
  range: number;
  cooldown: number;
  healPerSec?: number;
  damageBonus?: number;
  speedBonus?: number;
  tauntRange?: number;
};

export type HitscanWeapon = {
  kind: "hitscan";
  damage: number;
  knockback: number;
  range: number;
  cooldown: number;
};

export type TetherWeapon = {
  kind: "tether";
  damage: number;
  knockback: number;
  range: number;
  cooldown: number;
};

export type StatusWeapon = {
  kind: "status";
  damage: number;
  knockback: number;
  range: number;
  cooldown: number;
  speed: number;
  arc: number;
  slow?: number;
  slowT?: number;
};

export type SummonWeapon = {
  kind: "summon";
  damage: number;
  knockback: number;
  range: number;
  cooldown: number;
};

export type WeaponDef = MeleeWeapon | ProjectileWeapon | ChargeWeapon | AuraWeapon | HitscanWeapon | TetherWeapon | StatusWeapon | SummonWeapon;

export type AbilityDef = {
  kind: "heal-aura" | "damage-aura" | "taunt" | "speed-aura";
  radius: number;
  amount: number;
};

export type UnitDef = {
  id: string;
  faction: FactionId;
  name: string;
  blurb: string;
  cost: number;
  body: {
    kind: "humanoid" | "quadruped" | "vehicle" | "static";
    scale: number;
    massMult: number;
    hp: number;
    speed: number;
    springStiffness: number;
    launchThreshold: number;
    projectileArmor?: number;
  };
  weapon: WeaponDef;
  abilities?: AbilityDef[];
  ai: { targeting: TargetRule; keepAway?: number };
  recipe: MeshRecipe;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    skin: string;
  };
};

export type Side = 0 | 1;

export type Placement = {
  defId: string;
  x: number;
  z: number;
  yaw: number;
  side: Side;
};

export const FACTION_META: Record<
  FactionId,
  { name: string; tag: string; color: string }
> = {
  stoneage: { name: "Stone Age", tag: "Chunky knockback", color: "#c48a3a" },
  medieval: { name: "Medieval", tag: "Balanced steel", color: "#3a5f8a" },
  pirate: { name: "Pirates", tag: "Gunpowder and grabs", color: "#2a6f6a" },
  frontier: { name: "Frontier", tag: "Fast, fragile, loud", color: "#b56a2a" },
  haunted: { name: "Haunted", tag: "Swarms and weirdness", color: "#5a3a6a" },
  anomaly: { name: "Anomalies", tag: "Gacha only", color: "#d4a017" },
};
