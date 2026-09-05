import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createSaturnHitTargets } from './Bodies';

describe('Saturn tap targets', () => {
  it('does not claim empty space above the rings', () => {
    const { planet, rings } = createSaturnHitTargets();
    planet.updateMatrixWorld();
    rings.updateMatrixWorld();

    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0, 3, 10),
      new THREE.Vector3(0, 0, -1),
    );
    expect(raycaster.intersectObjects([planet, rings], false)).toHaveLength(0);
  });

  it('still accepts a tap on the visible ring plane', () => {
    const { planet, rings } = createSaturnHitTargets();
    planet.updateMatrixWorld();
    rings.updateMatrixWorld();

    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(2.6, 5, 0),
      new THREE.Vector3(0, -1, 0),
    );
    expect(raycaster.intersectObjects([planet, rings], false).map((hit) => hit.object)).toContain(
      rings,
    );
  });
});
