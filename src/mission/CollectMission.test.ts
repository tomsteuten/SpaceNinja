/**
 * Placement is the load-bearing idea of the mission: some collectibles must be in the
 * hemisphere the child is already looking at, and at least one must not be, or the drag
 * gesture never gets taught. That rule is pure maths, so it can be checked here rather
 * than by squinting at a screenshot.
 */

import { describe, expect, it } from 'vitest';
import { FLOAT_RATIO, hitRadiusFor, placementAngles } from './CollectMission';
import { MARS_RADIUS, MOON_RADIUS } from '../config';

/** Half the angle subtended by the visible face from a typical arrival distance. */
const LIMB = 1.4; // radians, ~80°

/**
 * Where a collectible ends up, in units of the body's radius. Mirrors the basis maths in
 * buildCollectible; any orthonormal basis gives the same distances *between* two of them,
 * so this uses the plain axes rather than a camera-derived one.
 */
function placements(count: number, bodyRadius: number): Array<[number, number, number]> {
  const float = bodyRadius * FLOAT_RATIO;
  return placementAngles(count).map(([yaw, pitch]) => [
    Math.sin(yaw) * Math.cos(pitch) * float,
    Math.sin(pitch) * float,
    Math.cos(yaw) * Math.cos(pitch) * float,
  ]);
}

function distance(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

describe('placementAngles', () => {
  it('produces one angle pair per collectible', () => {
    for (const count of [1, 2, 3, 4, 6, 9]) {
      expect(placementAngles(count)).toHaveLength(count);
    }
  });

  it('hides at least one past the limb whenever there is more than one to find', () => {
    for (const count of [2, 3, 4, 6, 9]) {
      const hidden = placementAngles(count).filter(([yaw]) => Math.abs(yaw) > LIMB);
      expect(hidden.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('leaves a lone collectible in plain sight', () => {
    // Nothing to teach a drag with, and hiding the only one would open the mission on an
    // empty screen.
    const [only] = placementAngles(1);
    expect(only).toBeDefined();
    expect(Math.abs(only?.[0] ?? Infinity)).toBeLessThan(LIMB);
  });

  it('leaves something visible to start with whenever there is more than one', () => {
    for (const count of [2, 3, 4, 6, 9]) {
      const visible = placementAngles(count).filter(([yaw]) => Math.abs(yaw) < LIMB);
      expect(visible.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('puts two of the Moon mission in view and one behind', () => {
    const angles = placementAngles(3);
    expect(angles.filter(([yaw]) => Math.abs(yaw) < LIMB)).toHaveLength(2);
    expect(angles.filter(([yaw]) => Math.abs(yaw) > LIMB)).toHaveLength(1);
  });

  it('scales to the four-rock Mars mission without hiding most of them', () => {
    const angles = placementAngles(4);
    expect(angles.filter(([yaw]) => Math.abs(yaw) < LIMB)).toHaveLength(3);
    expect(angles.filter(([yaw]) => Math.abs(yaw) > LIMB)).toHaveLength(1);
  });

  it('never places one at the poles, where the hit sphere would foreshorten away', () => {
    for (const [, pitch] of placementAngles(9)) {
      expect(Math.abs(pitch)).toBeLessThan(Math.PI / 2 - 0.6);
    }
  });

  it('separates neighbours in the visible fan rather than stacking them', () => {
    const visible = placementAngles(4)
      .filter(([yaw]) => Math.abs(yaw) < LIMB)
      .map(([yaw]) => yaw);
    for (let i = 1; i < visible.length; i++) {
      expect(Math.abs((visible[i] ?? 0) - (visible[i - 1] ?? 0))).toBeGreaterThan(0.3);
    }
  });
});

/**
 * The hit spheres are invisible and generously oversized, so two of them growing into
 * each other is a bug nobody would see — the tap simply scores the wrong rock, and only
 * sometimes. It is a pure consequence of the four proportions, so it is checked here.
 *
 * This is the constraint that stops ROCK_RATIO being raised freely: the hit radius is
 * partly a multiple of the rock's, and the collectibles sit at fixed angles.
 */
describe('hit sphere spacing', () => {
  const bodies: Array<[string, number, number]> = [
    ['the Moon, 3 rocks', MOON_RADIUS, 3],
    ['Mars, 4 rocks', MARS_RADIUS, 4],
    // A denser mission than either destination currently asks for, as headroom.
    ['a dense 6-rock mission', MOON_RADIUS, 6],
  ];

  for (const [name, radius, count] of bodies) {
    it(`keeps every pair clear of each other on ${name}`, () => {
      const points = placements(count, radius);
      const minimum = hitRadiusFor(radius) * 2;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i];
          const b = points[j];
          expect(a).toBeDefined();
          expect(b).toBeDefined();
          if (!a || !b) continue;
          expect(distance(a, b)).toBeGreaterThan(minimum);
        }
      }
    });
  }
});
