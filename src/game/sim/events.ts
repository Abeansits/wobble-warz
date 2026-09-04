export type SimEvent =
  | { type: "spawn"; unitId: number; defId: string; side: 0 | 1 }
  | { type: "hit"; attackerId: number; victimId: number; damage: number; impulse: number }
  | { type: "death"; unitId: number; killerId: number | null }
  | { type: "launch"; unitId: number }
  | { type: "swing"; unitId: number }
  | { type: "shot"; unitId: number }
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
