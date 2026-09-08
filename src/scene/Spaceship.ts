/**
 * A small friendly spaceship, built from primitives.
 *
 * Model convention: nose points along +Z. `orient()` maps that to any direction, so a
 * future GLB replacement only needs to match the same convention.
 *
 * The silhouette follows the concept sheet in `design/spaceship.png`: cream hull, orange
 * swept wings and nose, deep purple trim, a big glass canopy and three engines. Its broad
 * chamfered modules borrow a little from construction toys without becoming a literal
 * brick model. Nothing is loaded from the sheet — at roughly 40px parked and 130px in
 * flight, confident masses, colour blocking and the glow read where panel lines do not.
 */

import * as THREE from 'three';
import { createShipDecals } from './shipDecals';
import { makeGlowTexture } from './textures';

export interface Spaceship {
  /** Positioned and oriented by the flight sequence. */
  group: THREE.Group;
  /** 0 = idle flicker, 1 = full burn. Drives the engine glow. */
  setThrust(value: number): void;
  /** Fade the parked ship while the child is looking for places on the world behind it. */
  setContextDimmed(dimmed: boolean): void;
  /** Put every earned mission emblem onto the hull; unknown save entries are ignored. */
  setStickers(ids: readonly string[]): void;
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
/** Still recognisably the child's ship, but no longer able to hide a gold target. */
export const SHIP_CONTEXT_OPACITY = 0.28;

export function shipContextOpacity(dimmed: boolean): number {
  return dimmed ? SHIP_CONTEXT_OPACITY : 1;
}

/* Palette, read off the concept sheet. */
const HULL = 0xf2ece0;
const ACCENT = 0xf4762a;
const TRIM = 0x4a3d84;
const GLASS = 0x7fc9f5;
const METAL = 0xc9c6c4;
const CORE = 0x1a1626;
const LIGHT = 0x5fd8ff;

/**
 * Where the three engines sit, as angles around the ship's long axis. One up, two down —
 * the arrangement on the sheet, and the one that still reads as three from the side.
 */
const ENGINE_ANGLES = [Math.PI / 2, Math.PI * (7 / 6), Math.PI * (11 / 6)];
const ENGINE_RING_RADIUS = 0.052;
const ENGINE_Z = -0.155;

interface Wing {
  /** Where it sits around the ship's long axis. */
  angle: number;
  /** How far it reaches out from the hull. */
  span: number;
  /** How deep it is front-to-back. Roughly a third of the span reads as a wing; much
   *  less and it reads as a spike stuck into the side of the ship. */
  chord: number;
  /** How far it rakes backward. */
  sweep: number;
  /** Main wings carry a running light; the fins are too small to hold one. */
  lit: boolean;
}

/**
 * Two broad side wings and a smaller top/bottom pair. Four strong blocks stay readable
 * from every camera angle without turning the rear view into the old six-point starburst.
 */
const WINGS: Wing[] = [
  { angle: 0, span: 0.12, chord: 0.07, sweep: 0.42, lit: true },
  { angle: Math.PI, span: 0.12, chord: 0.07, sweep: 0.42, lit: true },
  { angle: Math.PI * 0.5, span: 0.078, chord: 0.058, sweep: 0.3, lit: false },
  { angle: Math.PI * 1.5, span: 0.058, chord: 0.048, sweep: 0.38, lit: false },
];

/** Where a wing root meets the hull. */
const WING_ROOT = 0.058;
/** Wings attach around mid-body and rake back past the engines, as on the sheet. */
const WING_Z = -0.015;

export function createSpaceship(): Spaceship {
  const group = new THREE.Group();
  group.position.copy(PARK_POSITION);
  group.scale.setScalar(PARK_SCALE);
  // Inner node carries the idle bob so the outer transform stays purely flight-driven.
  const body = new THREE.Group();
  group.add(body);

  const decals = createShipDecals();
  body.add(decals.group);

  const hull = new THREE.MeshStandardMaterial({
    color: HULL,
    roughness: 0.42,
    metalness: 0.08,
    flatShading: true,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: ACCENT,
    roughness: 0.38,
    metalness: 0.06,
    flatShading: true,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: TRIM,
    roughness: 0.42,
    metalness: 0.12,
    flatShading: true,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: METAL,
    roughness: 0.28,
    metalness: 0.7,
    flatShading: true,
  });
  const core = new THREE.MeshStandardMaterial({
    color: CORE,
    roughness: 0.9,
    metalness: 0,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: GLASS,
    roughness: 0.06,
    metalness: 0,
    emissive: new THREE.Color(0x2f7fc8),
    emissiveIntensity: 0.55,
  });
  // Self-lit, so the running lights still read on the ship's dark side.
  const light = new THREE.MeshStandardMaterial({
    color: LIGHT,
    roughness: 0.4,
    metalness: 0,
    emissive: new THREE.Color(LIGHT),
    emissiveIntensity: 1.5,
  });

  const materials = [hull, accent, trim, metal, core, glass, light];
  const materialResting = materials.map((material) => ({
    material,
    opacity: material.opacity,
    transparent: material.transparent,
  }));
  const geometries: THREE.BufferGeometry[] = [];
  const track = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  /**
   * One-bevel rounded box. The broad flat faces give the ship its block-built character;
   * the clipped corners keep it friendly and catch a highlight on a small screen.
   */
  function chamferedBox(width: number, height: number, depth: number, chamfer: number) {
    const flatWidth = width - chamfer * 2;
    const flatHeight = height - chamfer * 2;
    const shape = new THREE.Shape();
    const left = -flatWidth / 2;
    const right = flatWidth / 2;
    const bottom = -flatHeight / 2;
    const top = flatHeight / 2;
    shape.moveTo(left + chamfer, bottom);
    shape.lineTo(right - chamfer, bottom);
    shape.quadraticCurveTo(right, bottom, right, bottom + chamfer);
    shape.lineTo(right, top - chamfer);
    shape.quadraticCurveTo(right, top, right - chamfer, top);
    shape.lineTo(left + chamfer, top);
    shape.quadraticCurveTo(left, top, left, top - chamfer);
    shape.lineTo(left, bottom + chamfer);
    shape.quadraticCurveTo(left, bottom, left + chamfer, bottom);

    const innerDepth = depth - chamfer * 2;
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: innerDepth,
      steps: 1,
      curveSegments: 1,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: chamfer,
      bevelThickness: chamfer,
    });
    geometry.translate(0, 0, -innerDepth / 2);
    return track(geometry);
  }

  /* --- fuselage ----------------------------------------------------------- */

  const rearModule = new THREE.Mesh(chamferedBox(0.15, 0.125, 0.145, 0.012), hull);
  rearModule.position.z = -0.066;
  body.add(rearModule);

  const frontModule = new THREE.Mesh(chamferedBox(0.132, 0.108, 0.105, 0.012), hull);
  frontModule.position.z = 0.066;
  body.add(frontModule);

  // Four sides make the orange nose one bold, toy-like cap rather than a smooth missile.
  const nose = new THREE.Mesh(track(new THREE.ConeGeometry(0.076, 0.11, 4)), accent);
  nose.rotation.x = Math.PI / 2;
  nose.rotation.z = Math.PI / 4;
  nose.position.z = 0.17;
  body.add(nose);

  // The connector is deliberately proud of both cream modules, like a large brick seam.
  const connector = new THREE.Mesh(chamferedBox(0.158, 0.133, 0.034, 0.009), trim);
  connector.position.z = 0.006;
  body.add(connector);

  const tailBand = new THREE.Mesh(chamferedBox(0.16, 0.135, 0.032, 0.008), metal);
  tailBand.position.z = -0.132;
  body.add(tailBand);

  /* --- canopy -------------------------------------------------------------- */

  // A low-poly dome breaks the blocks just enough to keep the ship warm and characterful.
  const canopy = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.064, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2)),
    glass,
  );
  canopy.position.set(0, 0.052, 0.058);
  canopy.scale.set(0.82, 0.9, 1.08);
  body.add(canopy);

  const canopyFrame = new THREE.Mesh(chamferedBox(0.108, 0.016, 0.092, 0.006), trim);
  canopyFrame.position.set(0, 0.063, 0.058);
  body.add(canopyFrame);

  /* --- wings and fins ------------------------------------------------------ */

  // A four-sided frustum makes a broad trapezoidal block with a deliberately blunt tip.
  // Unit-sized, so each wing's scale is its chord, span and thickness.
  const wingGeometry = track(new THREE.CylinderGeometry(0.55, 1, 1, 4));
  const stripGeometry = track(new THREE.BoxGeometry(0.014, 0.007, 0.032));

  for (const wing of WINGS) {
    // A pivot per wing: spinning the pivot about the long axis places the wing, so the
    // blade inside only ever has to describe its own shape and rake.
    const pivot = new THREE.Group();
    pivot.rotation.z = wing.angle - Math.PI / 2;

    const blade = new THREE.Mesh(wingGeometry, accent);
    blade.scale.set(wing.chord, wing.span, wing.chord * 0.34);
    blade.position.y = WING_ROOT + wing.span * 0.5;
    blade.position.z = WING_Z;
    blade.rotation.x = -wing.sweep;
    pivot.add(blade);

    if (wing.lit) {
      const strip = new THREE.Mesh(stripGeometry, light);
      // Out along the blade, and back along it by however far the sweep has carried it.
      const along = wing.span * 0.34;
      strip.position.set(0, WING_ROOT + along, WING_Z - Math.sin(wing.sweep) * along);
      strip.rotation.x = -wing.sweep;
      pivot.add(strip);
    }

    body.add(pivot);
  }

  /* --- engines ------------------------------------------------------------- */

  const engineCollarGeometry = track(new THREE.BoxGeometry(0.054, 0.054, 0.026));
  const housingGeometry = track(new THREE.BoxGeometry(0.043, 0.043, 0.064));
  const coreGeometry = track(new THREE.BoxGeometry(0.029, 0.029, 0.014));

  const flameTexture = makeGlowTexture(128);
  const flameMaterial = new THREE.SpriteMaterial({
    map: flameTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  flameMaterial.color.setRGB(1.15, 0.72, 0.42);

  const flames: THREE.Sprite[] = [];

  for (const angle of ENGINE_ANGLES) {
    const x = Math.cos(angle) * ENGINE_RING_RADIUS;
    const y = Math.sin(angle) * ENGINE_RING_RADIUS;

    const collar = new THREE.Mesh(engineCollarGeometry, metal);
    collar.position.set(x, y, ENGINE_Z + 0.022);
    body.add(collar);

    const housing = new THREE.Mesh(housingGeometry, trim);
    housing.position.set(x, y, ENGINE_Z);
    body.add(housing);

    const bell = new THREE.Mesh(coreGeometry, core);
    bell.position.set(x, y, ENGINE_Z - 0.038);
    body.add(bell);

    // One flame per engine, sharing the material so thrust drives all three at once.
    const flame = new THREE.Sprite(flameMaterial);
    flame.position.set(x, y, ENGINE_Z - 0.065);
    flames.push(flame);
    body.add(flame);
  }

  /* --- state --------------------------------------------------------------- */

  let thrust = 0;
  let targetThrust = 0;
  let contextDimmed = false;
  const quaternion = new THREE.Quaternion();
  const normalized = new THREE.Vector3();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  const basis = new THREE.Matrix4();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();

  function applyContextOpacity() {
    const amount = shipContextOpacity(contextDimmed);
    for (const resting of materialResting) {
      const transparent = resting.transparent || contextDimmed;
      const transparencyChanged = resting.material.transparent !== transparent;
      resting.material.opacity = resting.opacity * amount;
      resting.material.transparent = transparent;
      if (transparencyChanged) resting.material.needsUpdate = true;
    }
    decals.setOpacity(amount);
  }

  return {
    group,

    setThrust(value: number) {
      targetThrust = THREE.MathUtils.clamp(value, 0, 1);
    },

    setContextDimmed(dimmed: boolean) {
      contextDimmed = dimmed;
      applyContextOpacity();
    },

    setStickers(ids: readonly string[]) {
      decals.setEarned(ids);
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
      // Smaller than the single-engine flame was: three of them together should read as
      // about as much fire as one did, not three times as much.
      const size = 0.05 + thrust * 0.07 + flicker;
      for (const flame of flames) {
        flame.scale.set(size, size, 1);
        flame.position.z = ENGINE_Z - 0.065 - thrust * 0.04;
      }
      flameMaterial.opacity =
        (0.5 + thrust * 0.4) * shipContextOpacity(contextDimmed);

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
      contextDimmed = false;
      applyContextOpacity();
      // Both, so the flame is cold on the next frame rather than easing down from a burn.
      thrust = 0;
      targetThrust = 0;
    },

    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      flameMaterial.dispose();
      flameTexture.dispose();
      decals.dispose();
    },
  };
}
