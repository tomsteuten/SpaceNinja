/**
 * The place badges: a small round picture of each place, pinned to the world where it is.
 *
 * A pre-reader cannot use a list of names, and an abstract gold ring had to be learned (see
 * docs/decision-history.md). A picture of a volcano on the volcano needs neither. Each badge is
 * a crop of the same real photograph its postcard opens, so the thing you fly to is the thing
 * you then see. Found places keep their badge with a tick, so what is left is visible at a
 * glance; unfound ones breathe gently so they read as something to go to.
 *
 * Badges are screen-sized sprites drawn over the globe (no depth test) and hidden by an
 * explicit horizon test instead, because a camera-facing quad skimming a curved surface would
 * otherwise be sliced in half by the ground in front of it.
 */
import * as THREE from 'three';
import type { CelestialBody } from '../scene/Bodies';
import { badgeVisibility, direction } from './surfaceView';
import { thumbnail, type ExplorerWorld, type WorldPlace } from './worlds';

const TEXTURE_SIZE = 128;
/** On-screen diameter in CSS pixels. Large enough to be a picture, small enough to stay out of the way. */
export const BADGE_PIXELS = 62;
/** Extra reach around the drawn badge for a small finger. */
const HIT_SLOP = 16;
const POP_SECONDS = 0.7;

/** Surface-space position (unit radius) of a place's badge. Ring places lie in the ring plane. */
export function badgePosition(place: WorldPlace): THREE.Vector3 {
  if (place.discovery.ring !== undefined) return direction(0, place.lon).multiplyScalar(place.discovery.ring);
  return direction(place.lat, place.lon).multiplyScalar(1.015);
}

interface Badge {
  place: WorldPlace;
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  image: HTMLImageElement | null;
  local: THREE.Vector3;
  visibility: number;
  pop: number;
  found: boolean;
}

export interface Beacons {
  update(cameraLocal: THREE.Vector3, camera: THREE.PerspectiveCamera, dt: number, elapsed: number): void;
  /** The place under a screen point, if a visible badge is there. */
  hit(clientX: number, clientY: number, camera: THREE.PerspectiveCamera): WorldPlace | null;
  markFound(id: string, celebrate: boolean): void;
  /** Screen positions for the playtest snapshot. */
  screen(camera: THREE.PerspectiveCamera): Array<{ id: string; x: number; y: number; visible: boolean; found: boolean }>;
  dispose(): void;
}

