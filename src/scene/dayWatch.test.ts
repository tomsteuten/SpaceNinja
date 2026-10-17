import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SUN_DIRECTION } from '../config';
import { ENTER_DAY, ENTER_NIGHT, IN_VIEW, START_INTO_DAY, createDayWatch, referenceDirection } from './dayWatch';

const tilted = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.41);

describe('referenceDirection', () => {
  for (const [label, view] of [
    ['camera on one side', new THREE.Vector3().crossVectors(SUN_DIRECTION, tilted)],
    ['camera on the other side', new THREE.Vector3().crossVectors(tilted, SUN_DIRECTION)],
  ] as const) {
    it(`starts on the equator, in daylight, facing the camera (${label})`, () => {
      const spot = referenceDirection(SUN_DIRECTION, tilted, view);
      expect(spot.length()).toBeCloseTo(1);
      expect(spot.dot(tilted)).toBeCloseTo(0);
      expect(spot.dot(SUN_DIRECTION)).toBeGreaterThan(ENTER_DAY);
      expect(spot.dot(view.clone().normalize())).toBeGreaterThan(Math.cos(START_INTO_DAY) - 1e-6);
    });
  }

  it('reaches night after a short turn in one direction, without a full rotation', () => {
    const view = new THREE.Vector3().crossVectors(SUN_DIRECTION, tilted);
    const spot = referenceDirection(SUN_DIRECTION, tilted, view);
    const lit = (angle: number) => spot.clone().applyAxisAngle(tilted, angle).dot(SUN_DIRECTION);
    // One of the two directions crosses the visible terminator within 90 degrees.
    expect(Math.min(lit(Math.PI / 2), lit(-Math.PI / 2))).toBeLessThan(ENTER_NIGHT);
  });
});

describe('createDayWatch', () => {
  it('acknowledges night, then the first morning as the round trip', () => {
    const watch = createDayWatch();
    expect(watch.observe(0.5, 1)).toBeNull();
    expect(watch.observe(-0.3, 1)).toBe('night');
    expect(watch.lit).toBe(false);
    expect(watch.observe(-0.2, 1)).toBeNull();
    expect(watch.observe(0.3, 1)).toBe('roundTrip');
    expect(watch.roundTrip).toBe(true);
    expect(watch.observe(-0.3, 1)).toBe('night');
    expect(watch.observe(0.3, 1)).toBe('morning');
  });

  it('counts a drag into night and straight back, in either direction', () => {
    const watch = createDayWatch();
    for (const dot of [0.4, 0.1, -0.1, -0.2, -0.1, 0.1, 0.2]) watch.observe(dot, 1);
    expect(watch.roundTrip).toBe(true);
  });

  it('does not flicker while the spot lingers on the sunset line', () => {
    const watch = createDayWatch();
    const events = [0.05, -0.05, 0.05, -0.05, 0.0].map((dot) => watch.observe(dot, 1));
    expect(events.every((event) => event === null)).toBe(true);
    expect(watch.lit).toBe(true);
  });

  it('waits until the spot is in view before saying what happened to it', () => {
    const watch = createDayWatch();
    expect(watch.observe(-0.5, IN_VIEW - 0.1)).toBeNull();
    expect(watch.lit).toBe(false);
    expect(watch.observe(-0.5, IN_VIEW + 0.1)).toBe('night');
    // Morning round the back, seen only as it comes back into view.
    expect(watch.observe(0.5, -0.4)).toBeNull();
    expect(watch.observe(0.5, 0.6)).toBe('roundTrip');
  });

  it('skips a night that happened entirely out of sight', () => {
    const watch = createDayWatch();
    expect(watch.observe(-0.5, -0.5)).toBeNull();
    expect(watch.observe(0.5, -0.5)).toBeNull();
    expect(watch.observe(0.5, 0.8)).toBeNull();
    expect(watch.roundTrip).toBe(false);
  });

  it('starts fresh on reset', () => {
    const watch = createDayWatch();
    watch.observe(-0.5, 1);
    watch.observe(0.5, 1);
    watch.reset();
    expect(watch.lit).toBe(true);
    expect(watch.roundTrip).toBe(false);
    expect(watch.observe(-0.5, 1)).toBe('night');
  });

  it('ignores non-finite input', () => {
    const watch = createDayWatch();
    expect(watch.observe(Number.NaN, 1)).toBeNull();
    expect(watch.lit).toBe(true);
  });
});
