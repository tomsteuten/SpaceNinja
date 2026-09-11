import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  DEFAULT_TUNING,
  MAX_PITCH_Y,
  advanceSpeed,
  approachSpeedCap,
  bankTarget,
  clampPitch,
  createFreeFlight,
  easeScalar,
  keepClear,
  nearestBody,
  steerHeading,
  type FlightBody,
} from './freeFlightModel';

const T = DEFAULT_TUNING;

function body(id: string, x: number, y: number, z: number, radius: number): FlightBody {
  return { id, center: new THREE.Vector3(x, y, z), radius };
}

describe('clampPitch', () => {
  it('keeps a shallow heading unit and untouched in direction', () => {
    const h = clampPitch(new THREE.Vector3(0, 0.2, 1));
    expect(h.length()).toBeCloseTo(1, 6);
    expect(h.y).toBeCloseTo(0.2 / Math.hypot(0.2, 1), 6);
  });

  it('caps a near-vertical heading short of the pole and stays unit', () => {
    const h = clampPitch(new THREE.Vector3(0, 20, 0.001));
    expect(h.y).toBeCloseTo(MAX_PITCH_Y, 6);
    expect(h.length()).toBeCloseTo(1, 6);
  });
});

describe('steerHeading', () => {
  it('yaws toward screen-right for a rightward push, and the reverse for the opposite', () => {
    // Facing +Z with the chase camera behind (world up +Y), three.js screen-right is world
    // −X — cross(forward, up) = (0,0,1)×(0,1,0) = (−1,0,0) — so a rightward stick turning the
    // ship right on screen means the nose swings toward −X. The two pushes must be mirror
    // images; the exact world sign is only meaningful paired with that camera.
    const right = steerHeading(new THREE.Vector3(0, 0, 1), 1, 0, 0.1, T);
    expect(right.x).toBeLessThan(0);
    expect(right.length()).toBeCloseTo(1, 6);
    const left = steerHeading(new THREE.Vector3(0, 0, 1), -1, 0, 0.1, T);
    expect(left.x).toBeCloseTo(-right.x, 6);
  });

  it('pitches up for an upward push and never breaches the pole cap', () => {
    let h = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < 200; i++) h = steerHeading(h, 0, 1, 0.05, T);
    expect(h.y).toBeLessThanOrEqual(MAX_PITCH_Y + 1e-6);
    expect(h.length()).toBeCloseTo(1, 6);
  });
});

describe('bankTarget', () => {
  it('banks into the turn and levels at centre', () => {
    expect(bankTarget(1, T)).toBeCloseTo(-T.maxBank, 6);
    expect(bankTarget(-1, T)).toBeCloseTo(T.maxBank, 6);
    expect(bankTarget(0, T)).toBe(0);
  });
});

describe('easeScalar', () => {
  it('moves toward the target and never overshoots on a long frame', () => {
    expect(easeScalar(0, 10, 4, 0.05)).toBeGreaterThan(0);
    expect(easeScalar(0, 10, 4, 100)).toBe(10); // rate*dt clamps to 1
  });
});

describe('advanceSpeed', () => {
  it('climbs to cruise while thrusting and stops there', () => {
    let s = 0;
    for (let i = 0; i < 100; i++) s = advanceSpeed(s, true, 0.05, T);
    expect(s).toBe(T.cruiseSpeed);
  });

  it('brakes to a dead stop on release', () => {
    let s = T.cruiseSpeed;
    for (let i = 0; i < 100; i++) s = advanceSpeed(s, false, 0.05, T);
    expect(s).toBe(0);
  });
});

describe('approachSpeedCap', () => {
  it('is cruise far away and zero at the hover shell', () => {
    const earth = body('earth', 0, 0, 0, 1);
    expect(approachSpeedCap(new THREE.Vector3(0, 0, 20), [earth], T)).toBe(T.cruiseSpeed);
    // Inside the inner hover factor, fully capped to a hover.
    expect(approachSpeedCap(new THREE.Vector3(0, 0, T.hoverInnerFactor * 0.9), [earth], T)).toBe(0);
  });

  it('takes the tightest cap when two bodies are near', () => {
    const a = body('a', 0, 0, 0, 1);
    const b = body('b', 0, 0, 5, 1);
    const near = new THREE.Vector3(0, 0, T.hoverInnerFactor); // hovering at a
    expect(approachSpeedCap(near, [a, b], T)).toBe(0);
  });
});

