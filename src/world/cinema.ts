import * as THREE from 'three';
import { CINEMA, ROOM, SEATS } from './layout.ts';
import type { LayoutPlacement } from './layout.ts';
import { GeneratedFilm, VideoFilm } from '../cinema/films.ts';
import type { CinemaFilm } from '../cinema/films.ts';
import { YouTubeFilm } from '../cinema/youtube.ts';
import { CinemaScreen, viewingPosition } from '../cinema/screen.ts';
import type { CinemaScreenHost } from '../cinema/screen.ts';
import type { FilmEntry } from '../cinema/programme.ts';

const B = CINEMA.bounds;
const SCREEN = CINEMA.screen;
const SCREEN_Z = B.maxZ - ROOM.wall / 2 - 0.03;
const SEATED_EYE = 1.12;

export interface CinemaSnapshot {
  readonly nowPlaying: FilmEntry | null;
  readonly loading: FilmEntry | null;
  readonly film: CinemaFilm | YouTubeFilm | null;
}

export interface CinemaHost {
  readonly camera: THREE.Camera;
  readonly canvas: HTMLCanvasElement;
  readonly scene: THREE.Scene;
  readonly setAmbient: (factor: number) => void;
}

export interface CinemaSconceBinding {
  readonly light: THREE.PointLight;
  readonly base: number;
}

export interface CinemaRenderBindings {
  readonly surface: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly letterbox: THREE.Mesh;
  readonly speaker: THREE.Object3D;
  readonly screenLight: THREE.RectAreaLight;
  readonly stageLed: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  readonly beamMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  readonly projectorLens: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  readonly sconces: readonly CinemaSconceBinding[];
}

export interface CinemaInteractionHandles {
  readonly surface: THREE.Object3D;
  readonly letterbox: THREE.Object3D;
  readonly seats: readonly THREE.Object3D[];
  seatPose(instanceId: number): { position: THREE.Vector3; yaw: number } | null;
}

export interface CinemaHandle {
  readonly placement: LayoutPlacement;
  readonly snapshot: CinemaSnapshot;
  readonly interaction: CinemaInteractionHandles | null;
  subscribe(listener: (snapshot: CinemaSnapshot) => void): () => void;
  project(entry: FilmEntry): Promise<void>;
  stop(): void;
  togglePause(): Promise<void>;
  setVolume(value: number): void;
  onVisibilityChange(visible: boolean): void;
  viewingPosition(): THREE.Vector3;
  lookAtScreen(): THREE.Vector3;
  setInteractive(interactive: boolean): void;
  update(delta: number): void;
  dispose(): void;
}

export class CinemaPlayback implements CinemaHandle {
  readonly placement: LayoutPlacement;
  readonly host: CinemaHost;
  private bindings: CinemaRenderBindings | null = null;
  private screen: CinemaScreen | null = null;
  private idleFilm: GeneratedFilm | null = null;
  private film: CinemaFilm | YouTubeFilm | null = null;
  private interactionHandles: CinemaInteractionHandles | null = null;
  private nowPlaying: FilmEntry | null = null;
  private loading: FilmEntry | null = null;
  private readonly listeners = new Set<(snapshot: CinemaSnapshot) => void>();
  private readonly localPoint = new THREE.Vector3();
  private readonly worldPoint = new THREE.Vector3();
  private readonly glowColor = new THREE.Color(0.6, 0.5, 0.5);
  private readonly glowTarget = new THREE.Color(0.6, 0.5, 0.5);
  private readonly sampler: CanvasRenderingContext2D | null;
  private loadToken = 0;
  private resumeFilm: CinemaFilm | YouTubeFilm | null = null;
  private volume = 0.8;
  private houseLights = 1;
  private ambient = 1;
  private beam = 0;
  private glowLevel = 0.3;
  private glowLevelTarget = 0.3;
  private sampleTimer = 0;
  private listener: THREE.AudioListener | null = null;
  private disposed = false;

  constructor(host: CinemaHost, placement: LayoutPlacement) {
    this.host = host;
    this.placement = placement;
    const sampler = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    this.sampler = sampler;
    if (sampler) {
      sampler.canvas.width = 8;
      sampler.canvas.height = 8;
    }
  }

  get snapshot(): CinemaSnapshot {
    return { nowPlaying: this.nowPlaying, loading: this.loading, film: this.film };
  }

  get interaction(): CinemaInteractionHandles | null {
    return this.interactionHandles;
  }

  /** Attach only the R3F meshes created by MuseumCinema; playback never creates theatre geometry. */
  attach(bindings: CinemaRenderBindings, seats: readonly THREE.Object3D[] = []): void {
    if (this.disposed) return;
    this.bindings = { ...bindings, sconces: bindings.sconces };
    this.screen = new CinemaScreen(
      { canvas: this.host.canvas, camera: this.host.camera } satisfies CinemaScreenHost,
      bindings.surface,
    );
    this.idleFilm = new GeneratedFilm('idle', { width: 1680, height: 720 });
    void this.idleFilm.play();
    this.showOnScreen(this.idleFilm);
    this.interactionHandles = {
      surface: bindings.surface,
      letterbox: bindings.letterbox,
      seats,
      seatPose: (instanceId) => this.seatPose(instanceId),
    };
  }

