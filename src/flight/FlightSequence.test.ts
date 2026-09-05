/**
 * The easing curve feeds CatmullRomCurve3.getPointAt, which indexes an arc-length table
 * by its argument. Hand it a u even one ulp above 1 and it reads one past the end of that
 * table, gets undefined, computes NaN, and throws inside getPoint — a crash that takes the
 * whole flight with it.
 *
 * That happened for real: clamping only the *input* left the polynomial free to return
 * marginally more than 1, and whether it ever did depended on whether the flight duration
 * happened to divide the frame delta. Changing FLIGHT_DURATION from 5.5 to 7 was enough to
 * turn a working flight into a crashing one, which is not a thing that should be luck.
 *
 * The second half of this file covers what the flight *reports* rather than what it draws:
 * the two numbers the engine sound is driven from. They are the same two the exhaust and
 * the widening view already use, and the tests pin them to those rather than to constants,
 * because the only failure that matters here is the sound and the picture disagreeing.
 */

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createFlightSequence, pilotInfluence, smootherstep } from './FlightSequence';
import { FLIGHT_FOV_PUNCH, fovForAspect } from '../config';
import type { CelestialBody, World } from '../scene/Bodies';
import type { EngineTrail } from '../scene/EngineTrail';
import type { OrbitInput } from '../controls/OrbitInput';
import type { Spaceship } from '../scene/Spaceship';

