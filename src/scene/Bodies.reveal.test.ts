import { describe, expect, it } from 'vitest';
import { worldRevealEase } from './Bodies';

describe('worldRevealEase', () => {
  it('starts and lands exactly, including values beyond the animation', () => {
    expect(worldRevealEase(-1)).toBe(0);
    expect(worldRevealEase(0)).toBe(0);
    expect(worldRevealEase(1)).toBe(1);
    expect(worldRevealEase(2)).toBe(1);
  });

  it('moves monotonically through the reveal', () => {
    const values = [0, 0.2, 0.4, 0.6, 0.8, 1].map(worldRevealEase);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(worldRevealEase(0.5)).toBeCloseTo(0.5, 10);
  });
});
