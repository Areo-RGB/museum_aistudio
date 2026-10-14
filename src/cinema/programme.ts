import type { GeneratorName } from './generators.ts';

export interface YouTubeFilmSource {
  readonly type: 'youtube';
  readonly videoId: string;
  readonly url: string;
}

export interface VideoFilmSource {
  readonly type: 'video';
  readonly url: string;
}

export interface GeneratedFilmSource {
  readonly type: 'generated';
  readonly generator: GeneratorName;
}

export type FilmSource = YouTubeFilmSource | VideoFilmSource | GeneratedFilmSource;

export interface FilmEntry {
  readonly id: string;
  readonly title: string;
  readonly meta: string;
  readonly source: FilmSource;
}

const programme: readonly (readonly [string, string])[] = [
  ['_Nrxv-wW874', '16:04'],
  ['caE1LNS5ko0', '14:40'],
  ['7FDXjjBZAnI', '15:21'],
  ['fazVWhZYT3w', '16:18'],
  ['CRrCqnJQ2M8', '13:57'],
];

export const YOUTUBE_FILMS: FilmEntry[] = programme.map<FilmEntry>(([videoId, time], index) => ({
  id: `youtube:${videoId}`,
  title: `20 September 2026 · ${time}`,
  meta: `Film ${String(index + 1)} of 5 · YouTube`,
  source: { type: 'youtube', videoId, url: `https://youtu.be/${videoId}` },
}));

export interface CinemaFloor {
  readonly key: 'cinema';
  readonly kind: 'cinema';
  readonly label: string;
  readonly range: string;
  readonly count: number;
  readonly items: [];
  readonly months: [];
}

export const CINEMA_FLOOR: CinemaFloor = {
  key: 'cinema',
  kind: 'cinema',
  label: 'The Little Cinema',
  range: 'YouTube programme',
  count: YOUTUBE_FILMS.length,
  items: [],
  months: [],
};
