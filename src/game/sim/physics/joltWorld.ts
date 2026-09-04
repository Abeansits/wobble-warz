import type { UnitDef } from "@/game/data/types";
import { yawOffset } from "../facing";
import {
  JOINT_COUNT,
  eulerToQuat,
  poseJoints,
  type JointEuler,
  type PoseRequest,
} from "../poses";
import {
  BONE_ALIASES,
  skeletonLayout,
  type SkelLayout,
  type SkelPart,
  type TwistAxis,
} from "./skeletons";

export type JoltModule = Awaited<ReturnType<(typeof import("jolt-physics"))["default"]>>;

export const LAYER_STATIC = 0;
export const LAYER_MOVING = 1;
export const LAYER_PHASE = 2;

export type BodyHandle = number;

export type TransformSnap = {
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
};

export type RagdollPartName = string;

export type BuiltRagdoll = {
  ragdoll: InstanceType<JoltModule["Ragdoll"]>;
  settings: InstanceType<JoltModule["RagdollSettings"]>;
  pose: InstanceType<JoltModule["SkeletonPose"]>;
  bodyIds: Record<string, BodyHandle>;
  orderedIds: BodyHandle[];
  rootBody: BodyHandle;
  pelvisSpring: InstanceType<JoltModule["Constraint"]>;
  springFreq: number;
  swingTorque: number;
  twistTorque: number;
  alive: boolean;
  kind: UnitDef["body"]["kind"];
};

export type { PoseRequest };

/** Weak motors: poses are suggestions so the ragdoll still wobbles. */
const POSE_MOTOR_FREQ = 2.8;
const POSE_MOTOR_DAMP = 1.15;
const POSE_SWING_TORQUE = 9;
const POSE_TWIST_TORQUE = 6;
const LAUNCH_SPRING_FREQ = 1.15;
const LAUNCH_MOTOR_TORQUE = 0.35;

/**
 * Thin Jolt adapter. Temporary `new Jolt.*` objects are destroyed after use;
 * ragdolls / shapes / the interface are released in dispose().
 */
export class JoltWorld {
  Jolt!: JoltModule;
  jolt!: InstanceType<JoltModule["JoltInterface"]>;
  system!: InstanceType<JoltModule["PhysicsSystem"]>;
  bodyInterface!: InstanceType<JoltModule["BodyInterface"]>;
  private temps: object[] = [];
  private ownedShapes: object[] = [];
  private ownedRagdolls: BuiltRagdoll[] = [];
  private arenaHandles: BodyHandle[] = [];
  private capturingArena = false;
  private vec3!: InstanceType<JoltModule["Vec3"]>;
  private rvec3!: InstanceType<JoltModule["RVec3"]>;
  private quat!: InstanceType<JoltModule["Quat"]>;
  private poseScratch: JointEuler[] = Array.from({ length: JOINT_COUNT + 2 }, () => ({ x: 0, y: 0, z: 0 }));

  async init() {
    const initJolt = (await import("jolt-physics")).default;
    const Jolt = await initJolt();
    this.Jolt = Jolt;

    const settings = new Jolt.JoltSettings();
    settings.mMaxWorkerThreads = 0;

    const objectFilter = new Jolt.ObjectLayerPairFilterTable(3);
    objectFilter.EnableCollision(LAYER_STATIC, LAYER_MOVING);
    objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING);
    objectFilter.EnableCollision(LAYER_STATIC, LAYER_PHASE);

    const bpStatic = new Jolt.BroadPhaseLayer(0);
    const bpMoving = new Jolt.BroadPhaseLayer(1);
    const bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(3, 2);
    bpInterface.MapObjectToBroadPhaseLayer(LAYER_STATIC, bpStatic);
    bpInterface.MapObjectToBroadPhaseLayer(LAYER_MOVING, bpMoving);
    bpInterface.MapObjectToBroadPhaseLayer(LAYER_PHASE, bpMoving);

    settings.mObjectLayerPairFilter = objectFilter;
    settings.mBroadPhaseLayerInterface = bpInterface;
    settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(
      bpInterface,
      2,
      objectFilter,
      3,
    );

    this.jolt = new Jolt.JoltInterface(settings);
    Jolt.destroy(settings);

    this.system = this.jolt.GetPhysicsSystem();
    this.bodyInterface = this.system.GetBodyInterface();

