import { describe, expect, it } from 'vitest';
import { availability, companionPages, createMapModel, NEIGHBORHOODS, pageIndex, visiblePlaces } from './model';
describe('map browsing without progress', () => {
  it('starts near home and wraps both ways', () => {
    const map = createMapModel();
    expect(map.neighborhood.id).toBe('earth');
    map.move(1); expect(map.neighborhood.id).toBe('mars');
    map.move(-1); expect(map.neighborhood.id).toBe('earth');
    expect(pageIndex(0,-1)).toBe(NEIGHBORHOODS.length-1);
    expect(pageIndex(NEIGHBORHOODS.length-1,1)).toBe(0);
  });
  it('exposes all five real destinations and cannot make a fixture playable', () => {
    const real = NEIGHBORHOODS.flatMap(n => n.places.flatMap(p => p.body ? [p.body] : []));
    expect(real.sort()).toEqual(['earth','mars','moon','saturn','sun']);
    for (const n of NEIGHBORHOODS) for (const p of n.places) {
      if (!p.body) expect(availability(p,[p.id])).toBe('unbuilt');
    }
    const mars = NEIGHBORHOODS.find(n => n.id === 'mars')!.places[0]!;
    expect(availability(mars,['earth','moon','sun'])).toBe('locked');
    expect(availability(mars,['earth','moon','sun','mars'])).toBe('ready');
  });
  it('fits all companions in three controls while retaining the parent', () => {
    for (const n of NEIGHBORHOODS) {
      const reached = new Set<string>();
      for (let i=0;i<companionPages(n);i++) {
        const places = visiblePlaces(n,i);
        expect(places.length).toBeLessThanOrEqual(3);
        expect(places[0]).toBe(n.places[0]);
        places.forEach(p => reached.add(p.id));
      }
      expect([...reached].sort()).toEqual(n.places.map(p => p.id).sort());
    }
    const map = createMapModel(); map.move(2); map.moreMoons();
    expect(map.places.map(p => p.id)).toEqual(['jupiter','ganymede','callisto']);
    map.move(1); expect(map.companionPage).toBe(0);
  });
});
