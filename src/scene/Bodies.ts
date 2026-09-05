/**
 * The Sun, the Earth (with its atmosphere) and the Moon, plus the lights.
 *
 * Everything is built from Three.js primitives and the textures resolved in
 * textures.ts, so swapping in real maps or GLB models later touches only this file.
 */

import * as THREE from 'three';
import {
  EARTH_RADIUS,
  EARTH_SPIN,
  MARS_ORBIT_RADIUS,
  MARS_ORBIT_SPEED,
  MARS_ORBIT_TILT,
  MARS_RADIUS,
  MARS_SPIN,
  MARS_START_ANGLE,
  MOON_ORBIT_RADIUS,
  MOON_ORBIT_SPEED,
  MOON_ORBIT_TILT,
  MOON_RADIUS,
  MOON_START_ANGLE,
  SATURN_AXIAL_TILT,
  SATURN_ORBIT_RADIUS,
  SATURN_ORBIT_SPEED,
  SATURN_ORBIT_TILT,
  SATURN_RADIUS,
  SATURN_RING_INNER_RATIO,
  SATURN_RING_OUTER_RATIO,
  SATURN_SPIN,
  SATURN_START_ANGLE,
  SUN_DIRECTION,
  SUN_POSITION,
  SUN_RADIUS,
} from '../config';
import {
  makeGlowTexture,
  makeMarsTexture,
  makeMoonTexture,
  makeRingTexture,
  makeSaturnRingTexture,
  makeSaturnTexture,
  makeSunTexture,
  resolveEarthMaps,
  resolveOptionalTexture,
  resolveTexture,
} from './textures';
import type { QualitySettings } from './quality';

export type BodyId = 'earth' | 'moon' | 'mars' | 'saturn';

/** Long enough to read as a reveal, short enough not to hold up the next choice. */
export const WORLD_REVEAL_DURATION = 0.9;

/** Exported because the endpoints and clamp are the parts a silent frame-rate bug breaks. */
export function worldRevealEase(progress: number): number {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  return t * t * (3 - 2 * t);
}

export interface CelestialBody {
  id: BodyId;
  label: string;
  radius: number;
  /**
   * The radius the flight and the framing should fit, when it is larger than the body
   * itself. Only Saturn sets it — its rings reach out to 2.3 radii, and framing on the
   * sphere alone would put the very thing that makes it Saturn off the edge of the shot.
   * Everything that is about the *body* (marker size, the hit sphere, the day-turn) still
   * uses `radius`; callers that are about the *shot* use `viewRadius ?? radius`.
   */
  viewRadius?: number;
  /** Object whose world position is the centre of the body. */
  anchor: THREE.Object3D;
  /**
   * The textured sphere itself. Anything parented to this is fixed to the map, which is
   * what lets a marker be *on* a named feature rather than near one; its rotation about
   * Y is the body's own turn, and nothing above it in the chain turns.
   */
  surface: THREE.Object3D;
  /** Invisible, generously sized sphere used for tap targeting. */
  hitMesh: THREE.Mesh;
  /**
   * Stop the body turning, holding the surface exactly where it is now.
   *
   * The surface has to be still to be explored: a marker on a rotating one slides out
   * from under the finger reaching for it. What is held is the body's orientation against
   * the stars, not its local rotation — the Moon's surface rides its orbit rather than
   * turning on its own, so the local value alone says nothing about whether it is moving.
   */
  holdSurface(): void;
  /** Let it turn again, from wherever it was held. */
  releaseSurface(): void;
  /**
   * Turn a held surface by this much, in radians about its own axis.
   *
   * Only meaningful while the surface is held: `update` reproduces the held value every
   * frame, so this moves the value it reproduces. On an unheld body the rotation is
   * already being driven and this does nothing rather than fight it.
   */
  turnSurface(delta: number): void;
  getWorldPosition(target: THREE.Vector3): THREE.Vector3;
}

