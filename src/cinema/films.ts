import * as THREE from 'three';
import { GENERATORS } from './generators.ts';
import type { FilmGenerator, GeneratorName } from './generators.ts';

export interface CinemaFilm {
  readonly texture?: THREE.Texture;
  readonly width: number;
  readonly height: number;
  readonly hasAudio: boolean;
  readonly sampleSource?: CanvasImageSource;
  readonly paused: boolean;
  readonly progress: number | null;
  play(): Promise<void>;
  pause(): void;
  update(delta: number): void;
  setVolume(value: number): void;
  dispose(): void;
}

export interface VideoFilmAudio {
  readonly listener: THREE.AudioListener;
  readonly speaker: THREE.Object3D;
}

export class GeneratedFilm implements CinemaFilm {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  readonly generator: FilmGenerator;
  readonly texture: THREE.CanvasTexture;
  readonly width: number;
  readonly height: number;
  readonly hasAudio = false;
  paused = true;
  private time = 0;

  constructor(generatorName: GeneratorName, dimensions: { width?: number; height?: number } = {}) {
    const factory = GENERATORS[generatorName];
    this.canvas = document.createElement('canvas');
    this.width = dimensions.width ?? 1280;
    this.height = dimensions.height ?? 720;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not create cinema canvas context');
    this.context = context;
    this.generator = factory(this.width, this.height);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.draw();
  }

  get sampleSource(): HTMLCanvasElement {
    return this.canvas;
  }

  get progress(): number | null {
    const duration = this.generator.duration;
    return Number.isFinite(duration) ? (this.time % duration) / duration : null;
  }

  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }

  setVolume(_value: number): void {
    /* Generated films have no audio track. */
  }

  update(delta: number): void {
    if (this.paused) return;
    this.time += delta;
    this.draw();
  }

  private draw(): void {
    this.generator.draw(this.context, this.time);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
export function generatorPoster(
  name: GeneratorName,
  time = 2.5,
  width = 320,
  height = 180,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create poster canvas context');
  const generator = GENERATORS[name](width, height);
  for (let elapsed = 0; elapsed <= time; elapsed += 0.1) generator.draw(context, elapsed);
  return canvas.toDataURL('image/jpeg', 0.8);
}

export class VideoFilm implements CinemaFilm {
  readonly video: HTMLVideoElement;
  readonly width: number;
  readonly height: number;
  readonly texture: THREE.VideoTexture;
  readonly hasAudio = true;
  readonly audio: THREE.PositionalAudio;

  static load(url: string, audio: VideoFilmAudio): Promise<VideoFilm> {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    return new Promise<VideoFilm>((resolve, reject) => {
      const onLoaded = (): void => {
        resolve(new VideoFilm(video, audio.listener, audio.speaker));
      };
      const onError = (): void => {
        video.removeAttribute('src');
        video.load();
        reject(new Error(`Could not load ${url}`));
      };
      video.addEventListener('loadeddata', onLoaded, { once: true });
      video.addEventListener('error', onError, { once: true });
    });
  }

  constructor(video: HTMLVideoElement, listener: THREE.AudioListener, speaker: THREE.Object3D) {
    this.video = video;
    this.width = video.videoWidth;
    this.height = video.videoHeight;
    this.texture = new THREE.VideoTexture(video);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.audio = new THREE.PositionalAudio(listener);
    this.audio.setMediaElementSource(video);
    this.audio.setRefDistance(7);
    this.audio.setRolloffFactor(1.6);
    this.audio.setDirectionalCone(200, 320, 0.25);
    speaker.add(this.audio);
  }

  get sampleSource(): HTMLVideoElement {
    return this.video;
  }
  get paused(): boolean {
    return this.video.paused;
  }
  get progress(): number | null {
    return this.video.duration ? this.video.currentTime / this.video.duration : null;
  }

  async play(): Promise<void> {
    await this.audio.context.resume();
    await this.video.play();
  }

  pause(): void {
    this.video.pause();
  }
  update(_delta: number): void {
    /* Video playback advances through the media element. */
  }
  setVolume(value: number): void {
    this.audio.setVolume(value);
  }

  dispose(): void {
    this.video.pause();
    this.audio.disconnect();
    this.audio.removeFromParent();
    this.texture.dispose();
    this.video.removeAttribute('src');
    this.video.load();
  }
}
