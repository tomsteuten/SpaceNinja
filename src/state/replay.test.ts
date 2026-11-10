import { expect, it } from 'vitest';
import { DESTINATIONS } from '../config';
import { nextWorld, worldCollections } from './replay';
const all = Object.keys(DESTINATIONS);
it('suggests the first unvisited world in journey order before collecting more', () => {
  expect(nextWorld({visited:[], discoveries:[], stickers:[]}, all)).toBe('earth');
  expect(nextWorld({visited:['earth'], discoveries:[], stickers:[]}, all)).toBe('moon');
  // Out of order is fine: nothing is locked, and the hint simply fills the earliest gap.
  expect(nextWorld({visited:['saturn'], discoveries:[], stickers:[]}, all)).toBe('earth');
  expect(nextWorld({visited:['earth','moon','saturn'], discoveries:[], stickers:[]}, all)).toBe('mars');
  expect(nextWorld({visited:['earth','moon','mars'], discoveries:[], stickers:[]}, all)).toBe('saturn');
});
it('suggests an incomplete collection after every world has been visited', () => {
  const discoveries = DESTINATIONS.moon!.mission!.discoveries.slice(0, 5).map(d => d.id);
  expect(nextWorld({visited:all, discoveries, stickers:[]}, all)).toBe('moon');
  expect(worldCollections(discoveries).find(w => w.id === 'moon')?.found).toBe(5);
});
it('only suggests an available world, never a completed one, and stops when everything is found', () => {
  const discoveries = Object.values(DESTINATIONS).flatMap(w => w.mission?.discoveries.map(d => d.id) ?? []);
  expect(nextWorld({visited:all, discoveries, stickers:[]}, all)).toBeNull();
  expect(nextWorld({visited:all, discoveries:[], stickers:[]}, ['earth'])).toBe('earth');
});
it('ignores stale and duplicate discovery IDs when counting pages', () => {
  const id = DESTINATIONS.moon!.mission!.discoveries[0]!.id;
  expect(worldCollections([id,id,'retired']).find(w => w.id === 'moon')?.found).toBe(1);
});
it('keeps an observation visit out of collection pages and preserves the planet invitation', () => {
  expect(worldCollections([]).some(world => world.id === 'sun')).toBe(false);
  expect(nextWorld({visited:[], discoveries:[], stickers:[]}, ['sun','earth','moon'])).toBe('earth');
  // The Sun has no places to find and is not on the home map, so it is never the suggestion.
  expect(nextWorld({visited:['earth','moon'], discoveries:[], stickers:[]}, ['sun','earth','moon'])).toBe('earth');
  expect(nextWorld({visited:['earth','moon'], discoveries:[], stickers:[]}, ['sun'])).toBeNull();
});
