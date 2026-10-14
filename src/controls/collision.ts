import type { Vector3 } from 'three';

export interface CollisionRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CollisionPoint {
  x: number;
  z: number;
}

/** Circle-vs-rectangle collision in the XZ plane. */
export function createCollisionChecker(
  rects: readonly CollisionRect[],
  radius: number,
): (position: CollisionPoint | Vector3) => boolean {
  const radiusSquared = radius * radius;
  return (position) => {
    for (const rect of rects) {
      const dx = position.x - Math.max(rect.minX, Math.min(position.x, rect.maxX));
      const dz = position.z - Math.max(rect.minZ, Math.min(position.z, rect.maxZ));
      if (dx * dx + dz * dz < radiusSquared) return true;
    }
    return false;
  };
}
