/**
 * Turning a destination through one whole day, so a child can watch morning arrive.
 *
 * This is here because of what children actually did with the game: they asked about the
 * sunrise. The scene has always answered that question correctly and never showed it —
 * `applyNightLights` masks the city lights by the world-space Sun direction and the
 * sunlight is a world-space directional light, so turning the surface makes places cross
 * into darkness with their lights coming on, and back out into morning. All of that
 * already worked. It simply never moved, and once a mission holds the surface still so its
 * markers stay under a child's finger, it could not.
 *
 * Two things happen, in order, and the first is not optional:
 *
 *  1. **The camera swings round to the terminator.** The flight deliberately arrives near
 *     the sub-solar point so the destination reads as a bright full disc, which means the
 *     day/night line hugs the limb and the visible face is entirely lit. Turning the body
 *     from there shows continents sliding past a planet that never changes — correct, and
 *     completely missing the point. From side-on the line runs down the middle of the disc
 *     and both sunrise and sunset are on screen at once.
 *  2. **The body turns once, at a constant rate.** Exactly one turn, so every marker ends
 *     where it started and a hunt is undisturbed by having watched. Constant rather than
 *     eased: the eased version looks better and would be a lie about the one thing this
 *     exists to show. The Earth does not speed up in the afternoon.
 */

import * as THREE from 'three';
import { SUN_DIRECTION } from '../config';
import type { OrbitInput } from '../controls/OrbitInput';
import type { CelestialBody } from './Bodies';

const FULL_TURN = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Seconds to swing the camera side-on, then seconds for the day itself.
 *
 * The turn is long enough to watch the light move rather than see it jump, short enough
 * to hold a five-year-old who is only watching. Reduced motion gets the same journey
 * briskly: the change *is* the content, so skipping it would show nothing at all.
 */
export const DAY_SWING_DURATION = 2.2;
export const DAY_TURN_DURATION = 9;
export const DAY_SWING_DURATION_REDUCED = 0.7;
export const DAY_TURN_DURATION_REDUCED = 3;

export interface DayTurn {
  /** True from start() until the turn completes or is reset. */
  readonly active: boolean;
  /** Begins a turn. Ignored while one is already running. */
  start(body: CelestialBody): void;
  update(dt: number): void;
  /** Stops where it is and gives the camera back. Does not report a finish. */
  reset(): void;
}

export interface DayTurnOptions {
  camera: THREE.PerspectiveCamera;
  /** Borrowed for the swing and handed back at the end, as the flight does. */
  controls: OrbitInput;
  reducedMotion: boolean;
  /**
   * How much of the day has turned, every active frame: 0 throughout the camera swing,
   * then 0 → 1 across the turn itself, reaching exactly 1 on the frame it completes.
   *
   * Reported rather than scheduled because the turn is clamped against what is left rather
   * than against the clock — a slow tablet stretches it, and anything following it has to
   * stretch too. Not called by reset(); stopping is the caller's own business, as it is
   * for onFinish.
   */
  onProgress?(progress: number): void;
  /** Fires once, when a full turn has been completed. Not called by reset(). */
  onFinish(): void;
}

function smootherstep(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function createDayTurn(options: DayTurnOptions): DayTurn {
  const { camera, controls, reducedMotion, onProgress, onFinish } = options;
  const swingDuration = reducedMotion ? DAY_SWING_DURATION_REDUCED : DAY_SWING_DURATION;
  const turnDuration = reducedMotion ? DAY_TURN_DURATION_REDUCED : DAY_TURN_DURATION;
  const rate = FULL_TURN / turnDuration;

  const centre = new THREE.Vector3();
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const offset = new THREE.Vector3();

  let turning: CelestialBody | null = null;
  let phase: 'swing' | 'turn' = 'swing';
  let swung = 0;
  let turned = 0;
  let distance = 0;

  /** Puts the camera on its arc at `t`, and keeps it there as the body travels. */
  function placeCamera(t: number) {
    const body = turning;
    if (!body) return;
    body.getWorldPosition(centre);
    // Interpolated as directions and re-scaled, not as points: a straight line between
    // two points on a sphere dips through the middle, which here means through the planet.
    offset.copy(from).lerp(to, t).normalize().multiplyScalar(distance);
    camera.position.copy(centre).add(offset);
    camera.lookAt(centre);
  }

  function release() {
    turning = null;
    swung = 0;
    turned = 0;
    controls.syncFromCamera();
    controls.enabled = true;
  }

  return {
    get active() {
      return turning !== null;
    },

    start(body: CelestialBody) {
      if (turning) return;
      turning = body;
      phase = 'swing';
      swung = 0;
      turned = 0;

      body.getWorldPosition(centre);
      offset.subVectors(camera.position, centre);
      distance = offset.length();
      from.copy(offset).normalize();

      /*
       * Square to the Sun *and* level with the equator, which is a single direction (up
       * to sign): the one perpendicular to both.
       *
       * Square to the Sun alone is not enough, and looks right until you watch it. The
       * Sun sits well above the equator, so the nearest square direction from a camera
       * that arrived high is also high — and from up there the day/night line lies
       * *across* the disc. A body turns about its own axis, so its surface moves
       * east-west, which from that viewpoint slides everything along the line instead of
       * over it: no sunrise, just continents skating past a boundary they never cross.
       * Level with the equator the line stands upright and places walk through it.
       */
      to.crossVectors(SUN_DIRECTION, UP).normalize();
      // Two directions satisfy that. Take the near one, so the swing is the shorter way
      // round and a child keeps their bearings.
      if (to.dot(from) < 0) to.negate();

      controls.enabled = false;
    },

    update(dt: number) {
      const body = turning;
      if (!body) return;

      if (phase === 'swing') {
        swung += dt;
        placeCamera(smootherstep(swung / swingDuration));
        // Nothing has turned yet, and saying so is not the same as saying nothing: the
        // swing is where a sound gets to arrive before the thing it is about starts.
        onProgress?.(0);
        if (swung >= swingDuration) phase = 'turn';
        return;
      }

      // Clamped against what is left rather than against the clock, so the total applied
      // is exactly one turn however the frames happened to land. A few thousandths of a
      // radian of overshoot per visit would walk every marker off its coordinates.
      const step = Math.min(FULL_TURN - turned, rate * dt);
      turned += step;
      body.turnSurface(step);
      onProgress?.(turned / FULL_TURN);
      // Held against the body rather than the world, so one that is still orbiting does
      // not slide out of frame while it turns.
      placeCamera(1);

      if (turned >= FULL_TURN) {
        release();
        onFinish();
      }
    },

    reset() {
      if (!turning) return;
      release();
    },
  };
}
