import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { disposeOwnedResources } from '../src/world/disposal.ts';

test('switching floors releases owned instanced buffers as well as geometry', () => {
  const group = new THREE.Group();
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 2);
  let released = false;
  mesh.userData.disposeOwned = () => {
    mesh.dispose();
    released = true;
  };
  group.add(mesh);
  disposeOwnedResources(group);
  assert.equal(released, true);
});
