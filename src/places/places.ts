/**
 * The scene half of the Places card (owner's pick B, `design/places/places-B.png`): turn the
 * world to a place and put a small quiet mark on it. The photo and its name are the UI's
 * (src/ui/ui.ts); the order of the places and when to show one are main.ts's.
 *
 * The surface is held for the whole visit (main.ts), so `turnSurface` moves it; the camera
 * keeps belonging to the child, and any press on the world cancels a turn part-way.
 */
import * as THREE from 'three';
import type { Discovery } from '../config';
import type { CelestialBody } from '../scene/Bodies';
import { easeTurn, placeTurn, surfaceDirection } from './placeTurn';

/** How long a turn to a place takes. Reduced motion cuts. */
export const PLACE_TURN_SECONDS = 0.9;
/** The mark's size, as a fraction of the world's radius. */
const MARK_RATIO = 0.085;
/** Sits just above the ground, so the ground never hides it. */
const FLOAT_RATIO = 1.012;

export interface PlacesScene {
  /** Turn `body` so `place` faces the camera, and mark it. */
  show(body: CelestialBody, place: Discovery): void;
  /** Take the mark away and stop any turn where it is. */
  hide(): void;
  readonly turning: boolean;
  /** The mark's world position, or null while no place is shown. */
  markPosition(target: THREE.Vector3): THREE.Vector3 | null;
  update(dt: number): void;
  dispose(): void;
}

export interface PlacesSceneOptions {
  camera: THREE.Camera;
  /** Tilts the camera about the world, as orbit control does (`OrbitInput.orbitAround`). */
  orbitAround(axis: THREE.Vector3, angle: number): void;
  reducedMotion: boolean;
}

/** A white dot with an ink outline and a soft halo, drawn once. */
function markTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const c = size / 2;
    const halo = ctx.createRadialGradient(c, c, 8, c, c, c);
    halo.addColorStop(0, 'rgba(255,255,255,0.55)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(c, c, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#2b2118';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c, c, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createPlacesScene(options: PlacesSceneOptions): PlacesScene {
  const { camera, orbitAround, reducedMotion } = options;
  const texture = markTexture();
  const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true });
  const mark = new THREE.Sprite(material);
  mark.visible = false;
  mark.renderOrder = 2;

  let turn: {
    body: CelestialBody; yaw: number; pitch: number; axis: THREE.Vector3; t: number; applied: number;
  } | null = null;

  const _center = new THREE.Vector3();
  const _place = new THREE.Vector3();
  const _axis = new THREE.Vector3();
  const _view = new THREE.Vector3();

  function step(amount: number) {
    if (!turn) return;
    const next = Math.min(1, turn.t + amount);
    turn.t = next;
    const eased = easeTurn(next);
    const delta = eased - turn.applied;
    turn.applied = eased;
    turn.body.turnSurface(turn.yaw * delta);
    if (turn.pitch) orbitAround(turn.axis, turn.pitch * delta);
    if (next >= 1) turn = null;
  }

  return {
    get turning() {
      return turn !== null;
    },

    show(body, place) {
      turn = null;
      const ring = place.ring !== undefined;
      const local = ring
        ? surfaceDirection(0, place.lon).multiplyScalar(place.ring!)
        : surfaceDirection(place.lat, place.lon).multiplyScalar(FLOAT_RATIO);
      // The surface sphere carries the world's radius in its geometry (Bodies.ts).
      mark.position.copy(local).multiplyScalar(body.radius);
      mark.scale.setScalar(body.radius * MARK_RATIO);
      body.surface.add(mark);
      mark.visible = true;

      body.surface.updateMatrixWorld(true);
      body.getWorldPosition(_center);
      mark.getWorldPosition(_place).sub(_center).normalize();
      _axis.set(0, 1, 0).transformDirection(body.surface.matrixWorld);
      _view.copy(camera.position).sub(_center).normalize();
      const { yaw, pitch, pitchAxis } = placeTurn(_place, _axis, _view, ring);
      turn = { body, yaw, pitch, axis: pitchAxis, t: 0, applied: 0 };
      if (reducedMotion) step(1);
    },

    markPosition(target) {
      return mark.visible && mark.parent ? mark.getWorldPosition(target) : null;
    },

    hide() {
      turn = null;
      mark.visible = false;
      mark.removeFromParent();
    },

    update(dt) {
      if (turn) step(dt / PLACE_TURN_SECONDS);
    },

    dispose() {
      this.hide();
      material.dispose();
      texture.dispose();
    },
  };
}
