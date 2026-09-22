import { describe, it, expect } from 'vitest';
import {
  createDeparture, createArrival, reverseArrivalToDeparture, advanceTravel, travelScale, travelStreak,
  TRAVEL_LEG_SECONDS, TRAVEL_MIN_SCALE,
} from './travel';

describe('travel curve', () => {
  it('shrinks the body away on depart and grows it back on arrive', () => {
    expect(travelScale({ leg: 'depart', t: 0 })).toBeCloseTo(1);
    expect(travelScale({ leg: 'depart', t: 1 })).toBeCloseTo(TRAVEL_MIN_SCALE);
    expect(travelScale({ leg: 'arrive', t: 0 })).toBeCloseTo(TRAVEL_MIN_SCALE);
    expect(travelScale({ leg: 'arrive', t: 1 })).toBeCloseTo(1);
  });

  it('streaks the stars only near the far point, not at the endpoints', () => {
    expect(travelStreak({ leg: 'depart', t: 0 })).toBeCloseTo(0);
    expect(travelStreak({ leg: 'arrive', t: 1 })).toBeCloseTo(0);
    expect(travelStreak({ leg: 'depart', t: 1 })).toBeGreaterThan(0.9);
    expect(travelStreak({ leg: 'arrive', t: 0 })).toBeGreaterThan(0.9);
  });

  it('reverses an arrival into departure without a scale or streak jump', () => {
    const arriving = { leg: 'arrive' as const, t: 0.24 };
    const departing = reverseArrivalToDeparture(arriving);
    expect(departing).toEqual({ leg: 'depart', t: 0.76 });
    expect(travelScale(departing)).toBeCloseTo(travelScale(arriving));
    expect(travelStreak(departing)).toBeCloseTo(travelStreak(arriving));
  });
});

describe('advanceTravel', () => {
  it('holds at the far point until the next world is ready, then swaps once', () => {
    const travel = createDeparture();
    // Fly the whole depart leg with the next world still loading.
    let step = advanceTravel(travel, TRAVEL_LEG_SECONDS, false);
    expect(step.swap).toBe(false);
    expect(travel.leg).toBe('depart');
    expect(travel.t).toBe(1);
    // Still not ready: keep hovering, never swap.
    step = advanceTravel(travel, 1, false);
    expect(step.swap).toBe(false);
    expect(travel.leg).toBe('depart');
    // Ready now: swap exactly once and flip to arriving.
    step = advanceTravel(travel, 0.016, true);
    expect(step.swap).toBe(true);
    expect(travel.leg).toBe('arrive');
    expect(travel.t).toBe(0);
  });

  it('finishes after the arrive leg completes', () => {
    const travel = createArrival();
    let step = advanceTravel(travel, TRAVEL_LEG_SECONDS / 2, true);
    expect(step.done).toBe(false);
    step = advanceTravel(travel, TRAVEL_LEG_SECONDS, true);
    expect(step.done).toBe(true);
    expect(travelScale(travel)).toBeCloseTo(1);
  });

  it('swaps immediately when the world is already loaded', () => {
    const travel = createDeparture();
    const step = advanceTravel(travel, TRAVEL_LEG_SECONDS, true);
    expect(step.swap).toBe(true);
    expect(travel.leg).toBe('arrive');
  });
});
