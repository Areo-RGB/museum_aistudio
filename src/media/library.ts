import { isMediaManifest, loadManifest } from './cache.ts';
import type { MediaItem, MediaKind, MonthSection, MuseumFloor } from '../types.ts';

export interface ParsedDate {
  date: Date;
  hasTime: boolean;
}

export interface Period {
  key: string;
  label: string;
  range: string;
  count: number;
  order: number;
}

export function kindOf(contentType = ''): Exclude<MediaKind, 'text'> | null {
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('image/')) return 'image';
  return null;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Pull a capture date out of common camera / messenger file names. */
export function parseDate(key: string): ParsedDate | null {
  const filename = key.split('/').pop() ?? key;
  const name = filename.replace(/\.[^.]+$/, '');
  const epoch = /^(\d{13})$/.exec(name);
  if (epoch?.[1]) return { date: new Date(Number(epoch[1])), hasTime: false };
  const whatsapp = /(\d{4})-(\d{2})-(\d{2}) at (\d{2})\.(\d{2})/.exec(name);
  const stamp = whatsapp ?? /(\d{4})[-_]?(\d{2})[-_]?(\d{2})(?:[-_](\d{2})(\d{2}))?/.exec(name);
  if (!stamp?.[1] || !stamp[2] || !stamp[3]) return null;
  const month = Number(stamp[2]);
  if (month < 1 || month > 12) return null;
  const day = Number(stamp[3]);
  if (day < 1 || day > 31) return null;
  const hour = stamp[4] ? Number(stamp[4]) : 0;
  const minute = stamp[5] ? Number(stamp[5]) : 0;
  return {
    date: new Date(Number(stamp[1]), month - 1, day, hour, minute),
    hasTime: stamp[4] !== undefined,
  };
}

/** Derive a museum-label style caption from a file name. */
export function captionFor(
  key: string,
  kind: Exclude<MediaKind, 'text'>,
): { title: string; subtitle: string; date: Date | null } {
  const medium = kind === 'video' ? 'Moving image' : 'Photograph';
  const parsed = parseDate(key);
  if (!parsed) {
    const filename = key.split('/').pop() ?? key;
    const name = filename.replace(/\.[^.]+$/, '');
    return { title: name.replace(/[-_]+/g, ' ').trim(), subtitle: medium, date: null };
  }
  const { date, hasTime } = parsed;
  let title = `${String(date.getDate())} ${String(MONTHS[date.getMonth()])} ${String(
    date.getFullYear(),
  )}`;
  if (hasTime) {
    title += ` · ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(
      2,
      '0',
    )}`;
  }
  return { title, subtitle: medium, date };
}

const SEASONS = ['Winter', 'Spring', 'Summer', 'Autumn'];
export const UNDATED = 'undated';

/**
 * Meteorological seasons: December belongs to the following year's winter.
 */
export function periodFor(date: Date | null | undefined): {
  key: string;
  label: string;
  order: number;
} {
  if (!date) return { key: UNDATED, label: 'Undated', order: Infinity };
  const month = date.getMonth();
  const year = date.getFullYear() + (month === 11 ? 1 : 0);
  const season = month === 11 ? 0 : Math.floor((month + 1) / 3);
  const label = SEASONS[season] ?? 'Undated';
  return {
    key: `${String(year)}-${String(season)}`,
    label: `${label} ${String(year)}`,
    order: year * 4 + season,
  };
}

function formatRange(dates: Date[]): string {
  if (!dates.length) return 'Date unknown';
  const min = new Date(Math.min(...dates.map((date) => date.getTime())));
  const max = new Date(Math.max(...dates.map((date) => date.getTime())));
  const month = (date: Date): string => MONTHS[date.getMonth()] ?? '';
  if (min.getFullYear() !== max.getFullYear()) {
    return `${month(min)} ${String(min.getFullYear())} – ${month(max)} ${String(
      max.getFullYear(),
    )}`;
  }
  if (min.getMonth() === max.getMonth()) {
    return `${month(min)} ${String(min.getFullYear())}`;
  }
  return `${month(min)} – ${month(max)} ${String(max.getFullYear())}`;
}

