import { describe, expect, it } from 'vitest';
import { framingHalfAngle } from '../controls/OrbitInput';
import { placePhotoRect, playfieldView, shelfDepth, visitPlayfield } from './viewport';

describe('visit playfield', () => {
  it('keeps a portrait world between the top buttons and the shelf', () => {
    const field = visitPlayfield(390, 844);
    expect(field.top).toBe(100);
    expect(field.bottom).toBe(844 - shelfDepth(390, 844) - 12);
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

  it('moves the world below the place photo in portrait and beside it in landscape', () => {
    for (const [width, height] of [[390, 844], [844, 390], [1024, 768]] as const) {
      const photo = placePhotoRect(width, height);
      const field = visitPlayfield(width, height, true);
      const inside = (a: number, b: number, c: number, d: number) =>
        a >= 0 && b >= 0 && c <= width && d <= height;
      expect(inside(photo.left, photo.top, photo.right, photo.bottom), `${width}x${height}`).toBe(true);
      if (width > height) {
        expect(field.right).toBeLessThan(photo.left);
        expect(photo.right).toBeLessThanOrEqual(width - shelfDepth(width, height));
      } else {
        expect(field.top).toBeGreaterThan(photo.bottom);
        expect(field.bottom - field.top).toBeGreaterThan(150);
      }
      expect(photo.image).toBeGreaterThanOrEqual(80);
    }
  });

  it('frames a landscape world smaller when the shelf takes the width it was binding on', () => {
    // A frame barely wider than tall binds horizontally once the shelf takes its share.
    const full = framingHalfAngle(52, 1.05, 0, 0);
    const shelved = framingHalfAngle(52, 1.05, 0, 0.25);
    expect(shelved).toBeLessThan(full);
  });
});
