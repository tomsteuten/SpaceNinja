/**
 * A small friendly spaceship, built from primitives.
 *
 * Model convention: nose points along +Z. `orient()` maps that to any direction, so a
 * future GLB replacement only needs to match the same convention.
 */

import * as THREE from 'three';
import { makeGlowTexture } from './textures';

export interface Spaceship {
  /** Positioned and oriented by the flight sequence. */
  group: THREE.Group;
  /** 0 = idle flicker, 1 = full burn. Drives the engine glow. */
  setThrust(value: number): void;
  orient(direction: THREE.Vector3, rollHint?: number): void;
  update(dt: number, elapsed: number): void;
  /**
   * Back to the parked transform and a cold engine. Re-parenting is the caller's job —
   * on arrival the ship belongs to the destination, and only the scene owner can undo
   * that — but everything else the ship knows about itself is restored here.
   */
  reset(): void;
  dispose(): void;
}

/** Where the ship waits before launch. Held here so reset() has one source of truth. */
const PARK_POSITION = new THREE.Vector3(2.2, 1.35, 1.4);
const PARK_SCALE = 0.85;

export function createSpaceship(): Spaceship {
  const group = new THREE.Group();
  group.position.copy(PARK_POSITION);
  group.scale.setScalar(PARK_SCALE);
  // Inner node carries the idle bob so the outer transform stays purely flight-driven.
  const body = new THREE.Group();
  group.add(body);

  const hull = new THREE.MeshStandardMaterial({
    color: 0xf6f1ea,
    roughness: 0.42,
    metalness: 0.12,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: 0xff9257,
    roughness: 0.36,
    metalness: 0.1,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9fd8ff,
    roughness: 0.08,
    metalness: 0,
    emissive: new THREE.Color(0x3f7fd4),
    emissiveIntensity: 0.65,
  });

  const geometries: THREE.BufferGeometry[] = [];
  const track = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  // Rounded fuselage. Capsule is built along Y, so tip it onto Z.
  const fuselage = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.062, 0.12, 4, 14)), hull);
  fuselage.rotation.x = Math.PI / 2;
  body.add(fuselage);

  const nose = new THREE.Mesh(track(new THREE.ConeGeometry(0.062, 0.1, 16)), accent);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.148;
  body.add(nose);

  const collar = new THREE.Mesh(track(new THREE.TorusGeometry(0.064, 0.011, 8, 20)), accent);
  collar.position.z = 0.02;
  body.add(collar);

  const cockpit = new THREE.Mesh(track(new THREE.SphereGeometry(0.046, 16, 12)), glass);
  cockpit.position.set(0, 0.042, 0.052);
  cockpit.scale.set(1, 0.78, 1.25);
  body.add(cockpit);

  // Three stubby fins, evenly spaced around the tail.
  const finGeometry = track(new THREE.ConeGeometry(0.028, 0.11, 4));
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(finGeometry, accent);
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
    fin.position.set(Math.cos(angle) * 0.062, Math.sin(angle) * 0.062, -0.085);
    fin.rotation.z = angle - Math.PI / 2;
    fin.rotation.x = Math.PI / 2;
    fin.scale.set(1, 1, 0.45);
    body.add(fin);
  }

  const nozzle = new THREE.Mesh(track(new THREE.CylinderGeometry(0.03, 0.042, 0.05, 14)), hull);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = -0.128;
  body.add(nozzle);

  const flameTexture = makeGlowTexture(128);
  const flameMaterial = new THREE.SpriteMaterial({
    map: flameTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  flameMaterial.color.setRGB(1.15, 0.72, 0.42);
  const flame = new THREE.Sprite(flameMaterial);
  flame.position.z = -0.18;
  body.add(flame);

  let thrust = 0;
  let targetThrust = 0;
  const quaternion = new THREE.Quaternion();
  const normalized = new THREE.Vector3();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  const basis = new THREE.Matrix4();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();

  return {
    group,

    setThrust(value: number) {
      targetThrust = THREE.MathUtils.clamp(value, 0, 1);
    },

    orient(direction: THREE.Vector3, rollHint = 0) {
      normalized.copy(direction);
      if (normalized.lengthSq() < 1e-8) return;
      normalized.normalize();
      // setFromUnitVectors alone leaves roll undefined, which makes the ship spin about
      // its own axis as the heading swings. Build an explicit world-up-aligned basis.
      right.crossVectors(WORLD_UP, normalized);
      if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
      right.normalize();
      up.crossVectors(normalized, right);
      basis.makeBasis(right, up, normalized);
      quaternion.setFromRotationMatrix(basis);
      group.quaternion.copy(quaternion);
      body.rotation.z = rollHint;
    },

    update(dt: number, elapsed: number) {
      // Ease thrust so the flame swells rather than snapping on.
      thrust += (targetThrust - thrust) * Math.min(1, dt * 3.5);

      const flicker = Math.sin(elapsed * 7.3) * 0.012;
      const size = 0.085 + thrust * 0.115 + flicker;
      flame.scale.set(size, size, 1);
      flame.position.z = -0.17 - thrust * 0.05;
      flameMaterial.opacity = 0.5 + thrust * 0.4;

      // Gentle bob, damped out under thrust so the flight reads as purposeful.
      const calm = 1 - thrust;
      body.position.y = Math.sin(elapsed * 1.6) * 0.012 * calm;
      body.rotation.x = Math.sin(elapsed * 1.1) * 0.05 * calm;
    },

    reset() {
      group.position.copy(PARK_POSITION);
      group.scale.setScalar(PARK_SCALE);
      group.quaternion.identity();
      body.position.set(0, 0, 0);
      body.rotation.set(0, 0, 0);
      // Both, so the flame is cold on the next frame rather than easing down from a burn.
      thrust = 0;
      targetThrust = 0;
    },

    dispose() {
      for (const geometry of geometries) geometry.dispose();
      hull.dispose();
      accent.dispose();
      glass.dispose();
      flameMaterial.dispose();
      flameTexture.dispose();
    },
  };
}
