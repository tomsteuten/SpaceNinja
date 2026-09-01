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
  moved: number;
}

export function createOrbitInput(options: OrbitInputOptions): OrbitInput {
  const { camera, element, onTap, reducedMotion } = options;

  const target = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  const spherical = new THREE.Spherical(9, Math.PI / 2.35, 0.9);
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
      moved: 0,
    });
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Fine - pointermove/up still arrive, they just stop at the element bounds.
    }
    if (pointers.size === 2) pinchDistance = currentPinchDistance();
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
    state.x = event.clientX;
    state.y = event.clientY;
    state.moved += Math.hypot(dx, dy);

    if (!api.enabled) return;

    if (pointers.size === 1) {
      // Full drag across the shorter screen edge is roughly a half turn.
      const scale = Math.PI / Math.min(element.clientWidth, element.clientHeight);
      velocityTheta -= dx * scale;
      velocityPhi -= dy * scale;
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

    update(dt: number) {
      if (!api.enabled) return;

      spherical.theta += velocityTheta;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + velocityPhi, PHI_MIN, PHI_MAX);
      // Frame-rate independent decay, so a 30fps tablet glides like a 60fps phone.
      const decay = Math.pow(inertia, dt * 60);
      velocityTheta *= decay;
      velocityPhi *= decay;

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
