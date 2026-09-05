import { describe, expect, it } from 'vitest';
import { steeringOffset, steeringResponse } from './PilotInput';

describe('steeringOffset', () => {
  it('maps a finger drag to screen-relative steering', () => {
    const value = steeringOffset(14, -7, 100);
    expect(value.x).toBeCloseTo(0.5, 8);
    expect(value.y).toBeCloseTo(0.25, 8);
  });

  it('caps diagonal travel to a circle', () => {
    const value = steeringOffset(100, 100, 100);
    expect(value.length()).toBeCloseTo(1, 8);
    expect(value.x).toBeCloseTo(Math.SQRT1_2, 8);
    expect(value.y).toBeCloseTo(-Math.SQRT1_2, 8);
  });

  it('fails still when the viewport cannot be measured', () => {
    expect(steeringOffset(30, 20, 0).toArray()).toEqual([0, 0]);
  });
});

describe('steeringResponse', () => {
  function responseAfterOneSecond(fps: number): number {
    let value = 0;
    for (let frame = 0; frame < fps; frame++) {
      value += (1 - value) * steeringResponse(1 / fps);
    }
    return value;
  }

  it('reaches the same place after the same time at different frame rates', () => {
    const at30 = responseAfterOneSecond(30);
    expect(responseAfterOneSecond(60)).toBeCloseTo(at30, 10);
    expect(responseAfterOneSecond(120)).toBeCloseTo(at30, 10);
  });

  it('does not move for a stopped or backwards clock', () => {
    expect(steeringResponse(0)).toBe(0);
    expect(steeringResponse(-1)).toBe(0);
  });
});
