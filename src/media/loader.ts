import * as THREE from 'three';
import { photoCache } from './cache.ts';
import type { LoadedMedia, MediaItem } from '../types.ts';

interface LoadOptions {
  maxTextureSize: number;
  anisotropy: number;
  signal?: AbortSignal;
}

interface QueueEntry {
  run: () => Promise<void>;
}

export type Limiter = <T>(task: () => T | Promise<T>) => Promise<T>;

/** Run at most `n` async tasks at a time. */
export function createLimiter(limit: number): Limiter {
  const queue: QueueEntry[] = [];
  let active = 0;

  const next = (): void => {
    if (active >= limit || queue.length === 0) return;
    const entry = queue.shift();
    if (!entry) return;
    active += 1;
    void entry.run().finally(() => {
      active -= 1;
      next();
    });
  };

  return <T>(task: () => T | Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push({
        run: async () => {
          try {
            resolve(await task());
          } catch (error: unknown) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        },
      });
      next();
    });
}

function hasFontLoader(value: unknown): value is Pick<FontFaceSet, 'load'> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'load' in value &&
    typeof value.load === 'function'
  );
}

function mediaUrl(item: MediaItem): string {
  if (!item.url) throw new Error(`Media item has no URL: ${item.id}`);
  return item.url;
}
/** Load an image or video into a GPU-ready texture. */
export function loadMedia(
  item: MediaItem,
  { maxTextureSize, anisotropy, signal }: LoadOptions,
): Promise<LoadedMedia> {
  if (item.kind === 'text') return loadText(item, anisotropy);
  if (item.kind === 'video') return loadVideo(item, anisotropy, signal);
  return loadImage(item, maxTextureSize, anisotropy, signal);
}

/** A name lettered in gold on Hertha royal navy, drawn once the display serif has loaded. */
async function loadText(item: MediaItem, anisotropy: number): Promise<LoadedMedia> {
  const font = 'italic 600 350px "Cormorant Garamond", Georgia, serif';
  const fonts: unknown = Reflect.get(document, 'fonts');
  if (hasFontLoader(fonts)) await fonts.load(font).catch(() => undefined);
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1365;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create canvas context');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  const width = canvas.width;
  const height = canvas.height;
  const glow = context.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    width * 0.62,
  );
  glow.addColorStop(0, '#1e4682');
  glow.addColorStop(0.55, '#10264a');
  glow.addColorStop(1, '#071124');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  // Double Championship Gold & Royal Blue border frame
  context.strokeStyle = 'rgba(212, 175, 55, 0.65)';
  context.lineWidth = 8;
  context.strokeRect(56, 56, width - 112, height - 112);
  context.strokeStyle = 'rgba(212, 175, 55, 0.25)';
  context.lineWidth = 3;
  context.strokeRect(78, 78, width - 156, height - 156);

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = 'rgba(230, 200, 117, 0.85)';
  context.font = '600 44px "Outfit", sans-serif';
  context.fillText('F.C. HERTHA 03 ZEHLENDORF · HALL OF FAME', width / 2, height * 0.2);

  context.fillStyle = '#e6c875';
  context.font = font;
  context.fillText(item.text ?? item.title, width / 2, height * 0.48);

  context.fillStyle = '#d4af37';
  context.fillRect(width * 0.3, height * 0.72, width * 0.4, 6);
  context.font = '74px Georgia, serif';
  for (const x of [width * 0.24, width * 0.76]) context.fillText('★', x, height * 0.72);
  context.fillStyle = 'rgba(248, 250, 252, 0.72)';
  context.font = '500 38px "Plus Jakarta Sans", sans-serif';
  context.fillText('JAHRGANG 2014 · CLUB LEGEND', width / 2, height * 0.82);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return {
    texture,
    video: null,
    width,
    height,
    dispose() {
      texture.dispose();
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

async function loadImage(
  item: MediaItem,
  maxSize: number,
  anisotropy: number,
  signal?: AbortSignal,
): Promise<LoadedMedia> {
  const blob = item.blob ?? (await photoCache.getBlob(mediaUrl(item), { signal }));
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(blob, {
      imageOrientation: 'from-image',
      resizeQuality: 'high',
    } as ImageBitmapOptions).catch(() => createImageBitmap(blob));
    signal?.throwIfAborted();
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create canvas context');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    bitmap = undefined;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return {
      texture,
      video: null,
      width: canvas.width,
      height: canvas.height,
      dispose() {
        texture.dispose();
        canvas.width = 0;
        canvas.height = 0;
      },
    };
  } catch (error: unknown) {
    bitmap?.close();
    if (!item.blob && item.url) void photoCache.invalidate(item.url);
    throw error;
  }
}

function loadVideo(
  item: MediaItem,
  anisotropy: number,
  signal?: AbortSignal,
): Promise<LoadedMedia> {
  const video = document.createElement('video');
  const objectUrl = item.blob ? URL.createObjectURL(item.blob) : null;
  if (!objectUrl) video.crossOrigin = 'anonymous';
  Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'auto' });
  video.src = objectUrl ?? mediaUrl(item);

  return new Promise<LoadedMedia>((resolve, reject) => {
    let settled = false;
    let texture: THREE.VideoTexture | undefined;
    const onAbort = (): void => {
      if (settled) return;
      cleanup();
      reject(new DOMException('Media load cancelled', 'AbortError'));
    };
    const onError = (): void => {
      if (settled) return;
      cleanup();
      reject(new Error(`video failed: ${item.id}`));
    };
    const onSeeked = (): void => {
      if (texture) texture.needsUpdate = true;
    };
    const cleanup = (): void => {
      signal?.removeEventListener('abort', onAbort);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('error', onError);
      video.removeEventListener('seeked', onSeeked);
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    const onReady = (): void => {
      if (settled) return;
      settled = true;
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
      texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = anisotropy;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      video.addEventListener('seeked', onSeeked, { once: true });
      video.currentTime = Math.min(1, (video.duration || 0) / 10);
      resolve({
        texture,
        video,
        width: video.videoWidth,
        height: video.videoHeight,
        dispose() {
          texture?.dispose();
          cleanup();
        },
      });
    };
    video.addEventListener('loadeddata', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}
