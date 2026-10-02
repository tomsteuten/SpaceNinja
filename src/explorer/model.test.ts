import { describe, expect, it } from 'vitest';
import { createFlight, stepFlight, radians, angularDistance, MIN_ALTITUDE, MAX_ALTITUDE } from './model';
describe('assisted surface flight', () => {
  it('flies on hold and comes to rest promptly on release', () => {
    const s = createFlight(); const before = s.lat;
    for (let i = 0; i < 120; i++) stepFlight(s, 1/60, {x:0, y:-1});
    expect(s.lat).toBeGreaterThan(before + 0.05);
    for (let i = 0; i < 40; i++) stepFlight(s, 1/60, null);
    expect(s.speed).toBe(0);
  });
  it('keeps altitude and poles safe during long steering', () => {
    const s = createFlight(); s.targetAltitude = -100;
    for (let i = 0; i < 10000; i++) stepFlight(s, 1/30, {x:0,y:-1});
    expect(s.altitude).toBeGreaterThanOrEqual(MIN_ALTITUDE - 1e-10);
    expect(Math.abs(s.lat)).toBeLessThanOrEqual(radians(78));
    s.targetAltitude = 100;
    for (let i = 0; i < 400; i++) stepFlight(s, 1/30, null);
    expect(s.altitude).toBeLessThanOrEqual(MAX_ALTITUDE);
  });
  it('has comparable travel at 30, 60 and 120 frames per second', () => {
    const states = [30,60,120].map(fps => {
      const s = createFlight();
      for (let i=0;i<fps*5;i++) stepFlight(s, 1/fps, {x:0.6,y:-0.8});
      return s;
    });
    for (const s of states) {
      expect(s.lat).toBeCloseTo(states[1]!.lat, 2);
      expect(s.lon).toBeCloseTo(states[1]!.lon, 2);
    }
  });
  it('measures great-circle separation, including across the date line', () => {
    expect(angularDistance({lat:0,lon:radians(179)},{lat:0,lon:radians(-179)})).toBeCloseTo(radians(2), 10);
    expect(angularDistance({lat:radians(90),lon:0},{lat:radians(-90),lon:1})).toBeCloseTo(Math.PI, 10);
  });
});
