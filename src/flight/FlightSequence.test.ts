/**
 * The easing curve feeds CatmullRomCurve3.getPointAt, which indexes an arc-length table
 * by its argument. Hand it a u even one ulp above 1 and it reads one past the end of that
 * table, gets undefined, computes NaN, and throws inside getPoint — a crash that takes the
 * whole flight with it.
 *
 * That happened for real: clamping only the *input* left the polynomial free to return
 * marginally more than 1, and whether it ever did depended on whether the flight duration
 * happened to divide the frame delta. Changing FLIGHT_DURATION from 5.5 to 7 was enough to
 * turn a working flight into a crashing one, which is not a thing that should be luck.
 */

import { describe, expect, it } from 'vitest';
import { smootherstep } from './FlightSequence';

describe('smootherstep', () => {
  it('stays inside 0..1 for the values either end of the flight', () => {
    // The middle one is the progress that actually crashed it.
    for (const t of [0, 1, 0.9999999999999974, 1 - Number.EPSILON, Number.EPSILON, 0.5]) {
      const value = smootherstep(t);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('stays inside 0..1 across the whole sweep', () => {
    for (let i = 0; i <= 2000; i++) {
      const value = smootherstep(i / 2000);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('clamps out-of-range input rather than extrapolating', () => {
    expect(smootherstep(-3)).toBe(0);
    expect(smootherstep(4)).toBe(1);
  });

  it('still eases: flat at both ends, halfway in the middle', () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    expect(smootherstep(0.5)).toBeCloseTo(0.5, 10);
    // Flat approach at each end is the whole point of this curve over a linear ramp.
    expect(smootherstep(0.05)).toBeLessThan(0.01);
    expect(smootherstep(0.95)).toBeGreaterThan(0.99);
  });
});
