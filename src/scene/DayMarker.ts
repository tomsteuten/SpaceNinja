/**
 * The little house that rides Earth's surface during the hands-on day/night activity.
 *
 * A symbol, not a place: it makes no claim about a real location, so it needs no coordinate
 * or photograph. White and blue rather than gold, and never a tap target, so it cannot be
 * mistaken for a discovery. It carries a small sun by day and a moon, with its window lit, by
 * night. A child of the surface, so it turns with every drag and is put back with the surface
 * when Done restores the hunt's orientation. Depth-tested, so the globe hides it round the back.
 */

import * as THREE from 'three';

/** Height above the surface, in body radii, so the badge never sinks into the globe. */
const LIFT = 1.08;
/** Drawn size, in body radii. Readable on a phone without covering a continent. */
const SIZE = 0.6;
const POP_SECONDS = 0.45;

export interface DayMarker {
  readonly attached: boolean;
  /** Place on `surface` at the world direction given, in daylight. */
  attach(surface: THREE.Object3D, radius: number, worldDirection: THREE.Vector3): void;
  /** Swap the badge. `pop` gives a short bounce (skip it under reduced motion). */
  setLit(lit: boolean, pop: boolean): void;
  update(dt: number): void;
  /** Outward direction from the body's centre, in world space. */
  outward(target: THREE.Vector3): THREE.Vector3;
  /** World position, for the browser-test snapshot. */
  position(target: THREE.Vector3): THREE.Vector3;
  /** Current world-space width, including the brief acknowledgement. */
  readonly width: number;
  detach(): void;
  dispose(): void;
}

function drawHouse(lit: boolean): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.lineJoin = 'round';
  g.lineWidth = 7;
  // A soft backing disc keeps the house legible over bright cloud and dark ocean alike.
  g.fillStyle = lit ? 'rgba(255,255,255,0.88)' : 'rgba(22,34,70,0.88)';
  g.beginPath();
  g.arc(64, 70, 52, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = lit ? '#243f60' : '#c7dcf5';
  g.lineWidth = 4;
  g.stroke();
  // House.
  g.fillStyle = lit ? '#4f8fc0' : '#2f4f7a';
  g.strokeStyle = '#13243f';
  g.beginPath();
  g.moveTo(34, 66); g.lineTo(64, 40); g.lineTo(94, 66); g.lineTo(94, 100); g.lineTo(34, 100);
  g.closePath();
  g.fill();
  g.stroke();
  // Windows: dark by day, lit at night, bringing the city-lights story into one house.
  g.fillStyle = lit ? '#1d3354' : '#ffd66b';
  g.fillRect(44, 70, 16, 20);
  g.fillRect(68, 70, 16, 20);
  // Badge.
  if (lit) {
    g.fillStyle = '#ffc93c';
    g.strokeStyle = '#ffc93c';
    g.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(98 + Math.cos(a) * 15, 28 + Math.sin(a) * 15);
      g.lineTo(98 + Math.cos(a) * 22, 28 + Math.sin(a) * 22);
      g.stroke();
    }
    g.beginPath();
    g.arc(98, 28, 11, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = '#e7ecff';
    g.beginPath();
    g.arc(98, 28, 16, 0, Math.PI * 2);
    g.fill();
    // Cut the crescent with the backing colour.
    g.fillStyle = 'rgba(22,34,70,1)';
    g.beginPath();
    g.arc(106, 22, 14, 0, Math.PI * 2);
    g.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createDayMarker(): DayMarker {
  let day: THREE.Texture | null = null;
  let night: THREE.Texture | null = null;
  const material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false });
  const sprite = new THREE.Sprite(material);
  sprite.name = 'day-marker';
  sprite.renderOrder = 2;
  const centre = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  let size = 0;
  let pop = 0;

  function textures() {
    day ??= drawHouse(true);
    night ??= drawHouse(false);
  }

  return {
    get attached() { return sprite.parent !== null; },
    get width() { return sprite.scale.x; },

    attach(surface, radius, worldDirection) {
      textures();
      surface.updateWorldMatrix(true, false);
      surface.getWorldQuaternion(rotation).invert();
      sprite.position.copy(worldDirection).normalize().applyQuaternion(rotation).multiplyScalar(radius * LIFT);
      size = radius * SIZE;
      sprite.scale.setScalar(size);
      pop = 0;
      material.map = day;
      material.needsUpdate = true;
      surface.add(sprite);
    },

    setLit(lit, animate) {
      const next = lit ? day : night;
      if (material.map === next) return;
      material.map = next;
      material.needsUpdate = true;
      pop = animate ? POP_SECONDS : 0;
    },

    update(dt) {
      if (!sprite.parent || pop <= 0) return;
      pop = Math.max(0, pop - dt);
      const t = 1 - pop / POP_SECONDS;
      sprite.scale.setScalar(size * (1 + 0.35 * Math.sin(Math.PI * t)));
    },

    outward(target) {
      const parent = sprite.parent;
      if (!parent) return target.set(0, 0, 0);
      parent.getWorldPosition(centre);
      return sprite.getWorldPosition(target).sub(centre).normalize();
    },

    position(target) {
      return sprite.getWorldPosition(target);
    },

    detach() {
      sprite.removeFromParent();
      sprite.scale.setScalar(size);
      pop = 0;
    },

    dispose() {
      sprite.removeFromParent();
      material.dispose();
      day?.dispose();
      night?.dispose();
    },
  };
}
