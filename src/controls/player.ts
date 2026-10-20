import * as THREE from 'three';
import type { Vector3Tuple } from '../types.ts';

const PITCH_LIMIT = Math.PI * 0.44;
const PITCH_SENSITIVITY_RATIO = 0.72;
const MAX_MOUSE_DELTA = 42;
const WARP_SPIKE_THRESHOLD = 220;
const LOOK_DAMPING = 20;
const ACCEL_DAMPING = 8.5;
const STOP_DAMPING = 12;
const HEAD_BOB_AMPLITUDE = 0.011;

export interface CameraPose {
  position: Vector3Tuple;
  yaw: number;
}
export interface SeatingPose {
  position: THREE.Vector3;
  yaw: number;
}

export interface MutableTouchMove {
  x: number;
  z: number;
}

export interface PlayerControllerOptions {
  start: CameraPose;
  speed: number;
  sprintMultiplier: number;
  eyeHeight: number;
  sensitivity: number;
  collides?: (position: THREE.Vector3) => boolean;
}

export interface MouseMovement {
  movementX: number;
  movementY: number;
}

export interface PlayerHandle {
  readonly locked: boolean;
  readonly active: boolean;
  enabled: boolean;
  readonly touchEnabled: boolean;
  readonly touchMove: Readonly<MutableTouchMove>;
  readonly euler: THREE.Euler;
  readonly velocity: THREE.Vector3;
  readonly keys: Set<string>;
  lock(): void;
  unlock(): void;
  setTouchEnabled(enabled: boolean): void;
  setTouchMove(x: number, z: number): void;
  clearInput(): void;
  resetPose(start: CameraPose): void;
  sit(pose: SeatingPose): void;
  standUp(): void;
  syncFromCamera(): void;
  onMouseMove(event: MouseMovement): void;
}

/** First-person pointer-lock controller with damped look, touch input, sliding and subtle head bob. */
export class PlayerController implements PlayerHandle {
  readonly camera: THREE.Camera;
  readonly canvas: HTMLCanvasElement | null;
  readonly options: PlayerControllerOptions;
  readonly euler: THREE.Euler;
  readonly keys = new Set<string>();
  readonly velocity = new THREE.Vector3();
  readonly touchMove: MutableTouchMove = { x: 0, z: 0 };

  enabled = true;
  touchEnabled = false;

