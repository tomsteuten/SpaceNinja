/**
 * Scene constants.
 *
 * Distances are compressed hard for composition, not accuracy: a true-scale Moon would
 * be 30 Earth-diameters away and invisible. Earth radius is the unit for everything else.
 */

import * as THREE from 'three';

export const EARTH_RADIUS = 1;
export const MOON_RADIUS = 0.27;
export const MOON_ORBIT_RADIUS = 2.5;
export const MOON_ORBIT_TILT = 0.11; // radians, so the Moon does not track a flat line
export const MOON_START_ANGLE = 0.62;

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
export const MIN_ORBIT_DISTANCE = 0.6;
export const MAX_ORBIT_DISTANCE = 16;

export const FLIGHT_DURATION = 5.5; // seconds
export const FLIGHT_DURATION_REDUCED = 1.4;

export const MOON_FACT =
  'There is no wind and no rain on the Moon. So the footprints the astronauts left ' +
  'there are still exactly where they stepped!';

/**
 * The Moon's collect mission. Only the strings and the count live here; the mission
 * module itself is destination-generic and takes the body at runtime.
 */
export const MOON_MISSION = {
  count: 3,
  label: 'Collect Moon Rocks',
  instruction: 'Tap the glowing moon rocks!',
  huntLine: 'One more! Drag to spin around the Moon.',
  successLine: 'You found all the moon rocks! What a brilliant explorer you are.',
  stickerId: 'moon-explorer',
} as const;
