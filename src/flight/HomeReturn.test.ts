/**
 * The return used to be an instant cut — restart() reframed the camera in one frame, which
 * from a close destination view is the "sudden jerk" this replaces. These pin the two things
 * that make the animated version safe: it lands exactly on the pose it was given (so restart()
 * reframing to the same pose is invisible), and it declines under reduced motion (so the caller
 * cuts rather than playing a slow sweep — the same rule the flight follows).
 */

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createHomeReturn, HOME_RETURN_DURATION } from './HomeReturn';
import type { OrbitInput } from '../controls/OrbitInput';

function harness(reducedMotion = false) {
  const camera = new THREE.PerspectiveCamera(52, 4 / 3, 0.05, 800);
  // Where the camera sits "at a destination": close, off to the side.
  camera.position.set(0, 2, 8);
  const controls = { enabled: true } as unknown as OrbitInput;
  const end = { position: new THREE.Vector3(0, 6, 30), look: new THREE.Vector3(0, 0, 0) };
  const onArrive = vi.fn();
  const home = createHomeReturn({
    camera,
    controls,
    reducedMotion,
    // Fresh clones each call, like the real OrbitInput.restingPose.
    restingPose: () => ({ position: end.position.clone(), look: end.look.clone() }),
    currentFocus: () => new THREE.Vector3(1, 1, 1),
    onArrive,
  });
  return { camera, controls, home, end, onArrive };
}

/** Runs the whole pull-back and returns how many frames it took. */
function run(home: ReturnType<typeof harness>['home'], dt = 1 / 60) {
  home.start();
  let frames = 0;
  while (home.active && frames++ < 100000) home.update(dt);
  return frames;
}

describe('the animated return home', () => {
  it('does nothing until it is started', () => {
    const { home, camera, onArrive } = harness();
    const before = camera.position.clone();
    home.update(1 / 60);
    expect(home.active).toBe(false);
    expect(camera.position).toEqual(before);
    expect(onArrive).not.toHaveBeenCalled();
  });

  it('takes the camera over while it runs, like the flight does', () => {
    const { home, controls } = harness();
    expect(home.start()).toBe(true);
    expect(home.active).toBe(true);
    // Orbit control is suspended so the two are not both writing the camera on one frame.
    expect(controls.enabled).toBe(false);
  });

  it('lands exactly on the pose it was given, so restart() reframing is invisible', () => {
    const { home, camera, end, onArrive } = harness();
    run(home);
    expect(home.active).toBe(false);
    expect(camera.position.x).toBeCloseTo(end.position.x, 6);
    expect(camera.position.y).toBeCloseTo(end.position.y, 6);
    expect(camera.position.z).toBeCloseTo(end.position.z, 6);
    // The teardown fires once, at the end, not during the move.
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it('runs for about its stated duration', () => {
    const { home } = harness();
    const frames = run(home, 1 / 60);
    expect(frames).toBeCloseTo(HOME_RETURN_DURATION * 60, -1);
  });

  it('is a cut, not a slow sweep, under reduced motion', () => {
    const { home, camera, controls, onArrive } = harness(true);
    const before = camera.position.clone();
    // Declines, so the caller resets immediately instead.
    expect(home.start()).toBe(false);
    expect(home.active).toBe(false);
    expect(controls.enabled).toBe(true);
    expect(camera.position).toEqual(before);
    expect(onArrive).not.toHaveBeenCalled();
  });

  it('cannot be started twice over', () => {
    const { home } = harness();
    expect(home.start()).toBe(true);
    expect(home.start()).toBe(false);
  });
});
