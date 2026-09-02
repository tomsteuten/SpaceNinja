/**
 * A "collect the things" mission, written once for any destination.
 *
 * Nothing in here knows about the Moon. It takes a CelestialBody and derives everything
 * — collectible size, how far above the surface they float, hit-target size, particle
 * scale — from that body's radius, so Mars needs a definition object and no new code.
 *
 * Two placement rules carry the whole design:
 *
 *  - The collectibles are parented to the body's *anchor*, not its mesh. The anchor
 *    carries the orbit but not the spin, so they ride along with the body without
 *    slowly rotating out from under the child's finger.
 *  - Positions are angles away from wherever the camera happens to be looking when the
 *    mission starts. The last one is placed past the limb on purpose: the only way to
 *    reach it is to drag, which teaches the camera control through need rather than
 *    through a tooltip nobody in this age group can read.
 */

import * as THREE from 'three';
import type { CelestialBody } from '../scene/Bodies';
import type { QualitySettings, Tier } from '../scene/quality';
import { makeGlowTexture } from '../scene/textures';

export interface MissionDefinition {
  body: CelestialBody;
  count: number;
  /** Text on the button that starts the mission. */
  label: string;
  /** Spoken and shown once the mission begins. */
  instruction: string;
  /** Shown when only the hidden one is left, to point at the drag gesture. */
  huntLine: string;
  successLine: string;
  stickerId: string;
}

export interface CollectMission {
  readonly definition: MissionDefinition;
  /** True from start() until reset(), including through the completion celebration. */
  readonly active: boolean;
  readonly collected: number;
  /** Live list for the raycaster. Entries leave it the instant they are collected. */
  readonly hitMeshes: THREE.Mesh[];
  start(): void;
  /** Feed a raycast hit. Returns true if it was one of ours and was collected. */
  collectFrom(object: THREE.Object3D): boolean;
  update(dt: number, elapsed: number): void;
  /** Tears the mission down completely and disposes everything it built. */
  reset(): void;
  dispose(): void;
}

export interface CollectMissionOptions {
  definition: MissionDefinition;
  camera: THREE.Camera;
  quality: QualitySettings;
  reducedMotion: boolean;
  /** Fires the moment a collectible is tapped, so sound and UI land with the particles. */
  onCollect(collected: number, total: number): void;
  /** Fires once, after the last collect animation has finished. */
  onComplete(): void;
}

/** Particle counts and geometry detail follow the device tier, like everything else. */
const DETAIL: Record<Tier, { particles: number; rockDetail: number }> = {
  low: { particles: 10, rockDetail: 0 },
  medium: { particles: 18, rockDetail: 1 },
  high: { particles: 28, rockDetail: 1 },
};

/** Angle from the view axis for the ones meant to be found immediately. */
const NEAR_YAW = 0.62; // ~36°, comfortably inside the visible disc
/**
 * Angle for the ones that need a drag. The limb sits near 80-85° from the view axis at
 * arrival distance, so this is past it — but only just. Far enough to require the
 * gesture, close enough that a short drag finds it.
 */
const FAR_YAW = 2.02; // ~116°

const COLLECT_DURATION = 0.68;
const COLLECT_DURATION_REDUCED = 0.24;
/** Breathing room between the last sparkle and the celebration. */
const COMPLETION_DELAY = 0.3;

/* --- proportions ----------------------------------------------------------- */

/*
 * All four are fractions of the body's radius (or of the rock's), so a bigger
 * destination gets proportionally bigger treasure and nothing here needs a per-body
 * number. The values are the shape of the thing a child is being asked to aim at, so
 * they are worth stating once, together, rather than inline.
 */

/**
 * Collectible size. Raised from 0.13: at the old size the rock was a third the width of
 * its own halo, so what actually reached the screen was an orange smudge on the surface
 * with a pebble somewhere inside it.
 */
export const ROCK_RATIO = 0.17;
/**
 * Halo width, as a multiple of the rock's. The glow texture puts its bright core in the
 * inner 16% and fades across the rest, so much above 3 stops reading as "this rock is
 * glowing" and starts reading as "something is smeared on the lens". Was 6.2.
 */
const GLOW_RATIO = 3.2;
/** Far enough off the surface to read as hovering treasure rather than painted-on rubble. */
export const FLOAT_RATIO = 1.16;
/**
 * Hit sphere, as a multiple of the rock's radius, under a floor tied to the body itself.
 * Deliberately *not* raised alongside the rock: at the old 3.4 the larger rock puts two
 * neighbouring hit spheres on Mars into overlap, and a tap meant for one would score the
 * other. The floor is what keeps the target generous on a small body.
 */
