export interface YouTubePlayer {
  playVideo?(): void;
  pauseVideo?(): void;
  setVolume?(value: number): void;
  getDuration?(): number;
  getCurrentTime?(): number;
  destroy?(): void;
}

export interface YouTubeStateEvent {
  readonly data: number;
}
export interface YouTubeErrorEvent {
  readonly data: number;
}
export interface YouTubePlayerEvents {
  onReady: () => void;
  onStateChange: (event: YouTubeStateEvent) => void;
  onAutoplayBlocked: () => void;
  onError: (event: YouTubeErrorEvent) => void;
}
export interface YouTubePlayerOptions {
  readonly events: YouTubePlayerEvents;
}
export interface YouTubeNamespace {
  readonly Player: new (iframe: HTMLIFrameElement, options: YouTubePlayerOptions) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: (() => void) | undefined;
  }
}

let apiPromise: Promise<YouTubeNamespace> | undefined;

/** Load the official API only after a visitor selects a film. */
export function loadYouTubeAPI(): Promise<YouTubeNamespace> {
  const current = window.YT;
  if (current?.Player) return Promise.resolve(current);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const script = document.createElement('script');
    const previous = window.onYouTubeIframeAPIReady;
    let timer = 0;
    const fail = (): void => {
      clearTimeout(timer);
      script.remove();
      window.onYouTubeIframeAPIReady = previous;
      apiPromise = undefined;
      reject(new Error('YouTube could not connect. Select the film to retry.'));
    };
    timer = setTimeout(fail, 20_000);
    window.onYouTubeIframeAPIReady = (): void => {
      clearTimeout(timer);
      previous?.();
      const ready = window.YT;
      if (ready) resolve(ready);
      else fail();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = fail;
    document.head.append(script);
  });
  return apiPromise;
}

export function youtubeEmbedURL(videoId: string, origin: string): string {
  if (!/^[\w-]{11}$/.test(videoId)) throw new Error('Invalid YouTube video ID');
  const url = new URL(`https://www.youtube.com/embed/${videoId}`);
  url.search = new URLSearchParams({
    enablejsapi: '1',
    playsinline: '1',
    origin,
    rel: '0',
  }).toString();
  return url.href;
}

export interface YouTubeFilmContainer {
  replaceChildren(...nodes: Node[]): void;
}

/** DOM playback remains separate from WebGL because YouTube exposes no video texture. */
export class YouTubeFilm {
  readonly iframe: HTMLIFrameElement;
  readonly ready: Promise<void>;
  readonly onChange: () => void;
  paused = true;
  disposed = false;
  volume = 0.8;
  status = 'Connecting to YouTube…';
  player: YouTubePlayer | undefined;
  isReady = false;
  private timer = 0;
  private rejectReady: ((reason?: unknown) => void) | undefined;

  constructor(videoId: string, container: YouTubeFilmContainer, onChange: () => void) {
    this.onChange = onChange;
    this.iframe = document.createElement('iframe');
    this.iframe.title = 'Cinema YouTube player';
    this.iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    this.iframe.allowFullscreen = true;
    this.iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    this.iframe.src = youtubeEmbedURL(videoId, location.origin);
    container.replaceChildren(this.iframe);
    this.ready = this.initialize();
  }

  private async initialize(): Promise<void> {
    const youtube = await loadYouTubeAPI();
    if (this.disposed) return;
    return new Promise<void>((resolve, reject) => {
      this.rejectReady = reject;
      this.timer = setTimeout(() => {
        reject(new Error('YouTube did not respond. Select the film to retry.'));
      }, 20_000);
      this.player = new youtube.Player(this.iframe, {
        events: {
          onReady: () => {
            clearTimeout(this.timer);
            if (this.disposed) return;
            this.isReady = true;
            this.player?.setVolume?.(this.volume * 100);
            this.status = 'Press Play on the video if playback does not start.';
            resolve();
            this.onChange();
          },
          onStateChange: ({ data }) => {
            if (this.disposed) return;
            this.paused = data !== 1 && data !== 3;
            this.status =
              data === 1
                ? 'Playing on YouTube'
                : data === 0
                  ? 'Film finished'
                  : data === 3
                    ? 'Buffering…'
                    : 'Paused · press Play to watch';
            this.onChange();
          },
          onAutoplayBlocked: () => {
            if (this.disposed) return;
            this.status = 'Tap Play on the video to begin with sound.';
            this.onChange();
          },
          onError: ({ data }) => {
            if (this.disposed) return;
            clearTimeout(this.timer);
            this.paused = true;
            this.status = [101, 150].includes(data)
              ? 'The owner has disabled embedding. Open this film on YouTube.'
              : `YouTube playback error (${String(data)}). Try again or open on YouTube.`;
            reject(new Error(this.status));
            this.onChange();
          },
        },
      });
    });
  }

  get progress(): number {
    const duration = this.isReady ? (this.player?.getDuration?.() ?? 0) : 0;
    return duration > 0 ? (this.player?.getCurrentTime?.() ?? 0) / duration : 0;
  }

  play(): Promise<void> {
    if (!this.disposed && this.isReady) this.player?.playVideo?.();
    return Promise.resolve();
  }

  pause(): void {
    if (this.isReady) this.player?.pauseVideo?.();
  }

  setVolume(value: number): void {
    this.volume = value;
    if (this.isReady) this.player?.setVolume?.(value * 100);
  }

  update(_delta: number): void {
    /* YouTube playback is advanced by the iframe API. */
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.timer);
    this.rejectReady?.(new Error('Playback cancelled'));
    this.player?.destroy?.();
    this.iframe.remove();
  }
}