    const gravity = new Jolt.Vec3(0, -11, 0);
    this.system.SetGravity(gravity);
    Jolt.destroy(gravity);

    this.vec3 = new Jolt.Vec3(0, 0, 0);
    this.rvec3 = new Jolt.RVec3(0, 0, 0);
    this.quat = new Jolt.Quat(0, 0, 0, 1);
    this.temps.push(this.vec3, this.rvec3, this.quat);
  }

  v(x: number, y: number, z: number) {
    this.vec3.Set(x, y, z);
    return this.vec3;
  }

  rv(x: number, y: number, z: number) {
    this.rvec3.Set(x, y, z);
    return this.rvec3;
  }

  qid() {
    this.quat.Set(0, 0, 0, 1);
    return this.quat;
  }

  qYaw(yaw: number) {
    const half = yaw * 0.5;
    this.quat.Set(0, Math.sin(half), 0, Math.cos(half));
    return this.quat;
  }

  qRollZ(roll: number) {
    const half = roll * 0.5;
    this.quat.Set(0, 0, Math.sin(half), Math.cos(half));
    return this.quat;
  }

  private wrapId(handle: BodyHandle) {
    return new this.Jolt.BodyID(handle);
  }

  createStaticBox(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, yaw = 0, friction = 0.8, rotZ = 0) {
    const Jolt = this.Jolt;
    const half = new Jolt.Vec3(hx, hy, hz);
    const shape = new Jolt.BoxShape(half, 0.04);
    Jolt.destroy(half);
    const settings = new Jolt.BodyCreationSettings(
      shape,
      this.rv(cx, cy, cz),
      rotZ ? this.qRollZ(rotZ) : this.qYaw(yaw),
      Jolt.EMotionType_Static,
      LAYER_STATIC,
    );
    settings.mFriction = friction;
    const body = this.bodyInterface.CreateBody(settings);
    Jolt.destroy(settings);
    this.bodyInterface.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
    this.ownedShapes.push(shape);
    const handle = body.GetID().GetIndexAndSequenceNumber();
    this.remember(handle);
    return handle;
  }

  createStaticSphere(x: number, y: number, z: number, r: number, restitution = 0) {
    const Jolt = this.Jolt;
    const shape = new Jolt.SphereShape(r);
    const settings = new Jolt.BodyCreationSettings(
      shape,
      this.rv(x, y, z),
      this.qid(),
      Jolt.EMotionType_Static,
      LAYER_STATIC,
    );
    settings.mRestitution = restitution;
    settings.mFriction = 0.2;
    const body = this.bodyInterface.CreateBody(settings);
    Jolt.destroy(settings);
    this.bodyInterface.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
    this.ownedShapes.push(shape);
    const handle = body.GetID().GetIndexAndSequenceNumber();
    this.remember(handle);
    return handle;
  }

  createKinematicCapsule(x: number, y: number, z: number, halfHeight: number, radius: number, layer = LAYER_MOVING) {
    const Jolt = this.Jolt;
    const shape = new Jolt.CapsuleShape(halfHeight, radius);
    const settings = new Jolt.BodyCreationSettings(
      shape,
      this.rv(x, y, z),
      this.qid(),
      Jolt.EMotionType_Kinematic,
      layer,
    );
    settings.mFriction = 0.8;
    const body = this.bodyInterface.CreateBody(settings);
    Jolt.destroy(settings);
    this.bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate);
    this.ownedShapes.push(shape);
    return body.GetID().GetIndexAndSequenceNumber();
  }

  createDynamicSphere(
    x: number,
    y: number,
    z: number,
    r: number,
    mass: number,
    opts?: { restitution?: number; friction?: number },
  ) {
    const Jolt = this.Jolt;
    const shape = new Jolt.SphereShape(r);
    const settings = new Jolt.BodyCreationSettings(
      shape,
      this.rv(x, y, z),
      this.qid(),
      Jolt.EMotionType_Dynamic,
      LAYER_MOVING,
    );
    settings.mFriction = opts?.friction ?? 0.4;
    settings.mRestitution = opts?.restitution ?? 0.12;
    settings.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
    settings.mMassPropertiesOverride.mMass = Math.max(0.2, mass);
    const body = this.bodyInterface.CreateBody(settings);
    Jolt.destroy(settings);
    this.bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate);
    this.ownedShapes.push(shape);
    const handle = body.GetID().GetIndexAndSequenceNumber();
    this.remember(handle);
    return handle;
  }

  setLinearVelocity(handle: BodyHandle, vx: number, vy: number, vz: number) {
    const id = this.wrapId(handle);
    this.bodyInterface.SetLinearVelocity(id, this.v(vx, vy, vz));
    this.Jolt.destroy(id);
  }

  createHumanoid(def: UnitDef, x: number, y: number, z: number, yaw: number, groupId: number, layer = LAYER_MOVING): BuiltRagdoll {
    return this.createUnit(def, x, y, z, yaw, groupId, layer);
  }

  createUnit(def: UnitDef, x: number, y: number, z: number, yaw: number, groupId: number, layer = LAYER_MOVING): BuiltRagdoll {
    const layout = skeletonLayout(def.body.kind);
    return this.createFromLayout(def, layout, x, y, z, yaw, groupId, layer);
  }

  private createFromLayout(
    def: UnitDef,
    layout: SkelLayout,
    x: number,
    y: number,
    z: number,
    yaw: number,
    groupId: number,
    layer: number,
  ): BuiltRagdoll {
    const Jolt = this.Jolt;
    const s = def.body.scale;
    const mass = 12 * def.body.massMult * s * s * s;
    const parts = layout.parts;

    const skeleton = new Jolt.Skeleton();
    const strs = parts.map((part) => new Jolt.JPHString(part.name, part.name.length));
    for (let i = 0; i < parts.length; i++) skeleton.AddJoint(strs[i], parts[i].parent);
    for (const n of strs) Jolt.destroy(n);

    const ident = Jolt.Quat.prototype.sIdentity();
    const axisY = Jolt.Vec3.prototype.sAxisY();
    const axisX = Jolt.Vec3.prototype.sAxisX();
    const axisZ = Jolt.Vec3.prototype.sAxisZ();
    const minusX = new Jolt.Vec3(-1, 0, 0);
    const minusY = new Jolt.Vec3(0, -1, 0);
    const twistVec = (a: TwistAxis) =>
      a === "x" ? axisX : a === "-x" ? minusX : a === "-y" ? minusY : a === "z" ? axisZ : axisY;

    const shapes = parts.map((part) => this.makeSkelShape(part, s));
    const positions = parts.map((part) => {
      const lx = part.pos[0] * s;
      const ly = part.pos[1] * s;
      const lz = part.pos[2] * s;
      if (layout.orient) {
        const o = yawOffset(lx, lz, yaw);
        return new Jolt.RVec3(x + o.x, y + ly, z + o.z);
      }
      return new Jolt.RVec3(x + lx, y + ly, z + lz);
    });
    const rotations = parts.map((part) => {
      if (layout.orient && part.orient) {
        const half = yaw * 0.5;
        return new Jolt.Quat(0, Math.sin(half), 0, Math.cos(half));
      }
      return ident;
    });
    const constraintPos = parts.map((part) => {
      const lx = part.joint[0] * s;
      const ly = part.joint[1] * s;
      const lz = part.joint[2] * s;
      if (layout.orient) {
        const o = yawOffset(lx, lz, yaw);
        return new Jolt.RVec3(x + o.x, y + ly, z + o.z);
      }
      return new Jolt.RVec3(x + lx, y + ly, z + lz);
    });

    const motorFreq = layout.kind === "static" ? 6.2 : POSE_MOTOR_FREQ;
    const swingTorque = layout.kind === "static" ? 22 : layout.kind === "vehicle" ? 12 : POSE_SWING_TORQUE;
    const twistTorque = layout.kind === "static" ? 14 : layout.kind === "vehicle" ? 8 : POSE_TWIST_TORQUE;
    const friction = layout.kind === "static" ? 8 : 2.4;

    const settings = new Jolt.RagdollSettings();
    settings.mSkeleton = skeleton;
    settings.mParts.resize(skeleton.GetJointCount());

    for (let i = 0; i < skeleton.GetJointCount(); i++) {
      const spec = parts[i];
      const part = settings.mParts.at(i);
      part.SetShape(shapes[i]);
      part.mPosition = positions[i];
      part.mRotation = rotations[i];
      part.mMotionType = Jolt.EMotionType_Dynamic;
      part.mObjectLayer = layer;
      part.mFriction = 0.7;
      part.mRestitution = def.id === "anomaly.jelly" ? 0.9 : 0.02;
      part.mLinearDamping = 0.35;
      part.mAngularDamping = 0.85;
      part.mGravityFactor = 0.85;
      part.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
      part.mMassPropertiesOverride.mMass = Math.max(0.5, mass * spec.massFrac);

      if (i > 0) {
        const constraint = new Jolt.SwingTwistConstraintSettings();
        constraint.mPosition1 = constraintPos[i];
        constraint.mPosition2 = constraintPos[i];
        const axis = twistVec(spec.twist);
        constraint.mTwistAxis1 = axis;
        constraint.mTwistAxis2 = axis;
        constraint.mPlaneAxis1 = axisZ;
        constraint.mPlaneAxis2 = axisZ;
        const deg = (d: number) => (d * Math.PI) / 180;
        constraint.mTwistMinAngle = -deg(spec.twistDeg);
        constraint.mTwistMaxAngle = deg(spec.twistDeg);
        constraint.mNormalHalfConeAngle = deg(spec.normalDeg);
        constraint.mPlaneHalfConeAngle = deg(spec.planeDeg);
        constraint.mMaxFrictionTorque = friction;
        constraint.mSwingMotorSettings.mSpringSettings.mFrequency = motorFreq;
        constraint.mSwingMotorSettings.mSpringSettings.mDamping = POSE_MOTOR_DAMP;
        constraint.mSwingMotorSettings.mMinTorqueLimit = -swingTorque;
        constraint.mSwingMotorSettings.mMaxTorqueLimit = swingTorque;
        constraint.mTwistMotorSettings.mSpringSettings.mFrequency = motorFreq;
        constraint.mTwistMotorSettings.mSpringSettings.mDamping = POSE_MOTOR_DAMP;
        constraint.mTwistMotorSettings.mMinTorqueLimit = -twistTorque;
        constraint.mTwistMotorSettings.mMaxTorqueLimit = twistTorque;
        part.mToParent = constraint;
      }
    }

    settings.Stabilize();
    settings.DisableParentChildCollisions();

    const ragdoll = settings.CreateRagdoll(groupId, 0, this.system);
    ragdoll.AddToPhysicsSystem(Jolt.EActivation_Activate);

    const pose = new Jolt.SkeletonPose();
    pose.SetSkeleton(skeleton);
    ragdoll.GetPose(pose);
    pose.CalculateJointMatrices();

    const orderedIds: BodyHandle[] = [];
    const bodyIds: Record<string, BodyHandle> = {};
    for (let i = 0; i < ragdoll.GetBodyCount(); i++) {
      const id = ragdoll.GetBodyID(i).GetIndexAndSequenceNumber();
      orderedIds.push(id);
      const name = parts[i]?.name ?? `part${i}`;
      bodyIds[name] = id;
      for (const alias of BONE_ALIASES[name] ?? []) bodyIds[alias] = id;
    }

    const lift = layout.rootLift * s;
    const rootBody = this.createKinematicCapsule(x, y + lift, z, layout.rootHalf * s, layout.rootRadius * s, layer);
    this.setRotation(rootBody, yaw);

    const springFreq = Math.max(8, def.body.springStiffness * 0.7);
    const springSettings = new Jolt.DistanceConstraintSettings();
    springSettings.mSpace = Jolt.EConstraintSpace_WorldSpace;
    springSettings.mPoint1 = this.rv(x, y + lift, z);
    springSettings.mPoint2 = this.rv(x, y + lift, z);
    springSettings.mMinDistance = 0.02;
    springSettings.mMaxDistance = layout.springSlack * s;
    springSettings.mLimitsSpringSettings.mFrequency = springFreq;
    springSettings.mLimitsSpringSettings.mDamping = 0.55;

    const rootId = this.wrapId(rootBody);
    const pelvisId = this.wrapId(bodyIds.pelvis);
    const constraint = this.bodyInterface.CreateConstraint(springSettings, rootId, pelvisId);
    this.system.AddConstraint(constraint);
    Jolt.destroy(springSettings);
    Jolt.destroy(rootId);
    Jolt.destroy(pelvisId);

    const built: BuiltRagdoll = {
      ragdoll,
      settings,
      pose,
      bodyIds,
      orderedIds,
      rootBody,
      pelvisSpring: constraint,
      springFreq,
      swingTorque,
      twistTorque,
      alive: true,
      kind: layout.kind,
    };
    this.ownedRagdolls.push(built);
    return built;
  }

  private makeSkelShape(part: SkelPart, s: number) {
    const Jolt = this.Jolt;
    if (part.shape === "sphere") return new Jolt.SphereShape(Math.max(0.04, part.size[0] * s));
    if (part.shape === "box") {
      const half = new Jolt.Vec3(Math.max(0.04, part.size[0] * s), Math.max(0.04, part.size[1] * s), Math.max(0.04, part.size[2] * s));
      const shape = new Jolt.BoxShape(half, 0.04);
      Jolt.destroy(half);
      return shape;
    }
    return new Jolt.CapsuleShape(Math.max(0.04, part.size[0] * s), Math.max(0.04, part.size[1] * s));
  }

  setPosition(handle: BodyHandle, x: number, y: number, z: number, activate = true) {
    const id = this.wrapId(handle);
    this.bodyInterface.SetPosition(
      id,
      this.rv(x, y, z),
      activate ? this.Jolt.EActivation_Activate : this.Jolt.EActivation_DontActivate,
    );
    this.Jolt.destroy(id);
  }

  setRotation(handle: BodyHandle, yaw: number) {
    const id = this.wrapId(handle);
    this.bodyInterface.SetRotation(id, this.qYaw(yaw), this.Jolt.EActivation_Activate);
    this.Jolt.destroy(id);
  }

  holdUpright(handle: BodyHandle, yaw: number) {
    try {
      const id = this.wrapId(handle);
      this.bodyInterface.SetRotation(id, this.qYaw(yaw), this.Jolt.EActivation_DontActivate);
      this.bodyInterface.SetAngularVelocity(id, this.v(0, 0, 0));
      this.Jolt.destroy(id);
    } catch {
      /* body already gone */
    }
  }

  destroyRagdoll(built: BuiltRagdoll) {
    if (!built.alive) return;
    built.alive = false;
    const Jolt = this.Jolt;
    try {
      this.system.RemoveConstraint(built.pelvisSpring);
    } catch {
      /* RemoveConstraint Releases the constraint — do not Jolt.destroy it */
    }
    // Pose before ragdoll: ragdoll dtor DestroyBodies; pose is independent.
    try {
      Jolt.destroy(built.pose);
    } catch {
      /* */
    }
    try {
      built.ragdoll.RemoveFromPhysicsSystem();
    } catch {
      /* */
    }
    try {
      Jolt.destroy(built.ragdoll);
    } catch {
      /* */
    }
    if (this.isAdded(built.rootBody)) this.removeBody(built.rootBody);
    this.ownedRagdolls = this.ownedRagdolls.filter((r) => r !== built);
  }

  moveKinematic(handle: BodyHandle, x: number, y: number, z: number, yaw: number, dt: number) {
    const id = this.wrapId(handle);
    this.bodyInterface.MoveKinematic(id, this.rv(x, y, z), this.qYaw(yaw), dt);
    this.Jolt.destroy(id);
  }

  getTransform(handle: BodyHandle, out: TransformSnap) {
    try {
      const id = this.wrapId(handle);
      this.bodyInterface.GetPositionAndRotation(id, this.rvec3, this.quat);
      out.x = this.rvec3.GetX();
      out.y = this.rvec3.GetY();
      out.z = this.rvec3.GetZ();
      out.qx = this.quat.GetX();
      out.qy = this.quat.GetY();
      out.qz = this.quat.GetZ();
      out.qw = this.quat.GetW();
      this.Jolt.destroy(id);
    } catch {
      return;
    }
    if (!Number.isFinite(out.x) || !Number.isFinite(out.qw)) {
      out.x = 0;
      out.y = 1;
      out.z = 0;
      out.qx = 0;
      out.qy = 0;
      out.qz = 0;
      out.qw = 1;
    }
  }

  applyImpulse(handle: BodyHandle, ix: number, iy: number, iz: number) {
    const id = this.wrapId(handle);
    this.bodyInterface.AddImpulse(id, this.v(ix, iy, iz));
    this.Jolt.destroy(id);
  }

  removeBody(handle: BodyHandle) {
    const id = this.wrapId(handle);
    try {
      if (this.bodyInterface.IsAdded(id)) this.bodyInterface.RemoveBody(id);
      this.bodyInterface.DestroyBody(id);
    } catch {
      /* already gone */
    }
    this.Jolt.destroy(id);
  }

  private remember(handle: BodyHandle) {
    if (this.capturingArena) this.arenaHandles.push(handle);
  }

  beginArena() {
    this.clearArena();
    this.capturingArena = true;
  }

  endArena() {
    this.capturingArena = false;
  }

  clearArena() {
    for (const h of this.arenaHandles) {
      try {
        this.removeBody(h);
      } catch {
        /* */
      }
    }
    this.arenaHandles = [];
  }

  isAdded(handle: BodyHandle) {
    try {
      const id = this.wrapId(handle);
      const ok = this.bodyInterface.IsAdded(id);
      this.Jolt.destroy(id);
      return ok;
    } catch {
      return false;
    }
  }

  setActive(handle: BodyHandle, on: boolean) {
    if (!this.isAdded(handle)) return;
    const id = this.wrapId(handle);
    try {
      if (on) this.bodyInterface.ActivateBody(id);
      else this.bodyInterface.DeactivateBody(id);
    } catch {
      /* */
    }
    this.Jolt.destroy(id);
  }

  freezeBody(handle: BodyHandle) {
    if (!this.isAdded(handle)) return;
    const id = this.wrapId(handle);
    try {
      this.bodyInterface.SetMotionType(id, this.Jolt.EMotionType_Static, this.Jolt.EActivation_DontActivate);
    } catch {
      /* */
    }
    this.Jolt.destroy(id);
  }

  speedOf(handle: BodyHandle) {
    if (!this.isAdded(handle)) return 0;
    try {
      const id = this.wrapId(handle);
      const vel = this.bodyInterface.GetLinearVelocity(id);
      const s = Math.hypot(vel.GetX(), vel.GetY(), vel.GetZ());
      this.Jolt.destroy(id);
      return s;
    } catch {
      return 0;
    }
  }

  createDistanceSpring(a: BodyHandle, b: BodyHandle, min: number, max: number, freq: number) {
    const Jolt = this.Jolt;
    const ta: TransformSnap = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
    const tb: TransformSnap = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
    this.getTransform(a, ta);
    this.getTransform(b, tb);
    const settings = new Jolt.DistanceConstraintSettings();
    settings.mSpace = Jolt.EConstraintSpace_WorldSpace;
    const p1 = new Jolt.RVec3(ta.x, ta.y, ta.z);
    const p2 = new Jolt.RVec3(tb.x, tb.y, tb.z);
    settings.mPoint1 = p1;
    settings.mPoint2 = p2;
    settings.mMinDistance = min;
    settings.mMaxDistance = max;
    settings.mLimitsSpringSettings.mFrequency = freq;
    settings.mLimitsSpringSettings.mDamping = 0.4;
    const idA = this.wrapId(a);
    const idB = this.wrapId(b);
    const constraint = this.bodyInterface.CreateConstraint(settings, idA, idB);
    this.system.AddConstraint(constraint);
    Jolt.destroy(settings);
    Jolt.destroy(idA);
    Jolt.destroy(idB);
    Jolt.destroy(p1);
    Jolt.destroy(p2);
    return constraint;
  }

  dropConstraint(constraint: InstanceType<JoltModule["Constraint"]>) {
    try {
      this.system.RemoveConstraint(constraint);
    } catch {
      /* */
    }
    // RemoveConstraint already Releases. Jolt.destroy here wasm-aborts (refcount).
  }

  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): { handle: BodyHandle; fraction: number } | null {
    const Jolt = this.Jolt;
    try {
      const ray = new Jolt.RRayCast();
      ray.mOrigin.Set(ox, oy, oz);
      ray.mDirection.Set(dx, dy, dz);
      const settings = new Jolt.RayCastSettings();
      const collector = new Jolt.CastRayClosestHitCollisionCollector();
      const bp = new Jolt.BroadPhaseLayerFilter();
      const obj = new Jolt.ObjectLayerFilter();
      const body = new Jolt.BodyFilter();
      const shape = new Jolt.ShapeFilter();
      this.system.GetNarrowPhaseQuery().CastRay(ray, settings, collector, bp, obj, body, shape);
      let result: { handle: BodyHandle; fraction: number } | null = null;
      if (collector.HadHit() && collector.mHit.mFraction < 0.999) {
        result = {
          handle: collector.mHit.mBodyID.GetIndexAndSequenceNumber(),
          fraction: collector.mHit.mFraction,
        };
      }
      Jolt.destroy(ray);
      Jolt.destroy(settings);
      Jolt.destroy(collector);
      Jolt.destroy(bp);
      Jolt.destroy(obj);
      Jolt.destroy(body);
      Jolt.destroy(shape);
      return result;
    } catch {
      return null;
    }
  }

  drivePose(built: BuiltRagdoll, req?: PoseRequest) {
    if (!built.alive) return;
    if (req) {
      const filled = { ...req, kind: req.kind ?? built.kind, jointCount: req.jointCount ?? built.pose.GetJointCount() };
      this.writePose(built, poseJoints(filled, this.poseScratch));
    }
    built.ragdoll.DriveToPoseUsingMotors(built.pose);
  }

  writePose(built: BuiltRagdoll, joints: JointEuler[]) {
    const n = Math.min(built.pose.GetJointCount(), joints.length);
    for (let i = 0; i < n; i++) {
      const q = eulerToQuat(joints[i].x, joints[i].y, joints[i].z);
      built.pose.GetJoint(i).mRotation.Set(q.qx, q.qy, q.qz, q.qw);
    }
    built.pose.CalculateJointMatrices();
  }

  beginLaunch(built: BuiltRagdoll) {
    if (!built.alive) return;
    this.setSpringEnabled(built, false);
    this.setSpringFreq(built, LAUNCH_SPRING_FREQ);
    this.setMotorTorque(built, LAUNCH_MOTOR_TORQUE, true);
  }

  endLaunch(built: BuiltRagdoll) {
    if (!built.alive) return;
    this.setSpringFreq(built, built.springFreq);
    this.setSpringEnabled(built, true);
    this.setMotorTorque(built, built.swingTorque, false);
  }

  private setSpringEnabled(built: BuiltRagdoll, on: boolean) {
    try {
      built.pelvisSpring.SetEnabled(on);
    } catch {
      /* constraint already released */
    }
  }

  private setSpringFreq(built: BuiltRagdoll, freq: number) {
    try {
      const d = this.Jolt.castObject(built.pelvisSpring, this.Jolt.DistanceConstraint);
      const s = d.GetLimitsSpringSettings();
      s.mFrequency = freq;
      d.SetLimitsSpringSettings(s);
    } catch {
      /* */
    }
  }

  private setMotorTorque(built: BuiltRagdoll, swingTorque: number, motorsOff: boolean) {
    const Jolt = this.Jolt;
    const twistScale = built.swingTorque > 0 ? built.twistTorque / built.swingTorque : 0.7;
    const twistTorque = swingTorque * twistScale;
    try {
      const n = built.ragdoll.GetConstraintCount();
      for (let i = 0; i < n; i++) {
        const c = Jolt.castObject(built.ragdoll.GetConstraint(i), Jolt.SwingTwistConstraint);
        const swing = c.GetSwingMotorSettings();
        swing.mMinTorqueLimit = -swingTorque;
        swing.mMaxTorqueLimit = swingTorque;
        const twist = c.GetTwistMotorSettings();
        twist.mMinTorqueLimit = -twistTorque;
        twist.mMaxTorqueLimit = twistTorque;
        if (motorsOff) {
          c.SetSwingMotorState(Jolt.EMotorState_Off);
          c.SetTwistMotorState(Jolt.EMotorState_Off);
        }
      }
    } catch {
      /* ragdoll already gone */
    }
  }

  step(dt: number) {
    this.jolt.Step(dt, 1);
  }

  sampleHeap(): number {
    return this.Jolt.HEAP8.buffer.byteLength;
  }

  dispose() {
    const Jolt = this.Jolt;
    for (const r of this.ownedRagdolls) {
      r.alive = false;
      try {
        this.system.RemoveConstraint(r.pelvisSpring);
      } catch {
        /* RemoveConstraint Releases — do not destroy */
      }
      try {
        Jolt.destroy(r.pose);
      } catch {
        /* */
      }
      try {
        r.ragdoll.RemoveFromPhysicsSystem();
      } catch {
        /* */
      }
      try {
        Jolt.destroy(r.ragdoll);
      } catch {
        /* */
      }
      try {
        if (this.isAdded(r.rootBody)) this.removeBody(r.rootBody);
      } catch {
        /* */
      }
    }
    this.ownedRagdolls = [];
    for (const t of this.temps) {
      try {
        Jolt.destroy(t);
      } catch {
        /* */
      }
    }
    this.temps = [];
    if (this.jolt) Jolt.destroy(this.jolt);
  }
}
