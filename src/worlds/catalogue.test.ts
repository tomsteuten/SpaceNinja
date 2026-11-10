/**
 * The catalogue replaces three hand-named framing tiers and a set of named geometry
 * constants. These pin the derived values to what the game shipped with, so the refactor is
 * provably a no-op for the four existing worlds, and pin the rule so a fifth world is framed
 * by the same logic rather than a fourth tier.
 */

import { describe, expect, it } from 'vitest';
import { MAP_FRAMING_RADIUS } from '../config';
import { BODY_IDS } from '../scene/Bodies';
import { SHIP_DECAL_IDS } from '../scene/shipDecals';
import { FINALE_STICKER, STICKERS } from '../state/progress';
import {
  FRAMING_MARGIN,
  WORLDS,
  WORLD_IDS,
  framingRadiusFor,
  reach,
  shortLabel,
  stickerIdFor,
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
    expect(reach(saturn)).toBeCloseTo(6.6 + 3.45);
  });

  it('frames the home map out to Saturn\'s outer ring, since every world is drawn', () => {
    expect(MAP_FRAMING_RADIUS).toBeCloseTo(10.23);
    expect(framingRadiusFor(BODY_IDS)).toBeCloseTo(MAP_FRAMING_RADIUS);
  });

  it('widens only for worlds that are drawn, and ignores ids it does not know', () => {
    expect(framingRadiusFor(['earth', 'moon'])).toBeCloseTo(2.95);
    expect(framingRadiusFor(['earth', 'moon', 'mars'])).toBeCloseTo(5.71);
    expect(framingRadiusFor(['earth', 'moon', 'saturn'])).toBeCloseTo(MAP_FRAMING_RADIUS);
    expect(framingRadiusFor(['earth', 'moon', 'vulcan'])).toBeCloseTo(2.95);
    expect(framingRadiusFor([])).toBe(FRAMING_MARGIN);
  });

  it('drives the stickers and the ship badges', () => {
    for (const world of WORLDS) {
      const stickerId = stickerIdFor(world.id);
      expect(STICKERS[stickerId]?.label).toBe(`${shortLabel(world)} Explorer`);
      expect(SHIP_DECAL_IDS).toContain(stickerId);
    }
    expect(SHIP_DECAL_IDS[SHIP_DECAL_IDS.length - 1]).toBe(FINALE_STICKER);
  });
});
