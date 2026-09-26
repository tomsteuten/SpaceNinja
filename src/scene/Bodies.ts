/**
 * The Sun, the Earth (with its atmosphere), every orbiting world in the catalogue, and the lights.
 *
 * Everything is built from Three.js primitives and the textures resolved in
 * textures.ts, so swapping in real maps or GLB models later touches only this file.
 */

import * as THREE from 'three';
import { EARTH_RADIUS, EARTH_SPIN, SUN_DIRECTION, SUN_POSITION, SUN_RADIUS } from '../config';
import {
  ORBITING_WORLDS,
  viewRadius as worldViewRadius,
  worldGeometry,
  type SurfaceFallback,
  type WorldGeometry,
} from '../worlds/catalogue';
import {
  makeBandedTexture,
  makeCrateredTexture,
  makeGlowTexture,
  makeMarsTexture,
  makeRingTexture,
  makeSaturnRingTexture,
  makeSunTexture,
  resolveEarthMaps,
  resolveOptionalTexture,
  resolveTexture,
} from './textures';
import type { QualitySettings } from './quality';
import { createTeachingSun, type TeachingSun } from './TeachingSun';

/**
 * The built scene bodies, as literal types so records keyed by them are exhaustive. The
 * catalogue (src/worlds/catalogue.ts) is the source of truth for what each one *is*;
 * catalogue.test.ts pins this list to it, so adding a world means one entry there and one
 * id here, and nothing else in this file.
 */
export const BODY_IDS = ['earth', 'moon', 'mars', 'saturn'] as const;
export type BodyId = typeof BODY_IDS[number];

/** Long enough to read as a reveal, short enough not to hold up the next choice. */
export const WORLD_REVEAL_DURATION = 0.9;

/**
 * A visiting world stays solid while the other earned worlds remain as quiet context.
 * Low enough that a close Moon cannot cover a target; non-zero so the solar system does
 * not disappear the moment a child arrives somewhere.
 */
export const WORLD_CONTEXT_OPACITY = 0.18;

export function worldFocusOpacity(id: BodyId, focused: BodyId | null): number {
  return focused === null || id === focused ? 1 : WORLD_CONTEXT_OPACITY;
}

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
  teachingSun: TeachingSun;
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
  /**
   * Keep one visited world solid and fade the others to context. Null restores the map.
   * Visibility and hit-target reveal rules are unchanged.
   */
  setFocus(id: BodyId | null): void;
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
function createRingMesh(texture: THREE.Texture, inner: number, outer: number): THREE.Mesh {
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

/**
 * Two honest tap targets for a ringed world's two visible shapes.
 *
 * This used to be one sphere as wide as the outer rings. In the wide solar-system view
 * that invisible ball included a huge volume of empty space and could sit in front of
 * Earth, so tapping the clearly visible Earth selected Saturn instead. A generous sphere
 * still covers the planet and a flat annulus follows the rings; empty space now stays empty.
 */
export function createRingedHitTargets(
  id: BodyId,
  radius: number,
  outerRatio: number,
): { planet: THREE.Mesh; rings: THREE.Mesh } {
  const planet = createHitMesh(radius * 1.35);
  const rings = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.98, radius * outerRatio * 1.08, 48, 1),
    new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
  );
  // RingGeometry faces +Z; the equatorial plane is XZ.
  rings.rotation.x = -Math.PI / 2;
  planet.userData.bodyId = id;
  rings.userData.bodyId = id;
  return { planet, rings };
}

/** Saturn's targets by name, for the test that pins the empty-space rule. */
export function createSaturnHitTargets(): { planet: THREE.Mesh; rings: THREE.Mesh } {
  const saturn = worldGeometry('saturn');
  return createRingedHitTargets('saturn', saturn.radius, saturn.rings!.outer);
}

/**
 * The rig every orbiting world uses: a tilt group so its path is not flat, an orbit group
 * carrying the orbit angle, and an anchor out at the orbit radius. Children of the anchor
 * ride the orbit without inheriting the body's own rotation — which is what lets the ship
 * park on it and the markers stay put under a child's finger.
 *
 * A world with an axial tilt gets an `axis` group between the anchor and the sphere that
 * carries the tilt, so any rings and the sphere share it while the sphere still spins about
 * its own axis inside. Rings hang off `axis`, not off the sphere, so they do not spin with
 * the surface texture; the sphere is what `holdSurface` freezes for a visit. The tilt lives
 * on a container rather than on the mesh because the mission places its markers by setting
 * the surface's rotation *about Y* and reads the camera's bearing in the surface's parent
 * space; a z-tilt on the mesh would sit inside that y-rotation and quietly move every marker
 * off its coordinates.
 */
