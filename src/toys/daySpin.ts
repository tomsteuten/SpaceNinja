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
