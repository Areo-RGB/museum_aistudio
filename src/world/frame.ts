import * as THREE from 'three';
import type { FitMode, FrameLoadState, FrameSlot, LoadedMedia, MediaItem } from '../types.ts';

// Geometry and materials shared by every frame. Per-frame size is applied via scale.
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
const MOULDING = new THREE.MeshStandardMaterial({
  color: 0x141821,
  roughness: 0.34,
  metalness: 0.42,
});
const MATTE = new THREE.MeshStandardMaterial({ color: 0xf7f5ef, roughness: 0.92 });
const PLAQUE_BACK = new THREE.MeshStandardMaterial({
  color: 0xc5a059,
  roughness: 0.28,
  metalness: 0.82,
});
let washMaterial: THREE.MeshBasicMaterial | null = null;
const EMPTY_TARGETS: readonly THREE.Object3D[] = [];

const BAR = 0.075;
const DEPTH = 0.07;
const PLAQUE_Y = 1.45;
const DIMMED = 0.18;
const FADE_SPEED = 2.5;

export interface FramePlaque {
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  face: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  draw(title: string, subtitle: string): void;
}
type FrameBars = [THREE.Object3D, THREE.Object3D, THREE.Object3D, THREE.Object3D];
/** Resources created for one mounted frame and borrowed by its controller. */
export interface FrameRenderBindings {
  readonly bars: FrameBars;
  readonly moulding: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  readonly matte: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  readonly screen: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly plaque: FramePlaque;
  readonly wash: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly hitTargets: readonly THREE.Object3D[];
  dispose(): void;
}

/**
 * Domain state for one artwork slot. Geometry is mounted by ArtworkFrame; this
 * controller owns assignment, asynchronous media generations, fitting and
 * distance-based playback policy.
 */
export class ArtworkFrameController {
  readonly slot: FrameSlot;
  fit: FitMode = 'auto';
  item: MediaItem | null = null;
  state: FrameLoadState = 'idle';
  retryAt = 0;
  knownAspect: number | null = null;
  brightness = 0;
  targetBrightness = DIMMED;
  private _loaded: LoadedMedia | null = null;
  private _loadToken = 0;
  private _loadController: AbortController | null = null;
  private bindings: FrameRenderBindings | null = null;
  private _outerSize: readonly [number, number] | undefined;
  private disposed = false;

  readonly center: THREE.Vector3;
  readonly normal: THREE.Vector3;

  constructor(slot: FrameSlot) {
    this.slot = slot;
    this.center = new THREE.Vector3(...slot.position);
    this.normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(
      THREE.Object3D.DEFAULT_UP,
      slot.rotationY,
    );
  }

  get loaded(): LoadedMedia | null {
    return this._loaded;
  }

  get loadToken(): number {
    return this._loadToken;
  }

  get loadController(): AbortController | null {
    return this._loadController;
  }

  get outerSize(): readonly [number, number] | undefined {
    return this._outerSize;
  }

  get renderBindings(): FrameRenderBindings | null {
    return this.bindings;
  }

  get hitTargets(): readonly THREE.Object3D[] {
    return this.bindings?.hitTargets ?? EMPTY_TARGETS;
  }

  /** Attach resources owned by the mounted ArtworkFrame component. */
  bindRender(bindings: FrameRenderBindings): void {
    if (this.bindings && this.bindings !== bindings) {
      throw new Error(`Frame ${this.slot.id} is already bound to a renderer`);
    }
    this.bindings = bindings;
    this.disposed = false;
    bindings.plaque.mesh.position.y = PLAQUE_Y - this.slot.position[1];
    this.layout();
    bindings.plaque.draw(this.item?.title ?? '', this.item?.subtitle ?? '');
  }

  /** Detach a component binding without invalidating media assignment. */
  unbindRender(bindings: FrameRenderBindings): void {
    if (this.bindings !== bindings) return;
    this.bindings = null;
  }

  get aspect(): number {
    return this.knownAspect ?? this.slot.maxWidth / this.slot.maxHeight;
  }

  assign(item: MediaItem | null): void {
    this.unload();
    this.item = item;
    this.knownAspect = null;
    this.bindings?.plaque.draw(item?.title ?? '', item?.subtitle ?? '');
    this.layout();
  }

  beginLoad(): number {
    this._loadController?.abort();
    this._loadController = new AbortController();
    this.state = 'loading';
    this.targetBrightness = DIMMED;
    this._loadToken += 1;
    return this._loadToken;
  }

