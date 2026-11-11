/**
 * The maths behind the "Far away" toy: the Sun is a star like the others, just much closer.
 * The child flies away from it and it shrinks the honest way, in proportion to 1 / distance
 * (twice as far, half as wide). The distances are far too different to fly at one speed, so
 * the journey is on a logarithmic scale: each second of holding multiplies the distance by
 * the same amount. `progress` runs from 0 (the start) to 1 (about the distance of the
 * nearest stars).
 *
 * Real numbers: the Sun is 695,700 km in radius; Earth is 1 AU from it (149.6 million km);
 * Neptune is about 30.07 AU; the nearest stars are about 4.2 to 4.4 light years away, which
 * is roughly 270,000 AU.
 */

export const SUN_RADIUS_AU = 695_700 / 149_597_870.7;
export const NEPTUNE_AU = 30.07;
/** About the distance of the nearest stars: some 4.3 light years, or 270,000 AU. */
export const NEAREST_STARS_AU = 270_000;
/** Where the journey starts: about six Sun-radii out, so the Sun fills the screen. */
export const START_AU = 0.03;
/** Holding Fly away for this long goes the whole way. */
export const JOURNEY_SECONDS = 9;

const LOG_SPAN = Math.log(NEAREST_STARS_AU / START_AU);

export type MilestoneId = 'earth' | 'neptune' | 'far';

export interface Milestone {
  id: MilestoneId;
  au: number;
  progress: number;
}

/** Distance (AU) to progress (0 to 1) on the logarithmic travel scale. */
export function progressAt(distanceAu: number): number {
  return Math.min(1, Math.max(0, Math.log(distanceAu / START_AU) / LOG_SPAN));
}

/** Progress (0 to 1) to distance (AU). */
export function distanceAt(progress: number): number {
  return START_AU * Math.exp(Math.min(1, Math.max(0, progress)) * LOG_SPAN);
}

export const MILESTONES: readonly Milestone[] = [
  { id: 'earth', au: 1, progress: progressAt(1) },
  { id: 'neptune', au: NEPTUNE_AU, progress: progressAt(NEPTUNE_AU) },
  { id: 'far', au: NEAREST_STARS_AU, progress: 1 },
];

/**
 * How wide the Sun looks, in proportion to 1 / distance, given how wide it looked at the
 * start. Twice as far is half as wide.
 */
export function apparentRadius(distanceAu: number, startRadius: number): number {
  return (startRadius * START_AU) / distanceAu;
}

/** The Sun's real angular width as seen from `distanceAu`, in degrees (0.53 from Earth). */
export function angularDiameterDeg(distanceAu: number): number {
  return (2 * Math.atan(SUN_RADIUS_AU / distanceAu) * 180) / Math.PI;
}

/** Drawn radii (px) at Earth, Neptune and the far end: a Sun a small child can still see. */
export const DISPLAY_EARTH_PX = 12.5;
export const DISPLAY_NEPTUNE_PX = 6;
export const DISPLAY_FAR_PX = 3.4;

/**
 * The Sun's radius on screen for a given journey progress: the honest 1 / distance size at the
 * start, then a display curve through the sizes above (straight on a log scale between them,
 * so it keeps shrinking all the way and never vanishes). The model above stays the truth; this
 * is only how big the picture is drawn.
 */
export function displayRadius(progress: number, startRadius: number): number {
  const stops = [0, ...MILESTONES.map(m => m.progress)];
  const sizes = [startRadius, DISPLAY_EARTH_PX, DISPLAY_NEPTUNE_PX, DISPLAY_FAR_PX];
  const p = Math.min(1, Math.max(0, progress));
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i]! || i === stops.length - 1) {
      const k = (p - stops[i - 1]!) / (stops[i]! - stops[i - 1]!);
      const from = Math.min(sizes[i - 1]!, Math.max(sizes[i]!, sizes[i - 1]!));
      return Math.exp(Math.log(from) + k * (Math.log(sizes[i]!) - Math.log(from)));
    }
  }
  return DISPLAY_FAR_PX;
}

