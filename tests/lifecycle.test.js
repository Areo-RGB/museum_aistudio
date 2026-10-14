import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import React from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ArtworkFrameController } from '../src/world/frame.ts';
import { LOBBY } from '../src/world/layout.ts';
import { MuseumFrames } from '../src/components/r3f/MuseumFrames.tsx';
import { MuseumLobby } from '../src/components/r3f/MuseumLobby.tsx';

function slot(id) {
  return {
    id,
    maxWidth: 1.4,
    maxHeight: 1.1,
    y: 1.7,
    position: [0, 1.7, 2],
    rotationY: 0,
    period: 'May',
    itemId: null,
  };
}

function canvasDocument() {
  const context = {
    fillStyle: '',
    font: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    letterSpacing: '0em',
    save() {},
    beginPath() {},
    rect() {},
    clip() {},
    clearRect() {},
    fillRect() {},
    stroke() {},
    strokeRect() {},
    restore() {},
    fillText() {},
    measureText() {
      return { width: 0 };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
  };
  class FakeCanvas {
    constructor() {
      this.width = 0;
      this.height = 0;
      this.clientWidth = 1;
      this.clientHeight = 1;
      this.style = {};
      this.listeners = new Map();
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    removeEventListener(type) {
      this.listeners.delete(type);
    }

    dispatchEvent(event) {
      this.listeners.get(event.type)?.(event);
      return true;
    }

    getContext(kind) {
      return kind === '2d' ? context : null;
    }
  }

  return {
    Canvas: FakeCanvas,
    createElement(name) {
      if (name !== 'canvas') throw new Error(`unexpected document element: ${name}`);
      return new FakeCanvas();
    },
  };
}

async function withCanvasDocument(action) {
  const environment = canvasDocument();
  const previousDocument = globalThis.document;
  const previousCanvas = globalThis.HTMLCanvasElement;
  const previousWindow = globalThis.window;
  const previousSelf = globalThis.self;
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCancelRaf = globalThis.cancelAnimationFrame;
  const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  let nextFrameId = 0;
  const pendingFrames = new Set();
  const requestFrame = () => {
    nextFrameId += 1;
    pendingFrames.add(nextFrameId);
    return nextFrameId;
  };
  const cancelFrame = (id) => {
    pendingFrames.delete(id);
  };
  const browser = {
    document: environment,
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame: requestFrame,
    cancelAnimationFrame: cancelFrame,
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: environment });
  Object.defineProperty(globalThis, 'HTMLCanvasElement', {
    configurable: true,
    value: environment.Canvas,
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'self', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: requestFrame,
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    value: cancelFrame,
  });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
    writable: true,
  });
  try {
    return await action();
  } finally {
    pendingFrames.clear();
    if (previousDocument === undefined) delete globalThis.document;
    else
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: previousDocument,
      });
    if (previousCanvas === undefined) delete globalThis.HTMLCanvasElement;
    else
      Object.defineProperty(globalThis, 'HTMLCanvasElement', {
        configurable: true,
        value: previousCanvas,
      });
    if (previousWindow === undefined) delete globalThis.window;
    else Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
    if (previousSelf === undefined) delete globalThis.self;
    else Object.defineProperty(globalThis, 'self', { configurable: true, value: previousSelf });
    if (previousRaf === undefined) delete globalThis.requestAnimationFrame;
    else
      Object.defineProperty(globalThis, 'requestAnimationFrame', {
        configurable: true,
        value: previousRaf,
      });
    if (previousCancelRaf === undefined) delete globalThis.cancelAnimationFrame;
    else
      Object.defineProperty(globalThis, 'cancelAnimationFrame', {
        configurable: true,
        value: previousCancelRaf,
      });
    if (previousActEnvironment === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    else
      Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
        configurable: true,
        value: previousActEnvironment,
        writable: true,
      });
  }
}

function loadedMedia(onDispose) {
  return {
    texture: new THREE.Texture(),
    width: 640,
    height: 480,
    video: null,
    dispose: onDispose,
  };
}

test('a late media completion is rejected and immediately disposed after a floor transition', () => {
  const controller = new ArtworkFrameController(slot('old-floor:1'));
  const token = controller.beginLoad();
  const signal = controller.loadController.signal;
  let staleDisposals = 0;

  controller.dispose();
  assert.equal(signal.aborted, true);
  assert.equal(
    controller.finishLoad(
      token,
      loadedMedia(() => {
        staleDisposals += 1;
      }),
    ),
    false,
  );
  assert.equal(staleDisposals, 1);
  assert.equal(controller.loaded, null);
});