  finishLoad(token: number, loaded: LoadedMedia): boolean {
    if (token !== this._loadToken || this.disposed) {
      loaded.dispose();
      return false;
    }
    this._loaded?.dispose();
    this._loaded = loaded;
    this.state = 'loaded';
    this.bindings?.plaque.draw(this.item?.title ?? '', this.item?.subtitle ?? '');
    this.knownAspect = loaded.width / loaded.height;
    const screenMaterial = this.screenMaterial;
    if (screenMaterial) {
      screenMaterial.map = loaded.texture;
      screenMaterial.needsUpdate = true;
    }
    this.brightness = 0;
    this.targetBrightness = 1;
    this.layout();
    return true;
  }

  failLoad(token: number): void {
    if (token !== this._loadToken || this.disposed) return;
    this.state = 'failed';
    this.bindings?.plaque.draw(this.item?.title ?? '', 'Unavailable · retrying…');
  }

  /** Free the texture while retaining assignment and known aspect ratio. */
  unload(): void {
    this._loadToken += 1;
    this._loadController?.abort();
    this._loadController = null;
    this._loaded?.dispose();
    this._loaded = null;
    this.state = 'idle';
    const screenMaterial = this.screenMaterial;
    if (screenMaterial) {
      screenMaterial.map = null;
      screenMaterial.needsUpdate = true;
      screenMaterial.color.setScalar(0);
    }
    this.brightness = 0;
    this.targetBrightness = DIMMED;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unload();
    const bindings = this.bindings;
    this.bindings = null;
    bindings?.dispose();
  }

  setFit(fit: FitMode): void {
    this.fit = fit;
    this.layout();
  }

  layout(): void {
    const bindings = this.bindings;
    if (!bindings) return;
    const { maxWidth: maxW, maxHeight: maxH, hero } = this.slot;
    const aspect = this.aspect;
    const [fitW, fitH] = containBox(aspect, maxW, maxH);
    const [frameW, frameH] = this.fit === 'auto' ? [fitW, fitH] : [maxW, maxH];
    const [picW, picH] = this.fit === 'cover' ? [maxW, maxH] : [fitW, fitH];

    const texture = this._loaded?.texture;
    if (texture) {
      let rx = 1;
      let ry = 1;
      if (this.fit === 'cover') {
        if (aspect > maxW / maxH) rx = maxW / maxH / aspect;
        else ry = aspect / (maxW / maxH);
      }
      texture.repeat.set(rx, ry);
      texture.offset.set((1 - rx) / 2, (1 - ry) / 2);
    }

    const pad = (hero ? 0.26 : 0.2) * Math.min(1, Math.min(frameW, frameH) / 1.6);
    const innerW = frameW + pad * 2;
    const innerH = frameH + pad * 2;
    const outerW = innerW + BAR * 2;
    const outerH = innerH + BAR * 2;

    bindings.screen.scale.set(picW, picH, 1);
    bindings.matte.scale.set(innerW, innerH, 0.02);
    const [top, bottom, left, right] = bindings.bars;
    top.scale.set(outerW, BAR, DEPTH);
    top.position.set(0, innerH / 2 + BAR / 2, DEPTH / 2);
    bottom.scale.copy(top.scale);
    bottom.position.set(0, -top.position.y, DEPTH / 2);
    left.scale.set(BAR, innerH, DEPTH);
    left.position.set(-(innerW / 2 + BAR / 2), 0, DEPTH / 2);
    right.scale.copy(left.scale);
    right.position.set(-left.position.x, 0, DEPTH / 2);
    bindings.bars.forEach((bar, index) => {
      bar.updateMatrix();
      bindings.moulding.setMatrixAt(index, bar.matrix);
    });
    bindings.moulding.instanceMatrix.needsUpdate = true;
    bindings.moulding.computeBoundingSphere();
    bindings.moulding.computeBoundingBox();

    bindings.plaque.mesh.position.x = outerW / 2 + 0.32;
    bindings.plaque.mesh.position.z = 0.006;
    bindings.wash.scale.set(outerW * 1.75, outerH * 1.7, 1);
    bindings.wash.position.y = outerH * 0.12;
    this._outerSize = [outerW, outerH];
  }

