/**
 * Finding real places on a destination, written once for any of them.
 *
 * Nothing in here knows about the Moon. It takes a CelestialBody and derives everything
 * — marker size, hit-target size, particle scale — from that body's radius, so Mars needs
 * a definition object and no new code.
 *
 * Two placement rules carry the whole design:
 *
 *  - Markers sit at their features' real coordinates and are parented to the body's
 *    *surface*, which is held still for the visit. That is what makes the ring a child
 *    taps genuinely be on Tycho's rays rather than somewhere plausible, and it is the
 *    whole difference between this and the collectibles it replaced: a rock could be
 *    anywhere, so finding one taught nothing about where you were.
 *  - The body is turned on arrival so that all but the last discovery face the camera.
 *    The last is left over the horizon, so the only way to reach it is to drag — which
 *    teaches the camera control through need rather than through a tooltip nobody in
 *    this age group can read. On the Moon that one is the far side, where having to go
 *    around to see it *is* the fact.
 */

import * as THREE from 'three';
import type { Discovery } from '../config';
import type { CelestialBody } from '../scene/Bodies';
import type { QualitySettings, Tier } from '../scene/quality';
import { makeEmojiTexture, makeGlowTexture } from '../scene/textures';

export interface MissionDefinition {
  body: CelestialBody;
  /** Shown once the mission begins. */
  instruction: string;
  /** Shown when only the hidden one is left, to point at the drag gesture. */
  huntLine: string;
  successLine: string;
  stickerId: string;
  /** The real places on this body. The last one is the one that needs a drag. */
  discoveries: Discovery[];
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
  /**
   * Which way the last unfound discovery lies, for the hint arrow.
   *
   * Null unless exactly one is left, because before that a child has something to tap on
   * screen and does not need pointing anywhere. `visible` is the same visible-face test a
   * tap has to pass, so the arrow disappears the instant the place could be tapped — an
   * arrow still pointing at something already on screen is just clutter.
   */
  remainingHint(): { side: -1 | 1; visible: boolean } | null;
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
  /**
   * Fires the moment a marker is tapped, so sound and UI land with the particles.
   *
   * `at` is where the marker was on screen, in normalised device coordinates (-1..1, y
   * up) — the only screen unit a module holding a camera and no canvas can honestly
   * report. The caller turns it into pixels. It is there so the answer to a tap can
   * appear *at the thing tapped*: the fact card is at the bottom of the screen, hundreds
   * of pixels away, and for a child who cannot yet read there was nothing at all
   * connecting the dot they touched to the words that changed.
   */
  onCollect(
    discovery: Discovery,
    found: number,
    total: number,
    at: { x: number; y: number },
  ): void;
  /** Fires once, after the last collect animation has finished. */
  onComplete(): void;
}

/** Particle counts and geometry detail follow the device tier, like everything else. */
const DETAIL: Record<Tier, { particles: number; ringSegments: number }> = {
  low: { particles: 10, ringSegments: 24 },
  medium: { particles: 18, ringSegments: 36 },
  high: { particles: 28, ringSegments: 48 },
};

const COLLECT_DURATION = 0.68;
const COLLECT_DURATION_REDUCED = 0.24;
/** Breathing room between the last sparkle and the celebration. */
const COMPLETION_DELAY = 0.3;

/* --- proportions ----------------------------------------------------------- */

/*
 * All four are fractions of the body's radius (or of the marker's), so a bigger
 * destination gets a proportionally bigger marker and nothing here needs a per-body
 * number. The values are the shape of the thing a child is being asked to aim at, so
 * they are worth stating once, together, rather than inline.
 */

/**
 * Marker size. Was 0.17, as a gold rock floating above the surface — which was tuned for
 * a camera nine radii out and became a flat-shaded crystal the size of a small country
 * once the flight started arriving at three. It is a target drawn *on* the ground now,
 * so the number is the size of a place rather than of an object. The opaque silhouette
 * carries visual legibility and the much larger invisible hit sphere carries touch ease.
 */
export const MARKER_RATIO = 0.085;
/**
 * Halo width, as a multiple of the marker's. The target shape carries the instruction now;
 * this is only enough glow to find it on the dark side. A broad warm additive disc was
 * read as sunlight on a phone. Was 3.2 after first coming down from 6.2.
 */
