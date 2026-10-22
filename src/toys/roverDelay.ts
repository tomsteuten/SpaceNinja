/**
 * The maths behind the Mars rover: Mars is so far away that a message from Earth, travelling
 * at the speed of light, takes minutes to arrive. From about 3 minutes when the two planets
 * are closest to about 22 when the Sun is between them. A rover driver cannot steer live;
 * they send their plan and wait.
 *
 * The toy has one verb. The child taps a rock; a message leaves Earth and takes a couple of
 * seconds to reach Mars (a little clock shows the real 12 minutes); then the rover drives
 * itself to that rock and drills a sample. Taps while it is busy are not queued. Time is
 * seconds, and every step is fixed size, so a slow frame changes nothing and a stalled one
 * cannot leap.
 */

/** Speed of light, km/s. */
export const LIGHT_SPEED_KM_S = 299_792.458;
/** Earth to Mars, km: the closest it can be, and the farthest (Mars behind the Sun). */
export const MARS_CLOSEST_KM = 54.6e6;
export const MARS_FARTHEST_KM = 401e6;
/** A realistic in-between distance for the clock, not today's: messages take 12 minutes. */
export const MARS_EXAMPLE_KM = 216e6;

export function lightSeconds(km: number): number {
  return km / LIGHT_SPEED_KM_S;
}

export function lightMinutes(km: number): number {
  return lightSeconds(km) / 60;
}

/** Whole minutes the clock shows a message taking: 12 on a typical day. */
export function delayMinutes(km: number = MARS_EXAMPLE_KM): number {
  return Math.max(1, Math.round(lightMinutes(km)));
}

/** The message's trip in play, seconds: long enough to watch, short enough to wait. */
export const PLAY_DELAY = 2;
/** Rover speed in squares a second, and the shortest drive, so even a near rock is a trip. */
export const DRIVE_SPEED = 2.2;
export const MIN_DRIVE = 0.6;
export const DRILL_TIME = 1.6;
/** After the third tube, a pause before the new rocks appear. */
export const RESTOCK_TIME = 2.2;
/** How far beside a rock the rover parks, in squares, so its arm reaches it. */
export const PARK = 0.3;
const SUBSTEP = 1 / 120;
/** The longest stretch one call will simulate; a stalled frame resumes rather than leaps. */
export const MAX_STEP = 0.25;

export interface Rock {
  readonly col: number;
  readonly row: number;
  drilled: boolean;
}

export type Phase = 'idle' | 'message' | 'drive' | 'drill' | 'restock';

export interface Drive {
  readonly cols: number;
  readonly rows: number;
  readonly delay: number;
  /** Where the rover is, in squares (fractional while driving). */
  x: number;
  y: number;
  /** Which way the rover's nose points on screen. */
  facing: 'left' | 'right';
  rocks: Rock[];
  round: number;
  phase: Phase;
  /** Seconds into the current phase, and how long it lasts. */
  elapsed: number;
  duration: number;
  /** The rock the message is about; null when idle. */
  target: Rock | null;
  /** Where the drive started and where it parks. */
  from: readonly [number, number];
  to: readonly [number, number];
  samples: number;
}

export interface DriveEvents {
  /** The message reached Mars this step. */
  arrived: boolean;
  /** A drill finished: one more sample tube. */
  sampled: boolean;
  /** New rocks appeared. */
  restocked: boolean;
}

export type TapResult = 'sent' | 'busy' | 'drilled';

/** Rocks to drill, rearranged after every three tubes. */
export const ROCK_SETS: readonly (readonly [number, number])[][] = [
  [[3, 0], [1, 1], [5, 2]],
  [[4, 1], [0, 0], [2, 3]],
  [[5, 0], [2, 1], [4, 3]],
  [[1, 3], [3, 2], [0, 1]],
];

export function createDrive(cols = 6, rows = 4, delay = PLAY_DELAY): Drive {
  return {
    cols, rows, delay, x: 0, y: rows - 1, facing: 'right',
    rocks: rocksFor(0, cols, rows), round: 0,
    phase: 'idle', elapsed: 0, duration: 0, target: null, from: [0, rows - 1], to: [0, rows - 1], samples: 0,
  };
}

/**
 * The rock set for this round, kept on the board. With `avoid` (where the rover is), the
 * first set from this round on with no rock under or right beside the rover.
 */