export interface World {
  group: THREE.Group;
  bodies: Record<BodyId, CelestialBody>;
  /**
   * The tap targets for the bodies currently on screen. Hidden bodies drop out of it, so a
   * world that has not been revealed yet cannot be selected through where it would have been.
   */
  hitMeshes: THREE.Mesh[];
  /**
   * Draw only these bodies; hide the rest (and drop their tap targets). A hidden body keeps
   * orbiting — this is visibility, not a freeze — so revealing it later does not teleport it.
   * The caller drives this from progress; the world holds no opinion about who has been where.
   */
  /**
   * Show exactly these worlds. Newly shown worlds can arrive as a short, non-blocking
   * reveal; returns their ids so the interface can announce the same event.
   */
  setRevealed(ids: Iterable<BodyId>, animate?: boolean): BodyId[];
  setSelected(id: BodyId | null): void;
  /** 0 freezes the Moon mid-orbit so the flight has a stationary destination. */
  setOrbitSpeedScale(scale: number): void;
  update(dt: number, elapsed: number, camera: THREE.Camera): void;
  /**
   * Back to the opening state for "explore again". Orbits are deliberately *not* wound
   * back: the bodies have kept moving, and pretending otherwise would teleport them.
   */
  reset(): void;
  dispose(): void;
}

/**
 * Fresnel shell: bright at the limb, invisible face-on, brightest on the lit side.
 *
 * Its own segment counts, not the body's. This is an unlit additive shell — far cheaper
 * per triangle than the Earth it wraps — and it is the *silhouette*, so its facets are
 * the ones that show when a child zooms all the way in. At the body's 64 the limb was a
 * visible polygon.
 */
