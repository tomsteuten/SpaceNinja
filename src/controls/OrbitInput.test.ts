import { describe, expect, it } from 'vitest';
import { TOUCH_TURN_PER_SHORT_EDGE, dragAngle, stepInertia } from './OrbitInput';

describe('dragAngle', () => {
  it('turns a calm but useful amount across the short edge', () => {
    expect(dragAngle(400, 400)).toBeCloseTo(TOUCH_TURN_PER_SHORT_EDGE);
    expect(degrees(TOUCH_TURN_PER_SHORT_EDGE)).toBeCloseTo(129.6);
  });

  it('does not change with pointer-event sampling rate', () => {
    const oneEvent = dragAngle(180, 400);
    const manyEvents = Array.from({ length: 12 }, () => dragAngle(15, 400)).reduce(
      (total, angle) => total + angle,
      0,
    );
    expect(manyEvents).toBeCloseTo(oneEvent);
  });

  it('ignores an element with no measurable short edge', () => {
    expect(dragAngle(100, 0)).toBe(0);
  });
});

describe('stepInertia', () => {
  it('matches at 30, 60 and 120fps', () => {
    function run(fps: number) {
      let angle = 0;
      let velocity = 2.4;
      for (let frame = 0; frame < fps; frame++) {
        const step = stepInertia(velocity, 1 / fps, 0.86);
        angle += step.angle;
        velocity = step.velocity;
      }
      return { angle, velocity };
    }

    const at30 = run(30);
    const at60 = run(60);
    const at120 = run(120);
    expect(at30.angle).toBeCloseTo(at60.angle, 8);
    expect(at120.angle).toBeCloseTo(at60.angle, 8);
    expect(at30.velocity).toBeCloseTo(at60.velocity, 8);
    expect(at120.velocity).toBeCloseTo(at60.velocity, 8);
  });

  it('has no release glide under reduced motion', () => {
    expect(stepInertia(2.4, 1 / 60, 0)).toEqual({ angle: 0, velocity: 0 });
  });
});

function degrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
