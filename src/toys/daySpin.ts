/**
 * The maths behind the bedtime spin toy. Earth seen from above the North Pole with the Sun
 * off to the left: one full turn is one day, and a house on the equator spends exactly half
 * of it in the light. Angles are radians; a positive turn is eastward, the way Earth spins.
 */

export const HOURS_PER_TURN = 24;
const TAU = Math.PI * 2;

/** Hours of the day at the house after `turn` radians, where a turn of 0 is noon. */
export function hourAt(turn: number): number {
  const hour = 12 + (turn / TAU) * HOURS_PER_TURN;
  return ((hour % HOURS_PER_TURN) + HOURS_PER_TURN) % HOURS_PER_TURN;
}

/** The turn (from noon) at which the house reads `hour`. */
export function turnForHour(hour: number): number {
  return ((hour - 12) / HOURS_PER_TURN) * TAU;
}

/** On the equator the Sun sets at six in the evening and rises at six in the morning. */
export function isNight(hour: number): boolean {
  return hour < 6 || hour >= 18;
}

export type PartOfDay = 'morning' | 'day' | 'evening' | 'night';

/** The half hour either side of sunrise and sunset is morning and evening. */
export function partOfDay(hour: number): PartOfDay {
  if (hour >= 5.5 && hour < 6.5) return 'morning';
  if (hour >= 17.5 && hour < 18.5) return 'evening';
  return isNight(hour) ? 'night' : 'day';
}

/** Whole days that have passed in `totalTurn` radians of turning. */
export function daysPassed(totalTurn: number): number {
  return Math.floor(Math.max(0, totalTurn) / TAU + 1e-9);
}

/**
 * How far a drag around Earth's centre turns it, given the pointer's previous and current
 * screen angles (canvas convention: y down, so a counter-clockwise drag lowers the angle).
 * Seen from above the North Pole, Earth turns counter-clockwise, so that is the only way it
 * turns: a backwards drag does nothing rather than running the day in reverse.
 */
