/**
 * The maths behind the Mars rover: Mars is so far away that a message from Earth, travelling
 * at the speed of light, takes minutes to arrive. From about 3 minutes when the two planets
 * are closest to about 22 when the Sun is between them. A rover driver cannot steer live;
 * they send a list of moves and wait.
 *
 * The toy shrinks the wait to a few seconds while a little clock says the real number. A
 * command leaves Earth as a glowing dot, and the rover does nothing until it arrives; moves
 * that arrive while it is busy wait their turn. Time is seconds, and every step is fixed
 * size, so a slow frame changes nothing and a stalled one cannot leap.
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

/** What the little clock says: "really: 12 minutes". */
export function realDelayLabel(km: number = MARS_EXAMPLE_KM): string {
  const minutes = Math.max(1, Math.round(lightMinutes(km)));
  return `really: ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/** The message's trip in play, seconds: long enough to plan ahead, short enough to wait. */
export const PLAY_DELAY = 3;
/** How long the rover takes to drive one square, to bump into the crater edge, or to drill. */
export const MOVE_TIME = 0.7;
export const BUMP_TIME = 0.45;
export const DRILL_TIME = 1.6;
/** Messages in flight plus moves waiting at the rover: a long list, but not an endless one. */
export const MAX_QUEUE = 8;
const SUBSTEP = 1 / 120;
/** The longest stretch one call will simulate; a stalled frame resumes rather than leaps. */
export const MAX_STEP = 0.25;

export type Move = 'up' | 'down' | 'left' | 'right';
export type Command = Move | 'drill';

const STEP: Record<Move, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export interface Message {
  readonly id: number;
  readonly command: Command;
  /** Seconds since it left Earth. */
  age: number;
}

export interface Rock {
  readonly col: number;
  readonly row: number;
  drilled: boolean;
}

export interface Action {
  readonly command: Command;
  /** Where the rover started and where it is going (the same square for a bump or a drill). */
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly kind: 'drive' | 'bump' | 'drill';
  readonly duration: number;
  elapsed: number;
}

export interface Drive {
  readonly cols: number;
  readonly rows: number;
  readonly delay: number;
  col: number;
  row: number;
  /** Which way the rover's nose points on screen; up and down keep the last one. */
  facing: 'left' | 'right';
  rocks: Rock[];
  /** On their way from Earth, oldest first. */
  messages: Message[];
  /** Arrived while the rover was busy, in the order they arrived. */
  waiting: Command[];
  action: Action | null;
  samples: number;
  nextId: number;
}

export interface DriveEvents {
  arrived: Message[];
  bumped: boolean;
  /** A drill finished on a rock not drilled before: one more sample tube. */
  sampled: boolean;
  /** A drill finished on plain ground. */
  dusty: boolean;
}

/** Rocks to drill: a few squares away from the start, rearranged after every three tubes. */
export const ROCK_SETS: readonly (readonly [number, number])[][] = [
  [[3, 0], [1, 1], [5, 2]],
  [[4, 1], [0, 0], [2, 3]],
  [[5, 0], [2, 1], [4, 3]],
];

export function createDrive(cols = 6, rows = 4, delay = PLAY_DELAY): Drive {
  return {
    cols, rows, delay, col: 0, row: rows - 1, facing: 'right',
    rocks: rocksFor(0, cols, rows), messages: [], waiting: [], action: null, samples: 0, nextId: 1,
  };
}

/** The rock set for this round, kept inside the board and off the square the rover is on. */
export function rocksFor(round: number, cols: number, rows: number, avoid?: readonly [number, number]): Rock[] {
  const set = ROCK_SETS[((round % ROCK_SETS.length) + ROCK_SETS.length) % ROCK_SETS.length]!;
  const spots = set.map(([c, r]) => [Math.min(cols - 1, c), Math.min(rows - 1, r)] as const);
  return spots
    .filter(([c, r], i) => !(avoid && avoid[0] === c && avoid[1] === r) &&
      spots.findIndex(([c2, r2]) => c2 === c && r2 === r) === i)
    .map(([col, row]) => ({ col, row, drilled: false }));
}

export function rockAt(d: Drive, col: number, row: number): Rock | undefined {
  return d.rocks.find(r => r.col === col && r.row === row);
}

/** Everything sent and not yet done: in flight, waiting, and the move under way. */
export function queued(d: Drive): number {
  return d.messages.length + d.waiting.length + (d.action ? 1 : 0);
}

/** Send a command from Earth. Null when the list is full. */
export function send(d: Drive, command: Command): Message | null {
  if (queued(d) >= MAX_QUEUE) return null;
  const message: Message = { id: d.nextId++, command, age: 0 };
  d.messages.push(message);
  return message;
}

/** How far along its trip a message is, 0 at Earth to 1 at the rover. */
export function progress(d: Drive, m: Message): number {
  return Math.min(1, Math.max(0, m.age / d.delay));
}

function begin(d: Drive, command: Command): Action {
  const from = [d.col, d.row] as const;
  if (command === 'drill') return { command, from, to: from, kind: 'drill', duration: DRILL_TIME, elapsed: 0 };
  if (command === 'left' || command === 'right') d.facing = command;
  const [dc, dr] = STEP[command];
  const to = [d.col + dc, d.row + dr] as const;
  const inside = to[0] >= 0 && to[0] < d.cols && to[1] >= 0 && to[1] < d.rows;
  if (!inside) return { command, from, to: from, kind: 'bump', duration: BUMP_TIME, elapsed: 0 };
  return { command, from, to, kind: 'drive', duration: MOVE_TIME, elapsed: 0 };
}

function finish(d: Drive, a: Action, events: DriveEvents) {
  d.col = a.to[0];
  d.row = a.to[1];
  if (a.kind === 'bump') events.bumped = true;
  if (a.kind === 'drill') {
    const rock = rockAt(d, d.col, d.row);
    if (rock && !rock.drilled) {
      rock.drilled = true;
      d.samples++;
      events.sampled = true;
    } else {
      events.dusty = true;
    }
  }
}

/** Advance `dt` seconds in small fixed steps. */
export function stepDrive(d: Drive, dt: number): DriveEvents {
  const events: DriveEvents = { arrived: [], bumped: false, sampled: false, dusty: false };
  let left = Number.isFinite(dt) ? Math.min(Math.max(0, dt), MAX_STEP) : 0;
  while (left > 1e-9) {
    const h = Math.min(SUBSTEP, left);
    left -= h;
    for (const m of d.messages) m.age += h;
    while (d.messages.length && d.messages[0]!.age >= d.delay) {
      const m = d.messages.shift()!;
      events.arrived.push(m);
      d.waiting.push(m.command);
    }
    if (d.action) {
      d.action.elapsed += h;
      if (d.action.elapsed >= d.action.duration) {
        finish(d, d.action, events);
        d.action = null;
      }
    }
    if (!d.action && d.waiting.length) d.action = begin(d, d.waiting.shift()!);
  }
  return events;
}

/** Where the rover is drawn, in squares, mid-move included. */
export function roverPosition(d: Drive): { col: number; row: number } {
  const a = d.action;
  if (!a || a.kind !== 'drive') return { col: d.col, row: d.row };
  const t = Math.min(1, a.elapsed / a.duration);
  const k = t * t * (3 - 2 * t);
  return { col: a.from[0] + (a.to[0] - a.from[0]) * k, row: a.from[1] + (a.to[1] - a.from[1]) * k };
}

/** Every rock drilled: time for a new set. */
export function allDrilled(d: Drive): boolean {
  return d.rocks.length > 0 && d.rocks.every(r => r.drilled);
}
