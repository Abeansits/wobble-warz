import type { ArenaId } from "@/game/data/arenas";
import type { Placement, Side, UnitDef } from "@/game/data/types";
import type { EventRing } from "./events";
import type { Rng } from "./rng";
import type {
  BodyHandle,
  BuiltRagdoll,
  JoltWorld,
  TransformSnap,
} from "./physics/joltWorld";

export type UnitState = "idle" | "seek" | "attack" | "stunned" | "launched" | "dead";
export type FaceState = "idle" | "angry" | "hurt" | "dead";

export type UnitInternal = {
  id: number;
  def: UnitDef;
  side: Side;
  hp: number;
  maxHp: number;
  state: UnitState;
  face: FaceState;
  x: number;
  y: number;
  z: number;
  yaw: number;
  ragdoll: BuiltRagdoll;
  cooldown: number;
  swingT: number;
  /** >0 while airborne; at 0 World resnaps root to pelvis xz and restores the spring. */
  launchT: number;
  stunT: number;
  hurtT: number;
  slowT: number;
  frozenT: number;
  targetId: number | null;
  flash: number;
  lastHitBy: number | null;
  aiTickOffset: number;
  damageDealt: number;
  swingHits: Set<number>;
  chargeHits: Set<number>;
  charging: boolean;
  deadT: number;
  summoned: boolean;
  gone: boolean;
  frozenCorpse: boolean;
  mounted: boolean;
  mountId: number | null;
  mountSeat?: { x: number; z: number };
  mountSpring?: ReturnType<JoltWorld["createDistanceSpring"]>;
};

export type Flying = {
  id: number;
  body: BodyHandle;
  ownerId: number;
  side: Side;
  damage: number;
  knockback: number;
  radius: number;
  life: number;
  linger: number;
  explosive: boolean;
  kind: "rock" | "spear" | "arrow" | "boom" | "pumpkin" | "ice";
  hit: Set<number>;
  slow?: number;
  slowT?: number;
  freeze?: number;
};

export type TetherLink = {
  constraint: ReturnType<JoltWorld["createDistanceSpring"]>;
  attackerId: number;
  victimId: number;
  until: number;
};

export type Tombstone = {
  handle: BodyHandle;
  x: number;
  y: number;
  z: number;
  hp: number;
};

export type Plank = {
  handle: BodyHandle;
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
  hp: number;
  gone: boolean;
};

export type PlaceOpts = {
  free?: boolean;
  summoned?: boolean;
  mounted?: boolean;
  def?: UnitDef;
};

export type SimCtx = {
  units: UnitInternal[];
  physics: JoltWorld;
  rng: Rng;
  events: EventRing;
  time: number;
  arena: ArenaId;
  hitStop: number;
  noDamageT: number;
  tethers: TetherLink[];
  flying: Flying[];
  nextShot: number;
  scratch: TransformSnap;
  bananaSide: 0 | 1 | null;
  stones: Tombstone[];
  planks: Plank[];
  debris: BodyHandle[];
  kill: (u: UnitInternal, killerId: number | null) => void;
  place: (p: Placement, opts?: PlaceOpts) => number;
  groundY: (x?: number, z?: number) => number;
};
