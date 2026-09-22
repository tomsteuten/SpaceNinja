/**
 * Guided travel between worlds — the "you flew there" feeling, with no steering.
 *
 * A journey has two legs. On `depart` the planet the child is leaving shrinks away into the
 * distance; on `arrive` the next planet swells from a far dot into view. Between them, at the
 * far point where the old world is a speck, the scene swaps its textures — so the child never
 * sees one planet's map snap onto another. The depart leg deliberately *holds* at that far
 * point until the next world's imagery has loaded, so a slow connection stretches the void
 * rather than arriving at a blank globe.
 *
 * This module is pure timing and easing: it knows nothing about Three.js, so `travel.test.ts`
 * can pin the curve and the hold-until-ready behaviour without a scene. `main.ts` turns the
 * numbers here into a body scale and a star streak, and performs the one side effect — the
 * texture swap — when `advanceTravel` reports it.
 */

/** Each leg runs this long; a whole hop is twice this. Short enough not to tax a 5-year-old. */
export const TRAVEL_LEG_SECONDS = 0.85;
/** How small the planet gets at the far point: a bright speck, not gone, so it reads as distance. */
export const TRAVEL_MIN_SCALE = 0.03;

export type TravelLeg = 'depart' | 'arrive';
export interface Travel {
  leg: TravelLeg;
  /** Progress through the current leg, 0 → 1. */
  t: number;
}

/** A full hop: pull away from the current world first. */
export function createDeparture(): Travel {
  return { leg: 'depart', t: 0 };
}
/** Arrival only: used for the very first view, so the app opens by flying in from space. */
export function createArrival(): Travel {
  return { leg: 'arrive', t: 0 };
}

/**
 * Turn an arriving body back toward the far point without a visual pop. Smootherstep is
 * symmetric, so reversing progress keeps both body scale and star-streak intensity continuous.
 */
export function reverseArrivalToDeparture(travel: Travel): Travel {
  return { leg: 'depart', t: 1 - travel.t };
}

// Smootherstep: zero velocity and acceleration at both ends, so the planet eases away and
// eases back rather than lurching.
const ease = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

/** Scale to draw the travelling body at: 1 up close, TRAVEL_MIN_SCALE at the far point. */
export function travelScale(travel: Travel): number {
  const e = ease(travel.t);
  return travel.leg === 'depart'
    ? 1 + (TRAVEL_MIN_SCALE - 1) * e
    : TRAVEL_MIN_SCALE + (1 - TRAVEL_MIN_SCALE) * e;
}

/** Star-streak intensity, 0 at rest and 1 at the far point where apparent speed peaks. */
export function travelStreak(travel: Travel): number {
  return travel.leg === 'depart' ? ease(travel.t) : ease(1 - travel.t);
}

export interface TravelStep {
  /** True on the single frame the world's textures should be swapped (far point reached). */
  swap: boolean;
  /** True once the arrive leg has finished and the child is back at the welcome view. */
  done: boolean;
}

/**
 * Advance the journey by `dt` seconds. The depart leg holds at the far point until `ready`
 * (the next world's imagery has loaded); once ready it swaps and flips to the arrive leg.
 * `ready` is ignored on the arrive leg, whose imagery is already showing.
 */
export function advanceTravel(travel: Travel, dt: number, ready: boolean): TravelStep {
  travel.t = Math.min(1, travel.t + dt / TRAVEL_LEG_SECONDS);
  if (travel.leg === 'depart') {
    if (travel.t >= 1) {
      if (!ready) {
        travel.t = 1; // hover at the dot rather than arrive at an unloaded globe
        return { swap: false, done: false };
      }
      travel.leg = 'arrive';
      travel.t = 0;
      return { swap: true, done: false };
    }
    return { swap: false, done: false };
  }
  return { swap: false, done: travel.t >= 1 };
}
