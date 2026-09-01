/**
 * The scripted Earth-to-Moon flight.
 *
 * While it runs it owns the camera outright: orbit input is disabled and the Moon's orbit
 * is frozen so the destination holds still. On arrival the ship is re-parented to the Moon
 * (so it rides along), the orbit controller re-derives its angles from wherever the camera
 * finished, and control returns to the player without a visible snap.
 */

import * as THREE from 'three';
import type { OrbitInput } from '../controls/OrbitInput';
import type { Spaceship } from '../scene/Spaceship';
import type { World } from '../scene/Bodies';
import {
  FLIGHT_DURATION,
  FLIGHT_DURATION_REDUCED,
  MOON_RADIUS,
  SUN_DIRECTION,
} from '../config';

export type FlightPhase = 'idle' | 'flying' | 'arrived';

export interface FlightSequence {
  readonly phase: FlightPhase;
  /** No-op unless idle. Returns true if the flight actually began. */
  start(): boolean;
  /**
   * Back to idle, ready to fly again. Only the sequence's own state — the ship, the
   * world and the camera are restored by their own resets, from the same caller.
   */
  reset(): void;
  update(dt: number): void;
}

export interface FlightOptions {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  ship: Spaceship;
  world: World;
  controls: OrbitInput;
  reducedMotion: boolean;
  onArrive(): void;
}

const UP = new THREE.Vector3(0, 1, 0);
/** sin of half the 52-degree landscape FOV, the reference the chase offsets were tuned at. */
const LANDSCAPE_SIN_HALF_FOV = Math.sin(THREE.MathUtils.degToRad(52) / 2);

