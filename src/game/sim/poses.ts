export const JOINT_PELVIS = 0;
export const JOINT_TORSO = 1;
export const JOINT_HEAD = 2;
export const JOINT_ARML = 3;
export const JOINT_ARMR = 4;
export const JOINT_LEGS = 5;
export const JOINT_COUNT = 6;
export const JOINT_EXTRA = 6;

export type PoseGait = "idle" | "run" | "stun";
export type PoseKind = "humanoid" | "quadruped" | "vehicle" | "static";

export type PoseRequest = {
  time: number;
  gait: PoseGait;
  swingT: number;
  swingDur: number;
  phase: number;
  hurtT?: number;
  kind?: PoseKind;
  charging?: boolean;
  jointCount?: number;
};

export type JointEuler = { x: number; y: number; z: number };

export type PoseUnit = {
  state: string;
  frozenT: number;
  charging: boolean;
  def: { body: { speed: number } };
};

/** Seeded-free gait from unit FSM. Static units never run. */
export function poseGait(u: PoseUnit): PoseGait {
  if (u.frozenT > 0 || u.state === "stunned") return "stun";
  if ((u.state === "seek" || u.charging) && u.def.body.speed > 0.05) return "run";
  return "idle";
}

/** XYZ intrinsic euler → quat. Matches the old arm-X swing when y=z=0. */
export function eulerToQuat(x: number, y: number, z: number) {
  const hx = x * 0.5;
  const hy = y * 0.5;
  const hz = z * 0.5;
  const cx = Math.cos(hx);
  const sx = Math.sin(hx);
  const cy = Math.cos(hy);
  const sy = Math.sin(hy);
  const cz = Math.cos(hz);
  const sz = Math.sin(hz);
  return {
    qx: sx * cy * cz + cx * sy * sz,
    qy: cx * sy * cz - sx * cy * sz,
    qz: cx * cy * sz + sx * sy * cz,
    qw: cx * cy * cz - sx * sy * sz,
  };
}

function zero(j: JointEuler) {
  j.x = 0;
  j.y = 0;
  j.z = 0;
}

/**
 * Tiny keyframe table. Attack uses the same swingT window as melee:
 * ang = sin((1 - swingT/dur) * π) * 1.4 on the right arm.
 */
export function poseJoints(req: PoseRequest, out: JointEuler[]): JointEuler[] {
  const n = req.jointCount ?? (req.kind === "quadruped" || req.kind === "vehicle" ? 7 : 6);
  while (out.length < n) out.push({ x: 0, y: 0, z: 0 });
  for (let i = 0; i < n; i++) zero(out[i]);

  const t = req.time + req.phase;
  if (n === 4) return poseLod4(req, out, t);
  if (req.kind === "quadruped") return poseQuad(req, out, t, n);
  if (req.kind === "vehicle") return poseVehicle(req, out, t, n);
  if (req.kind === "static") return poseStatic(req, out, t);

  if (req.gait === "run") {
    const a = Math.sin(t * 8.4);
    const b = Math.cos(t * 8.4);
    out[JOINT_LEGS].x = a * 0.55;
    out[JOINT_ARML].x = a * 0.48;
    out[JOINT_ARMR].x = -a * 0.48;
    out[JOINT_TORSO].y = a * 0.1;
    out[JOINT_TORSO].z = b * 0.07;
    out[JOINT_HEAD].y = -a * 0.08;
    out[JOINT_HEAD].x = 0.04;
  } else if (req.gait === "stun") {
    const a = Math.sin(t * 3.1);
    out[JOINT_TORSO].x = 0.32 + a * 0.05;
    out[JOINT_TORSO].z = a * 0.08;
    out[JOINT_HEAD].x = 0.22;
    out[JOINT_ARML].x = 0.35;
    out[JOINT_ARMR].x = 0.35;
    out[JOINT_LEGS].x = 0.12;
  } else {
    const a = Math.sin(t * 2.2);
    const b = Math.sin(t * 1.3);
    out[JOINT_TORSO].z = a * 0.07;
    out[JOINT_TORSO].y = b * 0.05;
    out[JOINT_HEAD].z = Math.sin(t * 2.2 + 0.4) * 0.1;
    out[JOINT_ARML].x = a * 0.08;
    out[JOINT_ARMR].x = -a * 0.08;
    out[JOINT_LEGS].x = b * 0.03;
  }

  if (req.hurtT && req.hurtT > 0) {
    out[JOINT_TORSO].x += 0.18;
    out[JOINT_HEAD].x += 0.1;
  }

  if (req.swingT > 0 && req.swingDur > 0) {
    const u = Math.max(0, Math.min(1, 1 - req.swingT / req.swingDur));
    const ang = Math.sin(u * Math.PI) * 1.4;
    out[JOINT_ARMR].x = ang;
    out[JOINT_TORSO].y += Math.sin(u * Math.PI) * 0.22;
    out[JOINT_ARML].x -= ang * 0.12;
  }

  return out;
}

