import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { CONFIG } from '../../config.js';

const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function useCinematicTour({
  frames = [],
  active = false,
  onStop,
  tourRef,
}) {
  const { camera } = useThree();

  const sortedFrames = useRef([]);
  const index = useRef(0);
  const elapsed = useRef(0);
  const from = useRef({ position: new THREE.Vector3(), quaternion: new THREE.Quaternion() });
  const to = useRef({ position: new THREE.Vector3(), quaternion: new THREE.Quaternion() });
  const dummy = useRef(new THREE.Object3D());

  const viewpointFor = useCallback((frame, out) => {
    if (!frame) return;
    const distance = CONFIG.tour.viewDistance * (frame.slot?.hero ? 1.35 : 1);
    out.position.copy(frame.center).addScaledVector(frame.normal, distance);
    out.position.y = CONFIG.player.eyeHeight + 0.1;
    dummy.current.position.copy(out.position);
    dummy.current.lookAt(frame.center);
    out.quaternion.copy(dummy.current.quaternion);
  }, []);

  const beginLeg = useCallback(() => {
    elapsed.current = 0;
    from.current.position.copy(camera.position);
    from.current.quaternion.copy(camera.quaternion);
    viewpointFor(sortedFrames.current[index.current], to.current);
  }, [camera, viewpointFor]);

  const start = useCallback(() => {
    if (!frames.length) return;
    sortedFrames.current = [...frames].sort(
      (a, b) => a.center.z - b.center.z || a.center.x - b.center.x
    );
    const pos = camera.position;
    index.current = sortedFrames.current.reduce(
      (best, f, i) =>
        f.center.distanceToSquared(pos) < sortedFrames.current[best].center.distanceToSquared(pos)
          ? i
          : best,
      0
    );
    beginLeg();
  }, [frames, camera, beginLeg]);

  const stop = useCallback(() => {
    onStop?.();
  }, [onStop]);

  if (tourRef) {
    tourRef.current = {
      start,
      stop,
      setFrames(newFrames) {
        sortedFrames.current = [...newFrames].sort(
          (a, b) => a.center.z - b.center.z || a.center.x - b.center.x
        );
      },
    };
  }

  useFrame((_, delta) => {
    if (!active || !sortedFrames.current.length) return;
    const total = CONFIG.tour.secondsPerStop;
    elapsed.current += delta;
    const travel = Math.min(1, elapsed.current / (total * 0.45));
    const e = smoother(travel);

    camera.position.lerpVectors(from.current.position, to.current.position, e);
    camera.quaternion.slerpQuaternions(from.current.quaternion, to.current.quaternion, e);

    if (travel >= 1) {
      const linger = (elapsed.current - total * 0.45) / (total * 0.55);
      camera.position.addScaledVector(
        sortedFrames.current[index.current].normal,
        -0.35 * smoother(Math.min(1, linger))
      );
    }

    if (elapsed.current >= total) {
      index.current = (index.current + 1) % sortedFrames.current.length;
      beginLeg();
    }
  });

  return { start, stop };
}
