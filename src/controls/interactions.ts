import * as THREE from 'three';

const CENTER = new THREE.Vector2(0, 0);
const OCCLUDER = Symbol('occluder');

type Occluder = typeof OCCLUDER;

export interface InteractionCaption {
  title: string;
  subtitle: string;
}

export interface InteractionTarget {
  caption?: (hit: THREE.Intersection) => InteractionCaption | null;
  activate: (hit: THREE.Intersection) => void;
  maxDistance?: number;
}

export interface InteractionPick {
  target: InteractionTarget;
  hit: THREE.Intersection;
}

/** Centre-crosshair raycasting with nearest-hit occlusion and distance limits. */
export class Interactions {
  readonly camera: THREE.Camera;
  readonly raycaster = new THREE.Raycaster();
  private readonly targets = new Map<THREE.Object3D, InteractionTarget | Occluder>();
  private readonly meshes: THREE.Object3D[] = [];
  private readonly intersections: THREE.Intersection[] = [];
  private cachedPick: InteractionPick | null = null;

  constructor(camera: THREE.Camera) {
    this.camera = camera;
    this.raycaster.far = 40;
  }

  add(meshes: readonly THREE.Object3D[], target: InteractionTarget): () => void {
    for (const mesh of meshes) {
      this.targets.set(mesh, target);
      this.meshes.push(mesh);
    }
    return (): void => {
      this.remove(meshes);
    };
  }

  addOccluders(meshes: readonly THREE.Object3D[]): () => void {
    for (const mesh of meshes) {
      this.targets.set(mesh, OCCLUDER);
      this.meshes.push(mesh);
    }
    return (): void => {
      this.remove(meshes);
    };
  }

  clear(): void {
    this.targets.clear();
    this.meshes.length = 0;
    this.intersections.length = 0;
    this.cachedPick = null;
  }

  pick(): InteractionPick | null {
    this.raycaster.setFromCamera(CENTER, this.camera);
    this.intersections.length = 0;
    this.raycaster.intersectObjects(this.meshes, false, this.intersections);
    const hit = this.intersections[0];
    if (!hit) return null;
    const target = this.targets.get(hit.object);
    if (!target || target === OCCLUDER || hit.distance > (target.maxDistance ?? 8)) return null;
    const cachedPick = this.cachedPick;
    if (!cachedPick) {
      const nextPick = { target, hit };
      this.cachedPick = nextPick;
      return nextPick;
    }
    cachedPick.target = target;
    cachedPick.hit = hit;
    return cachedPick;
  }

  private remove(meshes: readonly THREE.Object3D[]): void {
    for (const mesh of meshes) {
      this.targets.delete(mesh);
      const index = this.meshes.indexOf(mesh);
      if (index >= 0) this.meshes.splice(index, 1);
    }
  }
}
