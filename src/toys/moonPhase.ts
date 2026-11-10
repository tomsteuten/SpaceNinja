/**
 * The maths behind the Moonlight toy. Seen from far above Earth's North Pole with the Sun
 * off to the left, the Moon goes round Earth counter-clockwise, once in about a month.
 *
 * `angle` (radians) is the Moon's place on its path measured from the Sun's direction, in
 * the real direction of travel: 0 is between Earth and the Sun (New Moon), a quarter turn
 * is First Quarter, a half turn is opposite the Sun (Full Moon), three quarters Last Quarter.
 * Whatever the angle, half of the Moon is lit, the half that faces the Sun. What changes is
 * how much of that lit half the child on Earth can see.
 *
 * Canvas conventions (y down). The Sun is on the left, so a Moon at `angle` sits at
 * (-cos, +sin) of the path's radius from Earth.
 */

const TAU = Math.PI * 2;
/** One press of "Move Moon": an eighth of the way round. */
export const MOON_STEP = TAU / 8;

/** Any angle as 0 up to a full turn. */
export function wrapAngle(angle: number): number {
  return ((angle % TAU) + TAU) % TAU;
}

/** Where the Moon is, relative to Earth's centre, at `angle` on a path of `radius`. */
export function moonOffset(angle: number, radius: number): { x: number; y: number } {
  return { x: -Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/** The angle on the path nearest a point (`dx`, `dy` from Earth's centre, canvas y down). */
export function angleFromOffset(dx: number, dy: number): number {
  return wrapAngle(Math.atan2(dy, -dx));
}

/**
 * One step of the Move Moon button, to the next (or previous) eighth of the way round, so
 * eight presses go once round and always land on a named phase.
 */
export function stepAngle(angle: number, direction: 1 | -1 = 1): number {
  const eighths = angle / MOON_STEP;
  const nearest = Math.round(eighths);
  const onStep = Math.abs(eighths - nearest) < 1e-6;
  const next = direction === 1 ? (onStep ? nearest + 1 : Math.ceil(eighths)) : (onStep ? nearest - 1 : Math.floor(eighths));
  return wrapAngle(next * MOON_STEP);
}

/**
 * The shortest signed way from one angle to another, to ease the Moon along its path
 * without ever going the long way round.
 */
export function angleDelta(from: number, to: number): number {
  return ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

/** The part of the Moon's face the child sees lit: 0 (new) to 1 (full). */
export function illuminatedFraction(angle: number): number {
  return (1 - Math.cos(angle)) / 2;
}

/** Growing (after New Moon, before Full Moon) or shrinking. */
export function isWaxing(angle: number): boolean {
  return wrapAngle(angle) < Math.PI;
}

export interface PhaseShape {
  /** Lit fraction of the disc, 0 to 1. */
  fraction: number;
  /** Which side of the disc the lit part is on, as the child sees it from the northern hemisphere. */
  litSide: 'right' | 'left';
  /** +1 for the lit side's x direction (right) or -1 (left). */
  litSign: 1 | -1;
  /**
   * Where the line between light and dark sits, as a fraction of the radius across the
   * disc, towards the lit side: 1 is the lit limb itself (nothing lit: crescents start
   * there), 0 is a straight line down the middle (a quarter), -1 is the far limb (full).
   * The line is half an ellipse with this as its half-width.
   */
  terminator: number;
}

/** How the Moon looks from Earth at `angle`, northern-hemisphere orientation. */
export function phaseShape(angle: number): PhaseShape {
  const a = wrapAngle(angle);
  const waxing = a < Math.PI;
  return {
    fraction: illuminatedFraction(a),
    litSide: waxing ? 'right' : 'left',
    litSign: waxing ? 1 : -1,
    terminator: Math.cos(a),
  };
}

/**
 * The outline of the lit part of the Moon's disc as points on a unit disc (x right, y down):
 * the lit limb from the top to the bottom, then back up along the terminator ellipse.
 * `steps` points on each. Empty when nothing is lit.
 */
export function litOutline(shape: Pick<PhaseShape, 'litSign' | 'terminator' | 'fraction'>, steps = 24): [number, number][] {
  if (shape.fraction <= 1e-6) return [];
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI;
    points.push([shape.litSign * Math.sin(a), -Math.cos(a)]);
  }
  for (let i = steps; i >= 0; i--) {
    const a = (i / steps) * Math.PI;
    points.push([shape.litSign * shape.terminator * Math.sin(a), -Math.cos(a)]);
  }
  return points;
}

export type PhaseName =
  | 'New Moon' | 'Waxing crescent' | 'First Quarter' | 'Waxing gibbous'
  | 'Full Moon' | 'Waning gibbous' | 'Last Quarter' | 'Waning crescent';

const NAMES: PhaseName[] = [
  'New Moon', 'Waxing crescent', 'First Quarter', 'Waxing gibbous',
  'Full Moon', 'Waning gibbous', 'Last Quarter', 'Waning crescent',
];

/** The name of the phase nearest this angle, for the picture's accessible label. */
export function phaseName(angle: number): PhaseName {
  return NAMES[Math.round(wrapAngle(angle) / MOON_STEP) % 8]!;
}