  subscribe(listener: (snapshot: CinemaSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const current = this.snapshot;
    for (const listener of this.listeners) listener(current);
  }

  async project(entry: FilmEntry): Promise<void> {
    const token = ++this.loadToken;
    this.loading = entry;
    this.notify();
    try {
      if (entry.source.type === 'youtube') {
        this.disposeFilm();
        const screen = this.screen;
        if (!screen) throw new Error('Cinema screen is not mounted');
        screen.setActive(true);
        this.bindings?.surface.scale.set(SCREEN.width, SCREEN.height, 1);
        const film = new YouTubeFilm(entry.source.videoId, screen.container, () => {
          this.notify();
        });
        this.film = film;
        this.nowPlaying = entry;
        film.setVolume(this.volume);
        this.notify();
        await film.ready;
        if (token !== this.loadToken || this.disposed) return;
        if (document.hidden) this.resumeFilm = film;
        else await film.play();
        return;
      }
      const renderBindings = this.bindings;
      if (!renderBindings) throw new Error('Cinema render bindings are not attached');
      const film =
        entry.source.type === 'video'
          ? await VideoFilm.load(entry.source.url, {
              listener: this.ensureListener(),
              speaker: renderBindings.speaker,
            })
          : new GeneratedFilm(entry.source.generator);
      if (token !== this.loadToken || this.disposed) {
        film.dispose();
        return;
      }
      this.disposeFilm();
      this.film = film;
      this.nowPlaying = entry;
      film.setVolume(this.volume);
      this.showOnScreen(film);
      if (document.hidden) this.resumeFilm = film;
      else await film.play().catch(() => undefined);
    } catch (error) {
      if (token !== this.loadToken) return;
      if (this.film instanceof YouTubeFilm)
        this.film.status = error instanceof Error ? error.message : 'Cinema playback failed';
      throw error;
    } finally {
      if (token === this.loadToken) this.loading = null;
      this.notify();
    }
  }

  stop(): void {
    this.loadToken += 1;
    this.loading = null;
    this.disposeFilm();
    if (this.idleFilm) this.showOnScreen(this.idleFilm);
    this.notify();
  }

  async togglePause(): Promise<void> {
    if (!this.film) return;
    if (this.film.paused) await this.film.play();
    else this.film.pause();
    this.notify();
  }

  setVolume(value: number): void {
    this.volume = value;
    this.film?.setVolume(value);
  }

  onVisibilityChange(visible: boolean): void {
    if (!this.film && !this.idleFilm) return;
    const activeFilm = this.activeFilm;
    if (!visible) {
      this.resumeFilm = activeFilm.paused ? null : activeFilm;
      activeFilm.pause();
    } else {
      if (this.resumeFilm === activeFilm) void activeFilm.play().catch(() => undefined);
      this.resumeFilm = null;
    }
  }

  viewingPosition(): THREE.Vector3 {
    const perspective = this.host.camera instanceof THREE.PerspectiveCamera;
    const local = viewingPosition(
      perspective ? this.host.camera.fov : 50,
      perspective ? this.host.camera.aspect : 1,
    );
    return this.localToWorld(local, this.worldPoint);
  }

  lookAtScreen(): THREE.Vector3 {
    const surface = this.bindings?.surface;
    if (!surface)
      return this.localToWorld(new THREE.Vector3(0, SCREEN.y, SCREEN_Z), this.worldPoint);
    return surface.getWorldPosition(this.worldPoint);
  }

  setInteractive(interactive: boolean): void {
    this.screen?.setInteractive(interactive);
  }

  update(delta: number): void {
    if (this.disposed || !this.bindings) return;
    this.screen?.update();
    const inside = this.contains(this.host.camera.position);
    if (this.film || inside) {
      this.activeFilm.update(delta);
      this.updateGlow(delta);
    }
    const dimmed = this.isPlaying;
    this.houseLights = approach(this.houseLights, dimmed ? 0.1 : 1, delta * 0.7);
    for (const sconce of this.bindings.sconces)
      sconce.light.intensity = sconce.base * this.houseLights;
    this.bindings.stageLed.material.color.setScalar(0.25 + 0.75 * this.houseLights);
    this.ambient = approach(this.ambient, inside ? 0.2 + 0.8 * this.houseLights : 1, delta * 1.2);
    this.host.setAmbient(this.ambient);
    this.beam = approach(this.beam, dimmed ? 1 : 0, delta * 1.5);
    this.bindings.beamMesh.visible = this.beam > 0.01;
    this.bindings.beamMesh.material.opacity = this.beam * 0.22;
    this.bindings.beamMesh.material.color.copy(this.glowColor);
    this.bindings.projectorLens.material.color.copy(this.glowColor).multiplyScalar(0.4 + this.beam);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.screen?.dispose();
    this.screen = null;
    this.interactionHandles = null;
    this.idleFilm?.dispose();
    this.idleFilm = null;
    this.listener?.removeFromParent();
    this.listener = null;
    this.host.setAmbient(1);
    this.listeners.clear();
  }

  private get activeFilm(): CinemaFilm | YouTubeFilm {
    if (this.film) return this.film;
    if (!this.idleFilm) throw new Error('Cinema idle film is not attached');
    return this.idleFilm;
  }

  private get isPlaying(): boolean {
    return this.film !== null && !this.film.paused;
  }

  private contains(point: THREE.Vector3): boolean {
    this.worldToLocal(point, this.localPoint);
    return (
      this.localPoint.x > B.minX &&
      this.localPoint.x < B.maxX &&
      this.localPoint.z > B.minZ &&
      this.localPoint.z < B.maxZ
    );
  }

  private seatPose(instanceId: number): { position: THREE.Vector3; yaw: number } | null {
    const seat = SEATS[instanceId];
    if (!seat) return null;
    return {
      position: this.localToWorld(
        new THREE.Vector3(seat.x, SEATED_EYE, seat.z - 0.08),
        new THREE.Vector3(),
      ),
      yaw: this.placement.rotationY + Math.PI,
    };
  }

  private ensureListener(): THREE.AudioListener {
    if (!this.listener) {
      this.listener = new THREE.AudioListener();
      this.host.camera.add(this.listener);
    }
    return this.listener;
  }

  private disposeFilm(): void {
    this.film?.dispose();
    this.film = null;
    this.nowPlaying = null;
    this.screen?.setActive(false);
  }

  private showOnScreen(film: CinemaFilm): void {
    const surface = this.bindings?.surface;
    if (!surface || !film.texture) return;
    surface.material.map = film.texture;
    surface.material.needsUpdate = true;
    const aspect = film.width / film.height;
    const screenAspect = SCREEN.width / SCREEN.height;
    const width = aspect > screenAspect ? SCREEN.width : SCREEN.height * aspect;
    const height = aspect > screenAspect ? SCREEN.width / aspect : SCREEN.height;
    surface.scale.set(width, height, 1);
  }

  private updateGlow(delta: number): void {
    const sampler = this.sampler;
    if (!sampler) return;
    this.sampleTimer -= delta;
    if (this.sampleTimer <= 0) {
      this.sampleTimer = 0.15;
      const active = this.activeFilm;
      const source =
        ('sampleSource' in active ? active.sampleSource : undefined) ?? this.idleFilm?.sampleSource;
      if (source) {
        try {
          sampler.drawImage(source, 0, 0, 8, 8);
          const data = sampler.getImageData(0, 0, 8, 8).data;
          let red = 0;
          let green = 0;
          let blue = 0;
          for (let index = 0; index < data.length; index += 4) {
            red += data[index] ?? 0;
            green += data[index + 1] ?? 0;
            blue += data[index + 2] ?? 0;
          }
          const count = (data.length / 4) * 255;
          this.glowTarget.setRGB(red / count, green / count, blue / count, THREE.SRGBColorSpace);
          this.glowLevelTarget = Math.max(0.05, (red + green + blue) / (3 * count));
        } catch {
          /* video frame not ready yet */
        }
      }
    }
    const factor = 1 - Math.exp(-delta * 6);
    this.glowColor.lerp(this.glowTarget, factor);
    this.glowLevel += (this.glowLevelTarget - this.glowLevel) * factor;
    const bindings = this.bindings;
    if (!bindings) return;
    const base = this.isPlaying ? 14 : 3;
    bindings.screenLight.color.copy(this.glowColor);
    bindings.screenLight.intensity = base * this.glowLevel;
  }

  private localToWorld(local: THREE.Vector3, target: THREE.Vector3): THREE.Vector3 {
    const cosine = Math.cos(this.placement.rotationY);
    const sine = Math.sin(this.placement.rotationY);
    target.set(
      this.placement.position[0] + local.x * cosine + local.z * sine,
      this.placement.position[1] + local.y,
      this.placement.position[2] - local.x * sine + local.z * cosine,
    );
    return target;
  }

  private worldToLocal(world: THREE.Vector3, target: THREE.Vector3): THREE.Vector3 {
    const cosine = Math.cos(this.placement.rotationY);
    const sine = Math.sin(this.placement.rotationY);
    const x = world.x - this.placement.position[0];
    const z = world.z - this.placement.position[2];
    target.set(x * cosine - z * sine, world.y - this.placement.position[1], x * sine + z * cosine);
    return target;
  }
}

function approach(value: number, target: number, step: number): number {
  return Math.abs(target - value) <= step ? target : value + Math.sign(target - value) * step;
}
