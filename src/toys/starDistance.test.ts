import { describe, expect, it } from 'vitest';
import {
  JOURNEY_SECONDS, MILESTONES, NEAREST_STARS_AU, NEPTUNE_AU, START_AU, angularDiameterDeg,
  apparentRadius, distanceAt, drawnSun, glowStrength, milestoneNear, nextStop, progressAt, travel,
} from './starDistance';

describe('far away from the Sun', () => {
  it('shrinks the Sun in proportion to 1 / distance', () => {
    const start = 200;
    expect(apparentRadius(START_AU, start)).toBeCloseTo(start);
    expect(apparentRadius(START_AU * 2, start)).toBeCloseTo(start / 2);
    expect(apparentRadius(START_AU * 10, start)).toBeCloseTo(start / 10);
    // Earth's distance is about 33 times the start, so the Sun is about a thirty-third as wide.
    expect(apparentRadius(1, start)).toBeCloseTo(start * START_AU);
    // Neptune's is 30 times farther than Earth's, so 30 times smaller than from Earth.
    expect(apparentRadius(1, start) / apparentRadius(NEPTUNE_AU, start)).toBeCloseTo(NEPTUNE_AU);
  });

  it('matches the Sun the sky really shows: about half a degree from Earth, 30 times less from Neptune', () => {
    expect(angularDiameterDeg(1)).toBeGreaterThan(0.52);
    expect(angularDiameterDeg(1)).toBeLessThan(0.54);
    expect(angularDiameterDeg(1) / angularDiameterDeg(NEPTUNE_AU)).toBeCloseTo(NEPTUNE_AU, 1);
  });

  it('travels on a logarithmic scale from the start to about the nearest stars', () => {
    expect(distanceAt(0)).toBeCloseTo(START_AU);
    expect(distanceAt(1)).toBeCloseTo(NEAREST_STARS_AU);
    // The same progress always multiplies the distance by the same amount.
    expect(distanceAt(0.6) / distanceAt(0.5)).toBeCloseTo(distanceAt(0.2) / distanceAt(0.1), 6);
    for (const p of [0, 0.1, 0.5, 0.9, 1]) expect(progressAt(distanceAt(p))).toBeCloseTo(p, 6);
  });

  it('puts Earth, Neptune and the far end in that order along the journey', () => {
    const [earth, neptune, far] = MILESTONES;
    expect(earth!.au).toBe(1);
    expect(neptune!.au).toBeCloseTo(30.07);
    expect(far!.progress).toBe(1);
    expect(0).toBeLessThan(earth!.progress);
    expect(earth!.progress).toBeLessThan(neptune!.progress);
    expect(neptune!.progress).toBeLessThan(far!.progress);
    expect(distanceAt(earth!.progress)).toBeCloseTo(1, 6);
  });

  it('takes about nine seconds of holding to go the whole way, and the same to come back', () => {
    expect(JOURNEY_SECONDS).toBeGreaterThanOrEqual(8);
    expect(JOURNEY_SECONDS).toBeLessThanOrEqual(10);
    let p = 0;
    for (let i = 0; i < JOURNEY_SECONDS * 10; i++) p = travel(p, 1, 0.1);
    expect(p).toBeCloseTo(1);
    expect(travel(1, 1, 5)).toBe(1);
    for (let i = 0; i < JOURNEY_SECONDS * 10; i++) p = travel(p, -1, 0.1);
    expect(p).toBeCloseTo(0);
    expect(travel(0, -1, 5)).toBe(0);
  });

  it('fades the glow with distance but never to nothing', () => {
    expect(glowStrength(0)).toBe(1);
    expect(glowStrength(0.5)).toBeLessThan(glowStrength(0.2));
    expect(glowStrength(1)).toBeGreaterThan(0);
  });

  it('draws a Sun too small to see as a dot a little fainter, never bigger than it is', () => {
    expect(drawnSun(40, 1.6)).toEqual({ radius: 40, alpha: 1 });
    const dot = drawnSun(0.01, 1.6);
    expect(dot.radius).toBe(1.6);
    expect(dot.alpha).toBeLessThan(1);
    expect(dot.alpha).toBeGreaterThan(0.5);
  });

  it('jumps to the next milestone when motion is reduced', () => {
    const [earth, neptune] = MILESTONES;
    expect(nextStop(0, 1)).toBeCloseTo(earth!.progress);
    expect(nextStop(earth!.progress, 1)).toBeCloseTo(neptune!.progress);
    expect(nextStop(neptune!.progress, 1)).toBe(1);
    expect(nextStop(1, 1)).toBe(1);
    expect(nextStop(1, -1)).toBeCloseTo(neptune!.progress);
    expect(nextStop(neptune!.progress, -1)).toBeCloseTo(earth!.progress);
    expect(nextStop(earth!.progress, -1)).toBe(0);
    expect(nextStop(0, -1)).toBe(0);
  });

  it('names the milestone you are near, for a while after passing it, and none between', () => {
    const [earth, neptune] = MILESTONES;
    expect(milestoneNear(0)).toBeNull();
    expect(milestoneNear(earth!.progress)).toBe('earth');
    expect(milestoneNear(earth!.progress + 0.05)).toBe('earth');
    expect(milestoneNear((earth!.progress + neptune!.progress) / 2 + 0.01)).toBeNull();
    expect(milestoneNear(neptune!.progress)).toBe('neptune');
    expect(milestoneNear(0.8)).toBeNull();
    expect(milestoneNear(0.98)).toBe('far');
    expect(milestoneNear(1)).toBe('far');
  });
});