const GLOW_RATIO = 2.2;
/**
 * The found badge, as a multiple of the marker's radius. Bigger than the ring it replaces,
 * because a ring only has to be *seen* and an emoji has to be *read* — at arrival distance
 * a badge the size of the ring is a coloured speck, and the whole point of it is that a
 * child can tell the desert from the rainforest at a glance.
 */
const BADGE_RATIO = 2.1;
/**
 * How far off the surface the ring sits. Barely: it is meant to be lying on the ground,
 * and it only clears it at all to stay out of a z-fight with the sphere underneath.
 */
export const FLOAT_RATIO = 1.008;
/**
 * Hit sphere, as a multiple of the marker's radius, under a floor tied to the body
 * itself. The floor is doing all the work now that the marker is small, and it is what
 * keeps the target big enough for a five-year-old's aim on a moving tablet — it is
 * deliberately many times the size of the thing it is drawn around.
 */
export const HIT_RATIO = 2.4;
export const HIT_FLOOR_RATIO = 0.42;

/** The hit radius the mission will actually use for a body of this radius. */
export function hitRadiusFor(bodyRadius: number): number {
  return Math.max(bodyRadius * HIT_FLOOR_RATIO, bodyRadius * MARKER_RATIO * HIT_RATIO);
}

/**
 * Is a marker on the face the camera can actually see?
 *
 * `alignment` is how far the marker's own outward direction points at the camera, from 1
 * (dead centre of the disc) through 0 (on the limb as seen from infinitely far) to -1
 * (directly opposite). A sphere of radius r seen from distance d hides everything beyond
 * acos(r / d), so that ratio is the cut, times a little slack to keep a marker sitting
 * right on the limb tappable.
 *
 * This exists because the hit spheres are deliberately enormous — many times the marker
 * they surround, so a five-year-old's aim on a tablet is enough — and the raycast tests
 * only those spheres. It has no idea the planet is in between. On Earth the Sahara and
 * the hidden night-side marker land within thirty pixels of each other at arrival, one in
 * front of the globe and one behind it, so tapping the Sahara and then tapping the same
 * spot again reached straight through the planet and collected the one place the whole
 * design wants a child to have to go and look for.
 */
export function withinVisibleFace(
  alignment: number,
  bodyRadius: number,
  cameraDistance: number,
): boolean {
  if (cameraDistance <= bodyRadius) return true; // Inside the body; nothing is occluded.
  return alignment > (bodyRadius / cameraDistance) * 0.85;
}

/* Scratch — reused by every instance, never allocated per frame. */
const _center = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _view = new THREE.Vector3();
const _screen = new THREE.Vector3();
const _right = new THREE.Vector3();
/** The plane RingGeometry is built in, and so the axis every marker is turned off. */
const FACE = new THREE.Vector3(0, 0, 1);