  update(
    dt: number,
    cameraPosition: THREE.Vector3,
    { videoPlayDistance }: { videoPlayDistance: number },
  ): void {
    if (this.brightness !== this.targetBrightness) {
      const step = dt * FADE_SPEED;
      const delta = this.targetBrightness - this.brightness;
      this.brightness =
        Math.abs(delta) <= step ? this.targetBrightness : this.brightness + Math.sign(delta) * step;
      const screenMaterial = this.screenMaterial;
      screenMaterial?.color.setScalar(this.brightness * 0.96);
    }

    const video = this._loaded?.video;
    if (!video) return;
    const dx = cameraPosition.x - this.center.x;
    const dy = cameraPosition.y - this.center.y;
    const dz = cameraPosition.z - this.center.z;
    const visible =
      (typeof document === 'undefined' || !document.hidden) &&
      dx * this.normal.x + dy * this.normal.y + dz * this.normal.z > 0 &&
      dx * dx + dy * dy + dz * dz < videoPlayDistance * videoPlayDistance;
    if (visible && video.paused) void video.play().catch(() => undefined);
    else if (!visible && !video.paused) video.pause();
  }

  private get screenMaterial(): THREE.MeshBasicMaterial | null {
    return this.bindings?.screen.material ?? null;
  }
}

function containBox(aspect: number, maxW: number, maxH: number): [number, number] {
  return aspect > maxW / maxH ? [maxW, maxW / aspect] : [maxH * aspect, maxH];
}

export function createFrameRenderBindings(): FrameRenderBindings {
  const bars: FrameBars = [
    new THREE.Object3D(),
    new THREE.Object3D(),
    new THREE.Object3D(),
    new THREE.Object3D(),
  ];
  const moulding = new THREE.InstancedMesh(UNIT_BOX, MOULDING, 4);
  const matte = new THREE.Mesh(UNIT_BOX, MATTE);
  const screen = new THREE.Mesh(
    UNIT_PLANE,
    new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }),
  );
  screen.position.z = 0.031;
  matte.position.z = 0.02;
  const plaque = createPlaque();
  const wash = new THREE.Mesh(UNIT_PLANE, getWashMaterial());
  wash.position.z = 0.004;
  wash.renderOrder = -1;
  const hitTargets: readonly THREE.Object3D[] = [screen, matte, moulding];
  let released = false;
  return {
    bars,
    moulding,
    matte,
    screen,
    plaque,
    wash,
    hitTargets,
    dispose() {
      if (released) return;
      released = true;
      screen.material.dispose();
      moulding.dispose();
      const faceMaterial = plaque.face.material;
      if (faceMaterial instanceof THREE.MeshStandardMaterial) {
        faceMaterial.map?.dispose();
        faceMaterial.dispose();
      }
    },
  };
}

function getWashMaterial(): THREE.MeshBasicMaterial {
  if (washMaterial) return washMaterial;
  if (typeof document === 'undefined') throw new Error('ArtworkFrame requires a browser canvas');
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ArtworkFrame could not create a 2D canvas context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.58)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  const map = new THREE.CanvasTexture(canvas);
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  washMaterial = new THREE.MeshBasicMaterial({
    map,
    color: 0xffe4b8,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return washMaterial;
}

function createPlaque(): FramePlaque {
  if (typeof document === 'undefined') throw new Error('ArtworkFrame requires a browser canvas');
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ArtworkFrame could not create a 2D canvas context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const face = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.48,
    metalness: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(UNIT_BOX, PLAQUE_BACK);
  mesh.scale.set(0.36, 0.18, 0.012);
  const faceMesh = new THREE.Mesh(UNIT_PLANE, face);
  faceMesh.position.z = 0.6;
  mesh.add(faceMesh);
  return {
    mesh,
    face: faceMesh,
    draw(title, subtitle) {
      // Sleek dark obsidian museum plaque with gold & Hertha blue rule
      ctx.fillStyle = '#101622';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.55)';
      ctx.lineWidth = 10;
      ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
      ctx.fillStyle = '#1e56a0';
      ctx.fillRect(68, 66, 110, 10);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(190, 66, 36, 10);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 84px "Cormorant Garamond", Georgia, serif';
      wrapText(ctx, title, 68, 184, canvas.width - 136, 96, 2);
      ctx.fillStyle = '#d4af37';
      ctx.font = '500 50px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(subtitle, 68, 430);
      texture.needsUpdate = true;
    },
  };
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): void {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      if (lines >= maxLines) return;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, x, y + lines * lineHeight);
}
