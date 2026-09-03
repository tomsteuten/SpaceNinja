/**
 * One turn has to be exactly one turn.
 *
 * The markers a child is hunting are children of the surface this rotates, so anything
 * that is not exactly 2π leaves every one of them off its real coordinates — by a little,
 * silently, and cumulatively if the child presses the button twice. That is the whole
 * reason the step is clamped against what is left rather than against the clock, and it is
 * invisible by eye: a few thousandths of a radian looks like nothing and is still wrong.
 */

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  DAY_SWING_DURATION,
  DAY_SWING_DURATION_REDUCED,
  DAY_TURN_DURATION,
  DAY_TURN_DURATION_REDUCED,
  createDayTurn,
} from './DayTurn';
import { SUN_DIRECTION } from '../config';
import type { OrbitInput } from '../controls/OrbitInput';
import type { CelestialBody } from './Bodies';

const FULL_TURN = Math.PI * 2;

/** A body at the origin that only records how far it was asked to turn. */
function stubBody() {
  let turned = 0;
  const body = {
    id: 'earth',
    turnSurface: (delta: number) => {
      turned += delta;
    },
    getWorldPosition: (target: THREE.Vector3) => target.set(0, 0, 0),
  } as unknown as CelestialBody;
  return { body, turnedBy: () => turned };
}

function stubControls() {
  const controls = { enabled: true, syncFromCamera: vi.fn() } as unknown as OrbitInput;
  return controls;
}

/** A camera parked where the flight leaves it: near the Sun's own direction. */
function stubCamera() {
  const camera = new THREE.PerspectiveCamera(52, 4 / 3, 0.05, 800);
  camera.position.copy(SUN_DIRECTION).multiplyScalar(3.2);
  return camera;
}

/** Runs a turn to completion at a given frame time, returning how long it took. */
function runToFinish(reducedMotion: boolean, dt: number) {
  const onFinish = vi.fn();
  const camera = stubCamera();
  const controls = stubControls();
  const turn = createDayTurn({ camera, controls, reducedMotion, onFinish });
  const { body, turnedBy } = stubBody();
  turn.start(body);

  let frames = 0;
  while (turn.active && frames < 100000) {
    turn.update(dt);
    frames++;
  }
  return { turnedBy, onFinish, frames, active: turn.active, camera, controls };
}

