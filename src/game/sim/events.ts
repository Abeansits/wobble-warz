export type ShotFlavor = "hitscan" | "projectile" | "status" | "explosive";
export type SplatKind = "freeze" | "pumpkin" | "heal" | "boom";

export type SimEvent =
  | { type: "spawn"; unitId: number; defId: string; side: 0 | 1 }
  | { type: "hit"; attackerId: number; victimId: number; damage: number; impulse: number }
  | { type: "death"; unitId: number; killerId: number | null }
  | { type: "launch"; unitId: number }
  | { type: "swing"; unitId: number }
  | {
      type: "shot";
      unitId: number;
      flavor: ShotFlavor;
      ox: number;
      oy: number;
      oz: number;
      tx: number;
      ty: number;
      tz: number;
    }
  | { type: "splat"; kind: SplatKind; x: number; y: number; z: number }
  | { type: "break"; x: number; y: number; z: number }
  | { type: "victory"; winner: 0 | 1 | "draw" };


export class EventRing {
  private items: SimEvent[] = [];

  push(ev: SimEvent) {
    if (this.items.length > 256) this.items.shift();
    this.items.push(ev);
  }

  drain(): SimEvent[] {
    const out = this.items;
    this.items = [];
    return out;
  }
}
