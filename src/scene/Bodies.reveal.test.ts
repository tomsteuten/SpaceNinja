import { describe, expect, it } from 'vitest';
import { WORLD_CONTEXT_OPACITY, worldFocusOpacity, worldRevealEase } from './Bodies';

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

describe('worldFocusOpacity', () => {
  it('keeps the destination solid and the rest visible as quiet context', () => {
    expect(worldFocusOpacity('moon', 'moon')).toBe(1);
    expect(worldFocusOpacity('earth', 'moon')).toBe(WORLD_CONTEXT_OPACITY);
    expect(WORLD_CONTEXT_OPACITY).toBeGreaterThan(0);
    expect(WORLD_CONTEXT_OPACITY).toBeLessThanOrEqual(0.2);
  });

  it('restores every world for the home map', () => {
    for (const id of ['earth', 'moon', 'mars', 'saturn'] as const) {
      expect(worldFocusOpacity(id, null)).toBe(1);
    }
  });
});
