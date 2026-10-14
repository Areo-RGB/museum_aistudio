import { useCallback, useEffect, useRef } from 'react';
import type { TourFrameLike, TourHandle } from '../../controls/tour.ts';
import { CinematicTour } from '../../controls/tour.ts';
import { CONFIG } from '../../config.ts';
import { useFrame, useThree } from '@react-three/fiber';

export interface UseCinematicTourOptions {
  frames?: readonly TourFrameLike[];
  active?: boolean;
  onStop?: () => void;
  tourRef?: { current: TourHandle | null };
}
const EMPTY_FRAMES: readonly TourFrameLike[] = [];

/** R3F lifecycle wrapper around CinematicTour. */
export function useCinematicTour({
  frames = [],
  active = false,
  onStop,
  tourRef,
}: UseCinematicTourOptions): TourHandle {
  const { camera } = useThree();
  const controllerRef = useRef<CinematicTour | null>(null);
  const onStopRef = useRef(onStop);
  const notifyingStopRef = useRef(false);

  useEffect(() => {
    onStopRef.current = onStop;
  }, [onStop]);

  useEffect(() => {
    const controller = new CinematicTour(camera, EMPTY_FRAMES, {
      secondsPerStop: CONFIG.tour.secondsPerStop,
      viewDistance: CONFIG.tour.viewDistance,
      eyeHeight: CONFIG.player.eyeHeight,
    });
    controllerRef.current = controller;
    return () => {
      controller.stop();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [camera]);

  const start = useCallback((): void => {
    controllerRef.current?.start();
  }, []);

  const stop = useCallback((): void => {
    controllerRef.current?.stop();
    if (notifyingStopRef.current) return;
    notifyingStopRef.current = true;
    try {
      onStopRef.current?.();
    } finally {
      notifyingStopRef.current = false;
    }
  }, []);

  const setFrames = useCallback((nextFrames: readonly TourFrameLike[]): void => {
    controllerRef.current?.setFrames(nextFrames);
  }, []);

  useEffect(() => {
    setFrames(frames);
  }, [frames, setFrames]);

  useEffect(() => {
    if (tourRef) tourRef.current = { start, stop, setFrames };
    return () => {
      if (tourRef?.current?.start === start) tourRef.current = null;
    };
  }, [setFrames, start, stop, tourRef]);

  useFrame((_, delta) => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (!active) {
      controller.stop();
      return;
    }
    controller.update(delta);
  });

  return { start, stop, setFrames };
}
