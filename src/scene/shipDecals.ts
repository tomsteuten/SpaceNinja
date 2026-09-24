/**
 * Earned mission stickers, redrawn as tiny ship-safe emblems.
 *
 * The celebration art is much larger than the parked ship, so these deliberately use bold
 * shapes rather than emoji, words or a downloaded sprite sheet. That keeps them legible at
 * seven-ish screen pixels, deterministic across Android browsers and available offline.
 */

import * as THREE from 'three';
import { FINALE_STICKER } from '../state/progress';
import { WORLDS, stickerIdFor } from '../worlds/catalogue';

/** One emblem per world in the catalogue, in catalogue order, then the title reward. */
export const SHIP_DECAL_IDS: readonly string[] = [
  ...WORLDS.map((world) => stickerIdFor(world.id)),
  FINALE_STICKER,
];

export type ShipDecalId = string;

/** Known rewards only, in the stable order in which their places are laid onto the ship. */
export function activeShipDecalIds(ids: readonly string[]): ShipDecalId[] {
  const earned = new Set(ids);
  return SHIP_DECAL_IDS.filter((id) => earned.has(id));
}

export interface ShipDecals {
  group: THREE.Group;
  setEarned(ids: readonly string[]): void;
  setOpacity(opacity: number): void;
  dispose(): void;
}

const SIZE = 192;
const CENTRE = SIZE / 2;
const INK = '#4a3d84';
const CREAM = '#fff8e9';
const ORANGE = '#f4762a';
const SKY = '#57b9ee';
const GREEN = '#55bd72';

function circle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill: string,
  stroke?: string,
  width = 0,
) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();
  if (stroke && width > 0) {
    context.strokeStyle = stroke;
    context.lineWidth = width;
    context.stroke();
  }
}

function polygon(context: CanvasRenderingContext2D, points: readonly number[], fill: string) {
  context.beginPath();
  context.moveTo(points[0] ?? 0, points[1] ?? 0);
  for (let index = 2; index < points.length; index += 2) {
    context.lineTo(points[index] ?? 0, points[index + 1] ?? 0);
  }
  context.closePath();
  context.fillStyle = fill;
  context.fill();
}

/**
 * The badge for a world with no hand-drawn emblem yet: a cream disc with a coloured ring
 * and the world's initial. Legible at the size these are shown, and enough for a new world
 * to earn something on the ship the day it lands; a drawn emblem can replace it later.
 */
function drawGenericBadge(context: CanvasRenderingContext2D, id: string) {
  circle(context, CENTRE, CENTRE, 70, CREAM, ORANGE, 14);
  const initial = id.replace(/-explorer$/, '').charAt(0).toUpperCase();
  context.fillStyle = INK;
  context.font = 'bold 96px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(initial, CENTRE, CENTRE + 6);
}

function drawBadge(context: CanvasRenderingContext2D, id: ShipDecalId) {
  context.clearRect(0, 0, SIZE, SIZE);
  context.lineJoin = 'round';
  context.lineCap = 'round';

  // A pale plate and thick plum keyline hold together even after minification.
  circle(context, CENTRE, CENTRE, 82, CREAM, INK, 12);

  if (id === 'earth-explorer') {
    circle(context, CENTRE, CENTRE, 55, SKY, INK, 7);
    polygon(context, [55, 62, 83, 47, 104, 56, 95, 74, 108, 88, 87, 101, 61, 91], GREEN);
    polygon(context, [112, 105, 139, 91, 145, 113, 130, 142, 108, 129], GREEN);
    return;
  }

  if (id === 'moon-explorer') {
    circle(context, CENTRE, CENTRE, 55, '#d8d6d1', INK, 7);
    circle(context, 72, 77, 11, '#aaa8ad');
    circle(context, 116, 62, 8, '#aaa8ad');
    circle(context, 121, 112, 15, '#b9b7ba');
    circle(context, 78, 128, 7, '#aaa8ad');
    return;
  }

  if (id === 'mars-explorer') {
    circle(context, CENTRE, CENTRE, 55, ORANGE, INK, 7);
    polygon(context, [48, 119, 78, 91, 94, 108, 116, 73, 148, 125], '#b94143');
    polygon(context, [88, 112, 116, 73, 148, 125], '#d9573d');
    context.beginPath();
    context.moveTo(105, 84);
    context.lineTo(122, 84);
    context.strokeStyle = '#ffd67a';
    context.lineWidth = 7;
    context.stroke();
    return;
  }

  if (id === 'saturn-explorer') {
    context.save();
    context.translate(CENTRE, CENTRE);
    context.rotate(-0.32);
    context.beginPath();
    context.ellipse(0, 0, 72, 25, 0, 0, Math.PI * 2);
    context.strokeStyle = ORANGE;
    context.lineWidth = 14;
    context.stroke();
    context.restore();
    circle(context, CENTRE, CENTRE, 42, '#f3c968', INK, 7);
    context.beginPath();
    context.moveTo(62, 91);
    context.lineTo(130, 91);
    context.strokeStyle = '#e59c40';
    context.lineWidth = 8;
    context.stroke();
    return;
  }

  if (id !== FINALE_STICKER) {
    drawGenericBadge(context, id);
    return;
  }

  // The finale emblem: a friendly masked face inside a four-point navigation star.
  polygon(context, [96, 35, 112, 67, 151, 61, 124, 91, 151, 125, 111, 120, 96, 155, 80, 120, 41, 125, 68, 91, 41, 61, 80, 67], SKY);
  circle(context, CENTRE, 99, 43, INK);
  polygon(context, [64, 91, 96, 70, 128, 91, 121, 127, 71, 127], '#302653');
  context.beginPath();
  context.moveTo(70, 95);
  context.lineTo(122, 95);
  context.strokeStyle = ORANGE;
  context.lineWidth = 17;
  context.stroke();
  context.beginPath();
  context.moveTo(82, 95);
  context.lineTo(87, 95);
  context.moveTo(105, 95);
  context.lineTo(110, 95);
  context.strokeStyle = INK;
  context.lineWidth = 6;
  context.stroke();
}

