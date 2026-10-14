import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { CameraPose, PlayerHandle } from '../../controls/player.ts';
import { PlayerController } from '../../controls/player.ts';
import { CONFIG } from '../../config.ts';
import type { Vector3 } from 'three';
export interface UsePlayerControlsOptions {
  enabled?: boolean;
  collides?: (position: Vector3) => boolean;
  start?: CameraPose;
  onLockChange?: (locked: boolean) => void;
  playerRef?: { current: PlayerHandle | null };
}

const DEFAULT_START: CameraPose = {
  position: [0, CONFIG.player.eyeHeight, 0],
  yaw: 0,
};

/** R3F lifecycle wrapper around the single PlayerController implementation. */
export function usePlayerControls({
  enabled = true,
  collides = () => false,
  start = DEFAULT_START,
  onLockChange,
  playerRef,
}: UsePlayerControlsOptions): void {
  const { camera, gl } = useThree();
  const controllerRef = useRef<PlayerController | null>(null);
  const callbackRef = useRef(onLockChange);
  const collisionRef = useRef(collides);

  useEffect(() => {
    callbackRef.current = onLockChange;
  }, [onLockChange]);

  useEffect(() => {
    collisionRef.current = collides;
    controllerRef.current?.setCollides(collides);
  }, [collides]);

  useEffect(() => {
    const controller = new PlayerController(
      camera,
      gl.domElement,
      {
        ...CONFIG.player,
        start: DEFAULT_START,
        collides: collisionRef.current,
      },
      (locked) => callbackRef.current?.(locked),
    );
    controllerRef.current = controller;
    if (playerRef) playerRef.current = controller;
    return () => {
      controller.dispose();
      if (playerRef?.current === controller) playerRef.current = null;
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [camera, gl, playerRef]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    controller.enabled = enabled;
    if (!enabled) controller.clearInput();
  }, [enabled]);

  const startX = start.position[0];
  const startY = start.position[1];
  const startZ = start.position[2];
  const startYaw = start.yaw;
  useEffect(() => {
    controllerRef.current?.resetPose({
      position: [startX, startY, startZ],
      yaw: startYaw,
    });
  }, [startX, startY, startZ, startYaw]);

  useFrame((_, delta) => {
    controllerRef.current?.update(Math.min(delta, 0.05));
  });
}
