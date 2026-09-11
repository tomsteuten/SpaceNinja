/**
 * Assisted free-flight — the physics, as pure functions plus one small stateful controller.
 *
 * This is a *prototype*, reached at `?freeflight`, and it exists to answer one question the
 * shipped game cannot: does steering the ship yourself feel good enough to be worth the
 * confusion it risks? AGENTS.md records why the last steering attempt was cut — "the ship
 * barely moved in frame" and there was "no goal" — so both are design targets here, not
 * afterthoughts. The heading and roll this produces are meant to be *seen*: the scene glue
 * lags the chase camera behind them so the nose leads a turn across the frame, and the goal
 * is the planets themselves, which the ship slows to a hover beside.
 *
 * The feel is deliberately *arcade*, not Newtonian. The ship always travels along its own
 * nose — there is no sideways drift to fight — so a five-year-old holding one finger down
 * gets forward motion they can point, and letting go stops them. Every assist the brief asks
 * for (auto-brake, auto-level, slow-to-hover, gentle collision deflection) is a consequence
 * of that one choice, tuned by the named constants below.
 *
 * The maths is exported piece by piece because that is the part whose failure is silent: a
 * sign wrong in the pitch clamp flips the world, a brake that never reaches zero leaves the
 * ship drifting into a planet. `freeFlightModel.test.ts` pins each one.
 */

import * as THREE from 'three';

/** World up. Yaw turns about it; the ship never rolls its own steering frame. */
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * A body the flight has to steer around and can stop beside. Deliberately not a
 * `CelestialBody`: the model knows a centre and a radius and nothing else, so it can be
 * tested with three lines of setup instead of a whole scene.
 */
export interface FlightBody {
  id: string;
  center: THREE.Vector3;
  radius: number;
  /**
   * Optional visual footprint that the ship must not cross. Saturn uses the outside of its
   * rings here: treating it as only a sphere lets a child fly through the most recognisable
   * part of the planet before collision help notices anything.
   */
  clearanceRadius?: number;
}

export interface FreeFlightTuning {
  /** Top forward speed, in Earth-radii per second. Earth→Mars (5 units) is about 4s at 1.3. */
  cruiseSpeed: number;
  /** How fast speed climbs to cruise while a finger is down. ~1.1 reaches cruise in ~1.2s. */
  accel: number;
  /** How fast speed bleeds to zero on release. Higher than accel so a stop feels deliberate. */
  brakeDecel: number;
  /** Peak yaw rate (rad/s) at full stick. ~1.6 is a brisk but not twitchy ~90°/s. */
  yawRate: number;
  /** Peak pitch rate (rad/s). A little gentler than yaw — pitching up and down disorients more. */
  pitchRate: number;
  /** How far the ship banks into a full-deflection turn, in radians (~0.5 ≈ 29°). Visible on purpose. */
  maxBank: number;
  /** How quickly bank eases toward its target and back to level. Per second. */
  levelRate: number;
  /**
   * Body radii at which the ship is fully hovered (speed capped to zero) and at which the
   * cap has released back to cruise. Between them the cap ramps, so approaching a planet
   * slows you to a stop with no button — the "automatic braking" the brief asks for.
   */
  hoverInnerFactor: number;
  hoverOuterFactor: number;
  /** Body radii inside which the ship is pushed back out. Collision help, no penalty, no crash. */
  clearFactor: number;
  /** Body radii within which a planet offers itself to Explore. Just outside the hover band. */
  exploreFactor: number;
}

export const DEFAULT_TUNING: FreeFlightTuning = {
  cruiseSpeed: 1.3,
  accel: 1.1,
  brakeDecel: 1.6,
  yawRate: 1.6,
  pitchRate: 1.2,
  maxBank: 0.5,
  levelRate: 4,
  hoverInnerFactor: 1.7,
  hoverOuterFactor: 3.0,
  clearFactor: 1.32,
  exploreFactor: 3.0,
};

/**
 * Keep a heading out of the poles. Straight up or down is where a yaw-about-world-up frame
 * gimbals — the right axis (up × heading) collapses to nothing and steering stops
 * responding — so the vertical component is capped short of vertical and the horizontal part
 * rescaled to keep the vector unit. 0.9 ≈ 64° of climb, past which a child is looking at
 * empty sky anyway.
 */
