/**
 * The maths behind Saturn's bath: a world floats if it is less dense than water, and a floating
 * ball sits as deep as it has to for the water it pushes aside to weigh as much as it does.
 * Saturn's average density is about 0.69 g/cm³, so it would float with about seven tenths of
 * itself under water. Rocky worlds are three to five and a half times denser than water: plop.
 *
 * Depths are measured downward from the water surface to the ball's centre, in that ball's
 * own radii, so one body of maths serves a big Saturn and a small Moon. Time is seconds.
 */

/** Mean densities, g/cm³ (NASA planetary fact sheets). */
export const DENSITY = {
  water: 1.0,
  saturn: 0.687,
  earth: 5.514,
  mars: 3.933,
  moon: 3.344,
} as const;

export type BathWorld = Exclude<keyof typeof DENSITY, 'water'>;
export const BATH_WORLDS: readonly BathWorld[] = ['earth', 'mars', 'moon', 'saturn'];

export function floats(density: number, water: number = DENSITY.water): boolean {
  return density < water;
}

/** How much of a floating world is under water: its density over water's (1 if it sinks). */
export function floatingFraction(density: number, water: number = DENSITY.water): number {
  return Math.min(1, Math.max(0, density / water));
}

/** Fraction of a sphere's volume below the water when `h` radii of it (0 to 2) are under. */
export function submergedVolume(h: number): number {
  const c = Math.min(2, Math.max(0, h));
  return (c * c * (3 - c)) / 4;
}

/**
 * Where a floating ball's centre rests, in radii below the surface (negative: above it).
 * Solves submergedVolume(h) = fraction for the depth of the waterline cut.
 */
export function restingDepth(density: number, water: number = DENSITY.water): number {
  const fraction = floatingFraction(density, water);
  let lo = 0;
  let hi = 2;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (submergedVolume(mid) < fraction) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2 - 1;
}

/** Gravity in radii per second squared: a cartoon bath, slow enough to watch. */
export const BATH_GRAVITY = 9;
/** Water drag per second, scaled by how much of the ball is wet: Saturn bobs, then settles in a few seconds. */
export const WATER_DRAG = 4.5;
const SUBSTEP = 1 / 240;
/** The longest stretch one call will simulate; a stalled frame resumes rather than leaps. */
export const MAX_STEP = 0.25;

export interface Floater {
  readonly density: number;
  /** Centre depth below the surface, in radii. */
  depth: number;
  /** Downward speed, radii per second. */
  speed: number;
  /** Deepest the centre can go (the bath floor), in radii. */
  floor: number;
  /** A sinker resting on the floor: no more motion until it is picked up. */
  onFloor: boolean;
}

export function createFloater(density: number, depth: number, floor: number): Floater {
  return { density, depth, speed: 0, floor, onFloor: false };
}

export interface BathStepEvents {
  /** The ball touched the water this step. */
  splash: boolean;
  /** The ball came to rest on the bath floor this step. */
  bottom: boolean;
}

function acceleration(f: Floater): number {
  const wet = submergedVolume(f.depth + 1);
  return BATH_GRAVITY * (1 - (wet * DENSITY.water) / f.density) - WATER_DRAG * wet * f.speed;
}

/** Advance `dt` seconds in small fixed steps, so a slow frame gives the same motion. */
export function stepFloater(f: Floater, dt: number): BathStepEvents {
  const events: BathStepEvents = { splash: false, bottom: false };
  if (f.onFloor) return events;
  let left = Math.min(Math.max(0, dt), MAX_STEP);
  while (left > 1e-9) {
    const h = Math.min(SUBSTEP, left);
    left -= h;
    const wasDry = f.depth < -1;
    f.speed += acceleration(f) * h;
    f.depth += f.speed * h;
    if (wasDry && f.depth >= -1) events.splash = true;
    if (f.depth >= f.floor) {
      f.depth = f.floor;
      // A floater pushed to the bottom bumps off it and comes back up.
      if (floats(f.density)) {
        f.speed = -Math.abs(f.speed) * 0.3;
        continue;
      }
      f.speed = 0;
      f.onFloor = true;
      events.bottom = true;
      break;
    }
  }
  return events;
}

/** Still enough to call it settled: floating at rest or lying on the floor. */
export function isSettled(f: Floater): boolean {
  if (f.onFloor) return true;
  return Math.abs(f.speed) < 0.03 && Math.abs(f.depth - restingDepth(f.density)) < 0.01;
}
