import { describe, expect, it } from 'vitest';
import { WORLD_CONTEXT_OPACITY, worldFocusOpacity } from './Bodies';

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
