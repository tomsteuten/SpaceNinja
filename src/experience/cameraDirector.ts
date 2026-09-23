import * as THREE from 'three';
import type { CelestialBody } from '../scene/Bodies';
import type { FreeFlightState } from '../flight/freeFlightModel';

/** Sole pose writer for the outing camera. Phase changes transfer ownership here. */
export function createCameraDirector(camera: THREE.PerspectiveCamera, reducedMotion: boolean) {
  const desired = new THREE.Vector3();
  const target = new THREE.Vector3();
  const center = new THREE.Vector3();
  const view = new THREE.Vector3();
  const trailingHeading = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let mode: 'flight' | 'explore' = 'flight';
  let first = true;

  return {
    setMode(next: 'flight' | 'explore') {
      mode = next;
      first = true;
    },
    update(dt: number, flight: FreeFlightState, moon: CelestialBody) {
      if (mode === 'flight') {
        if (first) trailingHeading.copy(flight.heading);
        else trailingHeading.lerp(flight.heading, Math.min(1, dt * 2.4)).normalize();
        desired.copy(flight.position).addScaledVector(trailingHeading, -1.5).addScaledVector(up, 0.5);
        target.copy(flight.position).addScaledVector(flight.heading, 1.65);
      } else {
        moon.getWorldPosition(center);
        // The visit looks from the lit hemisphere, at a low enough latitude that
        // Tycho (-43°) is in the readable middle of the Moon after mission alignment.
        view.set(0.1, -0.45, 0.89).normalize();
        desired.copy(center).addScaledVector(view, moon.radius * 4.8);
        target.copy(center);
      }
      const blend = first || reducedMotion ? 1 : 1 - Math.exp(-dt * (mode === 'flight' ? 6 : 4));
      camera.position.lerp(desired, blend);
      camera.up.copy(up);
      camera.lookAt(target);
      first = false;
    },
    /** Jump to the current owner's pose on the next update instead of easing there. */
    cut() {
      first = true;
    },
    get mode() { return mode; },
  };
}
