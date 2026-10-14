import { useLayoutEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import {
  createFrameRenderBindings,
  type ArtworkFrameController,
  type FrameRenderBindings,
} from '../../world/frame.ts';

export interface ArtworkFrameProps {
  controller: ArtworkFrameController;
  onClick?: (controller: ArtworkFrameController) => void;
}

/**
 * One reusable, declarative frame. The controller owns domain state while
 * these individual meshes are mounted and disposed by the React lifecycle.
 */
export function ArtworkFrame({ controller, onClick }: ArtworkFrameProps) {
  const bindings = useMemo<FrameRenderBindings>(() => createFrameRenderBindings(), []);

  useLayoutEffect(() => {
    controller.bindRender(bindings);
    return () => {
      controller.unbindRender(bindings);
      bindings.dispose();
    };
  }, [bindings, controller]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onClick?.(controller);
  };

  const [top, bottom, left, right] = bindings.bars;
  return (
    <group
      name={`artwork-frame:${controller.slot.id}`}
      position={controller.slot.position}
      rotation={[0, controller.slot.rotationY, 0]}
    >
      <primitive object={bindings.wash} />
      <primitive object={bindings.moulding} onClick={handleClick} />
      <primitive object={bindings.matte} onClick={handleClick} />
      <primitive object={bindings.screen} onClick={handleClick} />
      <primitive object={top} />
      <primitive object={bottom} />
      <primitive object={left} />
      <primitive object={right} />
      <primitive object={bindings.plaque.mesh} />
    </group>
  );
}

export interface MuseumFramesProps {
  frames: readonly ArtworkFrameController[];
  onFrameClick?: (frame: ArtworkFrameController) => void;
}

/** Mounts all frame components; media updates remain owned by Curator. */
export function MuseumFrames({ frames, onFrameClick }: MuseumFramesProps) {
  return (
    <group name="declarative-frames">
      {frames.map((frame) => (
        <ArtworkFrame key={frame.slot.id} controller={frame} onClick={onFrameClick} />
      ))}
    </group>
  );
}
