/**
 * Placement is the load-bearing idea of the mission: some discoveries must be in the
 * hemisphere the child is already looking at, and at least one must not be, or the drag
 * gesture never gets taught.
 *
 * That rule used to be guaranteed by construction — the angles were generated to satisfy
 * it. It is now a *consequence* of where the real features happen to be, which is exactly
 * why it has to be checked: the copy in config.ts is edited by hand, and moving one
 * longitude by a hundred degrees is a one-character change that silently opens the
 * mission on an empty screen or with nothing left to drag for.
 */

import { describe, expect, it } from 'vitest';
import {
  FLOAT_RATIO,
  facingLongitude,
  hitRadiusFor,
  placementAngles,
  surfaceDirection,
  withinVisibleFace,
} from './CollectMission';
import {
  DESTINATIONS,
  EARTH_RADIUS,
  MARS_RADIUS,
  MOON_RADIUS,
  type Discovery,
} from '../config';

/**
 * Half the angle subtended by the visible face at arrival.
 *
 * Was 1.4 (~80°), which was right when the flight stopped 9.6 body-radii out. It arrives
 * at ~3.2 now, and a nearer camera sees *less* of a sphere, not more: acos(1/3.2) is
 * 71.7°. Anything beyond this is over the horizon and needs a drag to reach.
 */
const LIMB = 1.25; // radians, ~72°

const MOON = DESTINATIONS.moon?.mission.discoveries ?? [];

/**
 * Radii by id. The hit-sphere spacing below scales with the body, so a destination that
 * fell through to a default would be checked against the wrong one — silently, and in the
 * safe direction for a small body, which is the direction that hides a real overlap.
 */
const RADII: Record<string, number> = {
  earth: EARTH_RADIUS,
  moon: MOON_RADIUS,
  mars: MARS_RADIUS,
};

/** Every destination's real discovery list, so a new planet is covered the day it lands. */
const DESTINATION_CASES: Array<[string, Discovery[], number]> = Object.entries(
  DESTINATIONS,
).map(([id, config]) => {
  const radius = RADII[id];
  if (radius === undefined) throw new Error(`No radius for destination "${id}" in this test.`);
  return [id, config.mission.discoveries, radius];
});

/** Where a discovery ends up, in world units, mirroring what buildCollectible does. */
function placements(discoveries: Discovery[], bodyRadius: number): THREENumberTriple[] {
  const float = bodyRadius * FLOAT_RATIO;
  return placementAngles(discoveries).map(([yaw, pitch]) => [
    Math.sin(yaw) * Math.cos(pitch) * float,
    Math.sin(pitch) * float,
    Math.cos(yaw) * Math.cos(pitch) * float,
  ]);
}

type THREENumberTriple = [number, number, number];

function distance(a: THREENumberTriple, b: THREENumberTriple): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

describe('surfaceDirection', () => {
  /*
   * The one piece of this that cannot be reasoned about from the game — it depends on
   * which way THREE.SphereGeometry wraps its UVs and on where an equirectangular map puts
   * its seam. Getting it wrong does not throw; it just puts every marker on the wrong
   * continent, which is why the bearings are pinned here rather than trusted.
   */
  const cases: Array<[string, [number, number], THREENumberTriple]> = [
    ['the prime meridian on the equator', [0, 0], [1, 0, 0]],
    ['90 east', [0, 90], [0, 0, -1]],
    ['90 west', [0, -90], [0, 0, 1]],
    ['the far side of the seam', [0, 180], [-1, 0, 0]],
    ['the north pole', [90, 0], [0, 1, 0]],
    ['the south pole', [-90, 137], [0, -1, 0]],
  ];

  for (const [name, [lat, lon], expected] of cases) {
    it(`points at ${name}`, () => {
      const direction = surfaceDirection(lat, lon);
      expect(direction.x).toBeCloseTo(expected[0], 6);
      expect(direction.y).toBeCloseTo(expected[1], 6);
      expect(direction.z).toBeCloseTo(expected[2], 6);
    });
  }

  it('is always a unit vector', () => {
    for (const lat of [-89, -43.3, 0, 18.65, 89]) {
      for (const lon of [-180, -133.8, 0, 23.47, 180]) {
        expect(surfaceDirection(lat, lon).length()).toBeCloseTo(1, 9);
      }
    }
  });

  /**
   * The identity `build()` turns into the body's arrival rotation. If surfaceDirection's
   * convention ever changes, this is what catches it: the mission would otherwise go on
   * turning the body by an angle that no longer means anything.
   */
  it('puts longitude L at a bearing of L plus a quarter turn', () => {
    // Compared as a *difference* modulo a full turn. Wrapping the two sides separately
    // puts pi and -pi on opposite ends of the range while meaning the same bearing, and
    // the identity is only ever used as a rotation, where a whole turn is nothing.
    const wrap = (radians: number) =>
      radians - Math.PI * 2 * Math.round(radians / (Math.PI * 2));
    for (const lon of [-170, -90, -37, 0, 23.47, 90, 179]) {
      const direction = surfaceDirection(0, lon);
      const bearing = Math.atan2(direction.x, direction.z);
      expect(wrap(bearing - (Math.PI / 2 + (lon * Math.PI) / 180))).toBeCloseTo(0, 9);
    }
  });
});