function smootherstep(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Wraps to (-pi, pi], so "170 degrees east" reads as a short turn one way, not a long one. */
function wrapPi(radians: number): number {
  return radians - Math.PI * 2 * Math.floor((radians + Math.PI) / (Math.PI * 2));
}

/**
 * Mean of a set of longitudes, taken as directions rather than as numbers. Averaging
 * -170 and 170 arithmetically gives 0, which is the opposite side of the body from both.
 */
function meanLongitude(longitudes: number[]): number {
  let x = 0;
  let y = 0;
  for (const longitude of longitudes) {
    const radians = THREE.MathUtils.degToRad(longitude);
    x += Math.cos(radians);
    y += Math.sin(radians);
  }
  return THREE.MathUtils.radToDeg(Math.atan2(y, x));
}

/**
 * The longitude the body is turned to face the camera with on arrival.
 *
 * Every discovery but the last should be in view when the child gets there, so the body
 * is turned to the average of *their* longitudes. Nothing here invents a position: the
 * discoveries sit at their real coordinates and only the body's rotation is chosen, which
 * is the one thing about a spinning body that was arbitrary anyway. A real mission times
 * its arrival for the same reason.
 */
export function facingLongitude(discoveries: Discovery[]): number {
  return meanLongitude(inView(discoveries).map((discovery) => discovery.lon));
}

/** With one there is no drag to teach and nothing to hide it from, so it faces directly. */
function inView(discoveries: Discovery[]): Discovery[] {
  return discoveries.length > 1 ? discoveries.slice(0, -1) : discoveries;
}

/**
 * The latitude the flight should arrive over, in degrees.
 *
 * A body can only be turned about its own axis, so `facingLongitude` can bring a feature
 * round to the camera but can never raise or lower it. The camera has to do that half.
 * Without it the arrival direction is dominated by the Sun, which sits 33 degrees up, and
 * the Moon's two near-side places — one on the equator and one at 43 south — both landed
 * squashed against the bottom limb, under the dock, at the least tappable part of the
 * whole disc.
 */
export function facingLatitude(discoveries: Discovery[]): number {
  const visible = inView(discoveries);
  if (visible.length === 0) return 0;
  return visible.reduce((total, d) => total + d.lat, 0) / visible.length;
}

/**
 * Yaw/pitch pairs relative to the view axis, one per discovery, once the body has been
 * turned to `facingLongitude`. Yaw is the longitude difference and pitch is simply the
 * latitude, because the body is only ever turned about its own axis.
 *
 * Exported for its unit test: the rule that at least one discovery starts over the
 * horizon is what teaches the drag gesture, and it used to be guaranteed by construction.
 * It is now a property of real coordinates, which is exactly why it needs checking.
 */
export function placementAngles(discoveries: Discovery[]): Array<[number, number]> {
  const facing = facingLongitude(discoveries);
  return discoveries.map((discovery) => [
    wrapPi(THREE.MathUtils.degToRad(discovery.lon - facing)),
    THREE.MathUtils.degToRad(discovery.lat),
  ]);
}

/**
 * Unit vector for a latitude/longitude on the body's own surface, in the surface mesh's
 * local space.
 *
 * This is the inverse of what THREE.SphereGeometry does to its UVs: it starts its wrap at
 * -X and runs anticlockwise, and an equirectangular map puts 180° west at u=0, which
 * together put the prime meridian on +X. Getting this wrong does not throw — it silently
 * lands every marker on the wrong part of the map — so it is checked against the real
 * texture by eye, and against a handful of known bearings in the test.
 */
export function surfaceDirection(lat: number, lon: number): THREE.Vector3 {
  const latitude = THREE.MathUtils.degToRad(lat);
  const longitude = THREE.MathUtils.degToRad(lon);
  const cosLat = Math.cos(latitude);
  return new THREE.Vector3(
    cosLat * Math.cos(longitude),
    Math.sin(latitude),
    -cosLat * Math.sin(longitude),
  );
}

/** The body's own axis, in surface-local space — the way a ring marker's disc faces. */
const AXIS = new THREE.Vector3(0, 1, 0);

export interface MarkerPlacement {
  /** Local position in the surface mesh's space. */
  position: THREE.Vector3;
  /** Which way the flat bullseye faces: outward for a surface place, along the axis for a
   *  ring one (so it lies in the ring plane rather than standing up out of it). */
  faceNormal: THREE.Vector3;
}

/**
 * Where a discovery's marker sits, and which way it faces, in the surface mesh's space.
 *
 * Two cases, and the ring one is the whole reason this is a function rather than two lines
 * inline. A surface place floats just above its lat/lon on the sphere and faces outward. A
 * ring place (Saturn only) is put out in the equatorial plane — `lat` ignored, `lon` only
 * choosing the direction round — at `ring` body-radii from the centre, lying flat in the
 * plane. Because it is at latitude zero, the surface's own y-rotation still carries it round
 * to the camera exactly like every other marker, so nothing downstream has to know.
 */
export function markerPlacement(discovery: Discovery, bodyRadius: number): MarkerPlacement {
  if (discovery.ring !== undefined) {
    const direction = surfaceDirection(0, discovery.lon);
    return {
      position: direction.multiplyScalar(discovery.ring * bodyRadius),
      faceNormal: AXIS.clone(),
    };
  }
  const direction = surfaceDirection(discovery.lat, discovery.lon);
  return {
    position: direction.clone().multiplyScalar(bodyRadius * FLOAT_RATIO),
    faceNormal: direction,
  };
}

interface Collectible {
  discovery: Discovery;
  group: THREE.Group;
  /** Opaque bullseye silhouette. The halo is deliberately not the thing that names it. */
  target: THREE.Group;
  ringMaterial: THREE.MeshBasicMaterial;
  outlineMaterial: THREE.MeshBasicMaterial;
  glow: THREE.Sprite;
  glowMaterial: THREE.SpriteMaterial;
  /** The emoji left on the place once it is found. Hidden until then. */
  badge: THREE.Sprite;
  badgeMaterial: THREE.SpriteMaterial;
  badgeTexture: THREE.CanvasTexture;
  badgeScale: number;
  particles: THREE.Points;
  particleGeometry: THREE.BufferGeometry;
  particleMaterial: THREE.PointsMaterial;
  velocities: Float32Array;
  hit: THREE.Mesh;
  hitMaterial: THREE.MeshBasicMaterial;
  /** Unit vector from the body centre, in surface space. The burst follows it. */
  outward: THREE.Vector3;
  glowScale: number;
  phase: number;
  state: 'idle' | 'collecting' | 'gone';
  t: number;
}

export function createCollectMission(options: CollectMissionOptions): CollectMission {
  const { definition, camera, quality, reducedMotion, onCollect, onComplete } = options;
  const { body, discoveries } = definition;
  const count = discoveries.length;

  const detail = DETAIL[quality.tier];
  const collectDuration = reducedMotion ? COLLECT_DURATION_REDUCED : COLLECT_DURATION;
  const particleCount = reducedMotion
    ? Math.max(6, Math.round(detail.particles * 0.5))
    : detail.particles;

  const markerRadius = body.radius * MARKER_RATIO;
  // Generous: aim on a moving tablet, from a five-year-old, is nothing like a mouse.
  const hitRadius = hitRadiusFor(body.radius);

  const collectibles: Collectible[] = [];
  const hitMeshes: THREE.Mesh[] = [];
  let group: THREE.Group | null = null;
  let ringGeometry: THREE.RingGeometry | null = null;
  let innerRingGeometry: THREE.RingGeometry | null = null;
  let outlineGeometry: THREE.RingGeometry | null = null;
  let sparkTexture: THREE.CanvasTexture | null = null;

  let active = false;
  let collected = 0;
  let completionTimer = -1;

  function buildCollectible(index: number, discovery: Discovery): Collectible {
    const geometry = ringGeometry;
    const innerGeometry = innerRingGeometry;
    const backingGeometry = outlineGeometry;
    const texture = sparkTexture;
    if (!geometry || !innerGeometry || !backingGeometry || !texture) {
      throw new Error('buildCollectible ran before build()');
    }

    // Straight from the feature's real coordinates. The marker is a child of the surface
    // mesh, so this lands it on the actual place in the actual map and keeps it there — or,
    // for a ring discovery, out in the equatorial plane at its radius. See markerPlacement.
    const placement = markerPlacement(discovery, body.radius);
    // The radial (outward-in-plane) direction, reused for the target's facing on a surface
    // marker and for the particle burst on both.
    _dir.copy(placement.position).normalize();

    const node = new THREE.Group();
    node.position.copy(placement.position);

    /*
     * A target, not a light. The old warm additive ring plus a broad additive halo looked
     * exactly like sunlight on Earth. Warmth still separates it from grey Moon and rusty
     * Mars, but an opaque double ring and dark keyline now carry a bullseye silhouette on
     * both day and night sides.
     */
    const target = new THREE.Group();
    target.quaternion.setFromUnitVectors(FACE, placement.faceNormal);
    target.renderOrder = 1;
    node.add(target);

    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x21143f,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    target.add(new THREE.Mesh(backingGeometry, outlineMaterial));

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffbd45,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geometry, ringMaterial);
    ring.position.z = markerRadius * 0.006;
    target.add(ring);
    const innerRing = new THREE.Mesh(innerGeometry, ringMaterial);
    innerRing.position.z = markerRadius * 0.006;
    target.add(innerRing);

    const glowMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.28,
    });
    // Below the bloom threshold so it cannot become a second little Sun. The opaque target
    // remains legible even on the low tier where bloom is absent.
    glowMaterial.color.setRGB(1, 0.66, 0.2);
    const glow = new THREE.Sprite(glowMaterial);
    const glowScale = markerRadius * GLOW_RATIO;
    glow.scale.setScalar(glowScale);
    glow.renderOrder = 0;
    node.add(glow);

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3),
    );
    const particleMaterial = new THREE.PointsMaterial({
      map: texture,
      size: markerRadius * 1.5,
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

    /*
     * The badge: this place's own emoji, left standing on it once it is found.
     *
     * Before this, every marker was an identical gold ring and every one of them vanished
     * on being tapped, so a finished planet looked exactly like an untouched one and
     * nothing on screen ever said which dot had been the desert. Reported plainly from a
     * tablet: "random yellow dots with no real educational value". The badge is the fix —
     * the planet becomes a labelled map of the places a child went and looked at.
     *
     * Hidden while the marker is idle, because showing it up front would answer the
     * question the hunt is asking. Not additive: it is a picture, not a light.
     */
    const badgeTexture = makeEmojiTexture(discovery.emoji, quality.tier === 'low' ? 64 : 128);
    const badgeMaterial = new THREE.SpriteMaterial({
      map: badgeTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const badge = new THREE.Sprite(badgeMaterial);
    const badgeScale = markerRadius * BADGE_RATIO;
    badge.scale.setScalar(badgeScale);
    badge.visible = false;
    node.add(badge);

    // material.visible, not object.visible, so the raycaster still traverses it.
    const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const hit = new THREE.Mesh(new THREE.SphereGeometry(hitRadius, 10, 8), hitMaterial);
    hit.userData.collectibleIndex = index;
    node.add(hit);

    return {
      discovery,
      group: node,
      target,
      ringMaterial,
      outlineMaterial,
      glow,
      glowMaterial,
      badge,
      badgeMaterial,
      badgeTexture,
      badgeScale,
      particles,
      particleGeometry,
      particleMaterial,
      velocities: new Float32Array(particleCount * 3),
      hit,
      hitMaterial,
      outward: _dir.clone(),
      glowScale,
      phase: index * 1.9,
      state: 'idle',
      t: 0,
    };
  }

  function build() {
    // Turn the body so the discoveries meant to be found first are facing the camera.
    // Everything sits at its real coordinates; only the rotation is chosen, and only
    // about the body's own axis, so latitudes and the angles *between* features are
    // untouched. See facingLongitude.
    //
    // The camera direction is taken in the surface's parent space, where the surface's
    // own rotation is a plain turn about Y — the orbital tilt above it is a fixed
    // rotation that would otherwise have to be undone by hand.
    const parent = body.surface.parent ?? body.surface;
    body.getWorldPosition(_center);
    _forward.copy(camera.position);
    parent.worldToLocal(_forward);
    _forward.sub(parent.worldToLocal(_center.clone())).normalize();

    const facing = THREE.MathUtils.degToRad(facingLongitude(discoveries));
    // surfaceDirection puts longitude L at atan2(x, z) = pi/2 + L, and a turn of theta
    // about Y adds theta to that, so this is the turn that brings `facing` round to the
    // camera.
    body.surface.rotation.y = Math.atan2(_forward.x, _forward.z) - Math.PI / 2 - facing;
    // And stop it turning. The markers are children of the surface, so an unheld body
    // would carry them out from under a child's finger part-way through the hunt — and
    // the Moon's surface counter-rotates against its own orbit, so "stationary" is not
    // something either of them does on its own.
    body.holdSurface();

    ringGeometry = new THREE.RingGeometry(
      markerRadius * 0.66,
      markerRadius,
      detail.ringSegments,
    );
    innerRingGeometry = new THREE.RingGeometry(
      markerRadius * 0.18,
      markerRadius * 0.34,
      detail.ringSegments,
    );
    outlineGeometry = new THREE.RingGeometry(
      markerRadius * 0.58,
      markerRadius * 1.12,
      detail.ringSegments,
    );
    sparkTexture = makeGlowTexture(quality.tier === 'low' ? 64 : 128);

    const root = new THREE.Group();
    for (const [index, discovery] of discoveries.entries()) {
      const collectible = buildCollectible(index, discovery);
      collectibles.push(collectible);
      hitMeshes.push(collectible.hit);
      root.add(collectible.group);
    }
    group = root;
    body.surface.add(root);
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
    // Where it is on screen, right now, before the burst moves anything. NDC, because
    // this module has a camera and no idea how big the canvas is.
    collectible.group.getWorldPosition(_screen).project(camera);
    onCollect(collectible.discovery, collected, count, { x: _screen.x, y: _screen.y });
    if (collected >= count) completionTimer = collectDuration + COMPLETION_DELAY;
  }

  function teardown() {
    // The mission asked for the hold in build(), so the mission gives it back. Without
    // this, flying home would leave the destination frozen for the rest of the session.
    body.releaseSurface();
    for (const collectible of collectibles) {
      collectible.group.removeFromParent();
      collectible.ringMaterial.dispose();
      collectible.outlineMaterial.dispose();
      collectible.glowMaterial.dispose();
      collectible.badgeMaterial.dispose();
      // Its own canvas texture, one per discovery, so it is the mission's to free.
      collectible.badgeTexture.dispose();
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
    ringGeometry?.dispose();
    ringGeometry = null;
    innerRingGeometry?.dispose();
    innerRingGeometry = null;
    outlineGeometry?.dispose();
    outlineGeometry = null;
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

      // Not one on the far side, reached through the body. See withinVisibleFace.
      body.getWorldPosition(_center);
      collectible.hit.getWorldPosition(_dir).sub(_center).normalize();
      _view.copy(camera.position).sub(_center);
      const distance = _view.length();
      if (!withinVisibleFace(_dir.dot(_view.divideScalar(distance)), body.radius, distance)) {
        return false;
      }

      beginCollect(collectible);
      return true;
    },

    remainingHint() {
      if (!active) return null;
      const left = collectibles.filter((collectible) => collectible.state === 'idle');
      const last = left.length === 1 ? left[0] : undefined;
      if (!last) return null;

      body.getWorldPosition(_center);
      last.hit.getWorldPosition(_dir).sub(_center).normalize();
      _view.copy(camera.position).sub(_center);
      const distance = _view.length();
      const visible = withinVisibleFace(
        _dir.dot(_view.clone().divideScalar(distance)),
        body.radius,
        distance,
      );

      /*
       * Which side of the screen it is round towards.
       *
       * Column 0 of the camera's world matrix is its right vector, so this is simply "is
       * the place to the right of where we are looking". Dragging right turns the planet
       * so that whatever is round to the *left* comes to the middle, so an arrow pointing
       * at the place is also pointing at the edge the child should be pulling from — the
       * gesture a hand makes on a globe.
       */
      _right.setFromMatrixColumn(camera.matrixWorld, 0);
      return { side: _dir.dot(_right) < 0 ? (-1 as const) : (1 as const), visible };
    },

    update(dt: number, elapsed: number) {
      if (!active) return;

      for (const collectible of collectibles) {
        if (collectible.state === 'gone') continue;

        if (collectible.state === 'idle') {
          if (!reducedMotion) {
            // The ring itself no longer bobs — it is lying on the ground, and something
            // drawn on a place should stay on it. The pulse carries the "tap me" instead.
            const wave = Math.sin(elapsed * 1.9 + collectible.phase);
            collectible.target.scale.setScalar(1 + wave * 0.07);
            collectible.ringMaterial.opacity = 0.78 + wave * 0.22;
            collectible.outlineMaterial.opacity = 0.82 + wave * 0.08;
            collectible.glow.scale.setScalar(collectible.glowScale * (1 + wave * 0.08));
            collectible.glowMaterial.opacity = 0.2 + wave * 0.08;
          }
          continue;
        }

        collectible.t += dt;
        const k = Math.min(1, collectible.t / collectDuration);
        const eased = smootherstep(k);

        // The ring opens outward and fades, like something being marked found rather
        // than something being picked up: the place stays, the marker on it does not.
        collectible.target.scale.setScalar(1 + eased * 2.2);
        collectible.ringMaterial.opacity = 1 - eased;
        collectible.outlineMaterial.opacity = 1 - eased;

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

        // The badge arrives as the ring leaves, so the marker turns into its own label
        // rather than blinking out and being replaced. It overshoots and settles, which is
        // the one bit of "you got it" left on the planet itself.
        collectible.badge.visible = true;
        const pop = smootherstep(Math.min(1, k * 1.5));
        collectible.badgeMaterial.opacity = pop;
        collectible.badge.scale.setScalar(
          collectible.badgeScale * (0.4 + pop * 0.72 + Math.sin(pop * Math.PI) * 0.22),
        );

        if (k >= 1) {
          collectible.state = 'gone';
          // Not group.visible = false any more: the group is what carries the badge, and
          // the badge is the whole point — a finished planet used to look identical to an
          // untouched one. The parts that *are* finished get hidden individually.
          collectible.target.visible = false;
          collectible.glow.visible = false;
          collectible.particles.visible = false;
          collectible.badgeMaterial.opacity = 1;
          collectible.badge.scale.setScalar(collectible.badgeScale);
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
