import * as THREE from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';

export const PLAYER_SIZE = { width: 1280, height: 720 } as const;

export interface CinemaScreenHost {
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.Camera;
}

export function screenCutoutMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0x000000,
    opacity: 0,
    blending: THREE.NoBlending,
    premultipliedAlpha: true,
    toneMapped: false,
  });
}

export interface ScreenPose {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly scale: THREE.Vector3;
}

export function screenPose(surface: THREE.Object3D): ScreenPose {
  surface.updateWorldMatrix(true, false);
  const size = surface.getWorldScale(new THREE.Vector3());
  return {
    position: surface.getWorldPosition(new THREE.Vector3()),
    quaternion: surface.getWorldQuaternion(new THREE.Quaternion()),
    scale: new THREE.Vector3(size.x / PLAYER_SIZE.width, size.y / PLAYER_SIZE.height, 1),
  };
}

export function viewingPosition(fov: number, aspect: number): THREE.Vector3 {
  const tangent = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const distance = Math.max(7.8, (6.4 / (2 * tangent * aspect)) * 1.15);
  return new THREE.Vector3(0, 1.65, Math.max(0.8, 15.84 - distance));
}

/**
 * CSS3D is a compositor for the YouTube iframe only. It borrows the active
 * R3F camera and canvas; it does not create a renderer or animation loop.
 */
export class CinemaScreen {
  readonly container: HTMLDivElement;
  readonly object: CSS3DObject;
  readonly scene = new THREE.Scene();
  readonly renderer = new CSS3DRenderer();
  private readonly surface: THREE.Mesh;
  private readonly originalMaterial: THREE.Material | THREE.Material[];
  private readonly cutoutMaterial = screenCutoutMaterial();
  private readonly camera: THREE.Camera;
  private readonly canvas: HTMLCanvasElement;
  private readonly position = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private width = 0;
  private height = 0;
  private active = false;

  constructor(host: CinemaScreenHost, surface: THREE.Mesh) {
    this.camera = host.camera;
    this.canvas = host.canvas;
    this.surface = surface;
    this.originalMaterial = surface.material;
    this.renderer.domElement.className = 'cinema-screen-layer';
    this.renderer.domElement.setAttribute('aria-label', 'Cinema screen');
    document.body.prepend(this.renderer.domElement);
    this.container = document.createElement('div');
    this.container.id = 'youtubePlayer';
    this.container.style.width = `${String(PLAYER_SIZE.width)}px`;
    this.container.style.height = `${String(PLAYER_SIZE.height)}px`;
    this.object = new CSS3DObject(this.container);
    this.scene.add(this.object);
    this.setActive(false);
  }

  setActive(active: boolean): void {
    this.active = active;
    this.surface.material = active ? this.cutoutMaterial : this.originalMaterial;
    this.surface.renderOrder = active ? 100 : 0;
    this.renderer.domElement.style.visibility = active ? 'visible' : 'hidden';
  }

  setInteractive(interactive: boolean): void {
    this.container.style.pointerEvents = interactive ? 'auto' : 'none';
  }

  update(): void {
    if (!this.active) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width !== this.width || height !== this.height) {
      this.renderer.setSize(width, height);
      this.width = width;
      this.height = height;
    }
    this.surface.updateWorldMatrix(true, false);
    this.surface.getWorldPosition(this.position);
    this.surface.getWorldQuaternion(this.quaternion);
    this.surface.getWorldScale(this.scale);
    this.object.position.copy(this.position);
    this.object.quaternion.copy(this.quaternion);
    this.object.scale.set(this.scale.x / PLAYER_SIZE.width, this.scale.y / PLAYER_SIZE.height, 1);
    this.camera.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.setActive(false);
    this.object.removeFromParent();
    this.renderer.domElement.remove();
    this.cutoutMaterial.dispose();
  }
}
