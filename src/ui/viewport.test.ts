import { describe, expect, it } from 'vitest';
import { framingHalfAngle } from '../controls/OrbitInput';
import { playfieldView, shelfDepth, visitPlayfield } from './viewport';

describe('visit playfield', () => {
  it('keeps a portrait world between the top buttons and the counter above the shelf', () => {
    const field = visitPlayfield(390, 844);
    expect(field.top).toBe(128);
    expect(field.bottom).toBe(844 - shelfDepth(390, 844) - 42);
    expect([field.left, field.right]).toEqual([0, 390]);
    // The optical centre moves up, into the band, and nothing moves sideways.
    const view = playfieldView(390, 844);
    expect(view.offsetX).toBe(0);
    expect(view.offsetY).toBeGreaterThan(0);
  });

  it('keeps a landscape world left of the shelf down the right side', () => {
    for (const [width, height] of [[844, 390], [1024, 768]] as const) {
      const field = visitPlayfield(width, height);
      expect(field.right).toBe(width - shelfDepth(width, height));
      const view = playfieldView(width, height);
      expect(view.offsetX).toBeGreaterThan(0);
      expect(view.width).toBeLessThan(1);
    }
  });

  it('frames a landscape world smaller when the shelf takes the width it was binding on', () => {
    // A frame barely wider than tall binds horizontally once the shelf takes its share.
    const full = framingHalfAngle(52, 1.05, 0, 0);
    const shelved = framingHalfAngle(52, 1.05, 0, 0.25);
    expect(shelved).toBeLessThan(full);
  });
});
