/**
 * A small, forgiving steering layer for the journey between worlds.
 *
 * This is deliberately not free flight. A five-year-old can drag anywhere on the scene
 * and see the ship answer immediately, while the authored route still guarantees they
 * reach the world they chose. Letting go springs gently back to the centre line.
 */

import * as THREE from 'three';

export interface PilotInput {
  readonly offset: THREE.Vector2;
  start(): void;
  stop(): void;
  reset(): void;
  update(dt: number): void;
  dispose(): void;
}

export interface PilotInputOptions {
  element: HTMLElement;
  /** The first deliberate drag in each flight, used to dismiss the wordless gesture cue. */
  onSteer?(): void;
}

const MAX_DRAG_FRACTION = 0.28;
const RESPONSE = 11;
const STEERING_INTENT = 0.08;

/** Exponential response is equivalent at 30, 60 or 120Hz for the same elapsed time. */
export function steeringResponse(dt: number): number {
  return 1 - Math.exp(-RESPONSE * Math.max(0, dt));
}

/** Converts one pointer's travel into a centred, circular steering input. */
export function steeringOffset(
  deltaX: number,
  deltaY: number,
  shortEdge: number,
  target = new THREE.Vector2(),
): THREE.Vector2 {
  if (!Number.isFinite(shortEdge) || shortEdge <= 0) return target.set(0, 0);
  const reach = Math.max(1, shortEdge * MAX_DRAG_FRACTION);
  target.set(deltaX / reach, -deltaY / reach);
  if (target.lengthSq() > 1) target.normalize();
  return target;
}

export function createPilotInput({ element, onSteer }: PilotInputOptions): PilotInput {
  const offset = new THREE.Vector2();
  const desired = new THREE.Vector2();
  const origin = new THREE.Vector2();
  let active = false;
  let pointerId: number | null = null;
  let steered = false;

  function onPointerDown(event: PointerEvent) {
    if (!active || pointerId !== null || event.button !== 0) return;
    pointerId = event.pointerId;
    origin.set(event.clientX, event.clientY);
    element.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!active || event.pointerId !== pointerId) return;
    steeringOffset(
      event.clientX - origin.x,
      event.clientY - origin.y,
      Math.min(element.clientWidth, element.clientHeight),
      desired,
    );
    if (!steered && desired.lengthSq() >= STEERING_INTENT * STEERING_INTENT) {
      steered = true;
      onSteer?.();
    }
    event.preventDefault();
  }

  function endPointer(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    desired.set(0, 0);
    if (element.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId);
  }

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', endPointer);
  element.addEventListener('pointercancel', endPointer);

  return {
    offset,

    start() {
      active = true;
      pointerId = null;
      steered = false;
      offset.set(0, 0);
      desired.set(0, 0);
    },

    stop() {
      active = false;
      pointerId = null;
      desired.set(0, 0);
    },

    reset() {
      active = false;
      pointerId = null;
      steered = false;
      offset.set(0, 0);
      desired.set(0, 0);
    },

    update(dt: number) {
      offset.lerp(desired, steeringResponse(dt));
    },

    dispose() {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', endPointer);
      element.removeEventListener('pointercancel', endPointer);
    },
  };
}