export function dragTurn(previousAngle: number, angle: number): number {
  let delta = previousAngle - angle;
  delta = ((delta + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return Math.max(0, delta);
}

/** Where on the rim the house is drawn, as a canvas angle, after `turn` radians from noon. */
export function houseAngle(turn: number): number {
  // Noon faces the Sun on the left (canvas angle π); turning eastward is counter-clockwise.
  return Math.PI - turn;
}

/* --- The view from the house ---------------------------------------------------
 * A window onto the sky as the house sees it, looking south from the equator at an equinox:
 * the Sun comes up at the left (east) edge at six, climbs overhead at noon, and sets at the
 * right (west) edge at six in the evening. It is the same hour as the spinning Earth and the
 * clock, so it can never disagree with them.
 */

/** How high the Sun is, -1 (straight down at midnight) to 1 (overhead at noon). */
export function sunElevation(hour: number): number {
  return Math.sin(((hour - 6) / 12) * Math.PI);
}

export interface SunInSky {
  /** -1 at the east (left) horizon, 0 overhead or underfoot, 1 at the west (right). */
  x: number;
  /** Height above the horizon, 0 on it, 1 overhead; negative below the ground. */
  y: number;
  above: boolean;
}

/** Where the Sun is in the sky at `hour`: rising at the left at 6, overhead at 12, setting at the right at 18. */
export function sunInSky(hour: number): SunInSky {
  const a = ((hour - 6) / 12) * Math.PI;
  const y = Math.sin(a);
  return { x: -Math.cos(a), y, above: y > 0 };
}

export type Rgb = readonly [number, number, number];

/** Sky colours by how high the Sun is: night, the glow of dawn and dusk, then daytime blue. */
const SKY_STOPS: readonly { e: number; top: Rgb; low: Rgb }[] = [
  { e: -0.3, top: [6, 10, 32], low: [20, 28, 72] },
  { e: -0.1, top: [22, 30, 78], low: [92, 62, 110] },
  { e: 0, top: [58, 78, 150], low: [246, 163, 95] },
  { e: 0.2, top: [79, 144, 220], low: [246, 214, 160] },
  { e: 0.55, top: [63, 155, 232], low: [191, 229, 251] },
];

const copy = (a: Rgb): [number, number, number] => [a[0], a[1], a[2]];
const mix = (a: Rgb, b: Rgb, k: number): [number, number, number] =>
  [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/** The sky at `hour`: its colour overhead and at the horizon, blended smoothly through dawn and dusk. */
export function skyColours(hour: number): { top: [number, number, number]; low: [number, number, number] } {
  const e = sunElevation(hour);
  const first = SKY_STOPS[0]!;
  const last = SKY_STOPS[SKY_STOPS.length - 1]!;
  if (e <= first.e) return { top: copy(first.top), low: copy(first.low) };
  if (e >= last.e) return { top: copy(last.top), low: copy(last.low) };
  for (let i = 1; i < SKY_STOPS.length; i++) {
    const a = SKY_STOPS[i - 1]!;
    const b = SKY_STOPS[i]!;
    if (e <= b.e) {
      const k = (e - a.e) / (b.e - a.e);
      return { top: mix(a.top, b.top, k), low: mix(a.low, b.low, k) };
    }
  }
  return { top: copy(last.top), low: copy(last.low) };
}

/** How many stars show: all of them at night, none once the Sun is well up, fading through dawn and dusk. */
export function starAlpha(hour: number): number {
  return Math.max(0, Math.min(1, (0.08 - sunElevation(hour)) / 0.3));
}

/** How lit the ground is, 0 at night to 1 by day. */
export function daylight(hour: number): number {
  return Math.max(0, Math.min(1, (sunElevation(hour) + 0.12) / 0.4));
}

/** The width set aside for the window's label. */
export const TAG_WIDTH = 160;

export interface BedtimeLayout {
  earth: { cx: number; cy: number; r: number };
  /** How far from Earth's middle the house and its sleepy "z z" can reach. */
  reach: number;
  clock: { x: number; y: number; r: number };
  /** The "From the house" window: centre and diameter. */
  window: { cx: number; cy: number; d: number };
  /** Where its label sits: the top-left of a box `TAG_WIDTH` wide and about 36 high. */
  tag: { left: number; top: number };
}

/**
 * Where everything sits in the bedtime spin. The window gets a place of its own that clears
 * Earth and the house's whole ride round it, the clock, the caption's corner, the days
 * counter and the Back and Turn Earth buttons: under Earth on a portrait phone, beside it on
 * a wide one.
 */
export function bedtimeLayout(width: number, height: number): BedtimeLayout {
  const wide = width > height * 1.15;
  const r = wide ? Math.min(width * 0.36, height * 0.3, 260) : Math.min(width * 0.33, height * 0.22, 260);
  const cx = width * 0.56;
  const cy = wide ? height * 0.44 : height * 0.34;
  const size = Math.max(34, r * 0.28);
  const reach = r + size * 1.7;
  const clockR = Math.max(34, Math.min(56, r * 0.3));
  const clock = { x: width - clockR - 18, y: clockR + 18, r: clockR };
  if (wide) {
    const d = Math.max(96, Math.min(150, height * 0.42));
    const left = Math.max(cx + reach + 14, width - 14 - d);
    const top = clock.y + clock.r + 12;
    return { earth: { cx, cy, r }, reach, clock, window: { cx: left + d / 2, cy: top + d / 2, d }, tag: { left: Math.min(left + d / 2 - TAG_WIDTH / 2, width - 14 - TAG_WIDTH), top: top + d + 8 } };
  }
  // Portrait: between the house's lowest point and the days counter above the buttons.
  const daysTop = height - 18 - 100 - 36;
  const top = cy + reach + 8;
  const d = Math.max(72, Math.min(150, width * 0.36, daysTop - 6 - top));
  const left = 18;
  return { earth: { cx, cy, r }, reach, clock, window: { cx: left + d / 2, cy: top + d / 2, d }, tag: { left: left + d + 10, top: top + d / 2 - 18 } };
}
