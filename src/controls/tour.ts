import * as THREE from 'three';

export interface TourFrameLike {
  center: THREE.Vector3;
  normal: THREE.Vector3;
  slot: { hero?: boolean };
}

export interface CinematicTourOptions {
  secondsPerStop: number;
  viewDistance: number;
  eyeHeight: number;
}

export interface TourHandle {
  start(): void;
  stop(): void;
  setFrames(frames: readonly TourFrameLike[]): void;
}

const smoother = (value: number): number => value * value * value * (value * (value * 6 - 15) + 10);

/** Glides the camera from artwork to artwork, pausing in front of each. */
export class CinematicTour implements TourHandle {
  readonly camera: THREE.Camera;
  readonly options: CinematicTourOptions;
  private frames: TourFrameLike[] = [];
  private index = 0;
  private elapsed = 0;
  private readonly fromPosition = new THREE.Vector3();
  private readonly fromQuaternion = new THREE.Quaternion();
  private readonly toPosition = new THREE.Vector3();
  private readonly toQuaternion = new THREE.Quaternion();
  private readonly dummy = new THREE.Object3D();

  active = false;

  constructor(
    camera: THREE.Camera,
    frames: readonly TourFrameLike[],
    options: CinematicTourOptions,
  ) {
    this.camera = camera;
    this.options = options;
    this.setFrames(frames);
  }
  start(): void {
    if (this.frames.length === 0) return;
    const firstFrame = this.frames[0];
    if (!firstFrame) return;
    this.active = true;
    const position = this.camera.position;
    let nearestIndex = 0;
    let nearestDistance = firstFrame.center.distanceToSquared(position);
    for (let index = 1; index < this.frames.length; index += 1) {
      const frame = this.frames[index];
      if (!frame) continue;
      const distance = frame.center.distanceToSquared(position);
      if (distance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    }
    this.index = nearestIndex;
    this.beginLeg();
  }

  stop(): void {
    this.active = false;
  }

  setFrames(frames: readonly TourFrameLike[]): void {
    this.frames = [...frames].sort((a, b) => a.center.z - b.center.z || a.center.x - b.center.x);
    if (this.frames.length === 0) {
      this.active = false;
    } else if (this.index >= this.frames.length) {
      this.index = 0;
    }
  }

  update(delta: number): void {
    if (!this.active || this.frames.length === 0) return;
    const frame = this.frames[this.index];
    if (!frame) {
      this.active = false;
      return;
    }
    const total = this.options.secondsPerStop;
    this.elapsed += delta;
    const travel = Math.min(1, this.elapsed / (total * 0.45));
    const eased = smoother(travel);
    this.camera.position.lerpVectors(this.fromPosition, this.toPosition, eased);
    this.camera.quaternion.slerpQuaternions(this.fromQuaternion, this.toQuaternion, eased);

    if (travel >= 1) {
      const linger = (this.elapsed - total * 0.45) / (total * 0.55);
      this.camera.position.addScaledVector(frame.normal, -0.35 * smoother(Math.min(1, linger)));
    }
    if (this.elapsed >= total) {
      this.index = (this.index + 1) % this.frames.length;
      this.beginLeg();
    }
  }

  private beginLeg(): void {
    this.elapsed = 0;
    this.fromPosition.copy(this.camera.position);
    this.fromQuaternion.copy(this.camera.quaternion);
    const frame = this.frames[this.index];
    if (!frame) {
      this.active = false;
      return;
    }
    const distance = this.options.viewDistance * (frame.slot.hero ? 1.35 : 1);
    this.toPosition.copy(frame.center).addScaledVector(frame.normal, distance);
    this.toPosition.y = this.options.eyeHeight + 0.1;
    this.dummy.position.copy(this.toPosition);
    this.dummy.lookAt(frame.center);
    this.toQuaternion.copy(this.dummy.quaternion);
  }
}
