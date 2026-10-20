import { describe, expect, it } from 'vitest';
import {
  CHILD_HEIGHT, EARTH_GRAVITY, MOON_GRAVITY, airTime, createJumper, jump, peakHeight, stepJumper,
} from './jumpPhysics';

function runJump(gravity: number, dt: number) {
  const j = createJumper(gravity);
  jump(j);
  let t = 0;
  while (!stepJumper(j, dt)) t += dt;
  return { peak: j.lastPeak, time: t + dt };
}

describe('jump physics', () => {
  it('jumps about six times higher and stays up about six times longer on the Moon', () => {
    expect(peakHeight(MOON_GRAVITY) / peakHeight(EARTH_GRAVITY)).toBeCloseTo(EARTH_GRAVITY / MOON_GRAVITY, 5);
    expect(airTime(MOON_GRAVITY) / airTime(EARTH_GRAVITY)).toBeCloseTo(6.06, 1);
  });

  it('clears the child’s own head on the Moon but not on Earth', () => {
    expect(peakHeight(MOON_GRAVITY)).toBeGreaterThan(CHILD_HEIGHT);
    expect(peakHeight(EARTH_GRAVITY)).toBeLessThan(CHILD_HEIGHT / 2);
  });

  it('reaches the same apex whatever the frame rate', () => {
    for (const dt of [1 / 120, 1 / 30, 1 / 8]) {
      expect(runJump(MOON_GRAVITY, dt).peak).toBeCloseTo(peakHeight(MOON_GRAVITY), 6);
    }
  });

  it('lands after the real air time and cannot double-jump in the air', () => {
    const j = createJumper(EARTH_GRAVITY);
    expect(jump(j)).toBe(true);
    expect(jump(j)).toBe(false);
    expect(runJump(EARTH_GRAVITY, 1 / 240).time).toBeCloseTo(airTime(EARTH_GRAVITY), 1);
  });
});