describe('facingLongitude', () => {
  it('faces the ones that are meant to be found first, not the hidden one', () => {
    // The Moon's far side is at 180 and would drag the average right around the body if
    // it counted; the two near-side features average to about 6 degrees east.
    expect(facingLongitude(MOON)).toBeCloseTo(6.03, 1);
  });

  it('averages longitudes as directions, not as numbers', () => {
    // The arithmetic mean of these is 0, which is the opposite side of the body to both.
    const across: Discovery[] = [
      { id: 'a', name: 'a', emoji: '', lat: 0, lon: 170, fact: '' },
      { id: 'b', name: 'b', emoji: '', lat: 0, lon: -170, fact: '' },
      { id: 'hidden', name: 'hidden', emoji: '', lat: 0, lon: 0, fact: '' },
    ];
    expect(Math.abs(facingLongitude(across))).toBeCloseTo(180, 6);
  });

  it('faces a lone discovery directly', () => {
    const only: Discovery[] = [
      { id: 'only', name: 'only', emoji: '', lat: 12, lon: 44, fact: '' },
    ];
    // Nothing to teach a drag with, and hiding the only one would open on an empty screen.
    expect(facingLongitude(only)).toBeCloseTo(44, 6);
    expect(Math.abs(placementAngles(only)[0]?.[0] ?? Infinity)).toBeLessThan(LIMB);
  });
});

describe('placementAngles, on the real destinations', () => {
  for (const [name, discoveries] of DESTINATION_CASES) {
    it(`produces one angle pair per discovery on ${name}`, () => {
      expect(placementAngles(discoveries)).toHaveLength(discoveries.length);
    });

    it(`leaves something in view on arrival at ${name}`, () => {
      const visible = placementAngles(discoveries).filter(([yaw]) => Math.abs(yaw) < LIMB);
      expect(visible.length).toBeGreaterThanOrEqual(1);
    });

    it(`hides the last one past the limb at ${name}`, () => {
      const angles = placementAngles(discoveries);
      const last = angles[angles.length - 1];
      expect(last).toBeDefined();
      expect(Math.abs(last?.[0] ?? 0)).toBeGreaterThan(LIMB);
    });

    it(`keeps the hidden one at ${name} within a single drag`, () => {
      // The other half of the rule, and the half that is easy to lose. Past the limb
      // teaches the gesture; *far* past it is a half-turn of dragging on a dark
      // hemisphere, which a five-year-old abandons. The Moon's far side sat at 180 and
      // needed about 100 degrees of drag before this bound existed; the collectible this
      // replaced sat at 116, needing about 45, which is the feel being preserved.
      const angles = placementAngles(discoveries);
      const last = angles[angles.length - 1];
      expect(Math.abs(last?.[0] ?? 0)).toBeLessThan(2.3); // ~132 degrees
    });

    it(`hides only the last one at ${name}`, () => {
      // More than one over the horizon and the arrival shot starts looking empty.
      const hidden = placementAngles(discoveries).filter(([yaw]) => Math.abs(yaw) > LIMB);
      expect(hidden).toHaveLength(1);
    });

    it(`keeps ${name} clear of the poles, where a hit sphere foreshortens away`, () => {
      for (const [, pitch] of placementAngles(discoveries)) {
        expect(Math.abs(pitch)).toBeLessThan(Math.PI / 2 - 0.6);
      }
    });

    it(`separates the ones in view on ${name} rather than stacking them`, () => {
      const visible = placementAngles(discoveries)
        .filter(([yaw]) => Math.abs(yaw) < LIMB)
        .map(([yaw]) => yaw);
      for (let i = 1; i < visible.length; i++) {
        expect(Math.abs((visible[i] ?? 0) - (visible[i - 1] ?? 0))).toBeGreaterThan(0.3);
      }
    });
  }
});

