import { describe, expect, it } from "vitest";
import { JOINT_ARML, JOINT_ARMR, JOINT_EXTRA, JOINT_LEGS, poseGait, poseJoints, quatMul } from "./poses";

describe("poseJoints", () => {
  it("humanoid run swings opposite arms", () => {
    const out = poseJoints(
      { time: 0.2, gait: "run", swingT: 0, swingDur: 0.3, phase: 0, kind: "humanoid" },
      [],
    );
    expect(out).toHaveLength(6);
    expect(out[JOINT_ARML].x).toBeCloseTo(-out[JOINT_ARMR].x);
  });

  it("quadruped trot uses opposite diagonal legs", () => {
    const out = poseJoints(
      { time: 0.2, gait: "run", swingT: 0, swingDur: 0.3, phase: 0, kind: "quadruped", jointCount: 7 },
      [],
    );
    expect(out).toHaveLength(7);
    expect(out[JOINT_ARML].x).toBeCloseTo(out[JOINT_EXTRA].x);
    expect(out[JOINT_ARMR].x).toBeCloseTo(out[JOINT_LEGS].x);
    expect(out[JOINT_ARML].x).toBeCloseTo(-out[JOINT_ARMR].x);
  });

  it("vehicle run spins all four wheels the same way", () => {
    const out = poseJoints(
      { time: 1, gait: "run", swingT: 0, swingDur: 0.3, phase: 0, kind: "vehicle", jointCount: 7 },
      [],
    );
    expect(out[JOINT_ARML].x).toBeCloseTo(out[JOINT_ARMR].x);
    expect(out[JOINT_ARML].x).toBeCloseTo(out[JOINT_EXTRA].x);
    expect(Math.abs(out[JOINT_ARML].x)).toBeGreaterThan(1);
  });

  it("static recoil kicks the barrel back", () => {
    const out = poseJoints(
      { time: 0, gait: "idle", swingT: 0.16, swingDur: 0.32, phase: 0, kind: "static" },
      [],
    );
    expect(out[1].x).toBeLessThan(0);
  });
});

describe("poseGait", () => {
  it("static units never run", () => {
    expect(
      poseGait({
        state: "seek",
        frozenT: 0,
        charging: false,
        def: { body: { speed: 0 } },
      }),
    ).toBe("idle");
  });
});

describe("quatMul", () => {
  it("identity leaves a yaw untouched", () => {
    const yaw = { qx: 0, qy: Math.SQRT1_2, qz: 0, qw: Math.SQRT1_2 };
    const out = quatMul(yaw, { qx: 0, qy: 0, qz: 0, qw: 1 });
    expect(out.qy).toBeCloseTo(yaw.qy);
    expect(out.qw).toBeCloseTo(yaw.qw);
  });
});