/**
 * How the Sun is drawn once it is smaller than anything can be drawn: a dot of at least
 * `minRadius`, a little fainter the smaller the real Sun would be, like any star.
 */
export function drawnSun(radiusPx: number, minRadius: number): { radius: number; alpha: number } {
  if (radiusPx >= minRadius) return { radius: radiusPx, alpha: 1 };
  return { radius: minRadius, alpha: Math.max(0.6, 0.6 + 0.4 * (radiusPx / minRadius)) };
}

/**
 * How big and bright the Sun's glow is: strong close to the Sun and fading with distance to
 * the glimmer of an ordinary star. A gentle curve for the eye, not a measurement; the size
 * of the disc is the honest part.
 */
export function glowStrength(progress: number): number {
  return Math.max(0.2, 1 - 0.8 * Math.min(1, Math.max(0, progress)));
}

/**
 * Where the pictures sit along the rocket's track (0 = Sun end, 1 = star end): the track is
 * drawn with Earth and Neptune evenly spread, not at their true places on the log scale.
 */
export const TRACK_STOPS: readonly number[] = [0, 0.3, 0.55, 1];
const PROGRESS_STOPS = [0, ...MILESTONES.map(m => m.progress)];

function pieceMap(x: number, from: readonly number[], to: readonly number[]): number {
  const c = Math.min(1, Math.max(0, x));
  for (let i = 1; i < from.length; i++) {
    if (c <= from[i]! || i === from.length - 1) {
      const span = from[i]! - from[i - 1]!;
      return to[i - 1]! + ((c - from[i - 1]!) / span) * (to[i]! - to[i - 1]!);
    }
  }
  return c;
}

/** Where the rocket is on its track (0 to 1) to the journey progress behind the Sun's size. */
export function progressFromTrack(track: number): number {
  return pieceMap(track, TRACK_STOPS, PROGRESS_STOPS);
}

/** Journey progress back to the rocket's place on its track. */
export function trackFromProgress(progress: number): number {
  return pieceMap(progress, PROGRESS_STOPS, TRACK_STOPS);
}

export type StopId = 'start' | MilestoneId;
const STOP_IDS: readonly StopId[] = ['start', 'earth', 'neptune', 'far'];

/** The picture the rocket is nearest on its track: what the words chip talks about. */
export function nearestStop(track: number): StopId {
  let best = 0;
  for (let i = 1; i < TRACK_STOPS.length; i++) {
    if (Math.abs(TRACK_STOPS[i]! - track) < Math.abs(TRACK_STOPS[best]! - track)) best = i;
  }
  return STOP_IDS[best]!;
}

/** Progress after holding Fly away (direction 1) or Fly back (-1) for `seconds`. */
export function travel(progress: number, direction: 1 | -1, seconds: number): number {
  return Math.min(1, Math.max(0, progress + (direction * seconds) / JOURNEY_SECONDS));
}

const STOPS = [0, ...MILESTONES.map(m => m.progress)];

/**
 * Where a press jumps to when motion is reduced (and where a keyboard step lands near):
 * the next milestone beyond `progress` in the direction of travel.
 */
export function nextStop(progress: number, direction: 1 | -1): number {
  const eps = 1e-6;
  if (direction === 1) return STOPS.find(stop => stop > progress + eps) ?? 1;
  return [...STOPS].reverse().find(stop => stop < progress - eps) ?? 0;
}

/**
 * The milestone whose caption belongs on screen: from just before it to well after it, so a
 * caption stays up long enough to read once the child has flown past. null between them.
 */
export function milestoneNear(progress: number): MilestoneId | null {
  for (const m of MILESTONES) {
    const before = m.id === 'far' ? 0.04 : 0.05;
    const after = m.id === 'far' ? 0 : 0.07;
    if (progress >= m.progress - before && progress <= m.progress + after + 1e-9) return m.id;
  }
  return null;
}
