import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ArtworkFrameController, createFrameRenderBindings } from '../src/world/frame.ts';
import { PlayerController } from '../src/controls/player.ts';
import { CONFIG } from '../src/config.ts';
import { deviceProfile, pixelRatio } from '../src/core/deviceProfile.ts';
import { Curator } from '../src/media/curator.ts';
import { CinemaPlayback } from '../src/world/cinema.ts';
import { VideoFilm } from '../src/cinema/films.ts';

function withDocument(run) {
  const previous = globalThis.document;
  const previousWindow = globalThis.window;
  const context = new Proxy(
    { measureText: () => ({ width: 0 }), createRadialGradient: () => ({ addColorStop() {} }) },
    { get: (target, key) => target[key] ?? (() => {}) },
  );
  globalThis.document = {
    createElement: () => ({ getContext: () => context }),
    addEventListener() {},
    removeEventListener() {},
    pointerLockElement: null,
  };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  try {
    run();
  } finally {
    globalThis.document = previous;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

function frameFor(slot) {
  const frame = new ArtworkFrameController(slot);
  frame.bindRender(createFrameRenderBindings());
  return frame;
}

test('caption faces remain separated from their backing in world units', () =>
  withDocument(() => {
    const frame = frameFor({
      position: [6.88, 2.3, 14.5],
      rotationY: -Math.PI / 2,
      maxWidth: 3.1,
      maxHeight: 2.15,
    });
    try {
      const bindings = frame.renderBindings;
      assert.ok(bindings);
      const gap = (bindings.plaque.face.position.z - 0.5) * bindings.plaque.mesh.scale.z;
      assert.ok(gap >= 0.001, `caption clearance is ${gap} metres`);
      assert.equal(bindings.plaque.face.material.polygonOffset, true);
      assert.ok(bindings.plaque.face.material.polygonOffsetFactor < 0);
      assert.equal(bindings.plaque.face.material.depthTest, true, 'walls still occlude the label');
    } finally {
      frame.dispose();
    }
  }));

test('batched frame moulding stays clickable after portrait and landscape fit changes', () =>
  withDocument(() => {
    const frame = frameFor({ position: [0, 1.65, 0], rotationY: 0, maxWidth: 3, maxHeight: 2 });
    try {
      assert.equal(frame.hitTargets.length, 3, 'one batched moulding target replaces four bars');
      const group = new THREE.Group();
      group.position.copy(frame.center);
      group.rotation.y = 0;
      group.add(...frame.hitTargets);
      for (const aspect of [0.4, 2.5]) {
        frame.knownAspect = aspect;
        frame.layout();
        group.updateMatrixWorld(true);
        const size = frame.outerSize;
        assert.ok(size);
        const ray = new THREE.Raycaster(
          new THREE.Vector3(0, 1.65 + size[1] / 2 - 0.03, 3),
          new THREE.Vector3(0, 0, -1),
        );
        assert.ok(
          ray.intersectObjects(frame.hitTargets, false).length,
          `moulding visible for aspect ${aspect}`,
        );
      }
    } finally {
      frame.dispose();
    }
  }));

test('touch movement works without pointer lock, obeys collisions and clears when paused', () =>
  withDocument(() => {
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(camera, null, {
      ...CONFIG.player,
      start: { position: [0, 1.65, 0], yaw: 0 },
      collides: (p) => p.z < -0.3,
    });
    player.touchEnabled = true;
    player.touchMove = { x: 0, z: -1 };
    for (let i = 0; i < 30; i++) player.update(0.05);
    assert.ok(camera.position.z < 0 && camera.position.z >= -0.3);
    player.clearInput();
    const before = camera.position.clone();
    player.update(0.05);
    assert.deepEqual(camera.position.toArray(), before.toArray());
    player.dispose();
  }));

test('phone and low-memory budgets constrain GPU pixels and media without changing desktop textures', () => {
  const desktop = deviceProfile({ width: 1920, deviceMemory: 8 });
  assert.equal(desktop.touch, false);
  assert.equal(desktop.media.maxTextureSize, undefined);
  assert.equal(deviceProfile({ width: 390 }).touch, false, 'a narrow desktop retains pointer lock');
  for (const input of [
    { width: 390 },
    { coarsePointer: true, width: 1024 },
    { deviceMemory: 4 },
    { saveData: true },
  ]) {
    const profile = deviceProfile(input);
    assert.equal(profile.media.maxTextureSize, 1024);
    assert.equal(profile.media.maxVideos, 2);
    const ratio = pixelRatio(3840, 2160, 3, profile.render);
    assert.ok(3840 * 2160 * ratio * ratio <= 1_500_001);
  }
});

test('streaming polls less often while fades keep updating and hidden videos pause', () => {
  let distances = 0,
    updates = 0,
    pauses = 0;
  const frame = {
    state: 'loaded',
    item: { kind: 'image' },
    center: {
      distanceTo() {
        distances++;
        return 3;
      },
    },
    update() {
      updates++;
    },
    loaded: {
      video: {
        pause() {
          pauses++;
        },
      },
    },
  };
  const curator = new Curator([frame], {}, { media: { ...CONFIG.media, loadConcurrency: 1 } });
  const app = { camera: { position: {} } };
  for (let i = 0; i < 60; i++) curator.update(1 / 60, app);
  assert.equal(updates, 60);
  assert.ok(distances <= 6, `${distances} streaming checks in one second`);
  curator.onVisibilityChange(false);
  assert.equal(pauses, 1);
});

test('cinema loads completed in a hidden tab wait for visibility before playing', async () => {
  const previousDocument = globalThis.document,
    previousLoad = VideoFilm.load;
  globalThis.document = { hidden: false };
  let resolveLoad,
    plays = 0;
  VideoFilm.load = () =>
    new Promise((resolve) => {
      resolveLoad = resolve;
    });
  const film = {
    paused: true,
    setVolume() {},
    play() {
      plays++;
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
    dispose() {},
  };
  const cinema = Object.assign(Object.create(CinemaPlayback.prototype), {
    loadToken: 0,
    volume: 0.8,
    disposed: false,
    film: null,
    loading: null,
    nowPlaying: null,
    idleFilm: {
      paused: false,
      pause() {
        this.paused = true;
      },
    },
    resumeFilm: null,
    listeners: new Set(),
    bindings: { speaker: new THREE.Object3D() },
    ensureListener() {
      return null;
    },
    disposeFilm() {
      this.film = null;
    },
    showOnScreen() {},
    notify() {},
  });
  try {
    const pending = cinema.project({
      id: 'video:test',
      title: 'Test',
      meta: 'Test',
      source: { type: 'video', url: 'test.mp4' },
    });
    globalThis.document.hidden = true;
    cinema.onVisibilityChange(false);
    resolveLoad(film);
    await pending;
    assert.equal(plays, 0);
    globalThis.document.hidden = false;
    cinema.onVisibilityChange(true);
    assert.equal(plays, 1);
  } finally {
    globalThis.document = previousDocument;
    VideoFilm.load = previousLoad;
  }
});