/**
 * The hit spheres are invisible and generously oversized, so two of them growing into
 * each other is a bug nobody would see — the tap simply scores the wrong place, and only
 * sometimes.
 *
 * It now depends on real coordinates rather than on a spacing rule, so it is genuinely
 * possible to break by writing a plausible-looking config entry. The tightest pair in the
 * game is the Moon's footprints and its bright crater, which clear each other by about
 * nine per cent: worth knowing before adding a fourth place to a small body.
 */
describe('hit sphere spacing', () => {
  for (const [name, discoveries, radius] of DESTINATION_CASES) {
    it(`keeps every pair of ${name} discoveries clear of each other`, () => {
      const points = placements(discoveries, radius);
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

/**
 * Whether a marker can be tapped *through* the body it is on.
 *
 * This was a real bug and an invisible one. The hit spheres are many times the size of
 * the marker they surround, on purpose, and the raycast tests only those spheres — it
 * never learns the planet is in the way. At Earth's arrival the Sahara and the hidden
 * night-side marker project within thirty pixels of each other, one in front and one
 * behind, so a child who tapped the Sahara and then tapped the same spot again collected
 * the far-side discovery through six thousand miles of planet, without ever dragging.
 * That is the one thing the whole placement design exists to make them do.
 */
describe('withinVisibleFace', () => {
  // Earth-sized body at the distance the flight actually arrives at.
  const R = 1;
  const D = 3.19;

  it('accepts a marker facing the camera head on', () => {
    expect(withinVisibleFace(1, R, D)).toBe(true);
  });

  it('accepts one well inside the visible face', () => {
    // 45 degrees round from the centre of the disc.
    expect(withinVisibleFace(Math.cos(Math.PI / 4), R, D)).toBe(true);
  });

  it('rejects one directly behind the body', () => {
    expect(withinVisibleFace(-1, R, D)).toBe(false);
  });

  it('rejects the case that caused this: a marker 120 degrees round', () => {
    // Earth's night side at arrival, which shares a screen position with the Sahara.
    expect(withinVisibleFace(Math.cos((120 * Math.PI) / 180), R, D)).toBe(false);
  });

  it('still accepts one sitting right on the limb', () => {
    // acos(R/D) is the geometric horizon; a marker there must stay tappable, because
    // being *just* reachable after a drag is the reward the placement is aiming for.
    const limb = Math.acos(R / D);
    expect(withinVisibleFace(Math.cos(limb), R, D)).toBe(true);
  });

  it('tightens as the camera comes closer, which is what a sphere really does', () => {
    // The same marker, 75 degrees round from the centre of the disc. From 6.5 radii the
    // horizon is at 81 degrees and it is in view; from 1.8 it is at 56 and this is well
    // behind it. Not 60 degrees: that is inside the slack at 1.8, which is the point of
    // the slack rather than a hole in it.
    const alignment = Math.cos((75 * Math.PI) / 180);
    expect(withinVisibleFace(alignment, R, 6.5)).toBe(true);
    expect(withinVisibleFace(alignment, R, 1.8)).toBe(false);
  });

  it('never occludes anything when the camera is inside the body', () => {
    expect(withinVisibleFace(-1, R, 0.5)).toBe(true);
  });
});