describe('createDayTurn', () => {
  it('turns exactly once, whatever the frame time', () => {
    // 60fps, a struggling tablet, and the 0.05 ceiling Stage clamps dt to.
    for (const dt of [1 / 60, 1 / 15, 0.05, 0.0123]) {
      const { turnedBy } = runToFinish(false, dt);
      expect(turnedBy()).toBeCloseTo(FULL_TURN, 10);
    }
  });

  it('never overshoots, even when a frame is longer than the whole turn', () => {
    const { turnedBy, active } = runToFinish(false, DAY_TURN_DURATION * 2);
    expect(turnedBy()).toBeCloseTo(FULL_TURN, 10);
    expect(active).toBe(false);
  });

  it('takes about as long as it says it will, swing included', () => {
    const dt = 1 / 60;
    const total = DAY_SWING_DURATION + DAY_TURN_DURATION;
    const { frames } = runToFinish(false, dt);
    expect(frames * dt).toBeGreaterThan(total * 0.95);
    expect(frames * dt).toBeLessThan(total * 1.05);
  });

  /*
   * The reason the swing exists at all. The flight arrives near the sub-solar point so the
   * destination reads as a bright full disc, which puts the day/night line on the limb —
   * turn the body from there and a child watches continents slide past a planet whose
   * lighting never changes. Square to the Sun, the line runs down the middle of the disc
   * and sunrise and sunset are both on screen.
   */
  it('ends up looking at the destination side-on to the Sun', () => {
    const { camera } = runToFinish(false, 1 / 60);
    const view = camera.position.clone().normalize();
    expect(Math.abs(view.dot(SUN_DIRECTION))).toBeLessThan(0.02);
  });

  /*
   * And level with the equator, which is the half that is easy to miss. Square to the Sun
   * alone leaves the camera high, because the Sun is high — and from up there the day/night
   * line lies across the disc while the surface moves east-west along it. Everything
   * slides past the boundary and nothing crosses it, which is a sunrise that never happens.
   */
  it('ends up level with the equator, so the line stands upright', () => {
    const { camera } = runToFinish(false, 1 / 60);
    const view = camera.position.clone().normalize();
    expect(Math.abs(view.y)).toBeLessThan(0.02);
  });

  it('swings the short way round', () => {
    // Two directions are square to the Sun and level with the equator, one on each side.
    // A child who watched the planet swing most of the way around it has lost track of
    // which side they were looking at, so it has to pick the near one.
    const level = new THREE.Vector3().crossVectors(SUN_DIRECTION, new THREE.Vector3(0, 1, 0));
    level.normalize();

    for (const sign of [1, -1]) {
      const camera = stubCamera();
      // Leaning towards one of the two answers, which is the case the arrival really is
      // in — the test camera sitting exactly on the Sun axis is equidistant from both and
      // cannot tell them apart.
      camera.position.addScaledVector(level, sign * 1.5);
      const turn = createDayTurn({
        camera,
        controls: stubControls(),
        reducedMotion: false,
        onFinish: vi.fn(),
      });
      turn.start(stubBody().body);
      while (turn.active) turn.update(1 / 60);
      expect(camera.position.clone().normalize().dot(level)).toBeCloseTo(sign, 5);
    }
  });

  it('keeps the camera the same distance out as it swings', () => {
    const camera = stubCamera();
    const controls = stubControls();
    const started = camera.position.length();
    const turn = createDayTurn({ camera, controls, reducedMotion: false, onFinish: vi.fn() });
    const { body } = stubBody();
    turn.start(body);
    // Part-way through the swing: a straight line between two points on a sphere dips
    // through the middle, which here would be through the planet.
    for (let i = 0; i < 30; i++) turn.update(1 / 60);
    expect(camera.position.length()).toBeCloseTo(started, 6);
  });

  it('borrows the camera and gives it back', () => {
    const camera = stubCamera();
    const controls = stubControls();
    const turn = createDayTurn({ camera, controls, reducedMotion: false, onFinish: vi.fn() });
    const { body } = stubBody();

    turn.start(body);
    expect(controls.enabled).toBe(false);
    while (turn.active) turn.update(1 / 60);
    expect(controls.enabled).toBe(true);
    // Without this the controller would snap the camera back to its own stale angles.
    expect(controls.syncFromCamera).toHaveBeenCalled();
  });

  it('still turns the whole way round under reduced motion, only faster', () => {
    const dt = 1 / 60;
    const reduced = DAY_SWING_DURATION_REDUCED + DAY_TURN_DURATION_REDUCED;
    const { turnedBy, frames } = runToFinish(true, dt);
    // Skipping it would show nothing: the change *is* the content.
    expect(turnedBy()).toBeCloseTo(FULL_TURN, 10);
    expect(frames * dt).toBeLessThan(reduced * 1.05);
    expect(reduced).toBeLessThan(DAY_SWING_DURATION + DAY_TURN_DURATION);
  });

  it('reports finishing exactly once', () => {
    const { onFinish } = runToFinish(false, 1 / 60);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('ignores a second press while one is already running', () => {
    const onFinish = vi.fn();
    const turn = createDayTurn({
      camera: stubCamera(),
      controls: stubControls(),
      reducedMotion: false,
      onFinish,
    });
    const first = stubBody();
    const second = stubBody();

    turn.start(first.body);
    // Past the swing, so the body is actually turning by now.
    for (let i = 0; i < 4; i++) turn.update(1);
    turn.start(second.body); // the button is greyed out, but nothing should rely on that
    turn.update(1);

    expect(second.turnedBy()).toBe(0);
    expect(first.turnedBy()).toBeGreaterThan(0);
  });

  it('does nothing at all until started', () => {
    const turn = createDayTurn({
      camera: stubCamera(),
      controls: stubControls(),
      reducedMotion: false,
      onFinish: vi.fn(),
    });
    expect(turn.active).toBe(false);
    turn.update(1);
    expect(turn.active).toBe(false);
  });

  it('stops on reset without reporting a finish', () => {
    // Flying home mid-turn. The surface keeps whatever rotation it reached, which is fine
    // — the mission is torn down with it and rebuilt from the camera next time.
    const onFinish = vi.fn();
    const controls = stubControls();
    const turn = createDayTurn({
      camera: stubCamera(),
      controls,
      reducedMotion: false,
      onFinish,
    });
    const { body, turnedBy } = stubBody();
    turn.start(body);
    for (let i = 0; i < 4; i++) turn.update(1);
    turn.reset();
    turn.update(1);

    expect(turn.active).toBe(false);
    expect(onFinish).not.toHaveBeenCalled();
    expect(turnedBy()).toBeLessThan(FULL_TURN);
    // Flying home mid-turn must not leave the camera stuck in the cutscene.
    expect(controls.enabled).toBe(true);
  });
});
