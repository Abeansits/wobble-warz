import { describe, expect, it } from "vitest";
import { FUSE_ARM, fuseBoom, fuseHitsUnit, tickFuse } from "./fuse";

const bomb = {
  explosive: true,
  fuse: 2,
  armed: FUSE_ARM,
  fuseOnGround: true,
  life: 6,
};

describe("tickFuse", () => {
  it("counts down fuse and arm, then sticks at armed 0", () => {
    const a = tickFuse(bomb, 0.2);
    expect(a.fuse).toBeCloseTo(1.8);
    expect(a.armed).toBeCloseTo(0.15);
    const b = tickFuse({ ...bomb, ...a }, 0.2);
    expect(b.armed).toBe(0);
  });

  it("leaves arrows alone", () => {
    const t = tickFuse({ explosive: false, fuse: 0, armed: 0, fuseOnGround: false }, 1);
    expect(t.fuse).toBe(0);
  });
});

describe("fuseBoom", () => {
  it("booms when the timer runs out, even in the air", () => {
    expect(fuseBoom({ ...bomb, fuse: 0, armed: 0 }, 2, 0)).toBe("fuse");
  });

  it("booms on the ground only after it is armed", () => {
    expect(fuseBoom({ ...bomb, armed: 0.2 }, 0.2, 0)).toBeNull();
    expect(fuseBoom({ ...bomb, armed: 0 }, 0.2, 0)).toBe("ground");
  });

  it("lets a bouncing bomb skip the dirt", () => {
    expect(fuseBoom({ ...bomb, armed: 0, fuseOnGround: false }, 0.1, 0)).toBeNull();
  });

  it("still booms a miss that lived out its body", () => {
    expect(fuseBoom({ ...bomb, armed: 0, life: 0 }, 3, 0)).toBe("life");
    expect(fuseBoom({ ...bomb, armed: 0 }, -3, 0)).toBe("void");
  });
});

describe("fuseHitsUnit", () => {
  it("cooks friendlies once armed, not while leaving the hand", () => {
    const pal = { gone: false, state: "seek" };
    expect(fuseHitsUnit({ ...bomb, armed: 0.2 }, pal)).toBe(false);
    expect(fuseHitsUnit({ ...bomb, armed: 0 }, pal)).toBe(true);
    expect(fuseHitsUnit({ ...bomb, armed: 0 }, { gone: false, state: "dead" })).toBe(false);
  });
});
