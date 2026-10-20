/**
 * The physics behind the Moon jump toy. Real surface gravities and one take-off speed, so
 * the difference a child sees between the two jumps is the real difference, not a tuned one.
 */

export const EARTH_GRAVITY = 9.81; // m/s²
export const MOON_GRAVITY = 1.62; // m/s²

/** A child's standing jump: about 35 cm on Earth. The same push lifts them about 2 m on the Moon. */
export const TAKE_OFF_SPEED = 2.6; // m/s

/** How tall the drawn child is, so their own height is the ruler. */
export const CHILD_HEIGHT = 1.2; // m

export function peakHeight(gravity: number, speed = TAKE_OFF_SPEED): number {
  return (speed * speed) / (2 * gravity);
}

export function airTime(gravity: number, speed = TAKE_OFF_SPEED): number {
  return (2 * speed) / gravity;
}

export interface Jumper {
  readonly gravity: number;
  /** Height of the feet above the ground, metres. */
  height: number;
  velocity: number;
  airborne: boolean;
  /** Highest point of the last finished or current jump, metres. */
  lastPeak: number;
}

export function createJumper(gravity: number): Jumper {
  return { gravity, height: 0, velocity: 0, airborne: false, lastPeak: 0 };
}

/** Starts a jump if the jumper is standing. Returns whether it jumped. */
export function jump(j: Jumper, speed = TAKE_OFF_SPEED): boolean {
  if (j.airborne) return false;
  j.airborne = true;
  j.velocity = speed;
  j.lastPeak = 0;
  return true;
}

/**
 * Advances one jumper by dt seconds. Uses the exact parabola for the step so a slow frame
 * cannot change how high the jump goes. Returns true on the frame it lands.
 */
export function stepJumper(j: Jumper, dt: number): boolean {
  if (!j.airborne) return false;
  const v0 = j.velocity;
  const h0 = j.height;
  j.velocity = v0 - j.gravity * dt;
  j.height = h0 + v0 * dt - 0.5 * j.gravity * dt * dt;
  // Passed the top during this step: record the true apex, not the sampled one.
  if (v0 > 0 && j.velocity <= 0) j.lastPeak = Math.max(j.lastPeak, h0 + peakHeight(j.gravity, v0));
  j.lastPeak = Math.max(j.lastPeak, j.height);
  if (j.height <= 0) {
    j.height = 0;
    j.velocity = 0;
    j.airborne = false;
    return true;
  }
  return false;
}
