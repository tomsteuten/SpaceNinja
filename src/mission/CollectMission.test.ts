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
  facingLongitude,
  markerPlacement,
  placementAngles,
  surfaceDirection,
  withinVisibleFace,
} from './CollectMission';
import { authoredSet } from './selection';
import {
  DESTINATIONS,
  SATURN_RADIUS,
  SATURN_RING_INNER_RATIO,
  SATURN_RING_OUTER_RATIO,
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

/**
 * The Moon's own authored triple — the opening places plus the last one, which is the hidden
 * entry by the convention every world's list follows. Not the whole list: worlds now carry
 * more places than they show, and a *set* is chosen per visit. Whether a chosen set composes
 * is `selection.test.ts`'s job; this file tests the maths underneath it.
 */
const MOON = authoredSet(DESTINATIONS.moon?.mission.discoveries ?? []);

/** A local position, compared component-wise so a wrong axis is named rather than summed. */
type THREENumberTriple = [number, number, number];

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

describe('markerPlacement', () => {
  const surface: Discovery = { id: 's', name: 's', emoji: '', lat: 30, lon: 40, short: '', fact: '' };
  const ring: Discovery = { id: 'r', name: 'r', emoji: '', lat: 0, lon: 40, ring: 1.9, short: '', fact: '' };

  it('floats a surface place just off the sphere, facing outward', () => {
    const { position, faceNormal } = markerPlacement(surface, 1.5);
    // Just above the surface (FLOAT_RATIO is a hair over 1), and the disc faces along its
    // own outward radial so it lies on the ground.
    expect(position.length()).toBeGreaterThan(1.5);
    expect(position.length()).toBeLessThan(1.52);
    expect(faceNormal.dot(position.clone().normalize())).toBeCloseTo(1, 6);
  });

  it('puts a ring place out in the equatorial plane at its radius, lying flat', () => {
    const bodyRadius = SATURN_RADIUS;
    const { position, faceNormal } = markerPlacement(ring, bodyRadius);
    // On the ring band: `ring` body-radii from the centre, between the inner and outer edge.
    expect(position.length()).toBeCloseTo(1.9 * bodyRadius, 6);
    expect(1.9).toBeGreaterThan(SATURN_RING_INNER_RATIO);
    expect(1.9).toBeLessThan(SATURN_RING_OUTER_RATIO);
    // In the equatorial plane (y = 0) and facing along the axis, so the bullseye lies in the
    // ring rather than standing up radially out of it.
    expect(position.y).toBeCloseTo(0, 6);
    expect(faceNormal.x).toBeCloseTo(0, 6);
    expect(faceNormal.y).toBeCloseTo(1, 6);
    expect(faceNormal.z).toBeCloseTo(0, 6);
  });

  it('sends a ring place round the same way its longitude would on the surface', () => {
    // lat is ignored for a ring place, but lon still chooses the direction, so it rides the
    // arrival turn to the near side exactly like a surface marker at the same longitude.
    const ringDir = markerPlacement(ring, 1).position.clone().normalize();
    const surfaceDir = surfaceDirection(0, 40);
    expect(ringDir.dot(surfaceDir)).toBeCloseTo(1, 6);
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
      { id: 'a', name: 'a', emoji: '', lat: 0, lon: 170, short: '', fact: '' },
      { id: 'b', name: 'b', emoji: '', lat: 0, lon: -170, short: '', fact: '' },
      { id: 'hidden', name: 'hidden', emoji: '', lat: 0, lon: 0, short: '', fact: '' },
    ];
    expect(Math.abs(facingLongitude(across))).toBeCloseTo(180, 6);
  });

  it('faces a lone discovery directly', () => {
    const only: Discovery[] = [
      { id: 'only', name: 'only', emoji: '', lat: 12, lon: 44, short: '', fact: '' },
    ];
    // Nothing to teach a drag with, and hiding the only one would open on an empty screen.
    expect(facingLongitude(only)).toBeCloseTo(44, 6);
    expect(Math.abs(placementAngles(only)[0]?.[0] ?? Infinity)).toBeLessThan(LIMB);
  });
});

/*
 * The per-destination composition and hit-spacing suites that used to live here have moved to
 * `selection.test.ts`, along with the helpers they needed.
 *
 * They asserted that a world's *whole list* composed as an arrival, which was the same thing
 * as its chosen set while every world carried exactly three places. Worlds now carry six and
 * a set is picked per visit, so the property worth checking is that *every set the picker can
 * produce* composes — strictly stronger, and covering combinations no person ever looked at.
 */

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
