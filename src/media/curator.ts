import { CONFIG } from '../config.ts';
import type { FrameHandle, FitMode, LoadingProgress, MediaItem } from '../types.ts';
import { deleteSlotMedia, getSlotMedia, saveSlotMedia } from '../storage/db.ts';
import { kindOf } from './library.ts';
import type { MediaLibrary } from './library.ts';
import { createLimiter, loadMedia } from './loader.ts';
import type { Limiter } from './loader.ts';
import type { Vector3 } from 'three';

export interface CuratorMediaOptions {
  fallbackUrl: string;
  maxTextureSize: number;
  loadConcurrency: number;
  maxVideos: number;
  loadDistance: number;
  unloadDistance: number;
  videoPlayDistance: number;
  anisotropy: number;
}

export interface CuratorOptions {
  media: Partial<Omit<CuratorMediaOptions, 'anisotropy'>>;
  anisotropy?: number;
  onProgress?: (progress: LoadingProgress) => void;
}

export interface CuratorUpdateContext {
  camera: {
    position: Vector3;
  };
}

/**
 * Decides what hangs in each frame and keeps it in sync with storage.
 * Priority per frame: user upload (IndexedDB) → random item from the frame's
 * period → fallback.
 */
export class Curator {
  readonly frames: FrameHandle[];
  readonly library: MediaLibrary;
  readonly options: CuratorMediaOptions;
  private readonly limit: Limiter;
  private readonly onProgress: (progress: LoadingProgress) => void;
  private pending = 0;
  private done = 0;
  private streamElapsed = 0.2;
  private cameraPosition: Vector3 | undefined;
  preferredFrame: FrameHandle | undefined;
  disposed = false;

  constructor(
    frames: FrameHandle[],
    library: MediaLibrary,
    { media, anisotropy, onProgress }: CuratorOptions,
  ) {
    this.frames = frames;
    this.library = library;
    this.options = {
      ...CONFIG.media,
      ...media,
      anisotropy: anisotropy ?? 8,
    };
    this.limit = createLimiter(this.options.loadConcurrency);
    this.onProgress = onProgress ?? (() => undefined);
  }

  get fallbackItem(): MediaItem {
    return {
      id: 'fallback',
      kind: 'image',
      url: this.options.fallbackUrl,
      source: 'fallback',
      title: 'Untitled',
      subtitle: 'Photograph',
    };
  }

  /** Initial hang: restore uploads, fill the rest randomly. Textures stream in via update(). */
  async hangAll(): Promise<void> {
    const saved = await Promise.all(
      this.frames.map(async (frame) => {
        try {
          return await getSlotMedia(frame.slot.id);
        } catch {
          return undefined;
        }
      }),
    );
    if (this.disposed) return;
    this.frames.forEach((frame, index) => {
      const record = saved[index];
      if (record?.blob) {
        frame.setFit(record.fit);
        frame.assign(uploadItem(frame.slot.id, record.blob, record.type, record.name));
      } else {
        frame.assign(this.drawFor(frame));
      }
    });
  }

  /** Swap every non-upload frame for a fresh random piece. */
  shuffleAll(): void {
    const frames = this.frames.filter(
      (frame) => !frame.slot.hero && frame.item?.source !== 'upload',
    );
    const items = frames.map((frame) => frame.item ?? this.drawFor(frame));
    for (let index = items.length - 1; index > 0; index -= 1) {
      const current = items[index];
      const targetIndex = Math.floor(Math.random() * (index + 1));
      const target = items[targetIndex];
      if (current && target) {
        items[index] = target;
        items[targetIndex] = current;
      }
    }
    frames.forEach((frame, index) => {
      const item = items[index];
      if (item) frame.assign(item);
    });
    for (const frame of this.frames.filter(
      (candidate) =>
        candidate.slot.hero && !candidate.slot.pinned && candidate.item?.source !== 'upload',
    )) {
      frame.assign(
        this.library.draw((item) => item.period === frame.slot.period) ?? this.fallbackItem,
      );
    }
  }

  /** Swap one frame and load it straight away (the visitor is looking at it). */
  shuffle(frame: FrameHandle): Promise<void> {
    const peers = this.frames.filter(
      (candidate) =>
        candidate !== frame &&
        !candidate.slot.hero &&
        candidate.item?.source === 'collection' &&
        candidate.item.id !== frame.item?.id,
    );
    const peer = peers[Math.floor(Math.random() * peers.length)];
    if (peer && !frame.slot.hero && frame.item?.source === 'collection' && peer.item) {
      const previous = frame.item;
      frame.assign(peer.item);
      peer.assign(previous);
    } else if (frame.slot.pinned) {
      frame.assign(this.drawFor(frame));
    } else if (frame.slot.hero) {
      frame.assign(
        this.library.draw(
          (item) => item.period === frame.slot.period && item.id !== frame.item?.id,
        ) ?? this.drawFor(frame),
      );
    } else {
      frame.assign(this.drawFor(frame));
    }
    return this.load(frame);
  }

  async upload(frame: FrameHandle, file: File): Promise<void> {
    const kind = kindOf(file.type);
    if (!kind) throw new Error(`Unsupported file type: ${file.type || 'unknown'}`);
    await saveSlotMedia({
      slotId: frame.slot.id,
      blob: file,
      type: file.type,
      fit: frame.fit,
      name: file.name,
    });
    frame.assign(uploadItem(frame.slot.id, file, file.type, file.name));
    await this.load(frame);
  }

