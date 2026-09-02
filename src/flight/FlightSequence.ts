/**
 * The scripted flight from home out to a destination.
 *
 * While it runs it owns the camera outright: orbit input is disabled and every orbit is
 * frozen so the destination holds still. On arrival the ship is re-parented to the
 * destination (so it rides along), the orbit controller re-derives its angles from
 * wherever the camera finished, and control returns to the player without a visible snap.
 *
 * The destination is a parameter of start(), not a constant: nothing here knows which
 * body it is flying to, only its radius and where it is right now.
 */

import * as THREE from 'three';
import type { OrbitInput } from '../controls/OrbitInput';
import type { Spaceship } from '../scene/Spaceship';
import type { CelestialBody, World } from '../scene/Bodies';
import type { EngineTrail } from '../scene/EngineTrail';
import {
  FLIGHT_DURATION,
  FLIGHT_DURATION_REDUCED,
  FLIGHT_FOV_PUNCH,
  SUN_DIRECTION,
  fovForAspect,
} from '../config';

export type FlightPhase = 'idle' | 'flying' | 'arrived';

export interface FlightSequence {
  readonly phase: FlightPhase;
  /**
   * No-op unless idle. Returns true if the flight actually began.
   *
   * `aimLatitude` (degrees) is the latitude to arrive over. The caller passes the one the
   * destination's own discoveries sit at, because the flight deliberately knows nothing
   * about them — only where to point.
   */
  start(destination: CelestialBody, aimLatitude?: number): boolean;
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
  /** Exhaust. Owned by the caller like the ship is; the flight only feeds it. */
  trail: EngineTrail;
  world: World;
  controls: OrbitInput;
  /** Where the ship departs from. The arc is bowed away from this, so it never cuts through it. */
  home: CelestialBody;
  reducedMotion: boolean;
  onArrive(destination: CelestialBody): void;
}

const UP = new THREE.Vector3(0, 1, 0);
/** sin of half the 52-degree landscape FOV, the reference the chase offsets were tuned at. */
const LANDSCAPE_SIN_HALF_FOV = Math.sin(THREE.MathUtils.degToRad(52) / 2);

export function smootherstep(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  // Clamped on the way *out* as well as in. For an x a few ulps below 1 the polynomial
  // can land a few ulps above it, and CatmullRomCurve3.getPointAt(u > 1) then reads one
  // past the end of its arc-length table: undefined length, NaN t, and a crash inside
  // getPoint. Whether progress happens to land exactly on 1 depends on the flight
  // duration dividing the frame delta, so this was luck rather than correctness.
  return THREE.MathUtils.clamp(x * x * x * (x * (x * 6 - 15) + 10), 0, 1);
}

function smoothBetween(value: number, from: number, to: number): number {
  return smootherstep((value - from) / (to - from));
}

