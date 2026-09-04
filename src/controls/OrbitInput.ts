/**
 * Camera orbit controls: drag to rotate, pinch or wheel to zoom.
 *
 * Deliberately not OrbitControls. The flight sequence needs to take the camera over
 * completely and hand it back without a snap, which means the controller must be able to
 * re-derive its own state from wherever the camera ended up (`syncFromCamera`).
 */

import * as THREE from 'three';
import { MAX_ORBIT_DISTANCE, MIN_ORBIT_DISTANCE } from '../config';

const TAP_MOVE_TOLERANCE = 12; // css px
const TAP_DURATION = 400; // ms

/**
 * A full drag across the short edge turns a little under 130 degrees.
 *
 * This used to be PI, but the drag delta was also accumulated as a velocity and then
 * applied again every frame. On a high-refresh phone that could turn several times for one
 * finger movement. The direct mapping below is deliberately calm while still putting the
 * hidden discovery (bounded to about 130 degrees) within one committed swipe.
 */
export const TOUCH_TURN_PER_SHORT_EDGE = Math.PI * 0.72;
const MAX_FLING_SPEED = 2.4; // radians / second
const FLING_SAMPLE_BLEND = 0.45;
const FLING_STALE_MS = 80;

/** The exact angle represented by a screen-space drag. Additive, so sampling rate cannot change it. */
export function dragAngle(deltaPixels: number, shortEdge: number): number {
  if (!Number.isFinite(deltaPixels) || !Number.isFinite(shortEdge) || shortEdge <= 0) return 0;
  return (deltaPixels * TOUCH_TURN_PER_SHORT_EDGE) / shortEdge;
}

export interface InertiaStep {
  angle: number;
  velocity: number;
}

/**
 * Integrates exponential angular damping exactly over `dt`.
 *
 * Using `velocity * dt` and then decaying is subtly frame-rate dependent. The analytic
 * integral costs almost nothing and makes the same release glide match at 30, 60 and 120fps.
 */
export function stepInertia(
  velocity: number,
  dt: number,
  frameRetention: number,
): InertiaStep {
  if (velocity === 0 || dt <= 0 || frameRetention <= 0) return { angle: 0, velocity: 0 };
  if (frameRetention >= 1) return { angle: velocity * dt, velocity };
  const rate = -60 * Math.log(frameRetention);
  const retained = Math.exp(-rate * dt);
  return {
    angle: (velocity * (1 - retained)) / rate,
    velocity: velocity * retained,
  };
}

export interface OrbitInput {
  enabled: boolean;
  /** Point the camera orbits and looks at. Eased, so retargeting glides. */
  setTarget(position: THREE.Vector3, immediate?: boolean): void;
  /** Distance clamp floor, so you cannot fly inside whatever you are looking at. */
  setFocusRadius(radius: number): void;
  /** Choose a distance that fits a sphere of `radius` in the current viewport. */
  frame(radius: number, immediate?: boolean): void;
  /** Re-derive orbit angles from the camera's actual transform. Call after a cutscene. */
  syncFromCamera(): void;
  /**
   * Back to the opening angles and distance, with no leftover glide. The caller still
   * owns the target and the framing radius, exactly as it does at startup.
   */
  reset(): void;
  update(dt: number): void;
  dispose(): void;
}

export interface OrbitInputOptions {
  camera: THREE.PerspectiveCamera;
  element: HTMLElement;
  onTap(clientX: number, clientY: number): void;
  reducedMotion: boolean;
}

interface PointerState {
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTime: number;
  lastMoveTime: number;
  moved: number;
}

