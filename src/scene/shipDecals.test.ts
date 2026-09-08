import { describe, expect, it } from 'vitest';
import { SHIP_DECAL_IDS, activeShipDecalIds } from './shipDecals';

describe('activeShipDecalIds', () => {
  it('keeps only supported rewards in stable ship-layout order', () => {
    expect(
      activeShipDecalIds(['space-ninja', 'unknown', 'moon-explorer', 'space-ninja']),
    ).toEqual(['moon-explorer', 'space-ninja']);
  });

  it('has a mountable emblem for every persisted sticker', () => {
    expect(SHIP_DECAL_IDS).toEqual([
      'earth-explorer',
      'moon-explorer',
      'mars-explorer',
      'saturn-explorer',
      'space-ninja',
    ]);
  });
});
