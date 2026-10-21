import { describe, expect, it } from 'vitest';
import {
  BATH_WORLDS, DENSITY, MAX_STEP, createFloater, floatingFraction, floats, isSettled, restingDepth,
  stepFloater, submergedVolume,
} from './bathPhysics';

function run(density: number, dt: number, seconds: number, start = -3, floor = 4) {
  const f = createFloater(density, start, floor);
  let splashes = 0;
  let bottoms = 0;
  let deepest = -Infinity;
  for (let i = Math.round(seconds / dt); i > 0; i--) {
    const events = stepFloater(f, dt);
    if (events.splash) splashes++;
    if (events.bottom) bottoms++;
    deepest = Math.max(deepest, f.depth);
  }
  return { f, splashes, bottoms, deepest };
}

describe('bath physics', () => {
  it('uses real mean densities: only Saturn is lighter than water', () => {
    expect(DENSITY.saturn).toBeCloseTo(0.69, 2);
    expect(DENSITY.earth).toBeCloseTo(5.51, 2);
    expect(DENSITY.mars).toBeCloseTo(3.93, 2);
    expect(DENSITY.moon).toBeCloseTo(3.34, 2);
    expect(BATH_WORLDS.filter(w => floats(DENSITY[w]))).toEqual(['saturn']);
  });

  it('floats Saturn about seven tenths under, and a sinker is all the way under', () => {
    expect(floatingFraction(DENSITY.saturn)).toBeCloseTo(0.687, 3);
    expect(floatingFraction(DENSITY.earth)).toBe(1);
    // The waterline cut leaves exactly that fraction of the ball's volume under water.
    expect(submergedVolume(restingDepth(DENSITY.saturn) + 1)).toBeCloseTo(0.687, 6);
    // So Saturn's centre sits a little below the surface: more than half of it is wet.
    expect(restingDepth(DENSITY.saturn)).toBeGreaterThan(0.2);
    expect(restingDepth(DENSITY.saturn)).toBeLessThan(0.3);
    expect(restingDepth(0.5)).toBeCloseTo(0, 6);
  });

  it('drops Saturn in with one splash, bobs, and settles at its waterline', () => {
    const { f, splashes, bottoms, deepest } = run(DENSITY.saturn, 1 / 60, 15);
    expect(splashes).toBe(1);
    expect(bottoms).toBe(0);
    expect(deepest).toBeGreaterThan(restingDepth(DENSITY.saturn) + 0.2); // it overshoots: a bob
    expect(f.depth).toBeCloseTo(restingDepth(DENSITY.saturn), 2);
    expect(isSettled(f)).toBe(true);
  });

  it('sends Earth, Mars and the Moon to the bottom', () => {
    for (const world of ['earth', 'mars', 'moon'] as const) {
      const { f, splashes, bottoms } = run(DENSITY[world], 1 / 60, 5);
      expect(splashes, world).toBe(1);
      expect(bottoms, world).toBe(1);
      expect(f.onFloor, world).toBe(true);
      expect(f.depth, world).toBe(4);
    }
  });

  it('pops Saturn back up when it is let go under water', () => {
    const { f } = run(DENSITY.saturn, 1 / 60, 15, 2.5);
    expect(f.depth).toBeCloseTo(restingDepth(DENSITY.saturn), 2);
  });

  it('never leaves Saturn on the bottom of a shallow bath', () => {
    const { f, bottoms, deepest } = run(DENSITY.saturn, 1 / 60, 15, -6, 1.2);
    expect(deepest).toBe(1.2); // it reached the floor and bumped off it
    expect(bottoms).toBe(0);
    expect(f.onFloor).toBe(false);
    expect(f.depth).toBeCloseTo(restingDepth(DENSITY.saturn), 2);
  });

  it('gives the same result whatever the frame rate, and a stalled frame cannot leap', () => {
    const smooth = run(DENSITY.saturn, 1 / 120, 4).f.depth;
    const choppy = run(DENSITY.saturn, MAX_STEP, 4).f.depth;
    expect(choppy).toBeCloseTo(smooth, 2);

    const f = createFloater(DENSITY.saturn, -3, 4);
    stepFloater(f, 60);
    expect(Number.isFinite(f.depth)).toBe(true);
    expect(f.depth).toBeLessThan(-1); // a quarter second of falling, not a minute
    stepFloater(f, -1);
    stepFloater(f, Number.NaN);
    expect(Number.isFinite(f.depth)).toBe(true);
  });
});
