import React from 'react';
import { useFrame, useThree } from '@react-three/fiber';

export function MuseumFrames({
  frames = [],
  curator,
  onFrameClick,
}) {
  const { camera } = useThree();

  // Run distance-based video playback & fade updates in useFrame
  useFrame((_, delta) => {
    if (!frames.length) return;
    const dt = Math.min(delta, 0.05);
    const cameraPos = camera.position;
    const videoDistance = 14;

    for (const frame of frames) {
      frame.update?.(dt, cameraPos, { videoPlayDistance: videoDistance });
    }
  });

  return (
    <group name="declarative-frames">
      {frames.map((frame, index) => (
        <primitive
          key={frame.slot?.id || index}
          object={frame.group}
          onClick={(e) => {
            e.stopPropagation();
            onFrameClick?.(frame);
          }}
        />
      ))}
    </group>
  );
}