interface OrbitingBody {
  id: BodyId;
  world: WorldGeometry;
  tilt: THREE.Group;
  orbit: THREE.Group;
  anchor: THREE.Group;
  mesh: THREE.Mesh;
  ringMesh: THREE.Mesh | null;
  selectionRing: THREE.Sprite;
  selectionScale: number;
  hitMeshes: THREE.Mesh[];
}

function createOrbitingBody(
  world: WorldGeometry,
  options: {
    map: THREE.Texture;
    ringMap: THREE.Texture | null;
    selectionTexture: THREE.Texture;
    segments: [number, number];
  },
): OrbitingBody {
  const id = world.id as BodyId;
  const orbitSpec = world.orbit;
  if (!orbitSpec || !world.surface) throw new Error(`${world.id} is not an orbiting world`);

  const tilt = new THREE.Group();
  tilt.rotation.x = orbitSpec.tilt;
  const orbit = new THREE.Group();
  orbit.rotation.y = orbitSpec.startAngle;
  const anchor = new THREE.Group();
  anchor.position.x = orbitSpec.radius;

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(world.radius, options.segments[0], options.segments[1]),
    new THREE.MeshStandardMaterial({
      map: options.map,
      roughness: world.surface.roughness,
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

  // The sphere's parent: the axial-tilt container when there is one, else the anchor.
  const axis = new THREE.Group();
  axis.rotation.z = world.axialTilt ?? 0;
  axis.add(mesh);

  let ringMesh: THREE.Mesh | null = null;
  let hitMeshes: THREE.Mesh[];
  let selectionScale: number;
  if (world.rings && options.ringMap) {
    ringMesh = createRingMesh(
      options.ringMap,
      world.radius * world.rings.inner,
      world.radius * world.rings.outer,
    );
    const targets = createRingedHitTargets(id, world.radius, world.rings.outer);
    axis.add(ringMesh, targets.rings);
    anchor.add(targets.planet);
    hitMeshes = [targets.planet, targets.rings];
    // The selection ring takes in the whole ring system. Was 2.4, lowered with the others
    // for the same reason — and a ringed world needs it least, since this is a multiple of
    // the *outer ring* rather than of the body.
    selectionScale = worldViewRadius(world) * 1.7;
  } else {
    // Floored, because a small body far from the camera is otherwise a pixel-hunt.
    const hit = createHitMesh(Math.max(0.72, world.radius * 2.6));
    hit.userData.bodyId = id;
    anchor.add(hit);
    hitMeshes = [hit];
    /*
     * Was 6.4. The ring marked a *selection* then — a state a child had just put the game
     * into by tapping, held for as long as it took them to find the Fly button, and worth
     * shouting about. There is no selection any more: it marks the world the map is
     * suggesting, so it is on the whole time the child is at the map, and at 6.4 radii it
     * dominated the shot and clipped off the edge of a portrait phone whenever the Moon was
     * out at the side of its orbit — which the opening framing puts it at routinely.
     * 4.2 still reads as a ring around a small body without becoming the subject.
     */
    selectionScale = world.radius * 4.2;
  }
  const selectionRing = createSelectionRing(options.selectionTexture, selectionScale);

  anchor.add(axis, selectionRing);
  orbit.add(anchor);
  tilt.add(orbit);
  return { id, world, tilt, orbit, anchor, mesh, ringMesh, selectionRing, selectionScale, hitMeshes };
}

function generatedSurface(fallback: SurfaceFallback, width: number): THREE.Texture {
  switch (fallback.style) {
    case 'cratered':
      return makeCrateredTexture(width, fallback.tint);
    case 'banded':
      return makeBandedTexture(width, [fallback.dark, fallback.light]);
    case 'rocky':
      return makeMarsTexture(width);
  }
}

async function resolveWorldMaps(
  world: WorldGeometry,
  textureSize: number,
): Promise<{ map: THREE.Texture; ringMap: THREE.Texture | null }> {
  const surface = world.surface!;
  const [map, ringMap] = await Promise.all([
    resolveTexture({
      file: surface.file,
      fallback: () => generatedSurface(surface.fallback, textureSize),
      anisotropy: 8,
    }),
    world.rings
      ? resolveTexture({
          file: world.rings.file,
          fallback: () => makeSaturnRingTexture(),
          fallbackLabel: 'generated rings',
          anisotropy: 8,
        })
      : Promise.resolve(null),
  ]);
  return { map, ringMap };
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
  const worldSegments: [number, number] = [segments[0], segments[1]];

  // Earth's colour and roughness are resolved together: the generated pair are cut from
  // one noise field, so mixing a real photo with a generated roughness map would put the
  // ocean sheen on the wrong side of every coastline. See resolveEarthMaps.
  const [earthMaps, earthNightMap, sunMap, orbitingMaps] = await Promise.all([
    resolveEarthMaps(quality.textureSize),
    // Optional, and there is no sensible way to invent one: absent simply means the night
    // side stays dark, which is what it did before the map existed.
    resolveOptionalTexture({ file: 'earth-night.jpg', anisotropy: 8 }),
    resolveTexture({
      file: 'sun.jpg',
      fallback: () => makeSunTexture(Math.min(512, quality.textureSize)),
    }),
    Promise.all(ORBITING_WORLDS.map((world) => resolveWorldMaps(world, quality.textureSize))),
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
  const teachingSun = createTeachingSun(sunMap, glowTexture, (visible) => {
    // One Sun in the picture, even if a child started the turn looking at the real one.
    // Its light remains unchanged; only the two visual representations are exchanged.
    sunMesh.visible = corona.visible = !visible;
  });
  group.add(teachingSun.group);

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
   * y-rotation and quietly moves every marker off its coordinates. The orbiting worlds
   * carry their tilt on a container for the same reason; this makes Earth match them.
   */
  const earthAxis = new THREE.Group();
  earthAxis.rotation.z = worldGeometry('earth').axialTilt ?? 0;
  earthAxis.add(earthMesh);
  const atmosphere = createAtmosphere(EARTH_RADIUS, segments);
  const earthRing = createSelectionRing(ringTexture, EARTH_RADIUS * 3.1);
  const earthHit = createHitMesh(EARTH_RADIUS * 1.4);
  earthHit.userData.bodyId = 'earth';
  earthAnchor.add(earthAxis, atmosphere, earthRing, earthHit);
  group.add(earthAnchor);

  /* --- Every orbiting world, from the catalogue ------------------------------ */

  const orbiting = new Map<BodyId, OrbitingBody>();
  ORBITING_WORLDS.forEach((world, index) => {
    const body = createOrbitingBody(world, {
      map: orbitingMaps[index]!.map,
      ringMap: orbitingMaps[index]!.ringMap,
      selectionTexture: ringTexture,
      segments: worldSegments,
    });
    orbiting.set(body.id, body);
    group.add(body.tilt);
  });

  /* --- Assembly ----------------------------------------------------------- */

  /**
   * Per-body surface hold. A number is the total turn — the body's own rotation plus
   * whatever its orbit contributes — that `update` reproduces every frame to leave the
   * surface stationary in the world while the body itself goes on travelling.
   */
  const holds: Partial<Record<BodyId, number>> = {};

  function holdControls(id: BodyId, orientation: () => number) {
    return {
      holdSurface: () => {
        holds[id] = orientation();
      },
      releaseSurface: () => {
        delete holds[id];
      },
      turnSurface: (delta: number) => {
        const held = holds[id];
        if (held !== undefined) holds[id] = held + delta;
      },
    };
  }

  const bodies = {} as Record<BodyId, CelestialBody>;
  bodies.earth = {
    id: 'earth',
    label: worldGeometry('earth').label,
    radius: EARTH_RADIUS,
    anchor: earthAnchor,
    surface: earthMesh,
    hitMesh: earthHit,
    // Earth sits at the origin, so its own rotation is the whole of its turn.
    ...holdControls('earth', () => earthMesh.rotation.y),
    getWorldPosition: (target) => earthAnchor.getWorldPosition(target),
  };
  for (const body of orbiting.values()) {
    const view = worldViewRadius(body.world);
    bodies[body.id] = {
      id: body.id,
      label: body.world.label,
      radius: body.world.radius,
      // A ringed world's shot has to fit the rings, not the sphere.
      ...(view > body.world.radius ? { viewRadius: view } : {}),
      anchor: body.anchor,
      surface: body.mesh,
      hitMesh: body.hitMeshes[0]!,
      // Local plus orbit, which is the body's orientation against the stars. Holding that
      // is what stops the surface moving under a finger: the camera orbits in world space
      // and follows the body along, so a world-fixed surface is a still one to explore.
      ...holdControls(body.id, () => body.mesh.rotation.y + body.orbit.rotation.y),
      getWorldPosition: (target) => body.anchor.getWorldPosition(target),
    };
  }

  interface WorldRegistration {
    root: THREE.Object3D;
    hitMeshes: THREE.Mesh[];
    selectionRing: THREE.Sprite;
    selectionScale: number;
  }

  /*
   * Extending a body used to require keeping independent roots, hit meshes and selection
   * rings in step. A registration keeps the visual, input and reveal ownership together.
   * Earth is the one hand-built body (paired maps, night lights, atmosphere, the origin);
   * every orbiting world comes from the catalogue through one builder.
   */
  const registrations = {} as Record<BodyId, WorldRegistration>;
  registrations.earth = {
    root: earthAnchor,
    hitMeshes: [earthHit],
    selectionRing: earthRing,
    selectionScale: EARTH_RADIUS * 3.1,
  };
  for (const body of orbiting.values()) {
    registrations[body.id] = {
      root: body.tilt,
      hitMeshes: body.hitMeshes,
      selectionRing: body.selectionRing,
      selectionScale: body.selectionScale,
    };
  }

  let orbitSpeedScale = 1;
  // Paired with their resting scale, so the selection pulse is one loop for every body.
  const rings = BODY_IDS.map((id) => {
    const registration = registrations[id];
    return [id, registration.selectionRing, registration.selectionScale] as const;
  });

  function setSelected(id: BodyId | null) {
    for (const [bodyId, ring] of rings) ring.visible = bodyId === id;
  }

  /*
   * Reveal-gating. Each body's root group is toggled, and its tap targets go in and out of the
   * hit list with it, so an unrevealed world is neither drawn nor tappable. Earth sits under
   * earthAnchor; the orbiting bodies each hang off their own `tilt` group.
   */
  const roots = Object.fromEntries(BODY_IDS.map((id) => [id, registrations[id].root])) as Record<BodyId, THREE.Object3D>;
  const bodyHits = Object.fromEntries(BODY_IDS.map((id) => [id, registrations[id].hitMeshes])) as Record<BodyId, THREE.Mesh[]>;
  // Everything on screen until told otherwise, so nothing that does not call setRevealed
  // (tests, and any future caller) sees a change in behaviour.
  const revealed = new Set<BodyId>(BODY_IDS);

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
  for (const id of BODY_IDS) {
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
  let focused: BodyId | null = null;

  function applyOpacity(id: BodyId, revealOpacity = 1) {
    const amount = revealOpacity * worldFocusOpacity(id, focused);
    for (const resting of revealVisuals[id].materials) {
      const transparent = resting.transparent || amount < 1;
      const transparencyChanged = resting.material.transparent !== transparent;
      resting.material.opacity = resting.opacity * amount;
      resting.material.transparent = transparent;
      if (transparencyChanged) resting.material.needsUpdate = true;
    }
  }

  function finishReveal(id: BodyId) {
    const visual = revealVisuals[id];
    roots[id].scale.copy(visual.scale);
    applyOpacity(id);
    revealing.delete(id);
  }

  function beginReveal(id: BodyId) {
    const visual = revealVisuals[id];
    roots[id].scale.copy(visual.scale).multiplyScalar(0.86);
    applyOpacity(id, 0);
    revealing.set(id, 0);
  }

  function setRevealed(ids: Iterable<BodyId>, animate = false): BodyId[] {
    const next = new Set<BodyId>(ids);
    const newlyRevealed = [...next].filter((id) => !revealed.has(id));
    for (const id of BODY_IDS) {
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

  function setFocus(id: BodyId | null) {
    focused = id;
    for (const bodyId of BODY_IDS) {
      const progress = revealing.get(bodyId);
      applyOpacity(bodyId, progress === undefined ? 1 : worldRevealEase(progress));
    }
  }

  return {
    group,
    teachingSun,
    bodies,
    get hitMeshes() {
      return BODY_IDS
        // A half-visible planet is an announcement, not yet a target. Waiting until the
        // fade lands prevents a quick tap passing through the small visual into a huge hit.
        .filter((id) => revealed.has(id) && !revealing.has(id))
        .flatMap((id) => bodyHits[id]);
    },
    setRevealed,
    setFocus,
    setSelected,

    setOrbitSpeedScale(scale: number) {
      orbitSpeedScale = scale;
    },

    reset() {
      teachingSun.hide();
      orbitSpeedScale = 1;
      // The map is full-strength again before any newly earned world is revealed on it.
      focused = null;
      // A reset may interrupt a reveal (for example, the adult clears progress). Restore
      // every material before the next setRevealed call decides what remains on screen.
      for (const id of [...revealing.keys()]) finishReveal(id);
      for (const id of BODY_IDS) applyOpacity(id);
      // A backstop, not the normal path: whoever called holdSurface releases it, and the
      // mission does. This is here because a hold that outlives its owner leaves a planet
      // frozen for the rest of the session, which is a bad enough failure to guard twice.
      // Deliberately not wound back to where the surface would have got to — the bodies
      // have kept moving, and pretending otherwise would spin one of them on the spot.
      for (const id of BODY_IDS) delete holds[id];
      setSelected(null);
    },

    update(dt: number, elapsed: number, camera: THREE.Camera) {
      for (const [id, previous] of [...revealing]) {
        const progress = Math.min(1, previous + dt / WORLD_REVEAL_DURATION);
        const eased = worldRevealEase(progress);
        const visual = revealVisuals[id];
        roots[id].scale.copy(visual.scale).multiplyScalar(0.86 + eased * 0.14);
        applyOpacity(id, eased);
        if (progress >= 1) finishReveal(id);
        else revealing.set(id, progress);
      }

      // A held body subtracts its orbit back out, so the surface stays put in the world
      // while the body itself keeps travelling. Earth has no orbit to subtract.
      const earthHold = holds.earth;
      if (earthHold === undefined) earthMesh.rotation.y += EARTH_SPIN * dt;
      else earthMesh.rotation.y = earthHold;

      for (const body of orbiting.values()) {
        body.orbit.rotation.y += body.world.orbit!.speed * orbitSpeedScale * dt;
        const hold = holds[body.id];
        if (hold !== undefined) {
          body.mesh.rotation.y = hold - body.orbit.rotation.y;
        } else if (body.world.spin === 0) {
          /*
           * Tidally locked: the same face towards Earth, the way the real Moon does. The
           * game tells a child exactly that — it is why the far side went unseen until a
           * spacecraft flew round the back — so it had better be what the Moon does.
           *
           * A *constant* local rotation is what locks it, because the mesh already
           * inherits the orbit from the group above it. This used to subtract that
           * inheritance back out, which is the opposite of locking: it left the Moon near
           * enough fixed against the stars, turning a full revolution against Earth every
           * two minutes. Pi puts longitude zero, the centre of the near side, towards Earth.
           */
          body.mesh.rotation.y = Math.PI;
        } else {
          // Locked to nothing: it simply turns on its own axis. Any rings ride the axis
          // group, not the sphere, so they do not turn with the surface texture.
          body.mesh.rotation.y = body.world.spin * elapsed;
        }
      }

      const pulse = 1 + Math.sin(elapsed * 3.2) * 0.05;
      for (const [, ring, scale] of rings) {
        if (ring.visible) ring.scale.setScalar(scale * pulse);
      }

      // Shrink the corona slightly as the camera approaches, so it never swallows the view.
      const sunDistance = camera.position.distanceTo(SUN_POSITION);
      corona.scale.setScalar(SUN_RADIUS * (5.2 + Math.min(1.6, sunDistance / 140)));
    },

    dispose() {
      teachingSun.dispose();
      const meshes: THREE.Mesh[] = [sunMesh, earthMesh, atmosphere, earthHit];
      for (const body of orbiting.values()) {
        meshes.push(body.mesh, ...body.hitMeshes);
        if (body.ringMesh) meshes.push(body.ringMesh);
      }
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      coronaMaterial.dispose();
      for (const [, ring] of rings) (ring.material as THREE.SpriteMaterial).dispose();
      const textures: (THREE.Texture | null)[] = [
        earthMaps.color,
        earthMaps.roughness,
        earthNightMap,
        sunMap,
        ringTexture,
        glowTexture,
      ];
      for (const maps of orbitingMaps) textures.push(maps.map, maps.ringMap);
      for (const t of textures) t?.dispose();
    },
  };
}
