import { describe, expect, it } from 'vitest';
import {
  MOON_STEP, angleDelta, angleFromOffset, illuminatedFraction, isWaxing, litOutline, moonOffset,
  phaseName, phaseShape, stepAngle,
} from './moonPhase';

const TAU = Math.PI * 2;

/** The area of a polygon on the unit disc, as a fraction of the disc. */
function areaFraction(points: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[(i + 1) % points.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum / 2) / Math.PI;
}

describe('moon phases', () => {
  it('is full when the Moon is opposite the Sun: all lit, the lit side filling the disc', () => {
    const shape = phaseShape(Math.PI);
    expect(shape.fraction).toBeCloseTo(1);
    expect(shape.terminator).toBeCloseTo(-1);
    expect(areaFraction(litOutline(shape, 64))).toBeCloseTo(1, 2);
  });

  it('is new when the Moon is between Earth and the Sun: none lit, nothing to draw', () => {
    const shape = phaseShape(0);
    expect(shape.fraction).toBeCloseTo(0);
    expect(litOutline(shape)).toEqual([]);
    expect(phaseName(0)).toBe('New Moon');
  });

  it('is a right-hand half at First Quarter and a left-hand half at Last Quarter', () => {
    const first = phaseShape(Math.PI / 2);
    expect(first.fraction).toBeCloseTo(0.5);
    expect(first.litSide).toBe('right');
    expect(first.terminator).toBeCloseTo(0, 6);
    expect(isWaxing(Math.PI / 2)).toBe(true);
    expect(areaFraction(litOutline(first, 64))).toBeCloseTo(0.5, 2);
    // Every lit point of a quarter is on the lit side.
    for (const [x] of litOutline(first)) expect(x).toBeGreaterThanOrEqual(-1e-9);

    const last = phaseShape((3 * Math.PI) / 2);
    expect(last.fraction).toBeCloseTo(0.5);
    expect(last.litSide).toBe('left');
    expect(isWaxing((3 * Math.PI) / 2)).toBe(false);
    for (const [x] of litOutline(last)) expect(x).toBeLessThanOrEqual(1e-9);
    expect(phaseName(Math.PI / 2)).toBe('First Quarter');
    expect(phaseName((3 * Math.PI) / 2)).toBe('Last Quarter');
  });

  it('is a thin right-hand crescent a little after New Moon, with the line bulging into the lit side', () => {
    const angle = Math.PI / 4;
    const shape = phaseShape(angle);
    expect(shape.fraction).toBeCloseTo((1 - Math.SQRT1_2) / 2, 6);
    expect(shape.fraction).toBeLessThan(0.5);
    expect(shape.litSide).toBe('right');
    expect(shape.terminator).toBeGreaterThan(0);
    expect(areaFraction(litOutline(shape, 128))).toBeCloseTo(shape.fraction, 2);
    expect(phaseName(angle)).toBe('Waxing crescent');
    // The mirror image, a little before the next New Moon, is a left-hand crescent.
    const waning = phaseShape(TAU - angle);
    expect(waning.fraction).toBeCloseTo(shape.fraction, 6);
    expect(waning.litSide).toBe('left');
    expect(phaseName(TAU - angle)).toBe('Waning crescent');
  });

  it('is gibbous between a quarter and Full Moon: more than half lit', () => {
    const shape = phaseShape((3 * Math.PI) / 4);
    expect(shape.fraction).toBeGreaterThan(0.5);
    expect(shape.terminator).toBeLessThan(0);
    expect(areaFraction(litOutline(shape, 128))).toBeCloseTo(shape.fraction, 2);
    expect(phaseName((3 * Math.PI) / 4)).toBe('Waxing gibbous');
    expect(phaseName((5 * Math.PI) / 4)).toBe('Waning gibbous');
  });

  it('lights a fraction that grows from new to full and back', () => {
    let previous = -1;
    for (let i = 0; i <= 8; i++) {
      const f = illuminatedFraction(i * MOON_STEP);
      if (i <= 4) expect(f).toBeGreaterThan(previous);
      previous = f;
    }
    expect(illuminatedFraction(TAU)).toBeCloseTo(0);
  });
});

describe('moving the Moon', () => {
  it('puts the Moon at the Sun side for New Moon, opposite for Full, and counter-clockwise between', () => {
    expect(moonOffset(0, 100).x).toBeCloseTo(-100);
    expect(moonOffset(Math.PI, 100).x).toBeCloseTo(100);
    // First Quarter is below Earth on screen (counter-clockwise from the Sun on the left).
    const quarter = moonOffset(Math.PI / 2, 100);
    expect(quarter.x).toBeCloseTo(0);
    expect(quarter.y).toBeCloseTo(100);
  });

  it('turns a pointer position back into the angle that put the Moon there', () => {
    for (const angle of [0.3, 1.2, Math.PI, 4.4, 6]) {
      const at = moonOffset(angle, 80);
      expect(angleFromOffset(at.x, at.y)).toBeCloseTo(angle, 6);
    }
  });

  it('steps an eighth of the way round and lands on a named phase, eight steps for a lap', () => {
    let angle = 0;
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      angle = stepAngle(angle);
      seen.push(phaseName(angle));
    }
    expect(angle).toBeCloseTo(0);
    expect(new Set(seen).size).toBe(8);
    // Between phases a press goes on to the next one, and back goes to the one behind.
    expect(stepAngle(0.1)).toBeCloseTo(MOON_STEP);
    expect(stepAngle(0.1, -1)).toBeCloseTo(0);
    expect(stepAngle(0, -1)).toBeCloseTo(TAU - MOON_STEP);
  });

  it('eases the short way round', () => {
    expect(angleDelta(0.1, TAU - 0.1)).toBeCloseTo(-0.2);
    expect(angleDelta(TAU - 0.1, 0.1)).toBeCloseTo(0.2);
  });
});
