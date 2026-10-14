import type * as THREE from 'three';

export type MediaKind = 'image' | 'video' | 'text';
export type MediaSource = 'collection' | 'upload' | 'fallback' | 'fame';
export type FitMode = 'auto' | 'cover' | 'contain';
export type FrameLoadState = 'idle' | 'loading' | 'loaded' | 'failed';
export type Vector3Tuple = [number, number, number];

export interface MediaItem {
  id: string;
  kind: MediaKind;
  source: MediaSource;
  url?: string;
  blob?: Blob;
  text?: string;
  date?: Date | null;
  period?: string;
  title: string;
  subtitle: string;
  sizeBytes?: number;
}

export interface MonthSection {
  key: string;
  label: string;
  items: MediaItem[];
}

export interface MuseumFloor {
  key: string;
  label: string;
  range: string;
  count: number;
  order?: number;
  items: MediaItem[];
  months: MonthSection[];
  kind?: 'gallery' | 'fame' | 'cinema';
  featured?: MediaItem;
}

export interface LoadedMedia {
  texture: THREE.Texture;
  width: number;
  height: number;
  video: HTMLVideoElement | null;
  dispose: () => void;
}

export interface LoadingProgress {
  pending: number;
  done: number;
}

export interface FrameSlot {
  id: string;
  maxWidth: number;
  maxHeight: number;
  y: number;
  position: Vector3Tuple;
  rotationY: number;
  period?: string;
  itemId?: string | null;
  hero?: boolean;
  pinned?: boolean;
}

export interface FrameHandle {
  readonly slot: FrameSlot;
  item: MediaItem | null;
  fit: FitMode;
  state: FrameLoadState;
  retryAt: number;
  readonly center: THREE.Vector3;
  readonly normal: THREE.Vector3;
  readonly loaded: LoadedMedia | null;
  readonly loadToken: number;
  readonly loadController: AbortController | null;
  assign(item: MediaItem | null): void;
  beginLoad(): number;
  finishLoad(token: number, loaded: LoadedMedia): boolean;
  failLoad(token: number): void;
  unload(): void;
  setFit(fit: FitMode): void;
  update(dt: number, cameraPosition: THREE.Vector3, options: { videoPlayDistance: number }): void;
}

export interface CacheLimits {
  maxBytes: number;
  maxObjectBytes: number;
  maxEntries: number;
  maxAgeMs: number;
}

export interface ManifestAsset {
  key: string;
  url?: string;
  sizeBytes?: number;
  contentType?: string;
  sha256?: string;
  etag?: string;
}

export interface MediaManifest {
  assets: ManifestAsset[];
  [key: string]: unknown;
}
