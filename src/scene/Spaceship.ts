/**
 * A small friendly spaceship, built from primitives.
 *
 * Model convention: nose points along +Z. `orient()` maps that to any direction, so a
 * future GLB replacement only needs to match the same convention.
 *
 * The silhouette follows the concept sheet in `design/spaceship.png`: cream hull, orange
 * swept wings and nose, deep purple trim, a big glass canopy and three engines. Nothing
 * is loaded from that image — it is drawn here in primitives, because at the sizes this
 * ship is ever on screen (roughly 40px parked, 130px at arrival) what reads is the
 * silhouette, the colour blocking and the glow, not panel lines.
 */

import * as THREE from 'three';
import { makeGlowTexture } from './textures';

export interface Spaceship {
  /** Positioned and oriented by the flight sequence. */
  group: THREE.Group;
  /** 0 = idle flicker, 1 = full burn. Drives the engine glow. */
  setThrust(value: number): void;
  /** Fade the parked ship while the child is looking for places on the world behind it. */
  setContextDimmed(dimmed: boolean): void;
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
const ENGINE_RING_RADIUS = 0.046;
const ENGINE_Z = -0.115;

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
 * Four swept wings in an X, plus a dorsal fin and a shorter ventral one.
 *
 * Spans are deliberately short. On the sheet the hull is the big chunky thing and the
 * wings are trim on it; at half again this size the ship reads from behind as an orange
 * starburst with a small hull somewhere inside it, which is the opposite of the design.
 */
const WINGS: Wing[] = [
  { angle: Math.PI * 0.25, span: 0.095, chord: 0.05, sweep: 0.5, lit: true },
  { angle: Math.PI * 0.75, span: 0.095, chord: 0.05, sweep: 0.5, lit: true },
  { angle: Math.PI * 1.25, span: 0.095, chord: 0.05, sweep: 0.5, lit: true },
  { angle: Math.PI * 1.75, span: 0.095, chord: 0.05, sweep: 0.5, lit: true },
  { angle: Math.PI * 0.5, span: 0.085, chord: 0.042, sweep: 0.2, lit: false },
  { angle: Math.PI * 1.5, span: 0.05, chord: 0.034, sweep: 0.35, lit: false },
];

/** Where a wing root meets the hull. */
const WING_ROOT = 0.05;
/** Wings attach around mid-body and rake back past the engines, as on the sheet. */
const WING_Z = 0.005;

export function createSpaceship(): Spaceship {
  const group = new THREE.Group();
  group.position.copy(PARK_POSITION);
  group.scale.setScalar(PARK_SCALE);
  // Inner node carries the idle bob so the outer transform stays purely flight-driven.
  const body = new THREE.Group();
  group.add(body);

  const hull = new THREE.MeshStandardMaterial({
    color: HULL,
    roughness: 0.46,
    metalness: 0.08,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: ACCENT,
    roughness: 0.38,
    metalness: 0.06,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: TRIM,
    roughness: 0.42,
    metalness: 0.12,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: METAL,
    roughness: 0.28,
    metalness: 0.7,
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

  /* --- fuselage ----------------------------------------------------------- */

  // Capsule is built along Y, so tip it onto Z.
  const fuselage = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.066, 0.13, 4, 16)), hull);
  fuselage.rotation.x = Math.PI / 2;
  body.add(fuselage);

  const nose = new THREE.Mesh(track(new THREE.ConeGeometry(0.066, 0.115, 18)), accent);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.158;
  body.add(nose);

  // Purple band where the nose meets the hull, and a metal one at the tail.
  const collar = new THREE.Mesh(track(new THREE.TorusGeometry(0.067, 0.007, 8, 24)), trim);
  collar.position.z = 0.088;
  body.add(collar);

  const tailBand = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.058, 0.05, 0.03, 18)),
    metal,
  );
  tailBand.rotation.x = Math.PI / 2;
  tailBand.position.z = -0.092;
  body.add(tailBand);

  /* --- canopy -------------------------------------------------------------- */

  const canopy = new THREE.Mesh(track(new THREE.SphereGeometry(0.058, 20, 14)), glass);
  canopy.position.set(0, 0.044, 0.05);
  canopy.scale.set(1, 0.94, 1.15);
  body.add(canopy);

  // Purple ring around the canopy base, laid flat on the hull.
  const canopyFrame = new THREE.Mesh(track(new THREE.TorusGeometry(0.055, 0.01, 8, 24)), trim);
  canopyFrame.rotation.x = Math.PI / 2;
  canopyFrame.position.set(0, 0.032, 0.05);
  canopyFrame.scale.set(1, 1.2, 1);
  body.add(canopyFrame);

  /* --- wings and fins ------------------------------------------------------ */

  // A four-sided cylinder rather than a cone: the cone tapered to a point, which read as
  // a thorn. Keeping 42% of the chord at the tip gives the blunt swept tip on the sheet.
  // Unit-sized, so each wing's scale *is* its span, chord and thickness.
  const wingGeometry = track(new THREE.CylinderGeometry(0.42, 1, 1, 4));
  const stripGeometry = track(new THREE.BoxGeometry(0.01, 0.005, 0.026));

  for (const wing of WINGS) {
    // A pivot per wing: spinning the pivot about the long axis places the wing, so the
    // blade inside only ever has to describe its own shape and rake.
    const pivot = new THREE.Group();
    pivot.rotation.z = wing.angle - Math.PI / 2;

    const blade = new THREE.Mesh(wingGeometry, accent);
    blade.scale.set(wing.chord, wing.span, wing.chord * 0.26);
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

  const housingGeometry = track(new THREE.CylinderGeometry(0.026, 0.03, 0.058, 14));
  const coreGeometry = track(new THREE.CylinderGeometry(0.019, 0.019, 0.016, 14));

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

    const housing = new THREE.Mesh(housingGeometry, trim);
    housing.rotation.x = Math.PI / 2;
    housing.position.set(x, y, ENGINE_Z);
    body.add(housing);

    const bell = new THREE.Mesh(coreGeometry, core);
    bell.rotation.x = Math.PI / 2;
    bell.position.set(x, y, ENGINE_Z - 0.022);
    body.add(bell);

    // One flame per engine, sharing the material so thrust drives all three at once.
    const flame = new THREE.Sprite(flameMaterial);
    flame.position.set(x, y, ENGINE_Z - 0.05);
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
        flame.position.z = ENGINE_Z - 0.05 - thrust * 0.04;
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
    },
  };
}
