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
import { DAY_INTRO_TURN_DURATION, DAY_SWING_DURATION, DAY_TURN_DURATION, createDayTurn } from './DayTurn';
import { SUN_DIRECTION } from '../config';
import type { OrbitInput } from '../controls/OrbitInput';
import type { CelestialBody } from './Bodies';
import { createTeachingSun } from './TeachingSun';

const FULL_TURN = Math.PI * 2;

/** A body at the origin that only records how far it was asked to turn. */
function stubBody() {
  let turned = 0;
  const body = {
    id: 'earth',
    radius: 1,
    surface: new THREE.Object3D(),
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
function runToFinish(dt: number, duration?: number) {
  const onFinish = vi.fn();
  const camera = stubCamera();
  const controls = stubControls();
  const turn = createDayTurn({ camera, controls, onFinish });
  const { body, turnedBy } = stubBody();
  turn.start(body, duration);

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
      const { turnedBy } = runToFinish(dt);
      expect(turnedBy()).toBeCloseTo(FULL_TURN, 10);
    }
  });

  it('never overshoots, even when a frame is longer than the whole turn', () => {
    const { turnedBy, active } = runToFinish(DAY_TURN_DURATION * 2);
    expect(turnedBy()).toBeCloseTo(FULL_TURN, 10);
    expect(active).toBe(false);
  });

  it('takes about as long as it says it will, swing included', () => {
    const dt = 1 / 60;
    const total = DAY_SWING_DURATION + DAY_TURN_DURATION;
    const { frames } = runToFinish(dt);
    expect(frames * dt).toBeGreaterThan(total * 0.95);
    expect(frames * dt).toBeLessThan(total * 1.05);
  });

  /*
   * The reason the swing exists at all. The flight arrives near the sub-solar point so the
   * destination reads as a bright full disc, which puts the day/night line on the limb —
   * turn the body from there and a child watches continents slide past a planet whose
   * lighting never changes. Near side-on, sunrise and sunset are both on screen. The
   * teaching composition can lean toward daylight without hiding the night hemisphere.
   */
  it('keeps substantial day and night visible together', () => {
    const { camera } = runToFinish(1 / 60);
    const view = camera.position.clone().normalize();
    expect(Math.abs(view.dot(SUN_DIRECTION))).toBeLessThan(0.35);
  });

  /*
   * And level with the equator, which is the half that is easy to miss. Square to the Sun
   * alone leaves the camera high, because the Sun is high — and from up there the day/night
   * line lies across the disc while the surface moves east-west along it. Everything
   * slides past the boundary and nothing crosses it, which is a sunrise that never happens.
   */
  it('stays near the equator, so places cross the terminator', () => {
    const { camera } = runToFinish(1 / 60);
    const view = camera.position.clone().normalize();
    expect(Math.abs(view.y)).toBeLessThan(0.2);
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
        onFinish: vi.fn(),
      });
      turn.start(stubBody().body);
      while (turn.active) turn.update(1 / 60);
      expect(camera.position.clone().normalize().dot(level) * sign).toBeGreaterThan(0.9);
    }
  });

  it('pulls back around the body without dipping through its surface', () => {
    const camera = stubCamera();
    const controls = stubControls();
    const started = camera.position.length();
    const turn = createDayTurn({ camera, controls, onFinish: vi.fn() });
    const { body } = stubBody();
    turn.start(body);
    // Part-way through the swing: a straight line between two points on a sphere dips
    // through the middle, which here would be through the planet.
    for (let i = 0; i < 140; i++) {
      turn.update(1 / 60);
      expect(camera.position.length()).toBeGreaterThanOrEqual(started);
    }
  });

  it('borrows the camera and gives it back', () => {
    const camera = stubCamera();
    const controls = stubControls();
    const turn = createDayTurn({ camera, controls, onFinish: vi.fn() });
    const { body } = stubBody();

    turn.start(body);
    expect(controls.enabled).toBe(false);
    while (turn.active) turn.update(1 / 60);
    expect(controls.enabled).toBe(true);
    // Without this the controller would snap the camera back to its own stale angles.
    expect(controls.syncFromCamera).toHaveBeenCalled();
  });

  it('reports finishing exactly once', () => {
    const { onFinish } = runToFinish(1 / 60);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('cuts only the camera sweep for reduced motion, keeping the full nine-second day', () => {
    const camera = stubCamera();
    const { body, turnedBy } = stubBody();
    const turn = createDayTurn({ camera, controls: stubControls(), reducedMotion: true, onFinish: vi.fn() });
    const before = camera.position.clone();
    turn.start(body);
    expect(camera.position.distanceTo(before)).toBeGreaterThan(1);
    expect(turnedBy()).toBe(0);
    turn.update(4.5);
    expect(turnedBy()).toBeCloseTo(Math.PI, 10);
    expect(turn.active).toBe(true);
    turn.update(4.5);
    expect(turnedBy()).toBeCloseTo(FULL_TURN, 10);
    expect(turn.active).toBe(false);
  });

  it.each(['finish', 'skip', 'reset'] as const)('cleans up the Sun on %s and supports a second turn', (end) => {
    const texture = new THREE.Texture();
    const sun = createTeachingSun(texture, texture);
    const onFinish = vi.fn();
    const { body, turnedBy } = stubBody();
    const turn = createDayTurn({ camera: stubCamera(), controls: stubControls(),
      teachingSun: sun, reducedMotion: true, onFinish });
    turn.start(body);
    expect(sun.group.visible).toBe(true);
    expect(sun.group.position.clone().normalize().dot(SUN_DIRECTION)).toBeCloseTo(1, 10);
    turn.update(1);
    if (end === 'finish') turn.update(9);
    else turn[end]();
    expect(sun.group.visible).toBe(false);
    expect(onFinish).toHaveBeenCalledTimes(end === 'reset' ? 0 : 1);
    if (end !== 'reset') expect(turnedBy()).toBeCloseTo(FULL_TURN, 10);
    turn.start(body);
    expect(sun.group.visible).toBe(true);
    turn.reset();
    sun.dispose();
    texture.dispose();
  });

  it('reframes a moving tilted world on resize and restores the camera up direction', () => {
    const { body } = stubBody();
    const parent = new THREE.Group();
    parent.rotation.z = 0.41;
    parent.add(body.surface);
    const center = new THREE.Vector3(3, 2, 1);
    body.getWorldPosition = target => target.copy(center);
    const camera = stubCamera();
    camera.position.add(center);
    camera.lookAt(center);
    const sun = createTeachingSun(new THREE.Texture(), new THREE.Texture());
    const turn = createDayTurn({ camera, controls: stubControls(), teachingSun: sun,
      reducedMotion: true, onFinish: vi.fn() });
    turn.start(body);
    const before = camera.position.clone();
    center.x += 1;
    turn.update(0.01);
    expect(camera.position.x - before.x).toBeCloseTo(1, 10);
    camera.aspect = 390 / 844;
    camera.fov = 68;
    camera.updateProjectionMatrix();
    turn.update(0.01);
    camera.updateMatrixWorld(true);
    expect(sun.group.position.clone().sub(center).normalize().dot(SUN_DIRECTION)).toBeCloseTo(1, 10);
    expect(Math.abs(sun.group.position.clone().project(camera).y)).toBeLessThan(0.75);
    expect(camera.up.distanceTo(new THREE.Vector3(0, 1, 0))).toBeGreaterThan(0.1);
    turn.reset();
    expect(camera.up.toArray()).toEqual([0, 1, 0]);
    sun.dispose();
  });

  it('ignores a second press while one is already running', () => {
    const onFinish = vi.fn();
    const turn = createDayTurn({
      camera: stubCamera(),
      controls: stubControls(),
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
      onFinish: vi.fn(),
    });
    expect(turn.active).toBe(false);
    turn.update(1);
    expect(turn.active).toBe(false);
  });

  /*
   * What the turn reports, which is what the sunrise sound is driven by. It has to be the
   * turn's own progress rather than a clock: the step is clamped against what is left, so
   * a struggling tablet stretches the turn out, and anything scheduled against wall-clock
   * time would finish while the light was still moving.
   */
  it('reports its progress from a silent swing through to exactly one', () => {
    const reported: number[] = [];
    const turn = createDayTurn({
      camera: stubCamera(),
      controls: stubControls(),
      onProgress: (progress) => reported.push(progress),
      onFinish: vi.fn(),
    });
    turn.start(stubBody().body);
    while (turn.active) turn.update(1 / 60);

    // The swing moves the camera and turns nothing, and says so.
    expect(reported[0]).toBe(0);
    expect(reported.filter((progress) => progress === 0).length).toBeGreaterThan(100);
    // Landing on exactly 1 is what lets a sound end rather than be faded out of.
    expect(reported.at(-1)).toBe(1);
    for (let i = 1; i < reported.length; i++) {
      expect(reported[i]).toBeGreaterThanOrEqual(reported[i - 1] as number);
    }
  });

  it('reports one on the last frame however the frames land', () => {
    for (const dt of [1 / 60, 1 / 15, 0.05, DAY_TURN_DURATION * 2]) {
      const reported: number[] = [];
      const turn = createDayTurn({
        camera: stubCamera(),
        controls: stubControls(),
          onProgress: (progress) => reported.push(progress),
        onFinish: vi.fn(),
      });
      turn.start(stubBody().body);
      while (turn.active) turn.update(dt);
      expect(reported.at(-1)).toBe(1);
    }
  });

  it('says nothing more once it has been reset', () => {
    // Fly Home part-way through. Whatever is listening is stopped by its own reset, from
    // the same caller; this only has to stop talking.
    const reported: number[] = [];
    const turn = createDayTurn({
      camera: stubCamera(),
      controls: stubControls(),
      onProgress: (progress) => reported.push(progress),
      onFinish: vi.fn(),
    });
    turn.start(stubBody().body);
    for (let i = 0; i < 4; i++) turn.update(1);
    const said = reported.length;
    turn.reset();
    turn.update(1);
    expect(reported).toHaveLength(said);
    expect(reported.at(-1)).toBeLessThan(1);
  });

  it('stops on reset without reporting a finish', () => {
    // Flying home mid-turn. The surface keeps whatever rotation it reached, which is fine
    // — the mission is torn down with it and rebuilt from the camera next time.
    const onFinish = vi.fn();
    const controls = stubControls();
    const turn = createDayTurn({
      camera: stubCamera(),
      controls,
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

describe('a shorter introduction turn', () => {
  it('is still exactly one turn, and finishes sooner', () => {
    const dt = 1 / 60;
    const lesson = runToFinish(dt);
    const intro = runToFinish(dt, DAY_INTRO_TURN_DURATION);
    expect(intro.turnedBy()).toBeCloseTo(FULL_TURN, 10);
    expect(intro.onFinish).toHaveBeenCalledTimes(1);
    expect(intro.frames).toBeLessThan(lesson.frames);
    expect(intro.frames * dt).toBeCloseTo(DAY_SWING_DURATION + DAY_INTRO_TURN_DURATION, 0);
    expect(DAY_INTRO_TURN_DURATION).toBeLessThan(DAY_TURN_DURATION);
  });
});