export function rocksFor(round: number, cols: number, rows: number, avoid?: readonly [number, number]): Rock[] {
  const n = ROCK_SETS.length;
  const place = (set: readonly (readonly [number, number])[]) =>
    set.map(([c, r]) => ({ col: Math.min(cols - 1, c), row: Math.min(rows - 1, r), drilled: false }));
  const clear = (rocks: Rock[]) =>
    !avoid || rocks.every(r => Math.hypot(r.col - avoid[0], r.row - avoid[1]) >= 1);
  for (let k = 0; k < n; k++) {
    const rocks = place(ROCK_SETS[(((round + k) % n) + n) % n]!);
    if (clear(rocks)) return rocks;
  }
  return place(ROCK_SETS[((round % n) + n) % n]!).filter(r => clear([r]));
}

/** Busy: a message on its way, the rover driving or drilling, or new rocks coming. */
export function busy(d: Drive): boolean {
  return d.phase !== 'idle';
}

/** The child taps a rock. Sent only when the rover is free; never queued. */
export function tap(d: Drive, rock: Rock): TapResult {
  if (busy(d)) return 'busy';
  if (rock.drilled || !d.rocks.includes(rock)) return 'drilled';
  d.target = rock;
  d.phase = 'message';
  d.elapsed = 0;
  d.duration = d.delay;
  return 'sent';
}

/** How far along its trip the message is, 0 at Earth to 1 at the rover; null when none. */
export function messageProgress(d: Drive): number | null {
  if (d.phase !== 'message') return null;
  return Math.min(1, Math.max(0, d.elapsed / d.duration));
}

/** Where the rover parks to drill a rock: beside it, on the side it comes from. */
export function parkingSpot(d: Drive, rock: Rock): { x: number; y: number; facing: 'left' | 'right' } {
  const dx = rock.col - d.x;
  const facing = Math.abs(dx) < 1e-6 ? d.facing : dx > 0 ? 'right' : 'left';
  return { x: rock.col - (facing === 'right' ? PARK : -PARK), y: rock.row, facing };
}

function enter(d: Drive, phase: Phase, duration: number) {
  d.phase = phase;
  d.elapsed = 0;
  d.duration = duration;
}

function advance(d: Drive, events: DriveEvents) {
  if (d.phase === 'message') {
    events.arrived = true;
    const spot = parkingSpot(d, d.target!);
    d.facing = spot.facing;
    d.from = [d.x, d.y];
    d.to = [spot.x, spot.y];
    enter(d, 'drive', Math.max(MIN_DRIVE, Math.hypot(spot.x - d.x, spot.y - d.y) / DRIVE_SPEED));
  } else if (d.phase === 'drive') {
    [d.x, d.y] = d.to;
    enter(d, 'drill', DRILL_TIME);
  } else if (d.phase === 'drill') {
    d.target!.drilled = true;
    d.target = null;
    d.samples++;
    events.sampled = true;
    if (allDrilled(d)) enter(d, 'restock', RESTOCK_TIME);
    else enter(d, 'idle', 0);
  } else if (d.phase === 'restock') {
    d.round++;
    d.rocks = rocksFor(d.round, d.cols, d.rows, [d.x, d.y]);
    events.restocked = true;
    enter(d, 'idle', 0);
  }
}

/** Advance `dt` seconds in small fixed steps. */
export function stepDrive(d: Drive, dt: number): DriveEvents {
  const events: DriveEvents = { arrived: false, sampled: false, restocked: false };
  let left = Number.isFinite(dt) ? Math.min(Math.max(0, dt), MAX_STEP) : 0;
  while (left > 1e-9) {
    const h = Math.min(SUBSTEP, left);
    left -= h;
    if (d.phase === 'idle') continue;
    d.elapsed += h;
    if (d.phase === 'drive') {
      const t = Math.min(1, d.elapsed / d.duration);
      const k = t * t * (3 - 2 * t);
      d.x = d.from[0] + (d.to[0] - d.from[0]) * k;
      d.y = d.from[1] + (d.to[1] - d.from[1]) * k;
    }
    if (d.elapsed >= d.duration) advance(d, events);
  }
  return events;
}

/** Every rock drilled: time for a new set. */
export function allDrilled(d: Drive): boolean {
  return d.rocks.length > 0 && d.rocks.every(r => r.drilled);
}
