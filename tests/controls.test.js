import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../src/config.ts';
import { PlayerController } from '../src/controls/player.ts';

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const callbacks = listeners.get(type) ?? new Set();
      callbacks.add(listener);
      listeners.set(type, callbacks);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(type, event = {}) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
}

function withBrowser(run) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const documentTarget = eventTarget();
  const windowTarget = eventTarget();
  const document = {
    ...documentTarget,
    hidden: false,
    pointerLockElement: null,
    exitPointerLock() {
      this.pointerLockElement = null;
      this.dispatchEvent('pointerlockchange');
    },
  };
  let requestCount = 0;
  const canvas = {
    requestPointerLock() {
      requestCount += 1;
      document.pointerLockElement = canvas;
      document.dispatchEvent('pointerlockchange');
      return Promise.resolve();
    },
  };
  globalThis.document = document;
  globalThis.window = windowTarget;
  try {
    const fixture = { canvas, document, window: windowTarget };
    Object.defineProperty(fixture, 'requestCount', { get: () => requestCount });
    run(fixture);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test('pointer lock requests during entry before enabled state commits, but movement waits for enablement', () =>
  withBrowser((fixture) => {
    const { canvas, document } = fixture;
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(camera, canvas, {
      ...CONFIG.player,
      start: { position: [0, CONFIG.player.eyeHeight, 0], yaw: 0 },
    });
    player.enabled = false;

    player.lock();
    assert.equal(fixture.requestCount, 1);
    assert.equal(player.locked, true);

    const entryPosition = camera.position.clone();
    player.keys.add('KeyW');
    player.update(0.1);
    assert.deepEqual(camera.position.toArray(), entryPosition.toArray());

    player.enabled = true;
    player.update(0.1);
    assert.ok(camera.position.z < entryPosition.z);

    player.dispose();
    const settledPosition = camera.position.clone();
    document.dispatchEvent('keydown', { code: 'KeyW' });
    player.update(0.1);
    assert.deepEqual(camera.position.toArray(), settledPosition.toArray());
  }));

test('mouse look damps smoothly across frames and ignores pointer-lock warp spikes', () =>
  withBrowser((fixture) => {
    const { canvas } = fixture;
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(camera, canvas, {
      ...CONFIG.player,
      start: { position: [0, CONFIG.player.eyeHeight, 0], yaw: 0 },
    });
    player.lock();

    // A massive synthetic warp spike (> 220px) is ignored completely.
    player.onMouseMove({ movementX: 400, movementY: -350 });
    player.update(0.016);
    assert.equal(player.euler.y, 0);
    assert.equal(player.euler.x, 0);

    // Normal mouse movement interpolates smoothly over frames rather than snapping all at once.
    player.onMouseMove({ movementX: 20, movementY: 10 });
    player.update(0.016);
    const firstFrameYaw = player.euler.y;
    assert.ok(firstFrameYaw < 0, 'camera begins rotating on first frame');
    player.update(0.05);
    assert.ok(player.euler.y < firstFrameYaw, 'camera continues smoothly damping toward target');

    player.dispose();
  }));
