import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { Lobby } from '../src/world/lobby.ts';
import { createLayout, LOBBY } from '../src/world/layout.ts';
import { createCollisionChecker } from '../src/controls/collision.ts';

const floors = [
  { key: '2023-0', label: 'Winter 2023', count: 2 },
  { key: '2023-1', label: 'Spring 2023', count: 2 },
];

function withLobby(run) {
  run(new Lobby(floors));
}

test('elevator changes floors behind closed doors and finishes with doors open', () =>
  withLobby((lobby) => {
    const events = [];
    assert.equal(
      lobby.travelTo(
        1,
        () => events.push({ phase: 'arrived', open: lobby.doorOpen }),
        () => events.push({ phase: 'finished', open: lobby.doorOpen }),
      ),
      true,
    );
    for (let index = 0; index < 100; index += 1) lobby.update(0.05);
    assert.deepEqual(events, [
      { phase: 'arrived', open: 0 },
      { phase: 'finished', open: 1 },
    ]);
    assert.equal(lobby.current, 1);
  }));

test('elevator cabin is accessible through its entrance but has solid sides and back', () => {
  assert.ok(LOBBY.elevator);
  const collides = createCollisionChecker(createLayout(null).colliders, 0.4);
  assert.equal(collides({ x: -7.9, z: 5.8 }), false);
  assert.equal(collides({ x: -9.5, z: 5.8 }), true);
  assert.equal(collides({ x: -7.9, z: 7.4 }), true);
  for (let x = -6; x >= -8.5; x -= 0.1) assert.equal(collides({ x, z: 5.8 }), false);
  assert.equal(collides({ x: -7, z: 8 }), true);
});

test('closed elevator doors block entry and open doors permit exit', () =>
  withLobby((lobby) => {
    const doorway = { x: -7, z: 5.8 };
    assert.equal(lobby.blocksDoor(doorway, 0.4), true);
    lobby.openDoors();
    for (let index = 0; index < 20; index += 1) lobby.update(0.05);
    assert.equal(lobby.blocksDoor(doorway, 0.4), false);
  }));

test('elevator ride accepts one destination and rejects concurrent rides', () =>
  withLobby((lobby) => {
    assert.equal(lobby.travelTo(1), true);
    assert.equal(lobby.travelTo(0), false);
    for (let index = 0; index < 100; index += 1) lobby.update(0.05);
    assert.equal(lobby.travelTo(0), true);
  }));