function smootherstep(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function smoothBetween(value: number, from: number, to: number): number {
  return smootherstep((value - from) / (to - from));
}

export function createFlightSequence(options: FlightOptions): FlightSequence {
  const { camera, scene, ship, world, controls, reducedMotion, onArrive } = options;
  const duration = reducedMotion ? FLIGHT_DURATION_REDUCED : FLIGHT_DURATION;

  let phase: FlightPhase = 'idle';
  let progress = 0;
  let curve: THREE.CatmullRomCurve3 | null = null;
  let chaseScale = 1;

  const startCamera = new THREE.Vector3();
  const startLook = new THREE.Vector3();
  const endCamera = new THREE.Vector3();
  const moonPosition = new THREE.Vector3();
  const earthPosition = new THREE.Vector3();

  // Scratch vectors — reused every frame so the flight allocates nothing.
  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const chase = new THREE.Vector3();
  const look = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const side = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const heading = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const endDirection = new THREE.Vector3();
  const lateral = new THREE.Vector3();
  const facing = new THREE.Vector3();

  /** Half-angle of the tighter of the two fields of view. Portrait phones are horizontal. */
  function halfFov(): number {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    return Math.min(vFov, hFov) / 2;
  }

  /** Distance that frames the Moon nicely in the current viewport. */
  function arrivalDistance(): number {
    return THREE.MathUtils.clamp((MOON_RADIUS * 4.2) / Math.sin(halfFov()), 1.6, 5.5);
  }

  function buildPath() {
    world.bodies.moon.getWorldPosition(moonPosition);
    world.bodies.earth.getWorldPosition(earthPosition);

    axis.subVectors(moonPosition, earthPosition).normalize();

    // Arrive on the sunlit side. Weighting the Sun direction most heavily is what keeps
    // the Moon a bright full disc instead of the dark limb you get facing back at Earth.
    endDirection
      .copy(SUN_DIRECTION)
      .multiplyScalar(0.9)
      .addScaledVector(axis, -0.5)
      .addScaledVector(UP, 0.18)
      .normalize();
    const distance = arrivalDistance();
    endCamera.copy(moonPosition).addScaledVector(endDirection, distance);

    // Park the ship on the camera's side of the Moon but well off to one side, so it
    // frames next to the Moon rather than eclipsing it.
    lateral.crossVectors(endDirection, UP).normalize();
    const from = ship.group.position.clone();
    const arrival = moonPosition
      .clone()
      .addScaledVector(endDirection, MOON_RADIUS * 2.4)
      .addScaledVector(lateral, -MOON_RADIUS * 3.2)
      .addScaledVector(UP, -MOON_RADIUS);

    heading.subVectors(arrival, from);
    const span = heading.length();
    heading.normalize();

    // Bow the path sideways so the trip reads as an arc rather than a straight line.
    // The bow must lean *away* from Earth, or the shortcut passes through the planet.
    side.crossVectors(heading, UP);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    outward.subVectors(from, earthPosition).normalize();
    if (side.dot(outward) < 0) side.negate();

    const mid1 = from
      .clone()
      .addScaledVector(heading, span * 0.3)
      .addScaledVector(side, span * 0.17)
      .addScaledVector(UP, span * 0.1);
    const mid2 = from
      .clone()
      .addScaledVector(heading, span * 0.68)
      .addScaledVector(side, span * 0.13)
      .addScaledVector(UP, span * 0.15);

    curve = new THREE.CatmullRomCurve3([from, mid1, mid2, arrival], false, 'catmullrom', 0.5);

    // Chase offsets are authored against a landscape field of view. Scaling them by how
    // much narrower this viewport is keeps the ship the same size on screen in portrait,
    // instead of filling the frame or wandering out of it.
    chaseScale = THREE.MathUtils.clamp(LANDSCAPE_SIN_HALF_FOV / Math.sin(halfFov()), 1, 2.2);

    startCamera.copy(camera.position);
    // The controller looks at its target, so the current view direction starts there.
    camera.getWorldDirection(look);
    startLook.copy(camera.position).addScaledVector(look, camera.position.distanceTo(earthPosition));
  }

  return {
    get phase() {
      return phase;
    },

    start() {
      if (phase !== 'idle') return false;
      phase = 'flying';
      progress = 0;

      scene.attach(ship.group);
      buildPath();

      controls.enabled = false;
      world.setOrbitSpeedScale(0);
      world.setSelected(null);
      return true;
    },

    reset() {
      phase = 'idle';
      progress = 0;
      curve = null;
      chaseScale = 1;
    },

    update(dt: number) {
      if (phase !== 'flying' || !curve) return;

      progress = Math.min(1, progress + dt / duration);
      const t = smootherstep(progress);

      curve.getPointAt(t, point);
      curve.getTangentAt(t, tangent);

      ship.group.position.copy(point);
      // Swing the nose round to face the Moon over the last stretch, so the ship settles
      // broadside to the camera instead of pointing its exhaust straight down the lens.
      facing.copy(tangent).lerp(lateral, smoothBetween(progress, 0.72, 1)).normalize();
      // Bank into the arc, easing back to level at both ends.
      ship.orient(facing, Math.sin(t * Math.PI) * 0.3);
      ship.setThrust(smoothBetween(progress, 0, 0.14) * (1 - smoothBetween(progress, 0.84, 1)));

      // Chase camera: behind, above and a little to the side, so the ship reads in
      // three-quarter view rather than as a silhouette around its own exhaust.
      chase
        .copy(point)
        .addScaledVector(tangent, -1.6 * chaseScale)
        .addScaledVector(UP, 0.6 * chaseScale)
        .addScaledVector(side, 0.55 * chaseScale);
      ahead.copy(point).addScaledVector(tangent, 1.1 * chaseScale);

      // Ease out of the player's view at the start, and into the fixed Moon view at the end.
      const departure = smoothBetween(progress, 0, 0.2);
      const approach = smoothBetween(progress, 0.6, 1);

      camera.position.lerpVectors(startCamera, chase, departure).lerp(endCamera, approach);
      look.lerpVectors(startLook, ahead, departure).lerp(moonPosition, approach);
      camera.lookAt(look);

      if (progress < 1) return;

      /* --- arrival ---------------------------------------------------------- */
      phase = 'arrived';
      ship.setThrust(0);

      // attach() keeps the world transform, so the ship simply starts riding the Moon.
      world.bodies.moon.anchor.attach(ship.group);
      world.setOrbitSpeedScale(1);

      controls.setFocusRadius(MOON_RADIUS);
      controls.setTarget(moonPosition, true);
      controls.syncFromCamera();
      controls.enabled = true;

      onArrive();
    },
  };
}