  /** Forget the upload and return the frame to the random collection. */
  async reset(frame: FrameHandle): Promise<void> {
    await deleteSlotMedia(frame.slot.id);
    frame.setFit('auto');
    await this.shuffle(frame);
  }

  async setFit(frame: FrameHandle, fit: FitMode): Promise<void> {
    frame.setFit(fit);
    if (frame.item?.source !== 'upload') return;
    const saved = await getSlotMedia(frame.slot.id);
    if (saved) {
      await saveSlotMedia({ ...saved, fit: frame.fit });
    }
  }

  drawFor(frame: FrameHandle): MediaItem {
    const assigned = frame.slot.itemId ? this.library.byId(frame.slot.itemId) : null;
    if (assigned) return assigned;
    const { period, hero } = frame.slot;
    const hanging = new Set(
      this.frames
        .filter((candidate) => candidate !== frame)
        .map((candidate) => candidate.item?.id)
        .filter((id): id is string => id !== undefined),
    );
    const videos = this.frames.filter(
      (candidate) => candidate !== frame && candidate.item?.kind === 'video',
    ).length;
    const fits = (candidate: MediaItem): boolean =>
      (!period || candidate.period === period) &&
      (candidate.kind !== 'video' || (videos < this.options.maxVideos && !hero));
    return (
      this.library.draw((candidate) => fits(candidate) && !hanging.has(candidate.id)) ??
      this.library.draw(fits) ??
      this.fallbackItem
    );
  }

  /** Load the frame's current item into a texture. */
  async load(frame: FrameHandle, priority = true): Promise<void> {
    if (this.disposed) return;
    const item = frame.item;
    if (!item) return;
    if (item.kind === 'video') {
      if (this.options.maxVideos <= 0) return;
      const active = this.frames.filter(
        (candidate) =>
          candidate !== frame &&
          candidate.item?.kind === 'video' &&
          (candidate.state === 'loaded' || candidate.state === 'loading'),
      );
      if (active.length >= this.options.maxVideos) {
        if (!priority) return;
        const cameraPosition = this.cameraPosition;
        if (cameraPosition) {
          active.sort(
            (a, b) => b.center.distanceTo(cameraPosition) - a.center.distanceTo(cameraPosition),
          );
        }
        active[0]?.unload();
      }
      if (priority) this.preferredFrame = frame;
    }
    const token = frame.beginLoad();
    this.track(1);
    try {
      const loaded = await this.limit(() => {
        if (this.disposed || token !== frame.loadToken) return null;
        return loadMedia(item, {
          ...this.options,
          signal: frame.loadController?.signal,
        });
      });
      if (loaded) frame.finishLoad(token, loaded);
    } catch (error: unknown) {
      if (token !== frame.loadToken) return;
      console.warn(`[curator] ${item.id} failed to load`, error);
      frame.failLoad(token);
      frame.retryAt = Date.now() + 5000;
    } finally {
      this.track(-1);
    }
  }

  private track(delta: number): void {
    if (delta > 0) this.pending += 1;
    else {
      this.pending -= 1;
      this.done += 1;
    }
    if (!this.disposed) this.onProgress({ pending: this.pending, done: this.done });
  }

  dispose(): void {
    this.disposed = true;
    for (const frame of this.frames) frame.unload();
  }

  onVisibilityChange(visible: boolean): void {
    if (!visible) {
      for (const frame of this.frames) frame.loaded?.video?.pause();
    } else {
      this.streamElapsed = 0.2;
    }
  }

  update(dt: number, app: CuratorUpdateContext): void {
    if (this.disposed) return;
    const position = app.camera.position;
    this.cameraPosition = position;
    for (const frame of this.frames) frame.update(dt, position, this.options);
    this.streamElapsed += dt;
    if (this.streamElapsed < 0.2) return;
    this.streamElapsed = 0;
    const byDistance = this.frames
      .map((frame) => ({ frame, distance: frame.center.distanceTo(position) }))
      .sort((a, b) =>
        a.frame === this.preferredFrame
          ? -1
          : b.frame === this.preferredFrame
            ? 1
            : a.distance - b.distance,
      );
    let videos = 0;
    for (const { frame, distance } of byDistance) {
      const allowed =
        frame.item?.kind !== 'video' ||
        (distance < this.options.loadDistance && videos++ < this.options.maxVideos);
      if (!allowed) {
        if (frame.state !== 'idle') frame.unload();
        continue;
      }
      if (
        (frame.state === 'idle' || (frame.state === 'failed' && Date.now() >= frame.retryAt)) &&
        frame.item &&
        distance < this.options.loadDistance
      ) {
        void this.load(frame, false);
      } else if (frame.state !== 'idle' && distance > this.options.unloadDistance) {
        frame.unload();
      }
    }
  }
}

function uploadItem(slotId: string, blob: Blob, type: string, name = 'Upload'): MediaItem {
  return {
    id: `upload:${slotId}`,
    kind: kindOf(type) ?? 'image',
    blob,
    source: 'upload',
    title: name.replace(/\.[^.]+$/, ''),
    subtitle: 'From your collection',
  };
}
