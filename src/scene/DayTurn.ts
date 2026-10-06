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
 *  2. **The surface turns under fixed sunlight.** Earth's hands-on activity follows the
 *     child's drag or a requested quarter turn. Other worlds keep the timed, constant-rate
 *     demonstration. Finishing restores the hunt's original surface orientation.
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
 * Retained short-demo timing. Earth's current activity uses direct input, not this timer.
 */
export const DAY_INTRO_TURN_DURATION = 6;

export interface DayTurn {
  /** True from start() until the turn completes or is reset. */
  readonly active: boolean;
  /** Earth can be turned by the child instead of running a timed demonstration. */
  readonly interactive: boolean;
  /** Begins a turn. Ignored while one is already running. `duration` is the turn itself, in seconds. */
  start(body: CelestialBody, duration?: number, interactive?: boolean): void;
  /** Direct finger motion; applied once, with no release inertia. */
  turnBy(angle: number): void;
  /** A tap/keyboard alternative advances a quarter turn at a gentle constant speed. */
  nudge(): void;
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
  /** Fires once on completion or Done. Not called by reset(). */
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
  let handsOn = false;
  let assistedTurn = 0;

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
    assistedTurn = 0;
    handsOn = false;
    controls.syncFromCamera();
    controls.enabled = true;
  }

  return {
    get active() {
      return turning !== null;
    },

    get interactive() {
      return turning !== null && handsOn;
    },

    start(body: CelestialBody, duration = DAY_TURN_DURATION, interactive = false) {
      if (turning) return;
      turning = body;
      rate = FULL_TURN / duration;
      phase = 'swing';
      swung = 0;
      turned = 0;
      handsOn = interactive;
      assistedTurn = 0;

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

    turnBy(angle: number) {
      if (!turning || !handsOn || !Number.isFinite(angle)) return;
      assistedTurn = 0;
      turned += angle;
      turning.turnSurface(angle);
      onProgress?.(THREE.MathUtils.euclideanModulo(turned, FULL_TURN) / FULL_TURN);
    },

    nudge() {
      if (turning && handsOn) assistedTurn += FULL_TURN / 4;
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
      const step = handsOn
        ? Math.min(assistedTurn, FULL_TURN / 3 * dt)
        : Math.min(FULL_TURN - turned, rate * dt);
      if (handsOn) assistedTurn -= step;
      turned += step;
      body.turnSurface(step);
      onProgress?.(handsOn ? THREE.MathUtils.euclideanModulo(turned, FULL_TURN) / FULL_TURN : turned / FULL_TURN);
      // Held against the body rather than the world, so one that is still orbiting does
      // not slide out of frame while it turns.
      placeCamera(1);

      if (!handsOn && turned >= FULL_TURN) {
        release();
        onFinish();
      }
    },

    skip() {
      const body = turning;
      if (!body) return;
      // Whatever is left of the one turn, applied at once — a partial turn would leave every
      // marker off its real coordinates, which is the whole thing the clamp above protects.
      // Hands-on play may move in either direction over many turns. Restore the exact
      // starting orientation before returning to the real-coordinate discovery hunt.
      body.turnSurface(handsOn ? -turned : FULL_TURN - turned);
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
      if (handsOn) turning.turnSurface(-turned);
      release();
    },
  };
}
