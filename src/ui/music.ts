const STORAGE_KEY = 'museum-music';
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

export interface MusicState {
  wanted: boolean;
  playing: boolean;
  held: boolean;
}

export interface BackgroundMusicOptions {
  volume?: number;
  onChange?: (state: MusicState) => void;
}

/** Persistent background music. UI owns the button; this controller owns only audio. */
export class BackgroundMusic {
  readonly audio: HTMLAudioElement;
  wanted: boolean;
  held = false;
  private readonly onChange?: (state: MusicState) => void;
  private readonly onPlay = (): void => {
    this.render();
  };
  private readonly onPause = (): void => {
    this.render();
  };
  private readonly startOnGesture = (): void => {
    for (const type of GESTURES) globalThis.removeEventListener(type, this.startOnGesture, true);
    this.sync();
  };

  constructor(url: string, { volume = 0.35, onChange }: BackgroundMusicOptions = {}) {
    this.onChange = onChange;
    this.audio = new Audio(url);
    this.audio.loop = true;
    this.audio.preload = 'none';
    this.audio.volume = volume;
    this.wanted = readPreference();
    this.audio.addEventListener('play', this.onPlay);
    this.audio.addEventListener('pause', this.onPause);
    this.sync();
  }

  toggle(): void {
    this.wanted = !this.wanted;
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, this.wanted ? 'on' : 'off');
    } catch {
      // Storage is optional (private browsing and embedded contexts).
    }
    this.sync();
  }

  hold(held: boolean): void {
    if (this.held === held) return;
    this.held = held;
    this.sync();
  }

  sync(): void {
    if (this.wanted && !this.held) {
      void this.audio.play().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          for (const type of GESTURES)
            globalThis.addEventListener(type, this.startOnGesture, { capture: true });
          return;
        }
        console.warn('[music] playback failed', error);
        this.wanted = false;
        this.render();
      });
    } else {
      this.audio.pause();
    }
    this.render();
  }

  dispose(): void {
    for (const type of GESTURES) globalThis.removeEventListener(type, this.startOnGesture, true);
    this.audio.removeEventListener('play', this.onPlay);
    this.audio.removeEventListener('pause', this.onPause);
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  private render(): void {
    this.onChange?.({
      wanted: this.wanted,
      playing: this.wanted && !this.held && !this.audio.paused,
      held: this.held,
    });
  }
}

function readPreference(): boolean {
  try {
    return globalThis.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}