export const MAX_PITCH_Y = 0.9;

export function clampPitch(heading: THREE.Vector3): THREE.Vector3 {
  heading.normalize();
  if (Math.abs(heading.y) <= MAX_PITCH_Y) return heading;
  const y = THREE.MathUtils.clamp(heading.y, -MAX_PITCH_Y, MAX_PITCH_Y);
  const horizontal = Math.hypot(heading.x, heading.z);
  // Rescale the horizontal part to whatever length keeps the vector unit at the clamped y.
  const scale = horizontal > 1e-6 ? Math.sqrt(1 - y * y) / horizontal : 0;
  heading.set(heading.x * scale, y, heading.z * scale);
  return heading.normalize();
}

/**
 * Steer a heading from one finger. `x`/`y` are the pointer's offset from the screen centre
 * in [-1, 1] (x right, y up). Push right and the nose yaws right; push up and it pitches up.
 * The turn rate is proportional to how far the finger is from centre, so a small nudge is a
 * gentle curve and the edge of the screen is a hard bank. Mutates and returns `heading`.
 */
export function steerHeading(
  heading: THREE.Vector3,
  x: number,
  y: number,
  dt: number,
  tuning: FreeFlightTuning,
  right = new THREE.Vector3(),
): THREE.Vector3 {
  const yaw = -x * tuning.yawRate * dt;
  heading.applyAxisAngle(WORLD_UP, yaw);
  // Screen-right is heading × world-up for the chase camera behind the ship. The reverse
  // cross product makes an upward finger pitch the nose down and, more seriously, makes
  // autopilot correct away from a target whenever it is above or below the ship.
  right.crossVectors(heading, WORLD_UP);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();
  const pitch = y * tuning.pitchRate * dt;
  heading.applyAxisAngle(right, pitch);
  return clampPitch(heading);
}

/**
 * The bank the ship should be showing for a given steering input. Banks into the turn (push
 * right → roll right) and returns to level at zero, which is what makes a release *look*
 * like levelling off rather than just going straight. `x` is the pointer's horizontal offset,
 * or 0 when nothing is held.
 */
export function bankTarget(x: number, tuning: FreeFlightTuning): number {
  const roll = -THREE.MathUtils.clamp(x, -1, 1) * tuning.maxBank;
  return roll === 0 ? 0 : roll; // normalise -0, so a centred stick reads as exactly level
}

/** Frame-rate-independent ease of a scalar toward a target. */
export function easeScalar(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * Math.min(1, rate * dt);
}

/**
 * Next forward speed. Thrusting climbs toward cruise; released, it brakes toward zero. The
 * result is clamped into [0, cruise] so neither integration can overshoot on a long frame
 * (Stage clamps dt to 0.05s, but this must be safe on its own for the tests).
 */
export function advanceSpeed(
  speed: number,
  thrusting: boolean,
  dt: number,
  tuning: FreeFlightTuning,
): number {
  const next = thrusting ? speed + tuning.accel * dt : speed - tuning.brakeDecel * dt;
  return THREE.MathUtils.clamp(next, 0, tuning.cruiseSpeed);
}

/**
 * The speed cap imposed by nearby planets: cruise far out, ramping to zero at the hover
 * shell, so a ship flown straight at a world coasts to a stop beside it rather than through
 * it. Returns the *lowest* cap any body imposes.
 */
export function approachSpeedCap(
  position: THREE.Vector3,
  bodies: readonly FlightBody[],
  tuning: FreeFlightTuning,
): number {
  let cap = tuning.cruiseSpeed;
  for (const body of bodies) {
    const dist = position.distanceTo(body.center);
    const naturalInner = body.radius * tuning.hoverInnerFactor;
    const inner = Math.max(naturalInner, body.clearanceRadius ?? 0);
    // Preserve the original width of the braking band when a larger visual footprint moves
    // the inner edge out. Scaling every factor by Saturn's rings starts braking across most
    // of the compact solar system and makes the other worlds feel inexplicably sticky.
    const outer = inner + body.radius * (tuning.hoverOuterFactor - tuning.hoverInnerFactor);
    if (dist >= outer) continue;
    const t = THREE.MathUtils.clamp((dist - inner) / (outer - inner), 0, 1);
    cap = Math.min(cap, t * tuning.cruiseSpeed);
  }
  return cap;
}

