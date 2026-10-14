import type * as THREE from 'three';

interface OwnedResourceUserData {
  disposeOwned: () => void;
}

function hasOwnedDisposer(value: unknown): value is OwnedResourceUserData {
  if (typeof value !== 'object' || value === null || !('disposeOwned' in value)) return false;
  return typeof value.disposeOwned === 'function';
}

/** Dispose only resources explicitly marked as owned by a specialized subsystem. */
export function disposeOwnedResources(root: THREE.Object3D): void {
  root.removeFromParent();
  root.traverse((object) => {
    const data: unknown = object.userData;
    if (hasOwnedDisposer(data)) data.disposeOwned();
  });
}