/** 4-body LOD: 0 pelvis, 1 head, 2 arms, 3 legs. */
function poseLod4(req: PoseRequest, out: JointEuler[], t: number): JointEuler[] {
  const a = Math.sin(t * (req.gait === "run" ? 8.4 : 2.2));
  out[1].y = -a * 0.08;
  out[2].x = a * (req.gait === "run" ? 0.4 : 0.08);
  out[3].x = a * (req.gait === "run" ? 0.5 : 0.04);
  if (req.gait === "stun") {
    out[0].x = 0.2;
    out[1].x = 0.22;
    out[2].x = 0.3;
  }
  if (req.swingT > 0 && req.swingDur > 0) {
    const u = Math.max(0, Math.min(1, 1 - req.swingT / req.swingDur));
    out[2].x = Math.sin(u * Math.PI) * 1.2;
  }
  return out;
}

function poseQuad(req: PoseRequest, out: JointEuler[], t: number, n: number): JointEuler[] {
  const rate = req.charging ? 10.2 : req.gait === "run" ? 7.2 : 2.4;
  const amp = req.gait === "stun" ? 0.08 : req.gait === "run" ? 0.48 : 0.12;
  const a = Math.sin(t * rate);
  // Trot: FL+BR vs FR+BL.
  out[JOINT_ARML].x = a * amp;
  out[JOINT_ARMR].x = -a * amp;
  out[JOINT_LEGS].x = -a * amp;
  if (n > JOINT_EXTRA) out[JOINT_EXTRA].x = a * amp;
  out[JOINT_TORSO].x = Math.abs(a) * (req.gait === "run" ? 0.08 : 0.03);
  out[JOINT_HEAD].x = a * 0.14;
  if (req.gait === "stun") {
    out[JOINT_TORSO].x = 0.22;
    out[JOINT_HEAD].x = 0.28;
  }
  if (req.hurtT && req.hurtT > 0) out[JOINT_TORSO].x += 0.12;
  return out;
}

function poseVehicle(req: PoseRequest, out: JointEuler[], t: number, n: number): JointEuler[] {
  const spin = req.gait === "run" || req.charging ? t * (req.charging ? 9 : 5.5) : t * 0.4;
  out[JOINT_ARML].x = spin;
  out[JOINT_ARMR].x = spin;
  out[JOINT_LEGS].x = spin;
  if (n > JOINT_EXTRA) out[JOINT_EXTRA].x = spin;
  out[JOINT_TORSO].z = Math.sin(t * 3.4) * (req.gait === "run" ? 0.05 : 0.02);
  out[JOINT_HEAD].x = req.gait === "stun" ? 0.18 : Math.sin(t * 2.1) * 0.04;
  if (req.hurtT && req.hurtT > 0) out[JOINT_TORSO].x += 0.1;
  return out;
}

function poseStatic(req: PoseRequest, out: JointEuler[], t: number): JointEuler[] {
  out[JOINT_TORSO].x = Math.sin(t * 1.1) * 0.03;
  out[JOINT_HEAD].x = Math.sin(t * 1.1 + 0.4) * 0.02;
  if (req.swingT > 0 && req.swingDur > 0) {
    const u = Math.max(0, Math.min(1, 1 - req.swingT / req.swingDur));
    out[JOINT_TORSO].x = -Math.sin(u * Math.PI) * 0.5;
    out[JOINT_HEAD].x = -Math.sin(u * Math.PI) * 0.2;
  }
  if (req.hurtT && req.hurtT > 0) out[JOINT_TORSO].x += 0.08;
  return out;
}