test('a newer load generation wins and the previous completion cannot replace it', () => {
  const controller = new ArtworkFrameController(slot('gallery:1'));
  const oldToken = controller.beginLoad();
  const newToken = controller.beginLoad();
  let staleDisposals = 0;
  const current = loadedMedia(() => {});

  assert.equal(
    controller.finishLoad(
      oldToken,
      loadedMedia(() => {
        staleDisposals += 1;
      }),
    ),
    false,
  );
  assert.equal(staleDisposals, 1);
  assert.equal(controller.finishLoad(newToken, current), true);
  assert.equal(controller.loaded, current);

  controller.dispose();
  assert.equal(controller.loaded, null);
});

test('unmounting a frame releases owned bindings without disposing shared geometry or materials', async () => {
  await withCanvasDocument(async () => {
    const controller = new ArtworkFrameController(slot('gallery:1'));
    const renderer = await ReactThreeTestRenderer.create(
      React.createElement(MuseumFrames, { frames: [controller] }),
    );
    const [screen, matte, moulding] = controller.hitTargets;
    assert.ok(screen && matte && moulding);

    let screenMaterialDisposals = 0;
    let screenGeometryDisposals = 0;
    let matteMaterialDisposals = 0;
    let mouldingGeometryDisposals = 0;
    screen.material.addEventListener('dispose', () => {
      screenMaterialDisposals += 1;
    });
    screen.geometry.addEventListener('dispose', () => {
      screenGeometryDisposals += 1;
    });
    matte.material.addEventListener('dispose', () => {
      matteMaterialDisposals += 1;
    });
    moulding.geometry.addEventListener('dispose', () => {
      mouldingGeometryDisposals += 1;
    });

    await renderer.unmount();

    assert.equal(screenMaterialDisposals, 1);
    assert.equal(screenGeometryDisposals, 0);
    assert.equal(matteMaterialDisposals, 0);
    assert.equal(mouldingGeometryDisposals, 0);
    assert.deepEqual(controller.hitTargets, []);
  });
});

test('replacing the mounted floor disposes the old frame binding before the new frame remains active', async () => {
  await withCanvasDocument(async () => {
    const first = new ArtworkFrameController(slot('spring:1'));
    const second = new ArtworkFrameController(slot('summer:1'));
    const renderer = await ReactThreeTestRenderer.create(
      React.createElement(MuseumFrames, { frames: [first] }),
    );
    const [oldScreen] = first.hitTargets;
    assert.ok(oldScreen);
    let oldScreenDisposals = 0;
    oldScreen.material.addEventListener('dispose', () => {
      oldScreenDisposals += 1;
    });

    await renderer.update(React.createElement(MuseumFrames, { frames: [second] }));

    assert.equal(oldScreenDisposals, 1);
    assert.deepEqual(first.hitTargets, []);
    assert.equal(second.hitTargets.length, 3);
    await renderer.unmount();
    assert.deepEqual(second.hitTargets, []);
  });
});

test('mounted lobby door, call button, display, and directory all activate the floor callback', async () => {
  await withCanvasDocument(async () => {
    const lobbyRef = { current: null };
    let opened = 0;
    const floors = [
      { key: 'fame', label: 'Hall of Fame', count: 1, kind: 'fame' },
      { key: 'cinema', label: 'Cinema', count: 0, kind: 'cinema' },
    ];
    const renderer = await ReactThreeTestRenderer.create(
      React.createElement(MuseumLobby, {
        floors,
        currentFloorIndex: 0,
        lobbyRef,
        onOpenFloors: () => {
          opened += 1;
        },
      }),
    );

    assert.ok(lobbyRef.current);
    const targets = renderer.scene.findAll(
      (instance) => typeof instance.props?.onClick === 'function',
    );
    const elevator = LOBBY.elevator;
    const expectedPositions = {
      leftDoor: [elevator.x - elevator.opening / 4, 1.29, elevator.frontZ + 0.015],
      rightDoor: [elevator.x + elevator.opening / 4, 1.29, elevator.frontZ + 0.015],
      callButton: [elevator.x + elevator.opening / 2 + 0.25, 1.35, elevator.frontZ - 0.11],
      display: [elevator.x, 2.9, elevator.frontZ - 0.095],
      directory: LOBBY.directory.position,
    };
    const namedTargets = Object.fromEntries(
      Object.entries(expectedPositions).map(([name, position]) => [
        name,
        targets.find((target) => target.instance.position.equals(new THREE.Vector3(...position))),
      ]),
    );
    for (const [name, target] of Object.entries(namedTargets)) {
      assert.ok(target, `${name} interaction target is mounted`);
      await renderer.fireEvent(target, 'click');
    }
    assert.equal(opened, Object.keys(namedTargets).length);

    await renderer.unmount();
    assert.equal(lobbyRef.current, null);
  });
});
