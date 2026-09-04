import type { UnitDef } from "@/game/data/types";

export type JoltModule = Awaited<ReturnType<(typeof import("jolt-physics"))["default"]>>;

const LAYER_STATIC = 0;
const LAYER_MOVING = 1;

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

const PART_NAMES = ["pelvis", "torso", "head", "armL", "armR", "legs"] as const;
export type RagdollPartName = (typeof PART_NAMES)[number];

export type BuiltRagdoll = {
  ragdoll: InstanceType<JoltModule["Ragdoll"]>;
  settings: InstanceType<JoltModule["RagdollSettings"]>;
  pose: InstanceType<JoltModule["SkeletonPose"]>;
  bodyIds: Record<RagdollPartName, BodyHandle>;
  orderedIds: BodyHandle[];
  rootBody: BodyHandle;
  pelvisSpring: InstanceType<JoltModule["Constraint"]>;
};

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
  private vec3!: InstanceType<JoltModule["Vec3"]>;
  private rvec3!: InstanceType<JoltModule["RVec3"]>;
  private quat!: InstanceType<JoltModule["Quat"]>;

  async init() {
    const initJolt = (await import("jolt-physics")).default;
    const Jolt = await initJolt();
    this.Jolt = Jolt;

    const settings = new Jolt.JoltSettings();
    settings.mMaxWorkerThreads = 0;

    const objectFilter = new Jolt.ObjectLayerPairFilterTable(2);
    objectFilter.EnableCollision(LAYER_STATIC, LAYER_MOVING);
    objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING);

    const bpStatic = new Jolt.BroadPhaseLayer(0);
    const bpMoving = new Jolt.BroadPhaseLayer(1);
    const bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(2, 2);
    bpInterface.MapObjectToBroadPhaseLayer(LAYER_STATIC, bpStatic);
    bpInterface.MapObjectToBroadPhaseLayer(LAYER_MOVING, bpMoving);

    settings.mObjectLayerPairFilter = objectFilter;
    settings.mBroadPhaseLayerInterface = bpInterface;
    settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(
      bpInterface,
      2,
      objectFilter,
      2,
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

  private wrapId(handle: BodyHandle) {
    return new this.Jolt.BodyID(handle);
  }

  createStaticBox(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, yaw = 0) {
    const Jolt = this.Jolt;
    const half = new Jolt.Vec3(hx, hy, hz);
    const shape = new Jolt.BoxShape(half, 0.04);
    Jolt.destroy(half);
    const settings = new Jolt.BodyCreationSettings(
      shape,
      this.rv(cx, cy, cz),
      this.qYaw(yaw),
      Jolt.EMotionType_Static,
      LAYER_STATIC,
    );
    const body = this.bodyInterface.CreateBody(settings);
    Jolt.destroy(settings);
    this.bodyInterface.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
    this.ownedShapes.push(shape);
    return body.GetID().GetIndexAndSequenceNumber();
  }

  createStaticSphere(x: number, y: number, z: number, r: number) {
    const Jolt = this.Jolt;
    const shape = new Jolt.SphereShape(r);
    const settings = new Jolt.BodyCreationSettings(
      shape,
      this.rv(x, y, z),
      this.qid(),
      Jolt.EMotionType_Static,
      LAYER_STATIC,
    );
    const body = this.bodyInterface.CreateBody(settings);
    Jolt.destroy(settings);
    this.bodyInterface.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
    this.ownedShapes.push(shape);
    return body.GetID().GetIndexAndSequenceNumber();
  }

  createKinematicCapsule(x: number, y: number, z: number, halfHeight: number, radius: number) {
    const Jolt = this.Jolt;
    const shape = new Jolt.CapsuleShape(halfHeight, radius);
    const settings = new Jolt.BodyCreationSettings(
      shape,
      this.rv(x, y, z),
      this.qid(),
      Jolt.EMotionType_Kinematic,
      LAYER_MOVING,
    );
    settings.mFriction = 0.8;
    const body = this.bodyInterface.CreateBody(settings);
    Jolt.destroy(settings);
    this.bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate);
    this.ownedShapes.push(shape);
    return body.GetID().GetIndexAndSequenceNumber();
  }

  createDynamicSphere(x: number, y: number, z: number, r: number, mass: number) {
    const Jolt = this.Jolt;
    const shape = new Jolt.SphereShape(r);
    const settings = new Jolt.BodyCreationSettings(
      shape,
      this.rv(x, y, z),
      this.qid(),
      Jolt.EMotionType_Dynamic,
      LAYER_MOVING,
    );
    settings.mFriction = 0.4;
    settings.mRestitution = 0.12;
    settings.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
    settings.mMassPropertiesOverride.mMass = Math.max(0.2, mass);
    const body = this.bodyInterface.CreateBody(settings);
    Jolt.destroy(settings);
    this.bodyInterface.AddBody(body.GetID(), Jolt.EActivation_Activate);
    this.ownedShapes.push(shape);
    return body.GetID().GetIndexAndSequenceNumber();
  }

  setLinearVelocity(handle: BodyHandle, vx: number, vy: number, vz: number) {
    const id = this.wrapId(handle);
    this.bodyInterface.SetLinearVelocity(id, this.v(vx, vy, vz));
    this.Jolt.destroy(id);
  }

  createHumanoid(def: UnitDef, x: number, y: number, z: number, yaw: number, groupId: number): BuiltRagdoll {
    const Jolt = this.Jolt;
    const s = def.body.scale;
    const mass = 12 * def.body.massMult * s * s * s;

    const skeleton = new Jolt.Skeleton();
    const strs = ["pelvis", "torso", "head", "armL", "armR", "legs"].map(
      (n) => new Jolt.JPHString(n, n.length),
    );
    const pelvis = skeleton.AddJoint(strs[0], -1);
    const torso = skeleton.AddJoint(strs[1], pelvis);
    skeleton.AddJoint(strs[2], torso);
    skeleton.AddJoint(strs[3], torso);
    skeleton.AddJoint(strs[4], torso);
    skeleton.AddJoint(strs[5], pelvis);
    for (const n of strs) Jolt.destroy(n);

    const ident = Jolt.Quat.prototype.sIdentity();

    // Capsules are Y-up. Keep every part identity so they stand, not lie on a side.
    const shapes = [
      new Jolt.CapsuleShape(0.08 * s, 0.13 * s),
      new Jolt.CapsuleShape(0.15 * s, 0.15 * s),
      new Jolt.SphereShape(0.15 * s),
      new Jolt.CapsuleShape(0.15 * s, 0.05 * s),
      new Jolt.CapsuleShape(0.15 * s, 0.05 * s),
      new Jolt.CapsuleShape(0.22 * s, 0.11 * s),
    ];

    const positions = [
      new Jolt.RVec3(x, y + 0.88 * s, z),
      new Jolt.RVec3(x, y + 1.22 * s, z),
      new Jolt.RVec3(x, y + 1.54 * s, z),
      new Jolt.RVec3(x - 0.28 * s, y + 1.22 * s, z),
      new Jolt.RVec3(x + 0.28 * s, y + 1.22 * s, z),
      new Jolt.RVec3(x, y + 0.42 * s, z),
    ];

    const rotations = [ident, ident, ident, ident, ident, ident];

    const constraintPos = [
      new Jolt.RVec3(0, 0, 0),
      new Jolt.RVec3(x, y + 1.05 * s, z),
      new Jolt.RVec3(x, y + 1.4 * s, z),
      new Jolt.RVec3(x - 0.16 * s, y + 1.34 * s, z),
      new Jolt.RVec3(x + 0.16 * s, y + 1.34 * s, z),
      new Jolt.RVec3(x, y + 0.68 * s, z),
    ];

    const axisY = Jolt.Vec3.prototype.sAxisY();
    const axisX = Jolt.Vec3.prototype.sAxisX();
    const axisZ = Jolt.Vec3.prototype.sAxisZ();
    const minusX = new Jolt.Vec3(-1, 0, 0);
    const minusY = new Jolt.Vec3(0, -1, 0);
    const twist = [axisY, axisY, axisY, minusX, axisX, minusY];
    const twistDeg = [0, 16, 35, 35, 35, 20];
    const normalDeg = [0, 22, 28, 55, 55, 28];
    const planeDeg = [0, 22, 28, 40, 40, 28];

    const settings = new Jolt.RagdollSettings();
    settings.mSkeleton = skeleton;
    settings.mParts.resize(skeleton.GetJointCount());

    for (let p = 0; p < skeleton.GetJointCount(); p++) {
      const part = settings.mParts.at(p);
      part.SetShape(shapes[p]);
      part.mPosition = positions[p];
      part.mRotation = rotations[p];
      part.mMotionType = Jolt.EMotionType_Dynamic;
      part.mObjectLayer = LAYER_MOVING;
      part.mFriction = 0.7;
      part.mRestitution = 0.02;
      part.mLinearDamping = 0.35;
      part.mAngularDamping = 0.85;
      part.mGravityFactor = 0.85;
      part.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
      const partMass = p === 0 ? mass * 0.28 : p === 1 ? mass * 0.32 : mass * 0.1;
      part.mMassPropertiesOverride.mMass = Math.max(0.5, partMass);

      if (p > 0) {
        const constraint = new Jolt.SwingTwistConstraintSettings();
        constraint.mPosition1 = constraintPos[p];
        constraint.mPosition2 = constraintPos[p];
        constraint.mTwistAxis1 = twist[p];
        constraint.mTwistAxis2 = twist[p];
        constraint.mPlaneAxis1 = axisZ;
        constraint.mPlaneAxis2 = axisZ;
        const deg = (d: number) => (d * Math.PI) / 180;
        constraint.mTwistMinAngle = -deg(twistDeg[p]);
        constraint.mTwistMaxAngle = deg(twistDeg[p]);
        constraint.mNormalHalfConeAngle = deg(normalDeg[p]);
        constraint.mPlaneHalfConeAngle = deg(planeDeg[p]);
        constraint.mMaxFrictionTorque = 2.4;
        constraint.mSwingMotorSettings.mSpringSettings.mFrequency = 6;
        constraint.mSwingMotorSettings.mSpringSettings.mDamping = 1.4;
        constraint.mSwingMotorSettings.mMinTorqueLimit = -28;
        constraint.mSwingMotorSettings.mMaxTorqueLimit = 28;
        constraint.mTwistMotorSettings.mSpringSettings.mFrequency = 6;
        constraint.mTwistMotorSettings.mSpringSettings.mDamping = 1.4;
        constraint.mTwistMotorSettings.mMinTorqueLimit = -20;
        constraint.mTwistMotorSettings.mMaxTorqueLimit = 20;
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
    const bodyIds = {} as Record<RagdollPartName, BodyHandle>;
    for (let i = 0; i < ragdoll.GetBodyCount(); i++) {
      const id = ragdoll.GetBodyID(i).GetIndexAndSequenceNumber();
      orderedIds.push(id);
      bodyIds[PART_NAMES[i]] = id;
    }

    const rootBody = this.createKinematicCapsule(x, y + 0.95 * s, z, 0.42 * s, 0.16 * s);
    this.setRotation(rootBody, yaw);

    const springSettings = new Jolt.DistanceConstraintSettings();
    springSettings.mSpace = Jolt.EConstraintSpace_WorldSpace;
    springSettings.mPoint1 = this.rv(x, y + 0.95 * s, z);
    springSettings.mPoint2 = this.rv(x, y + 0.95 * s, z);
    springSettings.mMinDistance = 0.02;
    springSettings.mMaxDistance = 0.12 * s;
    springSettings.mLimitsSpringSettings.mFrequency = Math.max(8, def.body.springStiffness * 0.7);
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
    };
    this.ownedRagdolls.push(built);

    for (const p of positions) Jolt.destroy(p);
    for (const p of constraintPos) Jolt.destroy(p);
    Jolt.destroy(minusX);
    Jolt.destroy(minusY);

    return built;
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
    const Jolt = this.Jolt;
    try {
      this.system.RemoveConstraint(built.pelvisSpring);
    } catch {
      /* */
    }
    try {
      Jolt.destroy(built.pelvisSpring);
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
    try {
      Jolt.destroy(built.pose);
    } catch {
      /* */
    }
    this.removeBody(built.rootBody);
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

  drivePose(built: BuiltRagdoll) {
    built.ragdoll.DriveToPoseUsingMotors(built.pose);
  }

  swingRightArm(built: BuiltRagdoll, amount: number) {
    const joint = built.pose.GetJoint(4);
    const half = amount * 0.5;
    joint.mRotation.Set(Math.sin(half), 0, 0, Math.cos(half));
    built.pose.CalculateJointMatrices();
  }

  resetArm(built: BuiltRagdoll) {
    const joint = built.pose.GetJoint(4);
    joint.mRotation.Set(0, 0, 0, 1);
    built.pose.CalculateJointMatrices();
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
      try {
        r.ragdoll.RemoveFromPhysicsSystem();
      } catch {
        /* */
      }
      try {
        Jolt.destroy(r.pose);
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
