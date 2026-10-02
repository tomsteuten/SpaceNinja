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
 * Two things happen, in order. Reduced motion cuts to the teaching viewpoint:
 *
 *  1. **The camera faces the terminator.** The flight deliberately arrives near
 *     the sub-solar point so the destination reads as a bright full disc, which means the
 *     day/night line hugs the limb and the visible face is entirely lit. Turning the body
 *     from there shows continents sliding past a planet that never changes — correct, and
 *     completely missing the point. Near side-on, both sunrise and sunset are visible.
 *     A compressed Sun cue on the lighting axis makes their cause visible too. Portrait
 *     frames it above the world; landscape uses the space beside it.
 *  2. **The body turns once, at a constant rate.** Exactly one turn, so every marker ends
 *     where it started and a hunt is undisturbed by having watched. Constant rather than
 *     eased: the eased version looks better and would be a lie about the one thing this
 *     exists to show. The Earth does not speed up in the afternoon.
 */

import * as THREE from 'three';
import type { OrbitInput } from '../controls/OrbitInput';
import type { CelestialBody } from './Bodies';
import type { TeachingSun } from './TeachingSun';
import { dayTurnPose } from './dayTurnFraming';

const FULL_TURN = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Seconds to swing the camera side-on, then seconds for the day itself.
 *
 * The turn is long enough to watch the light move rather than see it jump, short enough
 * to hold a five-year-old who is only watching.
 *
 * The body keeps one honest turning rate for everybody. Reduced motion omits the camera
 * sweep but keeps the turn: the changing daylight is the educational content.
 */
export const DAY_SWING_DURATION = 2.2;
export const DAY_TURN_DURATION = 9;
/**
 * The first-visit introduction on Earth is a shorter turn: long enough for one spoken
 * sentence to land while the light moves, short enough that a child who is not interested
 * has lost nothing — and any tap ends it anyway.
 */
export const DAY_INTRO_TURN_DURATION = 6;

export interface DayTurn {
  /** True from start() until the turn completes or is reset. */
  readonly active: boolean;
  /** Begins a turn. Ignored while one is already running. `duration` is the turn itself, in seconds. */
  start(body: CelestialBody, duration?: number): void;
  update(dt: number): void;
  /**
   * Ends the turn early, as a full completion rather than an abandonment: it applies
   * whatever turn is left in one step, so every marker still lands on its real coordinates,
   * settles the camera square-on where a natural finish leaves it, and fires `onFinish`.
   * This is the "tap to skip" a child gives when they would rather get on and hunt.
   */
  skip(): void;
  /** Stops where it is and gives the camera back. Does not report a finish. */
  reset(): void;
}

export interface DayTurnOptions {
  camera: THREE.PerspectiveCamera;
  /** Cut to the teaching viewpoint instead of sweeping the camera when motion is reduced. */
  reducedMotion?: boolean;
  /** Borrowed for the swing and handed back at the end, as the flight does. */
  controls: OrbitInput;
  teachingSun?: TeachingSun;
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
  const { camera, controls, teachingSun, onProgress, onFinish, reducedMotion = false } = options;
  const swingDuration = DAY_SWING_DURATION;
  let rate = FULL_TURN / DAY_TURN_DURATION;

  const centre = new THREE.Vector3();
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const look = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const sunPosition = new THREE.Vector3();
  const fromUp = new THREE.Vector3();
  const restoreUp = new THREE.Vector3();
  const fromLook = new THREE.Vector3();
  let pose: ReturnType<typeof dayTurnPose>;
  let aspect = 0;
  let fov = 0;
  let shotRadius = 1;

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
    if (aspect !== camera.aspect || fov !== camera.fov) {
      aspect = camera.aspect;
      fov = camera.fov;
      pose = dayTurnPose(shotRadius, axis, from, fov, aspect);
      to.copy(pose.position).normalize();
    }
    // Interpolated as directions and re-scaled, not as points: a straight line between
    // two points on a sphere dips through the middle, which here means through the planet.
    offset.copy(from).lerp(to, t).normalize()
      .multiplyScalar(THREE.MathUtils.lerp(distance, pose.position.length(), t));
    camera.position.copy(centre).add(offset);
    look.copy(fromLook).lerp(pose.look, t).add(centre);
    camera.up.copy(fromUp).lerp(pose.up, t).normalize();
    camera.lookAt(look);
    sunPosition.copy(centre).add(pose.sun);
    teachingSun?.show(sunPosition, shotRadius, smootherstep(t));
  }

  function release() {
    teachingSun?.hide();
    camera.up.copy(restoreUp);
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

    start(body: CelestialBody, duration = DAY_TURN_DURATION) {
      if (turning) return;
      turning = body;
      rate = FULL_TURN / duration;
      phase = 'swing';
      swung = 0;
      turned = 0;

      body.getWorldPosition(centre);
      offset.subVectors(camera.position, centre);
      distance = offset.length();
      from.copy(offset).normalize();
      restoreUp.copy(camera.up);
      fromUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
      camera.getWorldDirection(fromLook).multiplyScalar(distance).add(offset);

      // The actual spin axis includes the body's axial/orbital tilt. Near its equator,
      // surface features cross the terminator instead of sliding along it. The teaching
      // Sun shares the lighting direction, with deliberately compressed diagram distances.
      axis.copy(UP);
      if (body.surface.parent) {
        axis.applyQuaternion(body.surface.parent.getWorldQuaternion(new THREE.Quaternion()));
      }
      shotRadius = body.viewRadius ?? body.radius;
      aspect = 0; // Re-fit against the current viewport, including a resize during a turn.

      controls.enabled = false;
      if (reducedMotion) {
        phase = 'turn';
        placeCamera(1);
        onProgress?.(0);
      }
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

    skip() {
      const body = turning;
      if (!body) return;
      // Whatever is left of the one turn, applied at once — a partial turn would leave every
      // marker off its real coordinates, which is the whole thing the clamp above protects.
      body.turnSurface(FULL_TURN - turned);
      turned = FULL_TURN;
      // End on the square-on pose a natural finish leaves, so the hunt starts from the same
      // composition whether the turn ran out or was skipped.
      placeCamera(1);
      onProgress?.(1);
      release();
      onFinish();
    },

    reset() {
      teachingSun?.hide();
      if (!turning) return;
      release();
    },
  };
}