export function createOrbitInput(options: OrbitInputOptions): OrbitInput {
  const { camera, element, onTap, reducedMotion } = options;

  const target = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  const spherical = new THREE.Spherical(9, Math.PI / 2.35, 0.9);
  // Kept so reset() can restore the opening framing without the numbers living twice.
  const openingSpherical = spherical.clone();
  let desiredRadius = spherical.radius;

  // Angular velocity, decayed each frame for a little glide after a flick.
  let velocityTheta = 0;
  let velocityPhi = 0;

  let focusRadius = 1;
  const damping = reducedMotion ? 1 : 0.12;
  const inertia = reducedMotion ? 0 : 0.86;

  const pointers = new Map<number, PointerState>();
  let pinchDistance = 0;
  let api: OrbitInput;

  const PHI_MIN = 0.16;
  const PHI_MAX = Math.PI - 0.16;

  function minDistance(): number {
    return Math.max(MIN_ORBIT_DISTANCE, focusRadius * 2.1);
  }

  function clampRadius(value: number): number {
    return THREE.MathUtils.clamp(value, minDistance(), MAX_ORBIT_DISTANCE);
  }

  /* --- pointer handling ---------------------------------------------------- */

  function onPointerDown(event: PointerEvent) {
    // Register first: capture is an optimisation (it keeps a drag alive past the canvas
    // edge) and it throws for pointers the browser no longer considers active. Losing
    // capture is survivable; losing the pointer entirely would kill the controls.
    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      lastMoveTime: event.timeStamp,
      moved: 0,
    });
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Fine - pointermove/up still arrive, they just stop at the element bounds.
    }
    // A finger touching the globe catches the old glide immediately. Its first movement
    // must not be averaged with velocity left over from the previous swipe.
    velocityTheta = 0;
    velocityPhi = 0;
    if (pointers.size === 2) {
      pinchDistance = currentPinchDistance();
    }
  }

  function currentPinchDistance(): number {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onPointerMove(event: PointerEvent) {
    const state = pointers.get(event.pointerId);
    if (!state) return;

    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    const elapsed = Math.max(8, event.timeStamp - state.lastMoveTime) / 1000;
    state.x = event.clientX;
    state.y = event.clientY;
    state.lastMoveTime = event.timeStamp;
    state.moved += Math.hypot(dx, dy);

    if (!api.enabled) return;

    if (pointers.size === 1) {
      /*
       * Move by the finger delta exactly once. Previously these deltas were added to an
       * angular value that `update()` then applied every frame, so a drag was integrated a
       * second time and a 120Hz phone spun much farther than a 60Hz tablet.
       *
       * Velocity is only the short release glide. It is measured in radians per second,
       * smoothed across pointer samples and capped so a noisy final event cannot launch the
       * child past the place they were trying to reveal.
       */
      const shortEdge = Math.min(element.clientWidth, element.clientHeight);
      const thetaDelta = -dragAngle(dx, shortEdge);
      const phiDelta = -dragAngle(dy, shortEdge);
      spherical.theta += thetaDelta;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + phiDelta, PHI_MIN, PHI_MAX);
      if (!reducedMotion) {
        velocityTheta = THREE.MathUtils.clamp(
          THREE.MathUtils.lerp(velocityTheta, thetaDelta / elapsed, FLING_SAMPLE_BLEND),
          -MAX_FLING_SPEED,
          MAX_FLING_SPEED,
        );
        velocityPhi = THREE.MathUtils.clamp(
          THREE.MathUtils.lerp(velocityPhi, phiDelta / elapsed, FLING_SAMPLE_BLEND),
          -MAX_FLING_SPEED,
          MAX_FLING_SPEED,
        );
      }
    } else if (pointers.size === 2) {
      const distance = currentPinchDistance();
      if (pinchDistance > 0 && distance > 0) {
        desiredRadius = clampRadius(desiredRadius * (pinchDistance / distance));
      }
      pinchDistance = distance;
    }
  }

  function endPointer(event: PointerEvent) {
    const state = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    try {
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Already released by the browser.
    }
    pinchDistance = pointers.size === 2 ? currentPinchDistance() : 0;

    if (!state || !api.enabled) return;
    if (event.timeStamp - state.lastMoveTime > FLING_STALE_MS) {
      velocityTheta = 0;
      velocityPhi = 0;
    }
    const isTap =
      state.moved < TAP_MOVE_TOLERANCE && event.timeStamp - state.startTime < TAP_DURATION;
    // Only a clean single-finger tap counts; the second finger of a pinch must not select.
    if (isTap && pointers.size === 0) onTap(state.startX, state.startY);
  }

  function onWheel(event: WheelEvent) {
    if (!api.enabled) return;
    event.preventDefault();
    // Line-mode wheels report small deltas; normalise so trackpads and mice feel alike.
    const step = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    desiredRadius = clampRadius(desiredRadius * Math.exp(step * 0.0012));
  }

  function onContextMenu(event: Event) {
    event.preventDefault();
  }

  /** Safari answers pinch with page zoom unless this is swallowed. */
  function onGesture(event: Event) {
    event.preventDefault();
  }

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', endPointer);
  element.addEventListener('pointercancel', endPointer);
  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('gesturestart', onGesture, { passive: false });
  document.addEventListener('gesturechange', onGesture, { passive: false });

  /* --- api ----------------------------------------------------------------- */

  api = {
    enabled: true,

    setTarget(position: THREE.Vector3, immediate = false) {
      desiredTarget.copy(position);
      if (immediate) target.copy(position);
    },

    setFocusRadius(radius: number) {
      focusRadius = radius;
      desiredRadius = clampRadius(desiredRadius);
    },

    frame(radius: number, immediate = false) {
      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const half = Math.min(vFov, hFov) / 2;
      desiredRadius = clampRadius(radius / Math.sin(half));
      if (immediate) spherical.radius = desiredRadius;
    },

    syncFromCamera() {
      target.copy(desiredTarget);
      const offset = camera.position.clone().sub(target);
      spherical.setFromVector3(offset);
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, PHI_MIN, PHI_MAX);
      spherical.radius = clampRadius(spherical.radius);
      desiredRadius = spherical.radius;
      velocityTheta = 0;
      velocityPhi = 0;
    },

    reset() {
      spherical.copy(openingSpherical);
      desiredRadius = spherical.radius;
      focusRadius = 1;
      velocityTheta = 0;
      velocityPhi = 0;
      pointers.clear();
      pinchDistance = 0;
      api.enabled = true;
    },

    update(dt: number) {
      if (!api.enabled) return;

      // A drag has already moved the angles directly. Only a released finger gets glide.
      if (pointers.size === 0) {
        const thetaStep = stepInertia(velocityTheta, dt, inertia);
        const phiStep = stepInertia(velocityPhi, dt, inertia);
        spherical.theta += thetaStep.angle;
        spherical.phi = THREE.MathUtils.clamp(
          spherical.phi + phiStep.angle,
          PHI_MIN,
          PHI_MAX,
        );
        velocityTheta = thetaStep.velocity;
        velocityPhi = phiStep.velocity;
      }

      const ease = damping >= 1 ? 1 : 1 - Math.pow(1 - damping, dt * 60);
      spherical.radius += (desiredRadius - spherical.radius) * ease;
      target.lerp(desiredTarget, ease);

      camera.position.setFromSpherical(spherical).add(target);
      camera.lookAt(target);
    },

    dispose() {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', endPointer);
      element.removeEventListener('pointercancel', endPointer);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('gesturestart', onGesture);
      document.removeEventListener('gesturechange', onGesture);
      pointers.clear();
    },
  };

  return api;
}
