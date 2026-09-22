import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { surfaceDirection } from '../mission/CollectMission';
import { createFlight, radians } from './model';
import {
  badgeVisibility, blendPose, descentStart, direction, explorePose, occluded, shipPose, subPoint,
} from './surfaceView';

describe('surface-space explorer view', () => {
  it('uses the same latitude/longitude frame as the textured surface markers', () => {
    for (const [lat, lon] of [[0, 0], [23, -110], [-43.3, -11.4], [65, 170]] as const) {
      const ours = direction(radians(lat), radians(lon));
      const theirs = surfaceDirection(lat, lon);
      expect(ours.distanceTo(theirs)).toBeLessThan(1e-9);
      const back = subPoint(ours.clone().multiplyScalar(3));
      expect(back.lat).toBeCloseTo(radians(lat), 9);
      expect(back.lon).toBeCloseTo(radians(lon), 9);
    }
  });

  it('keeps the camera above the ground it looks ahead across, and the ship between them', () => {
    const state = createFlight();
    for (const altitude of [0.12, 0.24, 1.7]) {
      state.altitude = altitude;
      const pose = explorePose(state, false);
      expect(pose.position.length()).toBeGreaterThan(1 + altitude * 0.9);
      // Looking down toward the surface ahead, not out into space.
      const ahead = pose.target.clone().sub(pose.position);
      expect(ahead.dot(pose.up)).toBeLessThan(0);
      const ship = shipPose(state);
      expect(ship.position.length()).toBeGreaterThan(1);
      expect(ship.position.length()).toBeLessThan(pose.position.length());
    }
    const orbital = explorePose({ ...state, altitude: 2.4 }, true);
    expect(orbital.target.length()).toBe(0);
  });

  it('descends from the arrival shot without the camera passing through the body', () => {
    const arrival = new THREE.Vector3(1.8, 1.2, 2.4);
    const start = descentStart(arrival);
    const state = { ...createFlight(), lat: start.lat, lon: start.lon, altitude: 0.34 };
    const from = { position: arrival, target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
    const to = explorePose(state, false);
    for (let t = 0; t <= 1.0001; t += 0.05) {
      expect(blendPose(from, to, t).position.length()).toBeGreaterThan(1.05);
    }
    expect(blendPose(from, to, 1).position.distanceTo(to.position)).toBeLessThan(1e-9);
    expect(blendPose(from, to, 0).position.distanceTo(arrival)).toBeLessThan(1e-9);
  });

  it('hides badges on the far side and fades them at the limb', () => {
    const camera = new THREE.Vector3(0, 0, 3);
    const near = direction(0, radians(-90)).multiplyScalar(1.015);
    const far = direction(0, radians(90)).multiplyScalar(1.015);
    expect(near.z).toBeGreaterThan(0);
    expect(occluded(camera, far)).toBe(true);
    expect(occluded(camera, near)).toBe(false);
    expect(badgeVisibility(camera, near)).toBe(1);
    expect(badgeVisibility(camera, far)).toBe(0);
    // A ring place out in the equatorial plane is visible unless the planet is in the way.
    expect(badgeVisibility(camera, new THREE.Vector3(2, 0, 0))).toBe(1);
    expect(badgeVisibility(camera, new THREE.Vector3(0, 0, -2))).toBe(0);
  });
});
