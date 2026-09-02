/**
 * The exhaust the ship leaves behind it.
 *
 * This exists because the flight had no way of telling a child that the ship was moving.
 * The chase camera travels with the ship, so the ship sits nearly still in frame; the
 * distances are compressed hard, so almost nothing passes; and the destination only grows
 * slowly. What was left read as the camera swooping rather than the ship flying. A trail
 * is the cheapest fix: it is the one thing on screen that is unambiguously *behind*.
 *
 * One THREE.Points, so the whole trail is a single draw call however long it is. Puffs
 * fade by darkening their own vertex colour rather than by opacity, because the material
 * is additively blended and one material is shared by every point — black simply stops
 * contributing, which is exactly the fade wanted here.
 */

import * as THREE from 'three';
import { makeGlowTexture } from './textures';

export interface EngineTrail {
  /** Added to the scene by the caller: the trail lives in world space, not on the ship. */
  group: THREE.Object3D;
  /**
   * Lay down exhaust at a world position. `strength` is the throttle, so the trail thins
   * out as the engines ease off rather than stopping dead.
   */
  emit(position: THREE.Vector3, strength: number, dt: number): void;
  update(dt: number): void;
  /** Every puff dead and invisible, ready for the next flight. */
  reset(): void;
  dispose(): void;
}

/** How long one puff lives. Long enough to draw a streak, short enough not to ring the body. */
const LIFETIME = 0.85;
/** Warm and bright enough to bloom at the head of the trail. */
const COLOR = new THREE.Color(1.35, 0.66, 0.32);

export function createEngineTrail(count: number): EngineTrail {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  // Starts fully expired, so nothing shows before the first emit.
  const ages = new Float32Array(count).fill(LIFETIME);
  const strengths = new Float32Array(count);

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  const colorAttribute = new THREE.BufferAttribute(colors, 3);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', colorAttribute);

  const texture = makeGlowTexture(64);
  const material = new THREE.PointsMaterial({
    map: texture,
    size: 0.095,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  const points = new THREE.Points(geometry, material);
  // The cloud is rewritten every frame and spans the whole flight path, so a bounding
  // sphere computed once would be wrong immediately.
  points.frustumCulled = false;

  let cursor = 0;
  let sinceEmit = 0;
  // Spacing the emissions evenly over one lifetime is what keeps the trail continuous at
  // any frame rate: emitting per frame would double the density at 120fps and halve it at 30.
  const interval = LIFETIME / count;

  return {
    group: points,

    emit(position: THREE.Vector3, strength: number, dt: number) {
      sinceEmit += dt;
      if (sinceEmit < interval) return;
      sinceEmit = 0;
      if (strength <= 0.01) return;

      const o = cursor * 3;
      positions[o] = position.x;
      positions[o + 1] = position.y;
      positions[o + 2] = position.z;
      ages[cursor] = 0;
      strengths[cursor] = strength;
      cursor = (cursor + 1) % count;
    },

    update(dt: number) {
      for (let i = 0; i < count; i++) {
        const age = (ages[i] ?? LIFETIME) + dt;
        ages[i] = age;
        const life = 1 - Math.min(1, age / LIFETIME);
        // Squared, so the head of the trail stays hot and the tail falls away quickly
        // instead of leaving an even sausage behind the ship.
        const fade = life * life * (strengths[i] ?? 0);
        const o = i * 3;
        colors[o] = COLOR.r * fade;
        colors[o + 1] = COLOR.g * fade;
        colors[o + 2] = COLOR.b * fade;
      }
      positionAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;
    },

    reset() {
      ages.fill(LIFETIME);
      strengths.fill(0);
      colors.fill(0);
      cursor = 0;
      sinceEmit = 0;
      colorAttribute.needsUpdate = true;
    },

    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