/**
 * Push the ship out of any body it has sunk inside. Gentle collision help: no bounce, no
 * penalty, no crash — the position is simply clamped onto the clear shell, and the caller is
 * told it happened so it can bleed off speed. Mutates `position` and returns whether it moved.
 *
 * The degenerate case is real: the ship can start at Earth's own centre. With nowhere to be
 * pushed, it uses `fallback` (the heading) to choose a way out.
 */
export function keepClear(
  position: THREE.Vector3,
  bodies: readonly FlightBody[],
  tuning: FreeFlightTuning,
  fallback: THREE.Vector3,
  out = new THREE.Vector3(),
): boolean {
  let deflected = false;
  for (const body of bodies) {
    const minDist = Math.max(body.radius * tuning.clearFactor, body.clearanceRadius ?? 0);
    out.subVectors(position, body.center);
    const dist = out.length();
    if (dist >= minDist) continue;
    if (dist < 1e-4) out.copy(fallback).normalize();
    else out.divideScalar(dist);
    position.copy(body.center).addScaledVector(out, minDist);
    deflected = true;
  }
  return deflected;
}

export interface NearestBody {
  body: FlightBody;
  distance: number;
  /** Within the range at which a planet offers to be explored. */
  explorable: boolean;
}

/** The closest body, and whether it is near enough to offer Explore. Null if the list is empty. */
export function nearestBody(
  position: THREE.Vector3,
  bodies: readonly FlightBody[],
  tuning: FreeFlightTuning,
): NearestBody | null {
  let best: NearestBody | null = null;
  for (const body of bodies) {
    const distance = position.distanceTo(body.center);
    if (best && distance >= best.distance) continue;
    best = { body, distance, explorable: distance < body.radius * tuning.exploreFactor };
  }
  return best;
}

export interface FreeFlightState {
  position: THREE.Vector3;
  /** Unit facing (the ship's nose, +Z in model space — see Spaceship.orient). */
  heading: THREE.Vector3;
  /** Current forward speed, [0, cruise]. */
  speed: number;
  /** Bank angle in radians, for the ship's roll. */
  roll: number;
  /**
   * A world the ship is hovering beside and could enter: set once it is inside the explore
   * range and nearly stopped, cleared when it leaves. This is the goal the old attempt
   * lacked — the thing steering is *for*.
   */
  explorable: string | null;
  /** True while flying itself to an autopilot target. */
  autopilot: string | null;
}

export interface FreeFlightInput {
  /** Pointer offset from centre in [-1, 1], or null when nothing is held (released → braking). */
  pointer: { x: number; y: number } | null;
}

export interface FreeFlight {
  readonly state: FreeFlightState;
  update(dt: number, input: FreeFlightInput, bodies: readonly FlightBody[]): FreeFlightState;
  /** Fly to this body on its own; any finger-press hands control straight back to the child. */
  engageAutopilot(id: string): void;
  cancelAutopilot(): void;
}

/**
 * How nearly stopped, and how squarely facing a world, counts as "hovering beside it and
 * ready to explore". Speed is compared against a small fraction of cruise rather than zero
 * because the approach cap eases it down and never quite reaches it.
 */
const HOVER_SPEED_RATIO = 0.06;

