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
  MOON_ORBIT_RADIUS,
  MOON_ORBIT_SPEED,
  MOON_ORBIT_TILT,
  MOON_RADIUS,
  MOON_SPIN,
  MOON_START_ANGLE,
  SUN_DIRECTION,
  SUN_POSITION,
  SUN_RADIUS,
} from '../config';
import {
  makeEarthMaps,
  makeGlowTexture,
  makeMoonTexture,
  makeRingTexture,
  makeSunTexture,
  resolveTexture,
} from './textures';
import type { QualitySettings } from './quality';

export type BodyId = 'earth' | 'moon';

export interface CelestialBody {
  id: BodyId;
  label: string;
  radius: number;
  /** Object whose world position is the centre of the body. */
  anchor: THREE.Object3D;
  /** Invisible, generously sized sphere used for tap targeting. */
  hitMesh: THREE.Mesh;
  getWorldPosition(target: THREE.Vector3): THREE.Vector3;
}

export interface World {
  group: THREE.Group;
  bodies: Record<BodyId, CelestialBody>;
  hitMeshes: THREE.Mesh[];
  setSelected(id: BodyId | null): void;
  /** 0 freezes the Moon mid-orbit so the flight has a stationary destination. */
  setOrbitSpeedScale(scale: number): void;
  update(dt: number, elapsed: number, camera: THREE.Camera): void;
  dispose(): void;
}

/** Fresnel shell: bright at the limb, invisible face-on, brightest on the lit side. */
function createAtmosphere(radius: number, segments: [number, number]): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius * 1.035, segments[0], segments[1]);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(0x74b6ff) },
      uSunDir: { value: SUN_DIRECTION.clone() },
      uIntensity: { value: 1.7 },
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
        float rim = pow(1.0 - abs(dot(viewDir, vNormalW)), 2.4);
        float lit = clamp(dot(vNormalW, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
        float a = rim * uIntensity * (0.18 + 0.95 * pow(lit, 1.5));
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
  });
  return new THREE.Mesh(geometry, material);
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

export async function createWorld(quality: QualitySettings): Promise<World> {
  const group = new THREE.Group();
  const segments = quality.sphereSegments;
  const moonSegments: [number, number] = [
    Math.max(20, Math.round(segments[0] * 0.6)),
    Math.max(10, Math.round(segments[1] * 0.6)),
  ];

  const earthPlaceholders = makeEarthMaps(quality.textureSize);
  const [earthMap, earthRoughness, moonMap, sunMap] = await Promise.all([
    resolveTexture({ file: 'earth.jpg', fallback: () => earthPlaceholders.color, anisotropy: 8 }),
    resolveTexture({
      file: 'earth-roughness.jpg',
      fallback: () => earthPlaceholders.roughness,
      colorSpace: THREE.NoColorSpace,
    }),
    resolveTexture({
      file: 'moon.jpg',
      fallback: () => makeMoonTexture(quality.textureSize),
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
      map: earthMap,
      roughnessMap: earthRoughness,
      roughness: 1,
      metalness: 0,
    }),
  );
  earthMesh.rotation.z = 0.41; // axial tilt, purely for looks
  const atmosphere = createAtmosphere(EARTH_RADIUS, segments);
  const earthRing = createSelectionRing(ringTexture, EARTH_RADIUS * 3.1);
  const earthHit = createHitMesh(EARTH_RADIUS * 1.4);
  earthAnchor.add(earthMesh, atmosphere, earthRing, earthHit);
  group.add(earthAnchor);

  /* --- Moon --------------------------------------------------------------- */

  const moonTilt = new THREE.Group();
  moonTilt.rotation.x = MOON_ORBIT_TILT;
  const moonSpin = new THREE.Group();
  moonSpin.rotation.y = MOON_START_ANGLE;
  const moonAnchor = new THREE.Group();
  moonAnchor.position.x = MOON_ORBIT_RADIUS;

  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(MOON_RADIUS, moonSegments[0], moonSegments[1]),
    new THREE.MeshStandardMaterial({ map: moonMap, roughness: 0.94, metalness: 0 }),
  );
  const moonRing = createSelectionRing(ringTexture, MOON_RADIUS * 6.4);
  const moonHit = createHitMesh(Math.max(0.72, MOON_RADIUS * 2.6));
  moonAnchor.add(moonMesh, moonRing, moonHit);
  moonSpin.add(moonAnchor);
  moonTilt.add(moonSpin);
  group.add(moonTilt);

  /* --- Assembly ----------------------------------------------------------- */

  const bodies: Record<BodyId, CelestialBody> = {
    earth: {
      id: 'earth',
      label: 'Earth',
      radius: EARTH_RADIUS,
      anchor: earthAnchor,
      hitMesh: earthHit,
      getWorldPosition: (target) => earthAnchor.getWorldPosition(target),
    },
    moon: {
      id: 'moon',
      label: 'The Moon',
      radius: MOON_RADIUS,
      anchor: moonAnchor,
      hitMesh: moonHit,
      getWorldPosition: (target) => moonAnchor.getWorldPosition(target),
    },
  };

  earthHit.userData.bodyId = 'earth';
  moonHit.userData.bodyId = 'moon';

  let orbitSpeedScale = 1;
  const ringScales = { earth: EARTH_RADIUS * 3.1, moon: MOON_RADIUS * 6.4 };

  return {
    group,
    bodies,
    hitMeshes: [earthHit, moonHit],

    setSelected(id: BodyId | null) {
      earthRing.visible = id === 'earth';
      moonRing.visible = id === 'moon';
    },

    setOrbitSpeedScale(scale: number) {
      orbitSpeedScale = scale;
    },

    update(dt: number, elapsed: number, camera: THREE.Camera) {
      earthMesh.rotation.y += EARTH_SPIN * dt;
      moonSpin.rotation.y += MOON_ORBIT_SPEED * orbitSpeedScale * dt;
      // Keep the same face toward Earth, the way the real Moon does.
      moonMesh.rotation.y = -moonSpin.rotation.y + MOON_SPIN * elapsed;

      const pulse = 1 + Math.sin(elapsed * 3.2) * 0.05;
      if (earthRing.visible) earthRing.scale.setScalar(ringScales.earth * pulse);
      if (moonRing.visible) moonRing.scale.setScalar(ringScales.moon * pulse);

      // Shrink the corona slightly as the camera approaches, so it never swallows the view.
      const sunDistance = camera.position.distanceTo(SUN_POSITION);
      corona.scale.setScalar(SUN_RADIUS * (5.2 + Math.min(1.6, sunDistance / 140)));
    },

    dispose() {
      const meshes = [sunMesh, earthMesh, atmosphere, moonMesh, earthHit, moonHit];
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      coronaMaterial.dispose();
      (earthRing.material as THREE.SpriteMaterial).dispose();
      (moonRing.material as THREE.SpriteMaterial).dispose();
      for (const t of [earthMap, earthRoughness, moonMap, sunMap, ringTexture, glowTexture]) {
        t.dispose();
      }
      // The unused half of the placeholder pair when a real file was supplied.
      earthPlaceholders.color.dispose();
      earthPlaceholders.roughness.dispose();
    },
  };
}
