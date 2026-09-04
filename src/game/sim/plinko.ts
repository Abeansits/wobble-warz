import { JoltWorld, type BodyHandle, type TransformSnap } from "./physics/joltWorld";

export const PEG_R = 0.1;
export const BALL_R = 0.16;
export const DROP_Y = 6.35;
export const TRAY_Y = 0.42;

export type Peg = { x: number; y: number; z: number; r: number };
export type PlinkoPhase = "idle" | "falling" | "settled";

/** Staggered peg board. Spacing leaves a ball-width gap. */
export function plinkoPegs(): Peg[] {
  const pegs: Peg[] = [];
  const rows = 8;
  const evenCols = 6;
  for (let row = 0; row < rows; row++) {
    const n = row % 2 === 0 ? evenCols : evenCols - 1;
    const y = 5.15 - row * 0.54;
    const gap = 0.64;
    const span = (n - 1) * gap;
    for (let i = 0; i < n; i++) {
      pegs.push({ x: -span / 2 + i * gap, y, z: 0, r: PEG_R });
    }
  }
  return pegs;
}

export class PlinkoSim {
  physics = new JoltWorld();
  ball: BodyHandle | null = null;
  phase: PlinkoPhase = "idle";
  time = 0;
  settleT = 0;
  scratch: TransformSnap = { x: 0, y: DROP_Y, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };

  async init() {
    await this.physics.init();
    this.buildBoard();
  }

  private buildBoard() {
    this.physics.beginArena();
    const hz = 0.3;
    // Floor + tray lips.
    this.physics.createStaticBox(0, 0.04, 0, 2.6, 0.08, hz, 0, 0.55);
    this.physics.createStaticBox(0, 0.28, -0.22, 2.6, 0.22, 0.05, 0, 0.4);
    this.physics.createStaticBox(0, 0.28, 0.22, 2.6, 0.22, 0.05, 0, 0.4);
    // Sides.
    this.physics.createStaticBox(-2.58, 3.2, 0, 0.08, 3.3, hz, 0, 0.35);
    this.physics.createStaticBox(2.58, 3.2, 0, 0.08, 3.3, hz, 0, 0.35);
    // Back / front planes keep the capsule in the slot.
    this.physics.createStaticBox(0, 3.2, -0.32, 2.6, 3.3, 0.04, 0, 0.2);
    this.physics.createStaticBox(0, 3.2, 0.32, 2.6, 3.3, 0.04, 0, 0.2);
    // Funnel.
    this.physics.createStaticBox(-1.7, 5.95, 0, 1.15, 0.07, hz, 0, 0.3, 0.42);
    this.physics.createStaticBox(1.7, 5.95, 0, 1.15, 0.07, hz, 0, 0.3, -0.42);
    // Tray dividers (cosmetic bins — rarity is already decided).
    for (const x of [-1.5, -0.5, 0.5, 1.5]) {
      this.physics.createStaticBox(x, 0.28, 0, 0.04, 0.22, hz * 0.7, 0, 0.4);
    }
    for (const p of plinkoPegs()) {
      this.physics.createStaticSphere(p.x, p.y, p.z, p.r, 0.55);
    }
    this.physics.endArena();
  }

  drop(jitter: number) {
    this.clearBall();
    const x = Math.max(-0.7, Math.min(0.7, jitter));
    this.ball = this.physics.createDynamicSphere(x, DROP_Y, 0, BALL_R, 0.7, {
      restitution: 0.48,
      friction: 0.18,
    });
    this.physics.setLinearVelocity(this.ball, x * 1.4, -0.5, 0);
    this.phase = "falling";
    this.time = 0;
    this.settleT = 0;
    this.scratch.x = x;
    this.scratch.y = DROP_Y;
    this.scratch.z = 0;
  }

  step(dt: number) {
    if (this.phase !== "falling" || this.ball == null) return;
    const feed = Math.min(dt, 0.05);
    this.time += feed;
    this.physics.step(feed);
    this.physics.getTransform(this.ball, this.scratch);
    const speed = this.physics.speedOf(this.ball);
    const inTray = this.scratch.y < TRAY_Y + 0.35;
    if ((inTray && speed < 0.45) || this.time > 7.5) {
      this.settleT += feed;
      if (this.settleT > 0.22) this.phase = "settled";
    } else {
      this.settleT = 0;
    }
  }

  clearBall() {
    if (this.ball == null) return;
    try {
      this.physics.removeBody(this.ball);
    } catch {
      /* */
    }
    this.ball = null;
    this.phase = "idle";
  }

  dispose() {
    this.clearBall();
    this.physics.dispose();
  }
}
