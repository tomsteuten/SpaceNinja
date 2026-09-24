/**
 * The catalogue replaces three hand-named framing tiers and a set of named geometry
 * constants. These pin the derived values to what the game shipped with, so the refactor is
 * provably a no-op for the four existing worlds, and pin the rule so a fifth world is framed
 * by the same logic rather than a fourth tier.
 */

import { describe, expect, it } from 'vitest';
import {
  FRAMING_RADIUS,
  FRAMING_RADIUS_WIDE,
  FRAMING_RADIUS_WIDER,
  revealedDestinations,
} from '../config';
import { BODY_IDS } from '../scene/Bodies';
import { SHIP_DECAL_IDS } from '../scene/shipDecals';
import { FINALE_STICKER, STICKERS } from '../state/progress';
import { WORLDS as EXPLORER_WORLDS } from '../explorer/worlds';
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
  it('lists every built scene body, in reveal order, starting at home', () => {
    expect(WORLD_IDS).toEqual([...BODY_IDS]);
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

  it('derives the three shipped framing tiers from the revealed set', () => {
    expect(FRAMING_RADIUS).toBeCloseTo(2.95);
    expect(FRAMING_RADIUS_WIDE).toBeCloseTo(5.71);
    expect(FRAMING_RADIUS_WIDER).toBeCloseTo(10.23);
    expect(framingRadiusFor(revealedDestinations([]))).toBeCloseTo(FRAMING_RADIUS);
    expect(framingRadiusFor(revealedDestinations(['moon']))).toBeCloseTo(FRAMING_RADIUS_WIDE);
    expect(framingRadiusFor(revealedDestinations(['moon', 'mars']))).toBeCloseTo(FRAMING_RADIUS_WIDER);
  });

  it('widens only for worlds that are drawn, and ignores ids it does not know', () => {
    // Visiting Mars without the Moon is impossible in play, but saved progress can say
    // anything; the shot must still fit whatever revealedDestinations returns.
    expect(framingRadiusFor(['earth', 'moon', 'saturn'])).toBeCloseTo(FRAMING_RADIUS_WIDER);
    expect(framingRadiusFor(['earth', 'moon', 'vulcan'])).toBeCloseTo(FRAMING_RADIUS);
    expect(framingRadiusFor([])).toBe(FRAMING_MARGIN);
  });

  it('drives the stickers, the ship badges and the explorer list', () => {
    for (const world of WORLDS) {
      const stickerId = stickerIdFor(world.id);
      expect(STICKERS[stickerId]?.label).toBe(`${shortLabel(world)} Explorer`);
      expect(SHIP_DECAL_IDS).toContain(stickerId);
    }
    expect(SHIP_DECAL_IDS[SHIP_DECAL_IDS.length - 1]).toBe(FINALE_STICKER);
    expect(EXPLORER_WORLDS.map((world) => world.id)).toEqual([...WORLD_IDS]);
    // A ringed world has no surface to fly over, so the explorer holds it as orbital views.
    for (const world of EXPLORER_WORLDS) {
      expect(world.orbital).toBe(Boolean(worldGeometry(world.id).rings));
    }
  });
});
