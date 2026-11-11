/**
 * The catalogue replaces a set of named geometry constants. These pin the derived values to
 * what the game shipped with.
 */

import { describe, expect, it } from 'vitest';
import { BODY_IDS } from '../scene/Bodies';
import {
  WORLDS,
  WORLD_IDS,
  viewRadius,
  worldGeometry,
} from './catalogue';

describe('world catalogue', () => {
  it('lists the worlds with surface hunts, in journey order, starting at home', () => {
    expect(WORLD_IDS).toEqual(BODY_IDS.filter(id => id !== 'sun'));
    expect(WORLDS[0]?.orbit).toBeUndefined();
    for (const world of WORLDS.slice(1)) expect(world.orbit).toBeDefined();
  });

  it('keeps the shipped geometry', () => {
    expect(worldGeometry('moon').radius).toBe(0.27);
    expect(worldGeometry('mars').radius).toBe(0.53);
    expect(worldGeometry('saturn').radius).toBe(1.5);
    expect(worldGeometry('moon').spin).toBe(0); // tidally locked
    expect(() => worldGeometry('pluto')).toThrow(/Unknown world/);
  });

  it('frames a ringed world on its outer ring, not its sphere', () => {
    const saturn = worldGeometry('saturn');
    expect(viewRadius(saturn)).toBeCloseTo(1.5 * 2.3);
    expect(viewRadius(worldGeometry('mars'))).toBe(0.53);
  });

});
