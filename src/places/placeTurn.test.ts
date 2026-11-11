import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MAX_PITCH, RING_VIEW_ELEVATION, easeTurn, placeTurn, surfaceDirection } from './placeTurn';

const Y = new THREE.Vector3(0, 1, 0);

/** Apply a turn the way main.ts does: yaw the place about the axis, pitch the view. */
function apply(place: THREE.Vector3, axis: THREE.Vector3, view: THREE.Vector3, ring = false) {
  const turn = placeTurn(place, axis, view, ring);
  return {
    turn,
    place: place.clone().applyAxisAngle(axis, turn.yaw),
    view: view.clone().applyAxisAngle(turn.pitchAxis, turn.pitch),
  };
}

describe('surfaceDirection', () => {
  // Getting the bearings wrong does not throw; it puts every place on the wrong continent.
  const cases: Array<[string, [number, number], [number, number, number]]> = [
    ['the prime meridian on the equator', [0, 0], [1, 0, 0]],
    ['90 east', [0, 90], [0, 0, -1]],
    ['90 west', [0, -90], [0, 0, 1]],
    ['the far side of the seam', [0, 180], [-1, 0, 0]],
    ['the north pole', [90, 0], [0, 1, 0]],
  ];
  for (const [name, [lat, lon], expected] of cases) {
    it(`points at ${name}`, () => {
      const d = surfaceDirection(lat, lon);
      expect(d.x).toBeCloseTo(expected[0], 6);
      expect(d.y).toBeCloseTo(expected[1], 6);
      expect(d.z).toBeCloseTo(expected[2], 6);
    });
  }
});

describe('placeTurn', () => {
  it('brings a place round the back to face the camera', () => {
    const view = new THREE.Vector3(0, 0, 1);
    const { place, view: after } = apply(surfaceDirection(10, 129), Y, view);
    expect(place.dot(after)).toBeGreaterThan(0.99);
  });

  it('faces any place on a tilted world, from a camera above the equator', () => {
    const axis = new THREE.Vector3(0.4, 1, 0).normalize();
    const tilt = new THREE.Quaternion().setFromUnitVectors(Y, axis);
    const view = new THREE.Vector3(0.2, 0.3, 1).normalize();
    for (const [lat, lon] of [[0.67, 23.47], [-43.3, -11.4], [18.4, -57.4], [-20.4, 129.1], [27, 86]]) {
      const place = surfaceDirection(lat!, lon!).applyQuaternion(tilt);
      const { place: turned, view: after } = apply(place, axis, view);
      // Round to the camera's side, well inside the visible face (the tilt goes part way).
      const flat = (v: THREE.Vector3) => v.clone().addScaledVector(axis, -axis.dot(v)).normalize();
      expect(flat(turned).dot(flat(after)), `${lat},${lon}`).toBeCloseTo(1, 5);
      expect(turned.dot(after), `${lat},${lon}`).toBeGreaterThan(0.7);
    }
  });

  it('leaves a place already in front alone', () => {
    const view = new THREE.Vector3(0, 0, 1);
    const turn = placeTurn(view.clone(), Y, view);
    expect(turn.yaw).toBeCloseTo(0, 9);
    expect(turn.pitch).toBeCloseTo(0, 9);
  });

  it('looks down on a ring place rather than edge-on', () => {
    const view = new THREE.Vector3(0, 0, 1);
    const { place, view: after } = apply(surfaceDirection(0, 70), Y, view, true);
    expect(Math.asin(after.y)).toBeCloseTo(RING_VIEW_ELEVATION, 6);
    // Still the same side of the world, round to the camera.
    expect(place.x * after.x + place.z * after.z).toBeGreaterThan(0.8);
  });

  it('tilts only part way, so a far-south place does not swing the camera to the night side', () => {
    const view = new THREE.Vector3(0, 0.1, 1).normalize();
    const turn = placeTurn(surfaceDirection(-43.3, 0), Y, view);
    expect(Math.abs(turn.pitch)).toBeLessThanOrEqual(MAX_PITCH + 1e-9);
    expect(turn.pitch).toBeLessThan(0);
  });
});

describe('easeTurn', () => {
  it('starts at 0, ends at 1 and clamps', () => {
    expect(easeTurn(0)).toBe(0);
    expect(easeTurn(1)).toBe(1);
    expect(easeTurn(2)).toBe(1);
    expect(easeTurn(0.5)).toBeCloseTo(0.5, 9);
  });
});