/**
 * R2 doesn't send `Vary: Origin`, so a plain (non-CORS) fetch of an object can
 * leave a cached copy without CORS headers that later breaks WebGL use of the
 * same URL. A dedicated query string gives our CORS requests their own cache
 * entry; R2 ignores it when resolving the object.
 */
export function corsCacheKey(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}cors=1`;
}

function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = array[i];
    const target = array[j];
    if (current !== undefined && target !== undefined) {
      array[i] = target;
      array[j] = current;
    }
  }
  return array;
}

/** The remote collection described by the R2 manifest. */
export class MediaLibrary {
  readonly items: MediaItem[];
  private deck: MediaItem[] = [];
  private index: Map<string, MediaItem> | null = null;

  constructor(items: MediaItem[]) {
    this.items = items;
  }

  static async load(
    url: string,
    { hidden = [] }: { hidden?: string[] } = {},
  ): Promise<MediaLibrary> {
    try {
      const manifest: unknown = await loadManifest(url);
      if (!isMediaManifest(manifest)) throw new Error('Invalid media manifest');
      const skip = new Set(hidden);
      const items = manifest.assets.flatMap((asset): MediaItem[] => {
        const kind = kindOf(asset.contentType ?? '');
        const name = asset.key.split('/').pop() ?? asset.key;
        if (!kind || !asset.url || skip.has(name)) return [];
        const caption = captionFor(asset.key, kind);
        return [
          {
            id: asset.key,
            kind,
            url: corsCacheKey(asset.url),
            source: 'collection',
            sizeBytes: asset.sizeBytes,
            ...caption,
            period: periodFor(caption.date).key,
          },
        ];
      });
      return new MediaLibrary(items);
    } catch (error: unknown) {
      console.warn('[library] manifest unavailable, using fallback only', error);
      return new MediaLibrary([]);
    }
  }

  get size(): number {
    return this.items.length;
  }

  periods(): Period[] {
    return this.floors().map((floor) => ({
      key: floor.key,
      label: floor.label,
      range: floor.range,
      count: floor.count,
      order: floor.order ?? Infinity,
    }));
  }

  floors(): MuseumFloor[] {
    const groups = new Map<
      string,
      { key: string; label: string; order: number; items: MediaItem[] }
    >();
    for (const item of this.items.filter((candidate) => candidate.source === 'collection')) {
      const period = periodFor(item.date);
      let group = groups.get(period.key);
      if (!group) {
        group = { ...period, items: [] };
        groups.set(period.key, group);
      }
      group.items.push(item);
    }
    const byDate = (a: MediaItem, b: MediaItem): number =>
      (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0) || a.id.localeCompare(b.id);
    return [...groups.values()]
      .sort((a, b) => a.order - b.order)
      .map((floor): MuseumFloor => {
        const items = floor.items.sort(byDate);
        const months = new Map<string, MonthSection>();
        for (const item of items) {
          const month = item.date;
          const key = month
            ? `${String(month.getFullYear())}-${String(month.getMonth())}`
            : UNDATED;
          const label = month ? (MONTHS[month.getMonth()] ?? 'Undated') : 'Undated';
          let section = months.get(key);
          if (!section) {
            section = { key, label, items: [] };
            months.set(key, section);
          }
          section.items.push(item);
        }
        return {
          key: floor.key,
          label: floor.label,
          order: floor.order,
          items,
          count: items.length,
          months: [...months.values()],
          range: formatRange(items.flatMap((item) => (item.date ? [item.date] : []))),
        };
      });
  }

  add(items: MediaItem[]): void {
    this.items.push(...items);
    this.index = null;
    this.deck = [];
  }

  byId(id: string): MediaItem | null {
    this.index ??= new Map(this.items.map((item) => [item.id, item]));
    return this.index.get(id) ?? null;
  }

  draw(accept: (item: MediaItem) => boolean = () => true): MediaItem | null {
    if (!this.items.length) return null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (!this.deck.length) this.deck = shuffle([...this.items]);
      const index = this.deck.findIndex(accept);
      if (index >= 0) return this.deck.splice(index, 1)[0] ?? null;
      this.deck = [];
    }
    return null;
  }
}