function createAtmosphere(radius: number, segments: [number, number]): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(
    radius * 1.035,
    Math.max(96, segments[0]),
    Math.max(48, segments[1]),
  );
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(0x74b6ff) },
      uSunDir: { value: SUN_DIRECTION.clone() },
      // Down from 1.7. Against the stylised procedural Earth this read as haze; against a
      // photographic one, whose oceans are much darker, the same value read as a drawn-on
      // blue outline — most obviously in portrait, where Earth is small and the ring is
      // still a full pixel or two wide.
      uIntensity: { value: 1.05 },
    },
    vertexShader: `
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vPosW = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uSunDir;
      uniform float uIntensity;
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vPosW);
        // abs() because we render back faces: the far hemisphere reads as facing away.
        // The exponent is what decides ring-versus-haze: 2.4 kept the whole effect inside
        // a couple of pixels at the limb, which is the shape of an outline. 1.7 lets it
        // bleed inward over the disc, so it reads as air with depth to it.
        float rim = pow(1.0 - abs(dot(viewDir, vNormalW)), 1.7);
        float lit = clamp(dot(vNormalW, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
        float a = rim * uIntensity * (0.18 + 0.95 * pow(lit, 1.5));
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
  });
  return new THREE.Mesh(geometry, material);
}

/**
 * How bright the cities burn. Tuned so they read clearly against the night side without
 * crossing the bloom threshold — a bloomed city map turns the dark hemisphere into an
 * orange smear and undoes the point of it.
 */
const NIGHT_LIGHT_INTENSITY = 0.85;

/**
 * City lights on Earth's night side.
 *
 * A plain emissiveMap would light the cities in broad daylight too: emissive is added
 * after shading and knows nothing about where the Sun is, so the day side would carry a
 * grey haze of streetlights over it. So the emissive term is masked by the same sun
 * direction the rest of the scene is lit from — full past the terminator, gone before
 * the sunlit side starts, with the crossover wide enough to read as dusk rather than as
 * a drawn line.
 *
 * Uses the raw `normal` attribute rather than the shader's own transformed normal so the
 * mask is in world space, which is what SUN_DIRECTION is in. Earth has no skinning or
 * morph targets for that to skip over.
 */
function applyNightLights(material: THREE.MeshStandardMaterial, nightMap: THREE.Texture): void {
  material.emissiveMap = nightMap;
  // totalEmissiveRadiance starts at the emissive colour and is *multiplied* by the map,
  // so this has to be non-black or the map cannot show at all.
  material.emissive = new THREE.Color(0xffffff);
  material.emissiveIntensity = NIGHT_LIGHT_INTENSITY;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDirection = { value: SUN_DIRECTION.clone() };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vNightNormal;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvNightNormal = normalize(mat3(modelMatrix) * normal);',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vNightNormal;\nuniform vec3 uSunDirection;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `
        #ifdef USE_EMISSIVEMAP
          vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
          float night = smoothstep(0.12, -0.20, dot(normalize(vNightNormal), uSunDirection));
          totalEmissiveRadiance *= emissiveColor.rgb * night;
        #endif
        `,
      );
  };

  // The program source no longer matches what the material's own parameters describe, so
  // it needs a cache key of its own or an identical-looking material could reuse it.
  material.customProgramCacheKey = () => 'earth-night-lights';
  material.needsUpdate = true;
}

function createSelectionRing(texture: THREE.Texture, diameter: number): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.9,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(diameter);
  sprite.visible = false;
  sprite.renderOrder = 3;
  return sprite;
}

function createHitMesh(radius: number): THREE.Mesh {
  // material.visible (not object.visible) so the raycaster still traverses it.
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  return mesh;
}

/**
 * The three-node rig every orbiting body uses: a tilt group so its path is not flat, a
 * spin group carrying the orbit angle, and an anchor out at the orbit radius. Children of
 * the anchor ride the orbit without inheriting the body's own rotation - which is what
 * lets the ship park on it and the collectibles stay put under a child's finger.
 */
interface OrbitingBody {
  tilt: THREE.Group;
  spin: THREE.Group;
  anchor: THREE.Group;
  mesh: THREE.Mesh;
  ring: THREE.Sprite;
  hit: THREE.Mesh;
  ringScale: number;
}

function createOrbitingBody(options: {
  id: BodyId;
  radius: number;
  orbitRadius: number;
  orbitTilt: number;
  startAngle: number;
  map: THREE.Texture;
  roughness: number;
  segments: [number, number];
  ringTexture: THREE.Texture;
}): OrbitingBody {
  const tilt = new THREE.Group();
  tilt.rotation.x = options.orbitTilt;
  const spin = new THREE.Group();
  spin.rotation.y = options.startAngle;
  const anchor = new THREE.Group();
  anchor.position.x = options.orbitRadius;

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(options.radius, options.segments[0], options.segments[1]),
    new THREE.MeshStandardMaterial({
      map: options.map,
      roughness: options.roughness,
      metalness: 0,
      /*
       * A trace of the body's own map, added after shading, so the night side is dim
       * rather than absolutely black.
       *
       * The far side of the Moon is one of the three places a child is sent to find, and
       * it is 120 degrees round from an arrival that is deliberately on the sunlit side,
       * which put it in full shadow: the marker glowed there beautifully and the crater it
       * was marking could not be seen at all. Raising the scene's hemisphere fill would
       * have done it too, but that also lifts Earth's night side, and the city lights are
       * only legible because it is dark.
       *
       * 0.055 is a twentieth of the map, against a Sun at 2.7 — invisible on the lit side,
       * and the difference between black and faint relief on the other.
       */
      emissiveMap: options.map,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.055,
    }),
  );
  const ringScale = options.radius * 6.4;
  const ring = createSelectionRing(options.ringTexture, ringScale);
  // Floored, because a small body far from the camera is otherwise a pixel-hunt.
  const hit = createHitMesh(Math.max(0.72, options.radius * 2.6));
  hit.userData.bodyId = options.id;

  anchor.add(mesh, ring, hit);
  spin.add(anchor);
  tilt.add(spin);
  return { tilt, spin, anchor, mesh, ring, hit, ringScale };
}

/**
 * A flat ring lying in the equatorial plane.
 *
 * The one real gotcha, called out in AGENTS.md: THREE.RingGeometry runs `u` *around* the
 * circumference, which smears a radial ring texture round and round instead of across the
 * width. So the UVs are rewritten to put `u` along the radius — inner edge at 0, outer at
 * 1 — which is what makeSaturnRingTexture (and any drop-in ring strip) is drawn for.
 *
 * Lit rather than unlit, so it darkens with the planet instead of glowing on the night
 * side, with the same faint emissive floor the bodies use so it never goes fully black; and
 * `depthWrite: false` so the half of the ring behind the planet is hidden by the planet's
 * own depth while the near half still draws over it.
 */
function createSaturnRing(texture: THREE.Texture, inner: number, outer: number): THREE.Mesh {
  const geometry = new THREE.RingGeometry(inner, outer, 96, 1);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  const point = new THREE.Vector2();
  for (let i = 0; i < position.count; i++) {
    point.set(position.getX(i), position.getY(i));
    const radial = THREE.MathUtils.clamp((point.length() - inner) / (outer - inner), 0, 1);
    // v runs around the ring; it carries no structure in the 1-D strip but keeps the
    // texture defined everywhere, and lets a drop-in map add azimuthal variation if it wants.
    uv.setXY(i, radial, point.angle() / (Math.PI * 2));
  }
  uv.needsUpdate = true;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    roughness: 1,
    metalness: 0,
    depthWrite: false,
    emissiveMap: texture,
    emissive: new THREE.Color(0xffffff),
    // Higher than the bodies' 0.055: a flat ring only ever catches the Sun at a grazing
    // angle, so lit alone it comes out too dim to read as the thing the child came to see.
    emissiveIntensity: 0.3,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // RingGeometry lies in the XY plane facing +Z; lay it flat into the equatorial (XZ) plane.
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}

interface SaturnBody {
  tilt: THREE.Group;
  orbit: THREE.Group;
  anchor: THREE.Group;
  /** Axial-tilt container carrying the sphere and the rings. */
  axis: THREE.Group;
  mesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  selectionRing: THREE.Sprite;
  hit: THREE.Mesh;
  ringHit: THREE.Mesh;
  selectionScale: number;
}

/**
 * Two honest tap targets for Saturn's two visible shapes.
 *
 * This used to be one sphere as wide as the outer rings. In the wide solar-system view
 * that invisible ball included a huge volume of empty space and could sit in front of
 * Earth, so tapping the clearly visible Earth selected Saturn instead. A generous sphere
 * still covers the planet and a flat annulus follows the rings; empty space now stays empty.
 */
export function createSaturnHitTargets(): { planet: THREE.Mesh; rings: THREE.Mesh } {
  const planet = createHitMesh(SATURN_RADIUS * 1.35);
  const rings = new THREE.Mesh(
    new THREE.RingGeometry(
      SATURN_RADIUS * 0.98,
      SATURN_RADIUS * SATURN_RING_OUTER_RATIO * 1.08,
      48,
      1,
    ),
    new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
  );
  // RingGeometry faces +Z; Saturn's equatorial plane is XZ.
  rings.rotation.x = -Math.PI / 2;
  planet.userData.bodyId = 'saturn';
  rings.userData.bodyId = 'saturn';
  return { planet, rings };
}

/**
 * Saturn: an orbiting body like the others, but with an axial tilt and a ring lying in it.
 *
 * Built apart from createOrbitingBody because those two things are unique to it. The rig is
 * the same three-node one — tilt/orbit/anchor — plus an `axis` group between the anchor and
 * the sphere that carries the axial tilt, so the rings and the sphere share it while the
 * sphere still spins about its own axis inside. The rings hang off `axis`, not off the
 * sphere, so they do not spin with the surface texture; the sphere is what `holdSurface`
 * freezes for a visit, exactly as on Mars.
 */
function createSaturn(options: {
  map: THREE.Texture;
  ringTexture: THREE.Texture;
  selectionTexture: THREE.Texture;
  segments: [number, number];
}): SaturnBody {
  const tilt = new THREE.Group();
  tilt.rotation.x = SATURN_ORBIT_TILT;
  const orbit = new THREE.Group();
  orbit.rotation.y = SATURN_START_ANGLE;
  const anchor = new THREE.Group();
  anchor.position.x = SATURN_ORBIT_RADIUS;

  const axis = new THREE.Group();
  axis.rotation.z = SATURN_AXIAL_TILT;

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(SATURN_RADIUS, options.segments[0], options.segments[1]),
    new THREE.MeshStandardMaterial({
      map: options.map,
      roughness: 0.9,
      metalness: 0,
      emissiveMap: options.map,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.055,
    }),
  );

  const ringMesh = createSaturnRing(
    options.ringTexture,
    SATURN_RADIUS * SATURN_RING_INNER_RATIO,
    SATURN_RADIUS * SATURN_RING_OUTER_RATIO,
  );

  const hitTargets = createSaturnHitTargets();
  axis.add(mesh, ringMesh, hitTargets.rings);

  // The selection ring takes in the whole ring system; its two hit targets follow the
  // planet and the flat rings rather than filling that outline with an invisible ball.
  const selectionScale = SATURN_RADIUS * SATURN_RING_OUTER_RATIO * 2.4;
  const selectionRing = createSelectionRing(options.selectionTexture, selectionScale);

  anchor.add(axis, selectionRing, hitTargets.planet);
  orbit.add(anchor);
  tilt.add(orbit);
  return {
    tilt,
    orbit,
    anchor,
    axis,
    mesh,
    ringMesh,
    selectionRing,
    hit: hitTargets.planet,
    ringHit: hitTargets.rings,
    selectionScale,
  };
}

export async function createWorld(quality: QualitySettings): Promise<World> {
  const group = new THREE.Group();
  const segments = quality.sphereSegments;
  // The Moon and Mars used to be built at 0.6 of Earth's tessellation, on the reasoning
  // that they are smaller and further away. The flight now arrives at about 3.2 body
  // radii instead of 9.6, and at that range they are the largest thing on screen: 0.6 of
  // medium is 29 segments around, which draws a visibly faceted, polygonal limb against
  // the star field. They are destinations, so they get the same budget Earth does — a
  // sphere is a rounding error next to the bloom pass either way.
  const moonSegments: [number, number] = [segments[0], segments[1]];

  // Earth's colour and roughness are resolved together: the generated pair are cut from
  // one noise field, so mixing a real photo with a generated roughness map would put the
  // ocean sheen on the wrong side of every coastline. See resolveEarthMaps.
  const [earthMaps, earthNightMap, moonMap, marsMap, saturnMap, saturnRingMap, sunMap] =
    await Promise.all([
      resolveEarthMaps(quality.textureSize),
      // Optional, and there is no sensible way to invent one: absent simply means the night
      // side stays dark, which is what it did before the map existed.
      resolveOptionalTexture({ file: 'earth-night.jpg', anisotropy: 8 }),
      resolveTexture({
        file: 'moon.jpg',
        fallback: () => makeMoonTexture(quality.textureSize),
        anisotropy: 8,
      }),
      resolveTexture({
        file: 'mars.jpg',
        fallback: () => makeMarsTexture(quality.textureSize),
        anisotropy: 8,
      }),
      resolveTexture({
        file: 'saturn.jpg',
        fallback: () => makeSaturnTexture(quality.textureSize),
        anisotropy: 8,
      }),
      // A PNG, not a JPG: the rings need alpha, the one exception to the "use .jpg" rule.
      resolveTexture({
        file: 'saturn-rings.png',
        fallback: () => makeSaturnRingTexture(),
        fallbackLabel: 'generated rings',
        anisotropy: 8,
      }),
      resolveTexture({
        file: 'sun.jpg',
        fallback: () => makeSunTexture(Math.min(512, quality.textureSize)),
      }),
    ]);

  const ringTexture = makeRingTexture();
  const glowTexture = makeGlowTexture();

  /* --- Sun ---------------------------------------------------------------- */

  const sunMaterial = new THREE.MeshBasicMaterial({ map: sunMap, fog: false });
  // Values above 1 push the Sun past the bloom threshold and let ACES burn the core white.
  sunMaterial.color.setRGB(2.9, 2.1, 1.25);
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS, 32, 20), sunMaterial);
  sunMesh.position.copy(SUN_POSITION);

  const coronaMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  coronaMaterial.color.setRGB(1.5, 1.05, 0.6);
  const corona = new THREE.Sprite(coronaMaterial);
  corona.scale.setScalar(SUN_RADIUS * 6.5);
  corona.position.copy(SUN_POSITION);

  group.add(sunMesh, corona);

  /* --- Lights ------------------------------------------------------------- */

  // Directional rather than point: the Sun is effectively at infinity for this scene, and
  // parallel rays give Earth and Moon consistent terminators without falloff tuning.
  const sunLight = new THREE.DirectionalLight(0xfff1dc, 2.7);
  sunLight.position.copy(SUN_POSITION);
  const fill = new THREE.HemisphereLight(0x4a3a92, 0x0b0820, 0.55);
  group.add(sunLight, sunLight.target, fill);

  /* --- Earth -------------------------------------------------------------- */

  const earthAnchor = new THREE.Group();
  const earthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS, segments[0], segments[1]),
    new THREE.MeshStandardMaterial({
      map: earthMaps.color,
      roughnessMap: earthMaps.roughness,
      roughness: 1,
      metalness: 0,
    }),
  );
  if (earthNightMap) {
    applyNightLights(earthMesh.material as THREE.MeshStandardMaterial, earthNightMap);
  }
  /*
   * The axial tilt lives on a group above the sphere, not on the sphere itself.
   *
   * It used to be `earthMesh.rotation.z`, which looks identical and is not: the mission
   * places its markers by setting the surface's rotation *about Y*, and reads the camera's
   * bearing in the surface's parent space to work out what to set it to. Both assume the
   * only turn between those two spaces is that one. A z-tilt on the mesh sits inside the
   * y-rotation and quietly moves every marker off its coordinates. The Moon and Mars carry
   * their tilt on a container for the same reason; this makes Earth match them.
   */
  const earthAxis = new THREE.Group();
  earthAxis.rotation.z = 0.41; // axial tilt, purely for looks
  earthAxis.add(earthMesh);
  const atmosphere = createAtmosphere(EARTH_RADIUS, segments);
  const earthRing = createSelectionRing(ringTexture, EARTH_RADIUS * 3.1);
  const earthHit = createHitMesh(EARTH_RADIUS * 1.4);
  earthAnchor.add(earthAxis, atmosphere, earthRing, earthHit);
  group.add(earthAnchor);

  /* --- Moon and Mars ------------------------------------------------------- */

  const moon = createOrbitingBody({
    id: 'moon',
    radius: MOON_RADIUS,
    orbitRadius: MOON_ORBIT_RADIUS,
    orbitTilt: MOON_ORBIT_TILT,
    startAngle: MOON_START_ANGLE,
    map: moonMap,
    roughness: 0.94,
    segments: moonSegments,
    ringTexture,
  });

  const mars = createOrbitingBody({
    id: 'mars',
    radius: MARS_RADIUS,
    orbitRadius: MARS_ORBIT_RADIUS,
    orbitTilt: MARS_ORBIT_TILT,
    startAngle: MARS_START_ANGLE,
    map: marsMap,
    roughness: 0.88,
    segments: moonSegments,
    ringTexture,
  });

  const saturn = createSaturn({
    map: saturnMap,
    ringTexture: saturnRingMap,
    selectionTexture: ringTexture,
    segments: moonSegments,
  });

  group.add(moon.tilt, mars.tilt, saturn.tilt);

  /* --- Assembly ----------------------------------------------------------- */

  /**
   * Per-body surface hold. A number is the total turn — the body's own rotation plus
   * whatever its orbit contributes — that `update` reproduces every frame to leave the
   * surface stationary in the world while the body itself goes on travelling.
   */
  const holds: Partial<Record<BodyId, number>> = {};

  const bodies: Record<BodyId, CelestialBody> = {
    earth: {
      id: 'earth',
      label: 'Earth',
      radius: EARTH_RADIUS,
      anchor: earthAnchor,
      surface: earthMesh,
      hitMesh: earthHit,
      // Earth sits at the origin, so its own rotation is the whole of its turn.
      holdSurface: () => {
        holds.earth = earthMesh.rotation.y;
      },
      releaseSurface: () => {
        delete holds.earth;
      },
      turnSurface: (delta: number) => {
        const held = holds.earth;
        if (held !== undefined) holds.earth = held + delta;
      },
      getWorldPosition: (target) => earthAnchor.getWorldPosition(target),
    },
    moon: {
      id: 'moon',
      label: 'The Moon',
      radius: MOON_RADIUS,
      anchor: moon.anchor,
      surface: moon.mesh,
      hitMesh: moon.hit,
      // Local plus orbit, which is the Moon's orientation against the stars. Holding that
      // is what stops the surface moving under a finger: the camera orbits in world space
      // and follows the body along, so a world-fixed surface is a still one to explore.
      holdSurface: () => {
        holds.moon = moon.mesh.rotation.y + moon.spin.rotation.y;
      },
      releaseSurface: () => {
        delete holds.moon;
      },
      turnSurface: (delta: number) => {
        const held = holds.moon;
        if (held !== undefined) holds.moon = held + delta;
      },
      getWorldPosition: (target) => moon.anchor.getWorldPosition(target),
    },
    mars: {
      id: 'mars',
      label: 'Mars',
      radius: MARS_RADIUS,
      anchor: mars.anchor,
      surface: mars.mesh,
      hitMesh: mars.hit,
      holdSurface: () => {
        holds.mars = mars.mesh.rotation.y + mars.spin.rotation.y;
      },
      releaseSurface: () => {
        delete holds.mars;
      },
      turnSurface: (delta: number) => {
        const held = holds.mars;
        if (held !== undefined) holds.mars = held + delta;
      },
      getWorldPosition: (target) => mars.anchor.getWorldPosition(target),
    },
    saturn: {
      id: 'saturn',
      label: 'Saturn',
      radius: SATURN_RADIUS,
      // The rings reach out to 2.3 radii, so the shot has to fit that, not the sphere.
      viewRadius: SATURN_RADIUS * SATURN_RING_OUTER_RATIO,
      anchor: saturn.anchor,
      surface: saturn.mesh,
      hitMesh: saturn.hit,
      // Local axial spin plus the orbit, its orientation against the stars — the same sum
      // the Moon and Mars hold, and the same reason: a world-fixed surface is a still one
      // to explore while the body itself goes on travelling.
      holdSurface: () => {
        holds.saturn = saturn.mesh.rotation.y + saturn.orbit.rotation.y;
      },
      releaseSurface: () => {
        delete holds.saturn;
      },
      turnSurface: (delta: number) => {
        const held = holds.saturn;
        if (held !== undefined) holds.saturn = held + delta;
      },
      getWorldPosition: (target) => saturn.anchor.getWorldPosition(target),
    },
  };

  earthHit.userData.bodyId = 'earth';

  let orbitSpeedScale = 1;
  // Paired with their resting scale, so the selection pulse is one loop for every body.
  const rings: Array<[BodyId, THREE.Sprite, number]> = [
    ['earth', earthRing, EARTH_RADIUS * 3.1],
    ['moon', moon.ring, moon.ringScale],
    ['mars', mars.ring, mars.ringScale],
    ['saturn', saturn.selectionRing, saturn.selectionScale],
  ];

  function setSelected(id: BodyId | null) {
    for (const [bodyId, ring] of rings) ring.visible = bodyId === id;
  }

  /*
   * Reveal-gating. Each body's root group is toggled, and its tap targets go in and out of the
   * hit list with it, so an unrevealed world is neither drawn nor tappable. Earth sits under
   * earthAnchor; the orbiting bodies each hang off their own `tilt` group.
   */
  const roots: Record<BodyId, THREE.Object3D> = {
    earth: earthAnchor,
    moon: moon.tilt,
    mars: mars.tilt,
    saturn: saturn.tilt,
  };
  const bodyHits: Record<BodyId, THREE.Mesh[]> = {
    earth: [earthHit],
    moon: [moon.hit],
    mars: [mars.hit],
    saturn: [saturn.hit, saturn.ringHit],
  };
  // Everything on screen until told otherwise, so nothing that does not call setRevealed
  // (tests, and any future caller) sees a change in behaviour.
  const revealed = new Set<BodyId>(Object.keys(roots) as BodyId[]);

  interface MaterialRestingState {
    material: THREE.Material;
    opacity: number;
    transparent: boolean;
  }

  interface RevealVisual {
    scale: THREE.Vector3;
    materials: MaterialRestingState[];
  }

  const revealVisuals = {} as Record<BodyId, RevealVisual>;
  for (const id of Object.keys(roots) as BodyId[]) {
    const materials = new Set<THREE.Material>();
    roots[id].traverse((object) => {
      const renderable = object as THREE.Mesh | THREE.Sprite;
      const assigned = renderable.material;
      if (Array.isArray(assigned)) assigned.forEach((material) => materials.add(material));
      else if (assigned) materials.add(assigned);
    });
    revealVisuals[id] = {
      scale: roots[id].scale.clone(),
      materials: [...materials].map((material) => ({
        material,
        opacity: material.opacity,
        transparent: material.transparent,
      })),
    };
  }

  const revealing = new Map<BodyId, number>();

  function finishReveal(id: BodyId) {
    const visual = revealVisuals[id];
    roots[id].scale.copy(visual.scale);
    for (const resting of visual.materials) {
      const transparencyChanged = resting.material.transparent !== resting.transparent;
      resting.material.opacity = resting.opacity;
      resting.material.transparent = resting.transparent;
      if (transparencyChanged) resting.material.needsUpdate = true;
    }
    revealing.delete(id);
  }

  function beginReveal(id: BodyId) {
    const visual = revealVisuals[id];
    roots[id].scale.copy(visual.scale).multiplyScalar(0.86);
    for (const resting of visual.materials) {
      resting.material.opacity = 0;
      if (!resting.material.transparent) {
        resting.material.transparent = true;
        resting.material.needsUpdate = true;
      }
    }
    revealing.set(id, 0);
  }

  function setRevealed(ids: Iterable<BodyId>, animate = false): BodyId[] {
    const next = new Set<BodyId>(ids);
    const newlyRevealed = [...next].filter((id) => !revealed.has(id));
    for (const id of Object.keys(roots) as BodyId[]) {
      if (!next.has(id)) {
        finishReveal(id);
        roots[id].visible = false;
        continue;
      }
      roots[id].visible = true;
      if (newlyRevealed.includes(id) && animate) beginReveal(id);
      else if (!revealing.has(id)) finishReveal(id);
    }
    revealed.clear();
    for (const id of next) revealed.add(id);
    return newlyRevealed;
  }

  return {
    group,
    bodies,
    get hitMeshes() {
      return (Object.keys(bodyHits) as BodyId[])
        // A half-visible planet is an announcement, not yet a target. Waiting until the
        // fade lands prevents a quick tap passing through the small visual into a huge hit.
        .filter((id) => revealed.has(id) && !revealing.has(id))
        .flatMap((id) => bodyHits[id]);
    },
    setRevealed,
    setSelected,

    setOrbitSpeedScale(scale: number) {
      orbitSpeedScale = scale;
    },

    reset() {
      orbitSpeedScale = 1;
      // A reset may interrupt a reveal (for example, the adult clears progress). Restore
      // every material before the next setRevealed call decides what remains on screen.
      for (const id of [...revealing.keys()]) finishReveal(id);
      // A backstop, not the normal path: whoever called holdSurface releases it, and the
      // mission does. This is here because a hold that outlives its owner leaves a planet
      // frozen for the rest of the session, which is a bad enough failure to guard twice.
      // Deliberately not wound back to where the surface would have got to — the bodies
      // have kept moving, and pretending otherwise would spin one of them on the spot.
      for (const id of Object.keys(holds) as BodyId[]) delete holds[id];
      setSelected(null);
    },

    update(dt: number, elapsed: number, camera: THREE.Camera) {
      for (const [id, previous] of [...revealing]) {
        const progress = Math.min(1, previous + dt / WORLD_REVEAL_DURATION);
        const eased = worldRevealEase(progress);
        const visual = revealVisuals[id];
        roots[id].scale.copy(visual.scale).multiplyScalar(0.86 + eased * 0.14);
        for (const resting of visual.materials) {
          resting.material.opacity = resting.opacity * eased;
        }
        if (progress >= 1) finishReveal(id);
        else revealing.set(id, progress);
      }

      // A held body subtracts its orbit back out, so the surface stays put in the world
      // while the body itself keeps travelling. Earth has no orbit to subtract.
      const earthHold = holds.earth;
      if (earthHold === undefined) earthMesh.rotation.y += EARTH_SPIN * dt;
      else earthMesh.rotation.y = earthHold;

      moon.spin.rotation.y += MOON_ORBIT_SPEED * orbitSpeedScale * dt;
      const moonHold = holds.moon;
      /*
       * Tidally locked: the same face towards Earth, the way the real Moon does. The game
       * tells a child exactly that — it is why the far side went unseen until a spacecraft
       * flew round the back — so it had better be what the Moon does.
       *
       * A *constant* local rotation is what locks it, because the mesh already inherits
       * the orbit from the spin group above it. This used to subtract that inheritance
       * back out, which is the opposite of locking: it left the Moon near enough fixed
       * against the stars, turning a full revolution against Earth every two minutes. The
       * comment here claimed tidal locking throughout; the maths never did it.
       *
       * Pi puts longitude zero, the centre of the near side, towards Earth.
       */
      moon.mesh.rotation.y =
        moonHold === undefined ? Math.PI : moonHold - moon.spin.rotation.y;

      mars.spin.rotation.y += MARS_ORBIT_SPEED * orbitSpeedScale * dt;
      const marsHold = holds.mars;
      // Mars is tidally locked to nothing here, so it simply turns on its own axis.
      mars.mesh.rotation.y =
        marsHold === undefined ? MARS_SPIN * elapsed : marsHold - mars.spin.rotation.y;

      saturn.orbit.rotation.y += SATURN_ORBIT_SPEED * orbitSpeedScale * dt;
      const saturnHold = holds.saturn;
      // Like Mars: it turns on its own axis, and a held surface subtracts the orbit back out
      // so it stays put in the world. The rings ride the axis group, not the sphere, so they
      // do not turn with the surface texture whether it is held or spinning.
      saturn.mesh.rotation.y =
        saturnHold === undefined ? SATURN_SPIN * elapsed : saturnHold - saturn.orbit.rotation.y;

      const pulse = 1 + Math.sin(elapsed * 3.2) * 0.05;
      for (const [, ring, scale] of rings) {
        if (ring.visible) ring.scale.setScalar(scale * pulse);
      }

      // Shrink the corona slightly as the camera approaches, so it never swallows the view.
      const sunDistance = camera.position.distanceTo(SUN_POSITION);
      corona.scale.setScalar(SUN_RADIUS * (5.2 + Math.min(1.6, sunDistance / 140)));
    },

    dispose() {
      const meshes = [
        sunMesh,
        earthMesh,
        atmosphere,
        earthHit,
        moon.mesh,
        moon.hit,
        mars.mesh,
        mars.hit,
        saturn.mesh,
        saturn.ringMesh,
        saturn.hit,
      ];
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      coronaMaterial.dispose();
      for (const [, ring] of rings) (ring.material as THREE.SpriteMaterial).dispose();
      const textures = [
        earthMaps.color,
        earthMaps.roughness,
        earthNightMap,
        moonMap,
        marsMap,
        saturnMap,
        saturnRingMap,
        sunMap,
        ringTexture,
        glowTexture,
      ];
      for (const t of textures) t?.dispose();
    },
  };
}