export const HIT_RATIO = 2.4;
export const HIT_FLOOR_RATIO = 0.42;

/** The hit radius the mission will actually use for a body of this radius. */
export function hitRadiusFor(bodyRadius: number): number {
  return Math.max(bodyRadius * HIT_FLOOR_RATIO, bodyRadius * ROCK_RATIO * HIT_RATIO);
}

/* Scratch — reused by every instance, never allocated per frame. */
const _center = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();

function smootherstep(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * Yaw/pitch pairs relative to the view axis. Roughly a third of them — at least one —
 * go over the horizon; the rest fan out across the visible face.
 *
 * Exported for its unit test: this is the rule the whole "learn to drag" idea rests on,
 * and it is the one part of the mission that can be checked without a GPU.
 */
export function placementAngles(count: number): Array<[number, number]> {
  // How many we would like over the horizon, and how many are actually left for it. The
  // two diverge only at count 1, where the floor on `visible` wins and the single
  // collectible stays in plain sight - there is no drag to teach with one rock, and
  // hiding it would open the mission on an empty screen.
  const hidden = Math.max(1, Math.round(count / 3));
  const visible = Math.max(1, count - hidden);
  const angles: Array<[number, number]> = [];

  for (let i = 0; i < visible; i++) {
    const across = visible === 1 ? 0.5 : i / (visible - 1);
    // Alternating pitch keeps two neighbours off the same latitude, where one generous
    // hit sphere would otherwise sit in front of the next.
    angles.push([THREE.MathUtils.lerp(-NEAR_YAW, NEAR_YAW, across), i % 2 === 0 ? 0.34 : -0.3]);
  }
  for (let j = 0; j < count - visible; j++) {
    const sign = j % 2 === 0 ? 1 : -1;
    angles.push([sign * (FAR_YAW + j * 0.1), j % 2 === 0 ? -0.2 : 0.24]);
  }
  return angles;
}

interface Collectible {
  group: THREE.Group;
  rock: THREE.Mesh;
  rockMaterial: THREE.MeshStandardMaterial;
  glow: THREE.Sprite;
  glowMaterial: THREE.SpriteMaterial;
  particles: THREE.Points;
  particleGeometry: THREE.BufferGeometry;
  particleMaterial: THREE.PointsMaterial;
  velocities: Float32Array;
  hit: THREE.Mesh;
  hitMaterial: THREE.MeshBasicMaterial;
  /** Unit vector from the body centre, in anchor space. Bob and drift follow it. */
  outward: THREE.Vector3;
  glowScale: number;
  bobAmplitude: number;
  phase: number;
  state: 'idle' | 'collecting' | 'gone';
  t: number;
}

export function createCollectMission(options: CollectMissionOptions): CollectMission {
  const { definition, camera, quality, reducedMotion, onCollect, onComplete } = options;
  const { body, count } = definition;

  const detail = DETAIL[quality.tier];
  const collectDuration = reducedMotion ? COLLECT_DURATION_REDUCED : COLLECT_DURATION;
  const particleCount = reducedMotion
    ? Math.max(6, Math.round(detail.particles * 0.5))
    : detail.particles;

  const rockRadius = body.radius * ROCK_RATIO;
  const floatRadius = body.radius * FLOAT_RATIO;
  // Generous: aim on a moving tablet, from a five-year-old, is nothing like a mouse.
  const hitRadius = hitRadiusFor(body.radius);

  const collectibles: Collectible[] = [];
  const hitMeshes: THREE.Mesh[] = [];
  let group: THREE.Group | null = null;
  let rockGeometry: THREE.IcosahedronGeometry | null = null;
  let sparkTexture: THREE.CanvasTexture | null = null;

  let active = false;
  let collected = 0;
  let completionTimer = -1;

  function buildCollectible(index: number, yaw: number, pitch: number): Collectible {
    const geometry = rockGeometry;
    const texture = sparkTexture;
    if (!geometry || !texture) throw new Error('buildCollectible ran before build()');

    _dir
      .set(0, 0, 0)
      .addScaledVector(_forward, Math.cos(yaw) * Math.cos(pitch))
      .addScaledVector(_right, Math.sin(yaw) * Math.cos(pitch))
      .addScaledVector(_up, Math.sin(pitch))
      .normalize();

    const node = new THREE.Group();
    node.position.copy(_dir).multiplyScalar(floatRadius);

    // Warm and self-lit, so it reads as treasure even on the body's night side — but only
    // just. At 0.85 the emissive plus bloom washed the rock's own shading out completely
    // and left a featureless blob; this is dim enough that the facets still show.
    const rockMaterial = new THREE.MeshStandardMaterial({
      // Warm gold rather than the old bone white: the separation a child needs is from
      // grey regolith on the Moon and from rust on Mars, and warmth does that on both
      // where brightness alone only worked against the dark half of the body.
      color: 0xf2ddaf,
      roughness: 0.72,
      metalness: 0.05,
      emissive: new THREE.Color(0xffbb63),
      emissiveIntensity: 0.55,
      transparent: true,
    });
    const rock = new THREE.Mesh(geometry, rockMaterial);
    // Lumpy rather than a neat ball, and each one turned differently.
    rock.scale.set(1, 0.78 + (index % 3) * 0.12, 0.9);
    rock.rotation.set(index * 1.7, index * 0.9, index * 2.3);
    node.add(rock);

    const glowMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.85,
    });
    // Over 1 so it still crosses the bloom threshold, but well down from 1.5: additively
    // blended over a rock this size, the old value was most of what erased it.
    glowMaterial.color.setRGB(1.25, 0.95, 0.58);
    const glow = new THREE.Sprite(glowMaterial);
    const glowScale = rockRadius * GLOW_RATIO;
    glow.scale.setScalar(glowScale);
    node.add(glow);

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3),
    );
    const particleMaterial = new THREE.PointsMaterial({
      map: texture,
      size: rockRadius * 1.5,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    particleMaterial.color.setRGB(1.6, 1.2, 0.78);
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.visible = false;
    // Every particle starts at the origin, so the bounding sphere is a point and the
    // burst would be culled the moment it spread. Cheaper to skip the test than to
    // recompute bounds every frame.
    particles.frustumCulled = false;
    node.add(particles);

    // material.visible, not object.visible, so the raycaster still traverses it.
    const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const hit = new THREE.Mesh(new THREE.SphereGeometry(hitRadius, 10, 8), hitMaterial);
    hit.userData.collectibleIndex = index;
    node.add(hit);

    return {
      group: node,
      rock,
      rockMaterial,
      glow,
      glowMaterial,
      particles,
      particleGeometry,
      particleMaterial,
      velocities: new Float32Array(particleCount * 3),
      hit,
      hitMaterial,
      outward: _dir.clone(),
      glowScale,
      bobAmplitude: reducedMotion ? 0 : rockRadius * 0.5,
      phase: index * 1.9,
      state: 'idle',
      t: 0,
    };
  }

  function build() {
    // Basis from the camera's current view direction, expressed in anchor space so the
    // collectibles stay put relative to the body as it orbits away.
    body.getWorldPosition(_center);
    body.anchor.getWorldQuaternion(_quaternion).invert();
    _forward.copy(camera.position).sub(_center).normalize().applyQuaternion(_quaternion);
    _up.set(0, 1, 0).applyQuaternion(_quaternion);
    _right.crossVectors(_up, _forward);
    // Looking straight down the pole leaves the cross product undefined; any
    // perpendicular will do, and the arrival shot never actually gets there.
    if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0).cross(_forward);
    _right.normalize();
    _up.crossVectors(_forward, _right).normalize();

    rockGeometry = new THREE.IcosahedronGeometry(rockRadius, detail.rockDetail);
    sparkTexture = makeGlowTexture(quality.tier === 'low' ? 64 : 128);

    const root = new THREE.Group();
    const angles = placementAngles(count);
    for (let index = 0; index < angles.length; index++) {
      const pair = angles[index];
      if (!pair) continue;
      const collectible = buildCollectible(index, pair[0], pair[1]);
      collectibles.push(collectible);
      hitMeshes.push(collectible.hit);
      root.add(collectible.group);
    }
    group = root;
    body.anchor.add(root);
  }

  function beginCollect(collectible: Collectible) {
    collectible.state = 'collecting';
    collectible.t = 0;

    const positions = collectible.particleGeometry.getAttribute('position');
    const array = positions.array as Float32Array;
    const speed = body.radius * (reducedMotion ? 0.5 : 1.1);
    for (let i = 0; i < particleCount; i++) {
      const offset = i * 3;
      array[offset] = 0;
      array[offset + 1] = 0;
      array[offset + 2] = 0;
      // Even scatter over a sphere, biased outward so the burst blooms off the surface.
      const theta = Math.random() * Math.PI * 2;
      const z = Math.random() * 2 - 1;
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      const magnitude = speed * (0.35 + Math.random() * 0.65);
      collectible.velocities[offset] =
        (Math.cos(theta) * r + collectible.outward.x * 0.6) * magnitude;
      collectible.velocities[offset + 1] =
        (Math.sin(theta) * r + collectible.outward.y * 0.6) * magnitude;
      collectible.velocities[offset + 2] = (z + collectible.outward.z * 0.6) * magnitude;
    }
    positions.needsUpdate = true;
    collectible.particles.visible = true;

    // Out of the raycast list immediately: a second tap must not count twice.
    const index = hitMeshes.indexOf(collectible.hit);
    if (index >= 0) hitMeshes.splice(index, 1);

    collected++;
    onCollect(collected, count);
    if (collected >= count) completionTimer = collectDuration + COMPLETION_DELAY;
  }

  function teardown() {
    for (const collectible of collectibles) {
      collectible.group.removeFromParent();
      collectible.rockMaterial.dispose();
      collectible.glowMaterial.dispose();
      collectible.particleGeometry.dispose();
      collectible.particleMaterial.dispose();
      collectible.hit.geometry.dispose();
      collectible.hitMaterial.dispose();
    }
    collectibles.length = 0;
    hitMeshes.length = 0;
    group?.removeFromParent();
    group = null;
    // Shared across the whole set, so it is built and released with the set.
    rockGeometry?.dispose();
    rockGeometry = null;
    sparkTexture?.dispose();
    sparkTexture = null;
  }

  return {
    definition,
    hitMeshes,

    get active() {
      return active;
    },

    get collected() {
      return collected;
    },

    start() {
      if (active) return;
      active = true;
      collected = 0;
      completionTimer = -1;
      build();
    },

    collectFrom(object: THREE.Object3D) {
      const index = object.userData.collectibleIndex as number | undefined;
      if (typeof index !== 'number') return false;
      const collectible = collectibles[index];
      if (!collectible || collectible.state !== 'idle') return false;
      beginCollect(collectible);
      return true;
    },

    update(dt: number, elapsed: number) {
      if (!active) return;

      for (const collectible of collectibles) {
        if (collectible.state === 'gone') continue;

        if (collectible.state === 'idle') {
          if (!reducedMotion) {
            const wave = Math.sin(elapsed * 1.9 + collectible.phase);
            collectible.group.position
              .copy(collectible.outward)
              .multiplyScalar(floatRadius + wave * collectible.bobAmplitude);
            collectible.rock.rotation.y += dt * 0.6;
            collectible.rock.rotation.x += dt * 0.22;
            collectible.glow.scale.setScalar(collectible.glowScale * (1 + wave * 0.12));
            collectible.glowMaterial.opacity = 0.72 + wave * 0.16;
          }
          continue;
        }

        collectible.t += dt;
        const k = Math.min(1, collectible.t / collectDuration);
        const eased = smootherstep(k);

        // The rock shrinks, lifts away from the surface and fades out.
        collectible.group.position
          .copy(collectible.outward)
          .multiplyScalar(floatRadius + eased * body.radius * 0.4);
        collectible.rock.scale.setScalar(Math.max(0.001, 1 - eased));
        collectible.rock.rotation.y += dt * 4;
        collectible.rockMaterial.opacity = 1 - eased;

        // The glow flares first, then goes with it. The multiplier is up from 1.6 to hold
        // the size of the reward pop now that the resting halo is less than half as wide.
        const flare = Math.sin(Math.min(1, k * 1.7) * Math.PI);
        collectible.glow.scale.setScalar(collectible.glowScale * (1 + flare * 2.6));
        collectible.glowMaterial.opacity = 0.9 * (1 - eased);

        const positions = collectible.particleGeometry.getAttribute('position');
        const array = positions.array as Float32Array;
        // Drag, so the sparks spread fast and then hang and fade rather than flying off.
        const drag = 1 - Math.min(0.9, dt * 2.4);
        for (let i = 0; i < array.length; i++) {
          const velocity = (collectible.velocities[i] ?? 0) * drag;
          collectible.velocities[i] = velocity;
          array[i] = (array[i] ?? 0) + velocity * dt;
        }
        positions.needsUpdate = true;
        collectible.particleMaterial.opacity = 1 - eased;

        if (k >= 1) {
          collectible.state = 'gone';
          collectible.group.visible = false;
        }
      }

      if (completionTimer > 0) {
        completionTimer -= dt;
        if (completionTimer <= 0) {
          completionTimer = -1;
          onComplete();
        }
      }
    },

    reset() {
      teardown();
      active = false;
      collected = 0;
      completionTimer = -1;
    },

    dispose() {
      this.reset();
    },
  };
}