export function createFlightSequence(options: FlightOptions): FlightSequence {
  const { camera, scene, ship, trail, world, controls, home, reducedMotion, onArrive } = options;
  const duration = reducedMotion ? FLIGHT_DURATION_REDUCED : FLIGHT_DURATION;

  let phase: FlightPhase = 'idle';
  let target: CelestialBody | null = null;
  let progress = 0;
  let curve: THREE.CatmullRomCurve3 | null = null;
  let chaseScale = 1;

  const startCamera = new THREE.Vector3();
  const startLook = new THREE.Vector3();
  const endCamera = new THREE.Vector3();
  const targetPosition = new THREE.Vector3();
  const homePosition = new THREE.Vector3();

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
  const bodyPosition = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const tailPoint = new THREE.Vector3();

  /**
   * How far the camera sits behind the ship, in the chase offset's own units. It closes
   * in through the middle of the flight: the nearer the camera, the faster the stars sweep
   * past for the same speed, which is the parallax the compressed distances otherwise
   * deny us. It opens back out for the arrival so the destination still frames properly.
   */
  const CHASE_FAR = 1.6;
  const CHASE_NEAR = 1.12;

  /** Restores the field of view the viewport should be resting at. */
  function restFov(): number {
    return fovForAspect(camera.aspect);
  }

  function setFov(value: number) {
    if (Math.abs(camera.fov - value) < 0.001) return;
    camera.fov = value;
    camera.updateProjectionMatrix();
  }

  /** Half-angle of the tighter of the two fields of view. Portrait phones are horizontal. */
  function halfFov(): number {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    return Math.min(vFov, hFov) / 2;
  }

  /**
   * Distance that frames the destination nicely in the current viewport. The clamp is
   * expressed in body radii rather than absolute units so it holds for any destination.
   *
   * The numerator was 4.2, which put the camera about 9.6 body-radii out and left the
   * Moon a small ball in the middle of the screen. The orbit controller would let a child
   * reach 2.2 radii, where the real surface maps are genuinely worth looking at — but
   * nothing on screen says "pinch", so nobody ever got there and the best-looking thing
   * in the project went unseen. Arriving close is what makes the destination a *place*.
   *
   * 1.4 lands at ~3.2 radii: the body fills roughly two thirds of the frame height and
   * still sits whole inside it, with room for the ship alongside. The lower clamp is 2.4
   * rather than tighter because OrbitInput's own floor is max(MIN_ORBIT_DISTANCE,
   * 2.1 radii) — arriving inside that would snap the camera outward the moment the
   * flight handed control back.
   */
  function arrivalDistance(radius: number): number {
    return THREE.MathUtils.clamp(
      (radius * 1.4) / Math.sin(halfFov()),
      radius * 2.4,
      radius * 6.5,
    );
  }

  function buildPath(destination: CelestialBody, aimLatitude?: number) {
    destination.getWorldPosition(targetPosition);
    home.getWorldPosition(homePosition);

    axis.subVectors(targetPosition, homePosition).normalize();

    // Arrive on the sunlit side. Weighting the Sun direction most heavily is what keeps
    // the body a bright full disc instead of the dark limb you get facing back at home.
    endDirection
      .copy(SUN_DIRECTION)
      .multiplyScalar(0.9)
      .addScaledVector(axis, -0.5)
      .addScaledVector(UP, 0.18)
      .normalize();

    /*
     * Steer away from anything else that would loom in the shot.
     *
     * Distances here are compressed about thirtyfold, and making Earth a destination is
     * what exposed what that costs: the Moon's orbit is 2.5 Earth radii and an Earth
     * arrival sits at 3.2, so the Moon can pass *between* the camera and the planet a
     * child is trying to explore — a third of the screen wide, eclipsing it.
     *
     * This fixes the arrival shot, which is the one composed here, and no more than that:
     * the camera then orbits on a shell the Moon's own orbit crosses, so dragging far
     * enough round will still find it. Short of moving the Moon out — which would change
     * every other shot in the game — that is a property of the compressed scale rather
     * than something the flight can decide.
     *
     * A push rather than a hard constraint, weighted by how close it is, so a body out at
     * the edge of the framing barely moves the arrival and one sitting on top of it moves
     * it a long way. The Sun is at 105 and never qualifies.
     */
    for (const other of Object.values(world.bodies)) {
      if (other.id === destination.id) continue;
      other.getWorldPosition(bodyPosition).sub(targetPosition);
      const range = bodyPosition.length();
      if (range < 1e-4 || range > arrivalDistance(destination.radius)) continue;
      bodyPosition.divideScalar(range);
      // Only what is on the camera's side of the destination can get in front of it.
      const along = bodyPosition.dot(endDirection);
      if (along <= 0) continue;
      endDirection.addScaledVector(bodyPosition, -along * 0.9).normalize();
    }

    // Then swing it to the latitude the destination's own places sit at, keeping the
    // bearing the Sun just chose. The Sun is 33 degrees up, so left alone this arrives
    // looking down on the body and everything near its equator projects onto the bottom
    // limb. Only the elevation moves, so the arrival is still on the lit side.
    if (aimLatitude !== undefined) {
      const horizontal = Math.hypot(endDirection.x, endDirection.z);
      endDirection.y = Math.tan(THREE.MathUtils.degToRad(aimLatitude)) * horizontal;
      endDirection.normalize();
    }
    const radius = destination.radius;
    const framing = arrivalDistance(radius);
    endCamera.copy(targetPosition).addScaledVector(endDirection, framing);

    // Park the ship off the destination's lower limb, so it frames next to the body
    // rather than eclipsing it.
    //
    // Fractions of the *arrival distance*, not of the body's radius. Tied to the radius
    // (the old 2.4 / 3.2 / 1.0) the ship ended up 77 degrees off the view axis once the
    // camera moved in — entirely off the side of the screen.
    //
    // The depth term is slightly negative, putting the ship a little *beyond* the body
    // rather than in front of it. The ship is a fixed size in world units, so halving the
    // camera's distance to the destination doubles the ship on screen; parking it past
    // the body buys back some of that, and the lateral term is wide enough to clear the
    // limb so it is still plainly visible out there.
    // Also read by the flight itself, which turns the ship onto this axis as it arrives.
    lateral.crossVectors(endDirection, UP).normalize();
    const arrival = targetPosition
      .clone()
      .addScaledVector(endDirection, -framing * 0.35)
      .addScaledVector(lateral, -framing * 0.72)
      .addScaledVector(UP, -framing * 0.24);
    const from = ship.group.position.clone();

    heading.subVectors(arrival, from);
    const span = heading.length();
    heading.normalize();

    // Bow the path sideways so the trip reads as an arc rather than a straight line.
    // The bow must lean *away* from home, or the shortcut passes through the planet.
    side.crossVectors(heading, UP);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    outward.subVectors(from, homePosition).normalize();
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
    startLook
      .copy(camera.position)
      .addScaledVector(look, camera.position.distanceTo(homePosition));
  }

  return {
    get phase() {
      return phase;
    },

    start(destination: CelestialBody, aimLatitude?: number) {
      if (phase !== 'idle') return false;
      phase = 'flying';
      target = destination;
      progress = 0;

      scene.attach(ship.group);
      buildPath(destination, aimLatitude);

      controls.enabled = false;
      world.setOrbitSpeedScale(0);
      world.setSelected(null);
      return true;
    },

    reset() {
      phase = 'idle';
      target = null;
      progress = 0;
      curve = null;
      chaseScale = 1;
      // Explore Again can land here mid-flight, with the view still widened.
      setFov(restFov());
    },

    update(dt: number) {
      if (phase !== 'flying' || !curve || !target) return;

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
      const thrust =
        smoothBetween(progress, 0, 0.14) * (1 - smoothBetween(progress, 0.84, 1));
      ship.setThrust(thrust);

      // Exhaust, laid down behind the ship in world space so it stays where it was put
      // while the ship flies on. Offset back along the heading by roughly the length of
      // the hull, so it leaves the engines rather than the middle of the ship.
      if (!reducedMotion) {
        tailPoint.copy(point).addScaledVector(facing, -0.14);
        trail.emit(tailPoint, thrust, dt);
      }

      // Rises from 0 through the middle of the flight and falls back to 0 for the
      // arrival — one bell, driving everything that should peak at cruise.
      const cruise = Math.sin(smootherstep(progress) * Math.PI);

      // Chase camera: behind, above and a little to the side, so the ship reads in
      // three-quarter view rather than as a silhouette around its own exhaust.
      const chaseDistance = THREE.MathUtils.lerp(CHASE_FAR, CHASE_NEAR, cruise);
      chase
        .copy(point)
        .addScaledVector(tangent, -chaseDistance * chaseScale)
        .addScaledVector(UP, 0.6 * chaseScale)
        .addScaledVector(side, 0.55 * chaseScale);
      ahead.copy(point).addScaledVector(tangent, 1.1 * chaseScale);

      // Widen the view at cruise. Measured against the *current* resting FOV rather than
      // one captured at launch, so rotating the device mid-flight still lands correctly.
      if (!reducedMotion) setFov(restFov() + FLIGHT_FOV_PUNCH * cruise);

      // Ease out of the player's view at the start, and into the fixed Moon view at the end.
      const departure = smoothBetween(progress, 0, 0.2);
      const approach = smoothBetween(progress, 0.6, 1);

      camera.position.lerpVectors(startCamera, chase, departure).lerp(endCamera, approach);
      look.lerpVectors(startLook, ahead, departure).lerp(targetPosition, approach);
      camera.lookAt(look);

      if (progress < 1) return;

      /* --- arrival ---------------------------------------------------------- */
      phase = 'arrived';
      ship.setThrust(0);
      // The bell has already returned this to ~0 by now; set it exactly, so a flight that
      // ended on a frame boundary cannot leave the view a fraction of a degree wide.
      setFov(restFov());

      // attach() keeps the world transform, so the ship simply starts riding along.
      const destination = target;
      destination.anchor.attach(ship.group);
      world.setOrbitSpeedScale(1);

      controls.setFocusRadius(destination.radius);
      controls.setTarget(targetPosition, true);
      controls.syncFromCamera();
      controls.enabled = true;

      onArrive(destination);
    },
  };
}