function draw(badge: Badge) {
  const context = badge.canvas.getContext('2d');
  if (!context) return;
  const size = TEXTURE_SIZE, middle = size / 2;
  context.clearRect(0, 0, size, size);
  // A soft dark halo so the badge separates from bright ground as well as from space.
  context.fillStyle = 'rgba(4, 10, 16, 0.55)';
  context.beginPath(); context.arc(middle, middle, 62, 0, Math.PI * 2); context.fill();
  // The rim: warm gold while it is waiting to be found, calm teal once it has been.
  context.fillStyle = badge.found ? '#9ee9df' : '#ffd08a';
  context.beginPath(); context.arc(middle, middle, 57, 0, Math.PI * 2); context.fill();
  context.save();
  context.beginPath(); context.arc(middle, middle, 50, 0, Math.PI * 2); context.clip();
  if (badge.image?.complete && badge.image.naturalWidth > 0) {
    context.drawImage(badge.image, middle - 50, middle - 50, 100, 100);
  } else {
    // Until (or unless) the picture arrives, the place's own emoji keeps the badge meaningful.
    context.fillStyle = '#16303a';
    context.fillRect(0, 0, size, size);
    context.font = '54px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(badge.place.discovery.emoji, middle, middle + 3);
  }
  context.restore();
  if (badge.found) {
    context.fillStyle = '#2f9f6f';
    context.beginPath(); context.arc(99, 99, 22, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 7; context.lineCap = 'round'; context.lineJoin = 'round';
    context.beginPath(); context.moveTo(89, 99); context.lineTo(97, 107); context.lineTo(110, 91); context.stroke();
  }
  badge.texture.needsUpdate = true;
}

export function createBeacons(options: {
  body: CelestialBody;
  world: ExplorerWorld;
  found: ReadonlySet<string>;
  reducedMotion: boolean;
}): Beacons {
  const { body, world, found, reducedMotion } = options;
  const group = new THREE.Group();
  body.surface.add(group);
  const base = import.meta.env.BASE_URL;
  const scratch = new THREE.Vector3();
  let disposed = false;

  const badges: Badge[] = world.places.map((place) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TEXTURE_SIZE;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 10;
    const local = badgePosition(place);
    sprite.position.copy(local).multiplyScalar(body.radius);
    sprite.visible = false;
    group.add(sprite);
    const badge: Badge = {
      place, sprite, material, texture, canvas, image: null, local, visibility: 0, pop: 0, found: found.has(place.id),
    };
    draw(badge);
    // Thumbnails are a few kilobytes each and only this world's six are fetched, on arrival.
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => { if (!disposed) draw(badge); };
    image.src = base + thumbnail(place);
    badge.image = image;
    return badge;
  });

  function pixelScale(camera: THREE.PerspectiveCamera, pixels: number) {
    // A sizeAttenuation:false sprite of scale s covers s * P[5] / 2 of the viewport height.
    return (pixels / Math.max(1, window.innerHeight)) * 2 / camera.projectionMatrix.elements[5]!;
  }

  function project(badge: Badge, camera: THREE.PerspectiveCamera) {
    badge.sprite.getWorldPosition(scratch).project(camera);
    return { x: (scratch.x + 1) / 2 * window.innerWidth, y: (1 - scratch.y) / 2 * window.innerHeight, front: scratch.z < 1 };
  }

  return {
    update(cameraLocal, camera, dt, elapsed) {
      const base = pixelScale(camera, BADGE_PIXELS);
      for (const badge of badges) {
        badge.visibility = badgeVisibility(cameraLocal, badge.local);
        badge.sprite.visible = badge.visibility > 0.01;
        badge.material.opacity = badge.visibility * (badge.found ? 0.82 : 1);
        let scale = base;
        if (badge.pop > 0) {
          badge.pop = Math.max(0, badge.pop - dt);
          scale *= 1 + Math.sin((1 - badge.pop / POP_SECONDS) * Math.PI) * 0.55;
        } else if (!badge.found && !reducedMotion) {
          scale *= 1 + Math.sin(elapsed * 2.6 + badge.local.x * 5) * 0.06;
        }
        badge.sprite.scale.setScalar(scale);
      }
    },
    hit(clientX, clientY, camera) {
      let best: { place: WorldPlace; distance: number } | null = null;
      for (const badge of badges) {
        if (badge.visibility < 0.5) continue;
        const point = project(badge, camera);
        if (!point.front) continue;
        const distance = Math.hypot(point.x - clientX, point.y - clientY);
        if (distance <= BADGE_PIXELS / 2 + HIT_SLOP && (!best || distance < best.distance)) best = { place: badge.place, distance };
      }
      return best?.place ?? null;
    },
    markFound(id, celebrate) {
      const badge = badges.find((item) => item.place.id === id);
      if (!badge || badge.found) return;
      badge.found = true;
      if (celebrate && !reducedMotion) badge.pop = POP_SECONDS;
      draw(badge);
    },
    screen(camera) {
      return badges.map((badge) => {
        const point = project(badge, camera);
        return { id: badge.place.id, x: point.x, y: point.y, visible: badge.visibility > 0.5 && point.front, found: badge.found };
      });
    },
    dispose() {
      disposed = true;
      group.removeFromParent();
      for (const badge of badges) {
        if (badge.image) badge.image.onload = null;
        badge.texture.dispose();
        badge.material.dispose();
      }
    },
  };
}
