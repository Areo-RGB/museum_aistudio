import { CONFIG } from '../config.ts';
import type { CacheLimits, ManifestAsset, MediaManifest } from '../types.ts';

export type CacheOpener = () => Promise<Cache | undefined>;
export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface CacheOptions extends CacheLimits {
  open: CacheOpener;
  fetcher?: Fetcher;
  now?: () => number;
}

interface HttpError extends Error {
  status: number;
}

function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && 'status' in error && typeof error.status === 'number';
}

function isManifestAsset(value: unknown): value is ManifestAsset {
  if (value === null || typeof value !== 'object') return false;
  if (!('key' in value) || typeof value.key !== 'string') return false;
  if ('url' in value && value.url !== undefined && typeof value.url !== 'string') return false;
  if ('sizeBytes' in value && value.sizeBytes !== undefined && typeof value.sizeBytes !== 'number')
    return false;
  if (
    'contentType' in value &&
    value.contentType !== undefined &&
    typeof value.contentType !== 'string'
  )
    return false;
  if ('sha256' in value && value.sha256 !== undefined && typeof value.sha256 !== 'string')
    return false;
  if ('etag' in value && value.etag !== undefined && typeof value.etag !== 'string') return false;
  return true;
}

export function isMediaManifest(value: unknown): value is MediaManifest {
  if (value === null || typeof value !== 'object' || !('assets' in value)) return false;
  return Array.isArray(value.assets) && value.assets.every(isManifestAsset);
}

function absoluteUrl(url: string): string {
  const base = typeof document === 'undefined' ? 'http://localhost/' : document.baseURI;
  return new URL(url, base).href;
}

function openOptionalCache(name: string): Promise<Cache | undefined> {
  if (typeof caches === 'undefined') return Promise.resolve(undefined);
  return caches.open(name);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/** Disk cache for source blobs; decoded canvases and GPU textures remain disposable. */
export class ImageCache {
  private readonly open: CacheOpener;
  private readonly fetcher: Fetcher;
  private readonly now: () => number;
  private readonly limits: CacheLimits;
  private writes: Promise<unknown> = Promise.resolve();
  private generation = 0;
  private pendingWrites = 0;
  private readonly invalidated = new Set<string>();

  constructor({
    open,
    fetcher = (input, init) => fetch(input, init),
    now = () => Date.now(),
    ...limits
  }: CacheOptions) {
    this.open = open;
    this.fetcher = fetcher;
    this.now = now;
    this.limits = limits;
  }

  async getBlob(url: string, { signal }: { signal?: AbortSignal } = {}): Promise<Blob> {
    signal?.throwIfAborted();
    const resolvedUrl = absoluteUrl(url);
    const generation = this.generation;
    const cache = await optionalRead(() => this.open());
    const cached =
      this.invalidated.has(resolvedUrl) || !cache
        ? null
        : await optionalRead(() => cache.match(resolvedUrl));
    signal?.throwIfAborted();
    const cachedAt = Number(cached?.headers.get('x-museum-cached-at') ?? 0);
    if (cached && this.now() - cachedAt < this.limits.maxAgeMs) {
      const blob = await optionalRead(() => cached.clone().blob(), 1000);
      signal?.throwIfAborted();
      if (blob) {
        const cacheToUpdate = cache;
        if (!cacheToUpdate) return blob;
        void this.mutate(async () => {
          if (generation !== this.generation || !(await cacheToUpdate.match(resolvedUrl))) return;
          const headers = new Headers(cached.headers);
          headers.set('x-museum-used-at', String(this.now()));
          await cacheToUpdate.put(resolvedUrl, new Response(blob, { headers }));
        });
        return blob;
      }
    }
    try {
      const response = await this.fetcher(resolvedUrl, {
        mode: 'cors',
        signal,
        cache: cached ? 'no-cache' : 'default',
      });
      if (!response.ok) {
        const error = Object.assign(new Error(`${String(response.status)} for ${resolvedUrl}`), {
          status: response.status,
        });
        throw error;
      }
      const blob = await response.blob();
      signal?.throwIfAborted();
      this.invalidated.delete(resolvedUrl);
      if (cache && blob.type.startsWith('image/')) {
        void this.store(cache, resolvedUrl, blob, this.now(), generation);
      }
      return blob;
    } catch (error: unknown) {
      signal?.throwIfAborted();
      if (isAbortError(error)) throw error;
      if (cached && (!isHttpError(error) || error.status >= 500)) {
        const blob = await optionalRead(() => cached.blob(), 1000);
        signal?.throwIfAborted();
        if (blob) return blob;
      }
      if (isHttpError(error) && error.status < 500) {
        this.invalidated.add(resolvedUrl);
        if (cache) void this.mutate(() => cache.delete(resolvedUrl), true);
      }
      throw error;
    }
  }

  mutate(task: () => Promise<unknown>, required = false): Promise<unknown> {
    if (!required && this.pendingWrites >= 4) return Promise.resolve(null);
    this.pendingWrites += 1;
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    const locked = (): Promise<unknown> => {
      if (!locks) return task();
      return locks.request('museum-image-cache', { ifAvailable: !required }, (lock) =>
        lock ? task() : Promise.resolve(null),
      );
    };
    const next = this.writes
      .then(() => bestEffort(locked))
      .finally(() => {
        this.pendingWrites -= 1;
      });
    this.writes = next;
    return next;
  }

  flush(): Promise<unknown> {
    return this.writes;
  }

  async invalidate(url: string): Promise<unknown> {
    const resolvedUrl = absoluteUrl(url);
    this.invalidated.add(resolvedUrl);
    const cache = await optionalRead(() => this.open());
    if (cache) return this.mutate(() => cache.delete(resolvedUrl), true);
    return null;
  }

  private store(
    cache: Cache,
    url: string,
    blob: Blob,
    cachedAt: number,
    generation: number,
  ): Promise<unknown> {
    if (blob.size > Math.min(this.limits.maxObjectBytes, this.limits.maxBytes)) {
      return Promise.resolve(null);
    }
    return this.mutate(async () => {
      if (generation !== this.generation) return;
      const headers = {
        'Content-Type': blob.type,
        'x-museum-bytes': String(blob.size),
        'x-museum-cached-at': String(cachedAt),
        'x-museum-used-at': String(this.now()),
      };
      const entries: { key: Request; bytes: number; used: number }[] = [];
      for (const key of await cache.keys()) {
        if (key.url === url) continue;
        const response = await cache.match(key);
        entries.push({
          key,
          bytes: Number(response?.headers.get('x-museum-bytes') ?? 0),
          used: Number(response?.headers.get('x-museum-used-at') ?? 0),
        });
      }
      entries.sort((a, b) => a.used - b.used);
      let bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0) + blob.size;
      while (
        entries.length &&
        (bytes > this.limits.maxBytes || entries.length + 1 > this.limits.maxEntries)
      ) {
        const entry = entries.shift();
        if (!entry) break;
        await cache.delete(entry.key);
        bytes -= entry.bytes;
      }
      if (this.limits.maxEntries > 0) {
        await cache.put(url, new Response(blob, { headers }));
      }
    });
  }

  async clear(): Promise<boolean> {
    this.generation += 1;
    const cache = await optionalRead(() => this.open());
    if (!cache) return false;
    const result = await this.mutate(async () => {
      for (const key of await cache.keys()) await cache.delete(key);
      return true;
    }, true);
    return result === true;
  }
}