describe('smootherstep', () => {
  it('stays inside 0..1 for the values either end of the flight', () => {
    // The middle one is the progress that actually crashed it.
    for (const t of [0, 1, 0.9999999999999974, 1 - Number.EPSILON, Number.EPSILON, 0.5]) {
      const value = smootherstep(t);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('stays inside 0..1 across the whole sweep', () => {
    for (let i = 0; i <= 2000; i++) {
      const value = smootherstep(i / 2000);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('clamps out-of-range input rather than extrapolating', () => {
    expect(smootherstep(-3)).toBe(0);
    expect(smootherstep(4)).toBe(1);
  });

  it('still eases: flat at both ends, halfway in the middle', () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    expect(smootherstep(0.5)).toBeCloseTo(0.5, 10);
    // Flat approach at each end is the whole point of this curve over a linear ramp.
    expect(smootherstep(0.05)).toBeLessThan(0.01);
    expect(smootherstep(0.95)).toBeGreaterThan(0.99);
  });
});

describe('pilotInfluence', () => {
  it('hands departure and arrival back to the guaranteed route exactly', () => {
    expect(pilotInfluence(0)).toBe(0);
    expect(pilotInfluence(0.04)).toBe(0);
    expect(pilotInfluence(0.18)).toBe(1);
    expect(pilotInfluence(0.7)).toBe(1);
    expect(pilotInfluence(0.94)).toBe(0);
    expect(pilotInfluence(1)).toBe(0);
  });

  it('never pushes outside the authored steering corridor', () => {
    for (let step = 0; step <= 1000; step++) {
      const influence = pilotInfluence(step / 1000);
      expect(influence).toBeGreaterThanOrEqual(0);
      expect(influence).toBeLessThanOrEqual(1);
    }
  });
});

/* --- what the flight reports ---------------------------------------------- */

function stubBody(id: string, at: THREE.Vector3, radius: number): CelestialBody {
  return {
    id,
    radius,
    anchor: new THREE.Object3D(),
    getWorldPosition: (target: THREE.Vector3) => target.copy(at),
  } as unknown as CelestialBody;
}

/** Everything the flight touches, recording only the two things under test. */
function flightHarness(reducedMotion: boolean) {
  const camera = new THREE.PerspectiveCamera(52, 4 / 3, 0.05, 800);
  const scene = new THREE.Scene();
  const home = stubBody('earth', new THREE.Vector3(0, 0, 0), 1);
  const destination = stubBody('moon', new THREE.Vector3(9, 1, 4), 0.27);

  /** What the exhaust was actually emitted at, frame by frame. */
  const emitted: number[] = [];
  /** What the flight reported for sound, frame by frame. */
  const reported: Array<{ throttle: number; cruise: number; fov: number }> = [];

  const ship = {
    group: new THREE.Object3D(),
    orient: vi.fn(),
    setThrust: vi.fn(),
  } as unknown as Spaceship;

  const flight = createFlightSequence({
    camera,
    scene,
    ship,
    trail: { emit: (_p: THREE.Vector3, thrust: number) => emitted.push(thrust) } as unknown as EngineTrail,
    world: {
      bodies: { earth: home, moon: destination },
      setOrbitSpeedScale: vi.fn(),
      setSelected: vi.fn(),
    } as unknown as World,
    controls: {
      enabled: true,
      setFocusRadius: vi.fn(),
      setTarget: vi.fn(),
      syncFromCamera: vi.fn(),
    } as unknown as OrbitInput,
    home,
    reducedMotion,
    onThrottle: (throttle, cruise) => reported.push({ throttle, cruise, fov: camera.fov }),
    onArrive: vi.fn(),
  });

  return { flight, camera, destination, emitted, reported };
}

/** Flies the whole way and hands back what was reported on the way. */
function fly(reducedMotion = false, dt = 1 / 60) {
  const harness = flightHarness(reducedMotion);
  harness.flight.start(harness.destination);
  let frames = 0;
  while (harness.flight.phase === 'flying' && frames++ < 100000) harness.flight.update(dt);
  return harness;
}

describe('what the flight reports for sound', () => {
  it('says nothing at all until a flight starts', () => {
    const { flight, reported } = flightHarness(false);
    flight.update(1 / 60);
    expect(reported).toHaveLength(0);
  });

  it('reports the same throttle the exhaust is drawn at', () => {
    /*
     * The load-bearing one. The engine's level follows this value precisely so that what
     * is heard and what is seen coming out of the ship cannot come apart — gaining it by
     * the cruise bell instead would fade the sound to nothing over the first and last
     * sixth of the trip, while the exhaust is still plainly firing.
     */
    const { emitted, reported } = fly();
    // Every frame but the arrival report, which the trail is not given.
    const flown = reported.slice(0, emitted.length).map((frame) => frame.throttle);
    expect(flown).toEqual(emitted);
    expect(emitted.length).toBeGreaterThan(100);
  });

  it('reports the cruise the view is actually widened by', () => {
    const { reported, camera } = fly();
    const rest = fovForAspect(camera.aspect);
    // Each frame records the fov it *arrived* with, because the report happens before the
    // view is widened. So the widening a cruise value caused shows up on the next frame.
    for (let i = 0; i < reported.length - 2; i++) {
      const cruise = reported[i]?.cruise ?? 0;
      expect(reported[i + 1]?.fov).toBeCloseTo(rest + FLIGHT_FOV_PUNCH * cruise, 2);
    }
  });

  it('is a plateau, not a bell: the engine is still burning at both ends', () => {
    const { reported } = fly();
    const throttles = reported.map((frame) => frame.throttle);
    const cruises = reported.map((frame) => frame.cruise);
    // A fifth of the way in, the ship is at full throttle and barely into its cruise.
    const early = Math.floor(throttles.length * 0.2);
    expect(throttles[early]).toBeGreaterThan(0.95);
    expect(cruises[early]).toBeLessThan(0.75);
    expect(Math.max(...throttles)).toBeCloseTo(1, 5);
    expect(Math.max(...cruises)).toBeCloseTo(1, 2);
  });

  it('reports exactly nothing on arrival, rather than nearly nothing', () => {
    // The plateau has already fallen to a few thousandths by the last frame. A few
    // thousandths of a thruster is a thruster: it would run for the whole visit.
    const { reported } = fly();
    expect(reported.at(-1)).toEqual({ throttle: 0, cruise: 0, fov: expect.any(Number) });
  });

  /*
   * Reduced motion no longer shortens the flight, and this pins that it does not.
   *
   * FLIGHT_DURATION_REDUCED was 1.4 seconds against 7 — the same sweeping camera move at
   * five times the angular rate, which is more motion per second, not less. Reported from
   * the tablet the game is played on as faster and more awkward, which is the opposite of
   * what the preference asks for. What reduced motion still drops is the decoration: the
   * FOV punch and the exhaust trail, both checked here by their absence.
   */
  it('takes the same time however the device feels about motion', () => {
    const brisk = fly(true);
    const full = fly(false);
    expect(brisk.reported.length).toBe(full.reported.length);
    expect(Math.max(...brisk.reported.map((frame) => frame.throttle))).toBeCloseTo(1, 5);
    expect(brisk.reported.at(-1)?.throttle).toBe(0);
  });

  it('still drops the decoration under reduced motion', () => {
    const brisk = fly(true);
    // No exhaust laid down, and the view never widens off its resting value.
    expect(brisk.emitted).toHaveLength(0);
    const rest = fovForAspect(brisk.camera.aspect);
    for (const frame of brisk.reported) expect(frame.fov).toBeCloseTo(rest, 5);
    // And the sound is untouched by any of that: it is not motion.
    expect(Math.max(...brisk.reported.map((frame) => frame.cruise))).toBeCloseTo(1, 2);
  });
});
