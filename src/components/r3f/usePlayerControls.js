import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { CONFIG } from '../../config.js';

const PITCH_LIMIT = Math.PI * 0.47;

export function usePlayerControls({
  enabled = true,
  collides = () => false,
  start = { position: [0, CONFIG.player.eyeHeight, 0], yaw: 0 },
  onLockChange,
  playerRef,
}) {
  const { camera, gl } = useThree();

  const euler = useRef(new THREE.Euler(0, start.yaw ?? 0, 0, 'YXZ'));
  const keys = useRef(new Set());
  const velocity = useRef(new THREE.Vector3());
  const wish = useRef(new THREE.Vector3());
  const next = useRef(new THREE.Vector3());
  const standPosition = useRef(new THREE.Vector3());
  const bob = useRef(0);
  const isSeated = useRef(false);
  const touchEnabled = useRef(false);
  const touchMove = useRef({ x: 0, z: 0 });

  // Initialize camera position
  useEffect(() => {
    if (camera) {
      camera.position.fromArray(start.position);
      euler.current.set(0, start.yaw ?? 0, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler.current);
    }
  }, [camera, start]);

  const clearInput = useCallback(() => {
    keys.current.clear();
    touchMove.current.x = 0;
    touchMove.current.z = 0;
    velocity.current.set(0, 0, 0);
  }, []);

  const sit = useCallback(
    ({ position, yaw }) => {
      if (!isSeated.current) standPosition.current.copy(camera.position);
      isSeated.current = true;
      velocity.current.set(0, 0, 0);
      camera.position.copy(position);
      euler.current.set(-0.04, yaw, 0);
      camera.quaternion.setFromEuler(euler.current);
    },
    [camera]
  );

  const standUp = useCallback(() => {
    if (!isSeated.current) return;
    isSeated.current = false;
    camera.position.copy(standPosition.current);
    camera.position.y = CONFIG.player.eyeHeight;
  }, [camera]);

  const syncFromCamera = useCallback(() => {
    euler.current.setFromQuaternion(camera.quaternion, 'YXZ');
    euler.current.z = 0;
    camera.quaternion.setFromEuler(euler.current);
    camera.position.y = CONFIG.player.eyeHeight;
  }, [camera]);

  const lock = useCallback(() => {
    const canvas = gl.domElement;
    if (enabled && !touchEnabled.current && document.pointerLockElement !== canvas) {
      canvas?.requestPointerLock()?.catch?.(() => {});
    }
  }, [enabled, gl]);

  const unlock = useCallback(() => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, []);

  // Expose player controller methods to ref
  if (playerRef) {
    playerRef.current = {
      lock,
      unlock,
      clearInput,
      sit,
      standUp,
      syncFromCamera,
      get locked() {
        return document.pointerLockElement === gl.domElement;
      },
      get active() {
        return enabled && (this.locked || touchEnabled.current);
      },
      get touchEnabled() {
        return touchEnabled.current;
      },
      set touchEnabled(val) {
        touchEnabled.current = val;
      },
      touchMove: touchMove.current,
      euler: euler.current,
      velocity: velocity.current,
      keys: keys.current,
      enabled,
    };
  }

  // Pointer lock and keyboard event listeners
  useEffect(() => {
    const onMouseMove = (e) => {
      const isLocked = document.pointerLockElement === gl.domElement;
      if (!isLocked || !enabled) return;
      const s = CONFIG.player.sensitivity;
      euler.current.y -= e.movementX * s;
      euler.current.x = THREE.MathUtils.clamp(
        euler.current.x - e.movementY * s,
        -PITCH_LIMIT,
        PITCH_LIMIT
      );
      camera.quaternion.setFromEuler(euler.current);
    };

    const onKeyDown = (e) => {
      keys.current.add(e.code);
    };

    const onKeyUp = (e) => {
      keys.current.delete(e.code);
    };

    const onPointerLock = () => {
      const isLocked = document.pointerLockElement === gl.domElement;
      onLockChange?.(isLocked);
      if (!isLocked) {
        clearInput();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerlockchange', onPointerLock);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('pointerlockchange', onPointerLock);
    };
  }, [enabled, gl, camera, onLockChange, clearInput]);

  // Frame tick physics update
  useFrame((_, delta) => {
    if (!enabled) return;
    const dt = Math.min(delta, 0.05);
    const k = keys.current;
    const isLocked = document.pointerLockElement === gl.domElement;
    const active = enabled && (isLocked || touchEnabled.current);

    const x = active
      ? touchMove.current.x +
        (+(k.has('KeyD') || k.has('ArrowRight')) - +(k.has('KeyA') || k.has('ArrowLeft')))
      : 0;
    const z = active
      ? touchMove.current.z +
        (+(k.has('KeyS') || k.has('ArrowDown')) - +(k.has('KeyW') || k.has('ArrowUp')))
      : 0;

    if (isSeated.current) {
      if (x || z) standUp();
      return;
    }

    const sprint = k.has('ShiftLeft') || k.has('ShiftRight') ? CONFIG.player.sprintMultiplier : 1;
    wish.current.set(x, 0, z);
    if (wish.current.lengthSq()) {
      wish.current.clampLength(0, 1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, euler.current.y);
    }
    wish.current.multiplyScalar(CONFIG.player.speed * sprint);

    velocity.current.lerp(wish.current, 1 - Math.exp(-dt * 10));
    if (velocity.current.lengthSq() < 1e-5) return;

    const pos = camera.position;
    const step = wish.current.copy(velocity.current).multiplyScalar(dt);

    for (const candidate of [
      [step.x, step.z],
      [step.x, 0],
      [0, step.z],
    ]) {
      next.current.set(pos.x + candidate[0], 0, pos.z + candidate[1]);
      if (!collides(next.current)) {
        pos.x = next.current.x;
        pos.z = next.current.z;
        break;
      }
    }

    const speed = Math.hypot(velocity.current.x, velocity.current.z);
    bob.current += dt * speed * 2.2;
    pos.y =
      CONFIG.player.eyeHeight +
      Math.sin(bob.current) * 0.025 * Math.min(1, speed / CONFIG.player.speed);
  });

  return {
    lock,
    unlock,
    sit,
    standUp,
    syncFromCamera,
    clearInput,
  };
}