function makeTexture(id: ShipDecalId): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('A 2D canvas is required to draw ship decals.');
  drawBadge(context, id);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

interface Mount {
  id: ShipDecalId;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  size: number;
}

/**
 * Where the first four world badges go: one on each rear side, two on the broad top panel.
 * Worlds beyond the fourth take the top panel further forward, two per row, a little
 * smaller — a first version, to be looked at on the ship when a fifth world exists.
 */
const WORLD_SLOTS: readonly Omit<Mount, 'id'>[] = [
  { position: [-0.0765, 0, -0.083], rotation: [0, -Math.PI / 2, 0], size: 0.052 },
  { position: [0.0765, 0, -0.083], rotation: [0, Math.PI / 2, 0], size: 0.052 },
  { position: [-0.039, 0.0645, -0.083], rotation: [-Math.PI / 2, 0, 0], size: 0.046 },
  { position: [0.039, 0.0645, -0.083], rotation: [-Math.PI / 2, 0, 0], size: 0.046 },
];

function worldSlot(index: number): Omit<Mount, 'id'> {
  const named = WORLD_SLOTS[index];
  if (named) return named;
  const extra = index - WORLD_SLOTS.length;
  const row = Math.floor(extra / 2);
  const side = extra % 2 === 0 ? -1 : 1;
  return {
    position: [side * 0.039, 0.0645, -0.083 + 0.04 * (row + 1)],
    rotation: [-Math.PI / 2, 0, 0],
    size: 0.036,
  };
}

const MOUNTS: readonly Mount[] = [
  ...WORLDS.map((world, index) => ({ id: stickerIdFor(world.id), ...worldSlot(index) })),
  // The title reward is the ship's crest, repeated on both front sides like an insignia.
  { id: FINALE_STICKER, position: [-0.0675, 0, 0.073], rotation: [0, -Math.PI / 2, 0], size: 0.058 },
  { id: FINALE_STICKER, position: [0.0675, 0, 0.073], rotation: [0, Math.PI / 2, 0], size: 0.058 },
];

export function createShipDecals(): ShipDecals {
  const group = new THREE.Group();
  group.name = 'earned-ship-decals';
  // Shared geometry, while each reward has its own small texture and material.
  const geometry = new THREE.PlaneGeometry(1, 1);
  const textures = new Map<ShipDecalId, THREE.CanvasTexture>();
  const materials = new Map<ShipDecalId, THREE.MeshBasicMaterial>();
  const meshes = new Map<ShipDecalId, THREE.Mesh[]>();

  for (const id of SHIP_DECAL_IDS) {
    const texture = makeTexture(id);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.08,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    textures.set(id, texture);
    materials.set(id, material);
    meshes.set(id, []);
  }

  for (const mount of MOUNTS) {
    const material = materials.get(mount.id);
    const rewardMeshes = meshes.get(mount.id);
    if (!material || !rewardMeshes) continue;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `decal-${mount.id}`;
    mesh.position.set(...mount.position);
    mesh.rotation.set(...mount.rotation);
    mesh.scale.setScalar(mount.size);
    mesh.visible = false;
    mesh.renderOrder = 2;
    rewardMeshes.push(mesh);
    group.add(mesh);
  }

  return {
    group,

    setEarned(ids: readonly string[]) {
      const active = new Set(activeShipDecalIds(ids));
      for (const [id, rewardMeshes] of meshes) {
        const visible = active.has(id);
        for (const mesh of rewardMeshes) mesh.visible = visible;
      }
    },

    setOpacity(opacity: number) {
      for (const material of materials.values()) {
        material.opacity = opacity;
      }
    },

    dispose() {
      geometry.dispose();
      for (const material of materials.values()) material.dispose();
      for (const texture of textures.values()) texture.dispose();
    },
  };
}