async function bestEffort<T>(task: () => Promise<T>): Promise<T | null> {
  try {
    return await task();
  } catch {
    return null;
  }
}

async function optionalRead<T>(task: () => Promise<T>, ms = 150): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      bestEffort(task),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          resolve(null);
        }, ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export const PHOTO_CACHE_NAME = 'museum-photos-v1';
export const photoCache = new ImageCache({
  ...CONFIG.cache,
  open: () => openOptionalCache(PHOTO_CACHE_NAME),
});

/** Always revalidate the collection online; only use saved JSON when the network fails. */
export async function loadManifest(url: string): Promise<MediaManifest> {
  const cachePromise = bestEffort(() => openOptionalCache('museum-manifest-v1'));
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 5000);
  try {
    const response = await fetch(url, { cache: 'no-cache', signal: controller.signal });
    if (!response.ok) {
      const error = Object.assign(new Error(`${String(response.status)} for ${url}`), {
        status: response.status,
      });
      throw error;
    }
    const raw: unknown = await response.json();
    if (!isMediaManifest(raw)) throw new Error('Invalid media manifest');
    const saved = new Blob([JSON.stringify(raw)], { type: 'application/json' });
    if (saved.size <= 1024 * 1024) {
      void cachePromise.then(async (cache) => {
        if (!cache) return;
        await bestEffort(() => cache.put(url, new Response(saved)));
      });
    }
    return raw;
  } catch (error: unknown) {
    if (!isHttpError(error) || error.status >= 500) {
      const cache = await optionalRead(() => cachePromise);
      const saved: unknown = cache
        ? await optionalRead<unknown>(async () => {
            const response = await cache.match(url);
            if (!response) return null;
            const value: unknown = await response.json();
            return value;
          }, 1000)
        : null;
      if (isMediaManifest(saved)) return saved;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
