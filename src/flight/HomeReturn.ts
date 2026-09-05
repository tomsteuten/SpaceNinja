/**
 * The animated way back to the map — the reverse of a flight, but camera-only.
 *
 * "Fly Home" used to be an instant cut: restart() reframed the camera in a single frame,
 * which from a close destination view is a jarring jump (reported as "a sudden jerk"). This
 * eases the camera out to the opening composition first, and only then lets restart() do its
 * teardown, so the return reads as a pull-back rather than a snap. Like the flight, it owns
 * the camera while it runs and hands it back to a state that already matches where it left
 * the camera — restart() reframes to exactly the pose this lands on, so the swap is invisible.
 *
 * Reduced motion gets a cut, not a slow sweep: start() returns false and the caller resets
 * immediately. Same reasoning as FLIGHT_DURATION in config.ts — a slow version of a sweeping
 * camera move is more motion, not less.
 */

import * as THREE from 'three';
import type { OrbitInput } from '../controls/OrbitInput';
import { smootherstep } from './FlightSequence';

/** About the low end of Codex's "roughly 1–1.5 seconds": long enough to read as a move. */
export const HOME_RETURN_DURATION = 1.2; // seconds

export interface HomePose {
  position: THREE.Vector3;
  look: THREE.Vector3;
}

export interface HomeReturnOptions {
  camera: THREE.PerspectiveCamera;
  controls: OrbitInput;
  reducedMotion: boolean;
  /** Where the camera should finish: the opening map composition. Read once, at start(). */
  restingPose(): HomePose;
  /** What the camera is looking at right now, so the look-point eases from it rather than jumping. */
  currentFocus(): THREE.Vector3;
  /** Fired once the pull-back has landed; the caller does the actual teardown (restart) here. */
  onArrive(): void;
}

export interface HomeReturn {
  /** True while the pull-back owns the camera. The frame loop suspends orbit control for it. */
  readonly active: boolean;
  /**
   * Begin the pull-back. No-op (returns false) if already running, and deliberately a no-op
   * under reduced motion, where the caller cuts straight home instead.
   */
  start(): boolean;
  reset(): void;
  update(dt: number): void;
}

export function createHomeReturn(options: HomeReturnOptions): HomeReturn {
  const { camera, controls, reducedMotion, restingPose, currentFocus, onArrive } = options;

  let active = false;
  let progress = 0;

  const startCamera = new THREE.Vector3();
  const startLook = new THREE.Vector3();
  const endCamera = new THREE.Vector3();
  const endLook = new THREE.Vector3();
  const look = new THREE.Vector3();

  return {
    get active() {
      return active;
    },

    start() {
      if (active) return false;
      if (reducedMotion) return false;
      const pose = restingPose();
      startCamera.copy(camera.position);
      startLook.copy(currentFocus());
      endCamera.copy(pose.position);
      endLook.copy(pose.look);
      // The flight takes the camera the same way; the controller re-derives its angles from
      // wherever the camera ends when restart() calls controls.reset(), so there is no snap.
      controls.enabled = false;
      progress = 0;
      active = true;
      return true;
    },

    reset() {
      active = false;
      progress = 0;
    },

    update(dt: number) {
      if (!active) return;
      progress = Math.min(1, progress + dt / HOME_RETURN_DURATION);
      const t = smootherstep(progress);
      camera.position.lerpVectors(startCamera, endCamera, t);
      look.lerpVectors(startLook, endLook, t);
      camera.lookAt(look);

      if (progress < 1) return;
      active = false;
      // Only now does the teardown run. restart() reframes the camera to exactly endCamera
      // and re-enables the controls, so nothing about the picture moves as it happens.
      onArrive();
    },
  };
}
