import { expect, it } from 'vitest';
import { DESTINATIONS } from '../config';
import { nextWorld, worldCollections } from './replay';
const all = Object.keys(DESTINATIONS);
it('prefers a newly available world over collecting more on a visited world', () => {
  expect(nextWorld({visited:['moon'], discoveries:[], stickers:[]}, ['earth','moon','mars'])).toBe('mars');
});
it('suggests an incomplete collection after every world has been visited', () => {
  const discoveries = DESTINATIONS.moon!.mission.discoveries.slice(0, 5).map(d => d.id);
  expect(nextWorld({visited:all, discoveries, stickers:[]}, all)).toBe('moon');
  expect(worldCollections(discoveries).find(w => w.id === 'moon')?.found).toBe(5);
});
it('never suggests a locked or completed world and stops when everything is found', () => {
  const discoveries = Object.values(DESTINATIONS).flatMap(w => w.mission.discoveries.map(d => d.id));
  expect(nextWorld({visited:all, discoveries, stickers:[]}, all)).toBeNull();
  expect(nextWorld({visited:all, discoveries:[], stickers:[]}, ['earth'])).toBe('earth');
});
it('ignores stale and duplicate discovery IDs when counting pages', () => {
  const id = DESTINATIONS.moon!.mission.discoveries[0]!.id;
  expect(worldCollections([id,id,'retired']).find(w => w.id === 'moon')?.found).toBe(1);
});