export function createFreeFlight(
  start: { position: THREE.Vector3; heading: THREE.Vector3 },
  tuning: FreeFlightTuning = DEFAULT_TUNING,
): FreeFlight {
  const state: FreeFlightState = {
    position: start.position.clone(),
    heading: start.heading.clone().normalize(),
    speed: 0,
    roll: 0,
    explorable: null,
    autopilot: null,
  };

  const right = new THREE.Vector3();
  const toTarget = new THREE.Vector3();

  /**
   * Turn the autopilot's destination into the same (x, y) a finger would hold to fly there.
   * Yaw is the signed angle between where the nose points and where the target is, flattened
   * to the horizontal plane; pitch is how far above or below the ship the target sits. Both
   * are scaled so a target dead ahead asks for no stick and a target off to the side asks for
   * full — the autopilot flies with exactly the model the child does, nothing privileged.
   */
  function autopilotPointer(target: THREE.Vector3): { x: number; y: number } {
    toTarget.subVectors(target, state.position);
    if (toTarget.lengthSq() < 1e-8) return { x: 0, y: 0 };
    toTarget.normalize();
    // Horizontal steering as a difference of bearings about world up, where a bearing is the
    // angle from +Z toward +X — the same sense steerHeading's yaw turns in. Taking the wrapped
    // difference (rather than atan2 of a cross/dot pair) is what keeps a target dead behind
    // from flip-flopping the stick across the ±π branch every frame: the error just eases from
    // π down to 0 as the ship comes round, so it commits to one direction and holds it.
    const targetBearing = Math.atan2(toTarget.x, toTarget.z);
    const headBearing = Math.atan2(state.heading.x, state.heading.z);
    let yawErr = targetBearing - headBearing;
    yawErr = Math.atan2(Math.sin(yawErr), Math.cos(yawErr)); // wrap to (-π, π]
    // steerHeading yaws by -x·rate, so a positive error (target further round) needs x < 0.
    const x = THREE.MathUtils.clamp(-yawErr / (Math.PI / 3), -1, 1);
    const y = THREE.MathUtils.clamp((toTarget.y - state.heading.y) * 2, -1, 1);
    return { x, y };
  }

  return {
    state,

    engageAutopilot(id: string) {
      state.autopilot = id;
    },

    cancelAutopilot() {
      state.autopilot = null;
    },

    update(dt: number, input: FreeFlightInput, bodies: readonly FlightBody[]): FreeFlightState {
      // A finger-press cancels autopilot: the child has taken the controls back. This is
      // checked on the input, so the very frame a press arrives the pointer already drives.
      if (input.pointer) state.autopilot = null;

      // Where the steering comes from this frame: the finger, the autopilot, or nothing.
      let stick: { x: number; y: number } | null = input.pointer;
      let thrusting = input.pointer !== null;
      if (!stick && state.autopilot) {
        const target = bodies.find((b) => b.id === state.autopilot);
        if (target) {
          stick = autopilotPointer(target.center);
          // Steer the whole way in, but stop thrusting once inside the hover band and let the
          // brake settle it — otherwise a ship aimed at the centre at cruise just circles the
          // world at its turning radius forever, never slow enough to count as arrived.
          const naturalInner = target.radius * tuning.hoverInnerFactor;
          const inner = Math.max(naturalInner, target.clearanceRadius ?? 0);
          const reach = inner + target.radius * (tuning.hoverOuterFactor - tuning.hoverInnerFactor);
          thrusting = state.position.distanceTo(target.center) > reach;
        } else {
          state.autopilot = null;
        }
      }

      if (stick) steerHeading(state.heading, stick.x, stick.y, dt, tuning, right);
      state.roll = easeScalar(state.roll, bankTarget(stick?.x ?? 0, tuning), tuning.levelRate, dt);

      // Thrust toward cruise or brake toward zero, then let a nearby planet cap it lower so
      // the approach itself is the brake. The cap is applied after, so thrust can never push
      // through the hover shell.
      state.speed = advanceSpeed(state.speed, thrusting, dt, tuning);
      const cap = approachSpeedCap(state.position, bodies, tuning);
      if (state.speed > cap) state.speed = cap;

      // Always travel along the nose — arcade, no drift. Legible, and collision-friendly.
      state.position.addScaledVector(state.heading, state.speed * dt);
      keepClear(state.position, bodies, tuning, state.heading);

      // The goal light: hovering, slow, beside a world.
      const near = nearestBody(state.position, bodies, tuning);
      const hovering = state.speed <= tuning.cruiseSpeed * HOVER_SPEED_RATIO;
      state.explorable = near && near.explorable && hovering ? near.body.id : null;

      // Arriving under autopilot is the same event as arriving by hand: once it is hovering
      // beside the world it was sent to, its job is done and the child is offered Explore.
      if (state.autopilot && state.explorable === state.autopilot) state.autopilot = null;

      return state;
    },
  };
}