describe('keepClear', () => {
  it('pushes a buried ship back onto the clear shell', () => {
    const earth = body('earth', 0, 0, 0, 1);
    const p = new THREE.Vector3(0, 0, 0.2);
    const moved = keepClear(p, [earth], T, new THREE.Vector3(0, 0, 1));
    expect(moved).toBe(true);
    expect(p.length()).toBeCloseTo(T.clearFactor, 5);
  });

  it('uses the fallback direction when exactly at a centre', () => {
    const earth = body('earth', 0, 0, 0, 1);
    const p = new THREE.Vector3(0, 0, 0);
    keepClear(p, [earth], T, new THREE.Vector3(0, 0, 1));
    expect(p.z).toBeCloseTo(T.clearFactor, 5);
  });

  it('leaves a ship in open space alone', () => {
    const earth = body('earth', 0, 0, 0, 1);
    const p = new THREE.Vector3(0, 0, 8);
    expect(keepClear(p, [earth], T, new THREE.Vector3(0, 0, 1))).toBe(false);
    expect(p.z).toBe(8);
  });
});

describe('nearestBody', () => {
  it('finds the closest and flags it explorable inside range', () => {
    const a = body('a', 0, 0, 0, 1);
    const b = body('b', 0, 0, 10, 1);
    const near = nearestBody(new THREE.Vector3(0, 0, 2), [a, b], T);
    expect(near?.body.id).toBe('a');
    expect(near?.explorable).toBe(true);
  });

  it('reports far bodies as not explorable', () => {
    const a = body('a', 0, 0, 0, 1);
    const near = nearestBody(new THREE.Vector3(0, 0, 8), [a], T);
    expect(near?.explorable).toBe(false);
  });
});

describe('createFreeFlight', () => {
  const startAt = () => ({
    position: new THREE.Vector3(0, 0, 4),
    heading: new THREE.Vector3(0, 0, 1),
  });

  it('does nothing until a finger is down, then moves forward', () => {
    const f = createFreeFlight(startAt());
    f.update(0.05, { pointer: null }, []);
    expect(f.state.speed).toBe(0);
    for (let i = 0; i < 40; i++) f.update(0.05, { pointer: { x: 0, y: 0 } }, []);
    expect(f.state.speed).toBeGreaterThan(0);
    expect(f.state.position.z).toBeGreaterThan(4);
  });

  it('brakes to a hover after the finger lifts', () => {
    const f = createFreeFlight(startAt());
    for (let i = 0; i < 40; i++) f.update(0.05, { pointer: { x: 0, y: 0 } }, []);
    for (let i = 0; i < 100; i++) f.update(0.05, { pointer: null }, []);
    expect(f.state.speed).toBe(0);
  });

  it('coasts to a hover beside a world flown straight at, and offers Explore', () => {
    const earth = body('earth', 0, 0, 0, 1);
    // Start out on +Z, nose pointed at Earth (−Z), and hold thrust.
    const f = createFreeFlight({
      position: new THREE.Vector3(0, 0, 8),
      heading: new THREE.Vector3(0, 0, -1),
    });
    for (let i = 0; i < 400; i++) f.update(0.05, { pointer: { x: 0, y: 0 } }, [earth]);
    // Never inside the clear shell, and ends explorable.
    expect(f.state.position.length()).toBeGreaterThanOrEqual(T.clearFactor - 1e-3);
    expect(f.state.explorable).toBe('earth');
  });

  it('flies to an autopilot target and hands control back on a press', () => {
    const mars = body('mars', 0, 0, -6, 0.53);
    const f = createFreeFlight(startAt());
    f.engageAutopilot('mars');
    for (let i = 0; i < 600; i++) f.update(0.05, { pointer: null }, [mars]);
    expect(f.state.autopilot).toBeNull(); // arrived
    expect(f.state.explorable).toBe('mars');

    // Re-engage, then a finger-press cancels it immediately.
    f.engageAutopilot('mars');
    f.update(0.05, { pointer: { x: 0.5, y: 0 } }, [mars]);
    expect(f.state.autopilot).toBeNull();
  });
});