  private readonly standPosition = new THREE.Vector3();
  private readonly wish = new THREE.Vector3();
  private readonly next = new THREE.Vector3();
  private targetYaw = 0;
  private targetPitch = 0;
  private skipNextMouseSpike = false;
  private bob = 0;
  private seated = false;
  private collides: (position: THREE.Vector3) => boolean;
  private lockListener: () => void;
  private readonly moveListener = (event: MouseEvent): void => {
    this.onMouseMove(event);
  };
  private readonly keyDownListener = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
  };
  private readonly keyUpListener = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };
  private lockChangeCallback: ((locked: boolean) => void) | undefined;
  private readonly blurListener = (): void => {
    this.clearInput();
  };
  private readonly visibilityListener = (): void => {
    if (document.hidden) this.clearInput();
  };

  constructor(
    camera: THREE.Camera,
    canvas: HTMLCanvasElement | null,
    options: PlayerControllerOptions,
    onLockChange?: (locked: boolean) => void,
  ) {
    this.camera = camera;
    this.canvas = canvas;
    this.options = options;
    this.collides = options.collides ?? (() => false);
    this.lockChangeCallback = onLockChange;
    this.euler = new THREE.Euler(0, options.start.yaw, 0, 'YXZ');
    this.resetPose(options.start);
    this.lockListener = (): void => {
      this.handleLockChange();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerlockchange', this.lockListener);
      if (typeof window !== 'undefined') window.addEventListener('blur', this.blurListener);
      document.addEventListener('visibilitychange', this.visibilityListener);
    }
  }

  setCollides(collides: (position: THREE.Vector3) => boolean): void {
    this.collides = collides;
  }

  setLockChangeCallback(callback: ((locked: boolean) => void) | undefined): void {
    this.lockChangeCallback = callback;
  }

  resetPose(start: CameraPose): void {
    this.camera.position.fromArray(start.position);
    this.euler.set(0, start.yaw, 0, 'YXZ');
    this.targetYaw = start.yaw;
    this.targetPitch = 0;
    this.camera.quaternion.setFromEuler(this.euler);
    this.bob = 0;
  }

  lock(): void {
    if (this.touchEnabled || this.locked || !this.canvas) return;
    const requestLock = this.canvas.requestPointerLock.bind(this.canvas) as (
      options?: PointerLockOptions,
    ) => Promise<void> | undefined;
    try {
      const result = requestLock({ unadjustedMovement: true });
      if (result instanceof Promise) {
        void result.catch(() => {
          const fallback = this.canvas?.requestPointerLock();
          if (fallback instanceof Promise) void fallback.catch(() => undefined);
        });
      }
    } catch {
      const fallback = this.canvas.requestPointerLock();
      if (fallback instanceof Promise) void fallback.catch(() => undefined);
    }
  }

  unlock(): void {
    if (typeof document === 'undefined') return;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }
  setTouchEnabled(enabled: boolean): void {
    this.touchEnabled = enabled;
    if (!enabled) this.clearInput();
  }

  setTouchMove(x: number, z: number): void {
    this.touchMove.x = x;
    this.touchMove.z = z;
  }

  get locked(): boolean {
    return typeof document !== 'undefined' && document.pointerLockElement === this.canvas;
  }

  get active(): boolean {
    return this.enabled && (this.locked || this.touchEnabled);
  }

  clearInput(): void {
    this.keys.clear();
    this.touchMove.x = 0;
    this.touchMove.z = 0;
    this.velocity.set(0, 0, 0);
    this.targetYaw = this.euler.y;
    this.targetPitch = this.euler.x;
  }

  private handleLockChange(): void {
    if (this.locked) {
      this.skipNextMouseSpike = true;
      this.targetYaw = this.euler.y;
      this.targetPitch = this.euler.x;
      document.addEventListener('mousemove', this.moveListener);
      document.addEventListener('keydown', this.keyDownListener);
      document.addEventListener('keyup', this.keyUpListener);
    } else {
      document.removeEventListener('mousemove', this.moveListener);
      document.removeEventListener('keydown', this.keyDownListener);
      document.removeEventListener('keyup', this.keyUpListener);
      this.clearInput();
    }
    this.lockChangeCallback?.(this.locked);
  }

  /** Re-derive yaw/pitch after another system (for example a tour) moved the camera. */
  syncFromCamera(): void {
    this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.euler.z = 0;
    this.targetYaw = this.euler.y;
    this.targetPitch = this.euler.x;
    this.camera.quaternion.setFromEuler(this.euler);
    this.camera.position.y = this.options.eyeHeight;
  }

  /** Sit down in a cinema seat. Any movement key stands back up. */
  sit({ position, yaw }: SeatingPose): void {
    if (!this.seated) this.standPosition.copy(this.camera.position);
    this.seated = true;
    this.velocity.set(0, 0, 0);
    this.camera.position.copy(position);
    this.euler.set(-0.04, yaw, 0, 'YXZ');
    this.targetYaw = yaw;
    this.targetPitch = -0.04;
    this.camera.quaternion.setFromEuler(this.euler);
  }

  standUp(): void {
    if (!this.seated) return;
    this.seated = false;
    this.camera.position.copy(this.standPosition);
    this.camera.position.y = this.options.eyeHeight;
  }

  onMouseMove(event: MouseMovement): void {
    if (!this.enabled || (!this.locked && !this.touchEnabled)) return;
    const rawX = Number.isFinite(event.movementX) ? event.movementX : 0;
    const rawY = Number.isFinite(event.movementY) ? event.movementY : 0;

    // Filter out browser pointer-lock cursor-centering warp spikes.
    if (Math.abs(rawX) > WARP_SPIKE_THRESHOLD || Math.abs(rawY) > WARP_SPIKE_THRESHOLD) {
      this.skipNextMouseSpike = false;
      return;
    }
    if (this.skipNextMouseSpike) {
      this.skipNextMouseSpike = false;
      if (Math.abs(rawX) > 28 || Math.abs(rawY) > 28) return;
    }

    const clampedX = THREE.MathUtils.clamp(rawX, -MAX_MOUSE_DELTA, MAX_MOUSE_DELTA);
    const clampedY = THREE.MathUtils.clamp(rawY, -MAX_MOUSE_DELTA, MAX_MOUSE_DELTA);
    const sensitivity = this.options.sensitivity;

    this.targetYaw -= clampedX * sensitivity;
    this.targetPitch = THREE.MathUtils.clamp(
      this.targetPitch - clampedY * sensitivity * PITCH_SENSITIVITY_RATIO,
      -PITCH_LIMIT,
      PITCH_LIMIT,
    );
  }

  update(dt: number): void {
    if (!this.enabled) return;

    // Smoothly damp camera look rotation toward targetYaw / targetPitch.
    const lookBlend = 1 - Math.exp(-dt * LOOK_DAMPING);
    const yawDiff = this.targetYaw - this.euler.y;
    const pitchDiff = this.targetPitch - this.euler.x;
    if (Math.abs(yawDiff) > 1e-5 || Math.abs(pitchDiff) > 1e-5) {
      this.euler.y += yawDiff * lookBlend;
      this.euler.x = THREE.MathUtils.clamp(
        this.euler.x + pitchDiff * lookBlend,
        -PITCH_LIMIT,
        PITCH_LIMIT,
      );
      this.camera.quaternion.setFromEuler(this.euler);
    }

    const active = this.active;
    const x = active
      ? this.touchMove.x +
        (+(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
          +(this.keys.has('KeyA') || this.keys.has('ArrowLeft')))
      : 0;
    const z = active
      ? this.touchMove.z +
        (+(this.keys.has('KeyS') || this.keys.has('ArrowDown')) -
          +(this.keys.has('KeyW') || this.keys.has('ArrowUp')))
      : 0;

    if (this.seated) {
      if (x !== 0 || z !== 0) this.standUp();
      return;
    }

    const sprint =
      this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? this.options.sprintMultiplier : 1;
    this.wish.set(x, 0, z);
    const hasInput = this.wish.lengthSq() > 0;
    if (hasInput) {
      this.wish.clampLength(0, 1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.euler.y);
    }
    this.wish.multiplyScalar(this.options.speed * sprint);
    const moveDamping = hasInput ? ACCEL_DAMPING : STOP_DAMPING;
    this.velocity.lerp(this.wish, 1 - Math.exp(-dt * moveDamping));
    if (this.velocity.lengthSq() < 1e-5) return;

    const position = this.camera.position;
    const stepX = this.velocity.x * dt;
    const stepZ = this.velocity.z * dt;
    if (!this.tryMove(position, stepX, stepZ) && !this.tryMove(position, stepX, 0)) {
      this.tryMove(position, 0, stepZ);
    }

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.bob += dt * speed * 1.9;
    position.y =
      this.options.eyeHeight +
      Math.sin(this.bob) * HEAD_BOB_AMPLITUDE * Math.min(1, speed / this.options.speed);
  }

  private tryMove(position: THREE.Vector3, dx: number, dz: number): boolean {
    this.next.set(position.x + dx, 0, position.z + dz);
    if (this.collides(this.next)) return false;
    position.x = this.next.x;
    position.z = this.next.z;
    return true;
  }

  dispose(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerlockchange', this.lockListener);
      document.removeEventListener('mousemove', this.moveListener);
      document.removeEventListener('keydown', this.keyDownListener);
      document.removeEventListener('keyup', this.keyUpListener);
      document.removeEventListener('visibilitychange', this.visibilityListener);
      if (typeof window !== 'undefined') window.removeEventListener('blur', this.blurListener);
    }
    this.clearInput();
  }
}
