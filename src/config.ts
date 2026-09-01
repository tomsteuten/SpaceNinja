/**
 * Scene constants.
 *
 * Distances are compressed hard for composition, not accuracy: a true-scale Moon would
 * be 30 Earth-diameters away and invisible. Earth radius is the unit for everything else.
 *
 * Body *radii* are the one thing kept true to life — the Moon really is 0.27 Earths and
 * Mars really is 0.53 — because relative size is a thing a child can actually learn from
 * a picture, whereas relative distance at this scale is unshowable.
 */

import * as THREE from 'three';

export const EARTH_RADIUS = 1;

export const MOON_RADIUS = 0.27;
export const MOON_ORBIT_RADIUS = 2.5;
export const MOON_ORBIT_TILT = 0.11; // radians, so the Moon does not track a flat line
export const MOON_START_ANGLE = 0.62;

/**
 * Mars is given its own compressed path around the scene centre rather than a real
 * heliocentric orbit. At true scale it would be several thousand Earth-radii away and
 * the Sun is already at 105; this keeps every destination inside one composable frame.
 * Tilt and start angle are chosen to keep it well away from the Moon on screen.
 */
export const MARS_RADIUS = 0.53;
export const MARS_ORBIT_RADIUS = 5.0;
export const MARS_ORBIT_TILT = -0.19;
export const MARS_START_ANGLE = 3.4;

export const SUN_RADIUS = 7;
export const SUN_DISTANCE = 105;
/** Slightly off-axis so Earth shows a pleasing crescent terminator from the default view. */
export const SUN_DIRECTION = new THREE.Vector3(0.05, 0.55, 0.83).normalize();
export const SUN_POSITION = SUN_DIRECTION.clone().multiplyScalar(SUN_DISTANCE);

export const STAR_SHELL_RADIUS = 420;

/** Radians per second. Slow enough to feel calm rather than spinny. */
export const EARTH_SPIN = 0.045;
export const MOON_SPIN = 0.012;
export const MOON_ORBIT_SPEED = 0.055;
export const MARS_SPIN = 0.02;
/** Slower than the Moon: an outer body that raced round would read as wrong. */
export const MARS_ORBIT_SPEED = 0.03;

export const CAMERA_FOV_LANDSCAPE = 52;
export const CAMERA_FOV_PORTRAIT = 68;
export const CAMERA_NEAR = 0.05;
export const CAMERA_FAR = 800;

/**
 * How much of the scene the opening shot tries to fit, and the distance clamp around it.
 * This has to cover the Moon at the far side of its orbit, or a portrait phone — whose
 * horizontal field of view is tiny — loses the destination off the edge of the screen.
 */
export const FRAMING_RADIUS = MOON_ORBIT_RADIUS + MOON_RADIUS + 0.18;
/**
 * The wider shot, used once Mars is worth pointing at. Deliberately not the opening
 * framing: fitting Mars shrinks Earth and the Moon to a third of the size, which is a
 * bad first impression for a five-year-old who has not been given a reason to care yet.
 */
export const FRAMING_RADIUS_WIDE = MARS_ORBIT_RADIUS + MARS_RADIUS + 0.18;
export const MIN_ORBIT_DISTANCE = 0.6;
/**
 * Raised from 16 so FRAMING_RADIUS_WIDE actually fits on the narrowest phone in
 * portrait, where the horizontal field of view is only about 34 degrees.
 */
export const MAX_ORBIT_DISTANCE = 20;

export const FLIGHT_DURATION = 5.5; // seconds
export const FLIGHT_DURATION_REDUCED = 1.4;

/**
 * Earning this is what widens the opening shot to take in Mars. Tied to finishing the
 * Moon rather than to a flag of its own, so the world grows as a reward for the mission
 * the child has just done.
 */
export const WIDE_FRAMING_STICKER = 'moon-explorer';

/**
 * Everything a destination needs that is words rather than geometry. The bodies
 * themselves are built in Bodies.ts and matched up by id in main.ts; the collect
 * mission is generic and takes the body at runtime, so only the copy lives here.
 */
export interface DestinationConfig {
  /** Text on the button that launches the flight. */
  flyLabel: string;
  /** Read aloud on arrival. */
  fact: string;
  mission: {
    count: number;
    label: string;
    instruction: string;
    huntLine: string;
    successLine: string;
    stickerId: string;
  };
}

export const DESTINATIONS: Record<string, DestinationConfig> = {
  moon: {
    flyLabel: 'Fly to the Moon',
    fact:
      'There is no wind and no rain on the Moon. So the footprints the astronauts left ' +
      'there are still exactly where they stepped!',
    mission: {
      count: 3,
      label: 'Collect Moon Rocks',
      instruction: 'Tap the glowing moon rocks!',
      huntLine: 'One more! Drag to spin around the Moon.',
      successLine: 'You found all the moon rocks! What a brilliant explorer you are.',
      stickerId: 'moon-explorer',
    },
  },
  mars: {
    flyLabel: 'Fly to Mars',
    fact:
      'Mars is red because its dust is full of rust — the same rust that grows on an old ' +
      'bike left out in the rain. The whole planet is a bit rusty!',
    mission: {
      count: 4,
      label: 'Collect Mars Rocks',
      instruction: 'Tap the glowing red rocks!',
      huntLine: 'One more! Drag to spin around Mars.',
      successLine: 'You found all the Mars rocks! You are a real space explorer now.',
      stickerId: 'mars-explorer',
    },
  },
};
