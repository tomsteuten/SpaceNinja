import { describe,expect,it } from 'vitest';
import { existsSync } from 'node:fs';
import { DESTINATIONS } from '../config';
import { WORLDS,placeView } from './worlds';
import { radians } from './model';

describe('explorer destinations',()=>{
  it('retains every authored place with reachable views and individually credited existing media',()=>{
    for(const world of WORLDS){
      expect(world.places).toHaveLength(DESTINATIONS[world.id]!.mission.discoveries.length);
      expect(new Set(world.places.map(p=>p.id)).size).toBe(world.places.length);
      for(const place of world.places){
        expect(existsSync('public/'+place.photo),place.id).toBe(true);
        expect(place.source).toMatch(/^https:\/\/(svs.gsfc.nasa.gov|science.nasa.gov|images.nasa.gov|www.jpl.nasa.gov)\/.+/);
        expect(place.credit).not.toBe('NASA mission imagery');
        const view=placeView(place,world);
        expect(Math.abs(view.lat)).toBeLessThanOrEqual(radians(78));
        expect(view.altitude).toBeGreaterThanOrEqual(world.minAltitude);
        expect(view.altitude).toBeLessThanOrEqual(world.maxAltitude);
      }
    }
  });
  it('treats Saturn ring photographs as orbital views, without inventing a ground coordinate',()=>{
    const saturn=WORLDS.find(w=>w.id==='saturn')!;
    const rings=saturn.places.find(p=>p.id==='saturn-rings')!;
    expect(saturn.orbital).toBe(true);
    expect(placeView(rings,saturn).lat).not.toBe(rings.lat);
    expect(placeView(rings,saturn).altitude).toBeGreaterThan(1.3);
  });
});
