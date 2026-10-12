import { describe, expect, it } from 'vitest';
import { neighborhoodBounds, type FramedBody } from './framing';

const encloses = (bounds: ReturnType<typeof neighborhoodBounds>, body: FramedBody) =>
  Math.hypot(body.x - bounds.x, body.y - bounds.y, body.z - bounds.z) + body.radius <= bounds.radius + 1e-9;

describe('neighborhood framing', () => {
  it('frames a lone world around itself with a margin', () => {
    expect(neighborhoodBounds([{ x: 3, y: 0, z: 4, radius: 2 }])).toEqual({ x: 3, y: 0, z: 4, radius: 2.2 });
  });
  it('has a sensible default for a page with nothing drawn yet', () => {
    expect(neighborhoodBounds([])).toEqual({ x: 0, y: 0, z: 0, radius: 2 });
  });
  it('encloses a planet and its moon whichever comes first', () => {
    const earth = { x: 0, y: 0, z: 0, radius: 1 }, moon = { x: 6, y: 0, z: 0, radius: 0.3 };
    for (const order of [[earth, moon], [moon, earth]]) {
      const bounds = neighborhoodBounds(order);
      for (const body of order) expect(encloses(bounds, body)).toBe(true);
      // Tight: the sphere spans the pair, not the origin-out reach of the whole system.
      expect(bounds.radius).toBeCloseTo(((6 + 1 + 0.3) / 2) * 1.1);
    }
  });
  it('lets a ringed view radius swallow a small companion and still enclose everything', () => {
    const saturn = { x: 40, y: 0, z: 0, radius: 5 }, titan = { x: 43, y: 0, z: 0, radius: 0.4 };
    expect(neighborhoodBounds([saturn, titan])).toEqual({ ...saturn, radius: 5.5 });
    const bodies = [titan, saturn, { x: 40, y: 9, z: 2, radius: 0.5 }];
    const bounds = neighborhoodBounds(bodies);
    for (const body of bodies) expect(encloses(bounds, body)).toBe(true);
  });
});
