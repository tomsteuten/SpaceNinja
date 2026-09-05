import { describe, expect, it } from 'vitest';
import { SHIP_CONTEXT_OPACITY, shipContextOpacity } from './Spaceship';

describe('shipContextOpacity', () => {
  it('keeps the parked ship visible without letting it dominate a hunt', () => {
    expect(shipContextOpacity(true)).toBe(SHIP_CONTEXT_OPACITY);
    expect(SHIP_CONTEXT_OPACITY).toBeGreaterThan(0);
    expect(SHIP_CONTEXT_OPACITY).toBeLessThanOrEqual(0.3);
  });

  it('returns to full strength outside a visit', () => {
    expect(shipContextOpacity(false)).toBe(1);
  });
});
