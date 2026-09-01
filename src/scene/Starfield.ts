/**
 * The backdrop: a violet-to-navy void with layered point stars.
 *
 * If public/assets/starfield.jpg exists it becomes the scene background instead of the
 * gradient shell, and the points stay on top as a parallax layer.
 */

import * as THREE from 'three';
import { STAR_SHELL_RADIUS } from '../config';
import { imageExists, makeStarSpriteTexture } from './textures';
import type { QualitySettings } from './quality';

export interface Sky {
  group: THREE.Group;
  /** Set once the optional equirect background has been probed. */
  applyBackgroundTo(scene: THREE.Scene): Promise<void>;
  update(dt: number): void;
  dispose(): void;
}

/** Deterministic pseudo-random so the sky looks the same on every load. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Inverted sphere carrying a soft nebula gradient. Unlit, so it costs almost nothing. */
function createGradientShell(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(STAR_SHELL_RADIUS * 1.15, 24, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x120a30) },
      uBottom: { value: new THREE.Color(0x05040f) },
      uHaze: { value: new THREE.Color(0x3a2270) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uBottom;
      uniform vec3 uHaze;
      varying vec3 vDir;
      void main() {
        float h = vDir.y * 0.5 + 0.5;
        vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, h));
        // A slow diagonal band of violet haze, like a distant arm of the galaxy.
        float band = exp(-pow((vDir.y - vDir.x * 0.45) * 2.6, 2.0));
        col += uHaze * band * 0.34;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -2;
  return mesh;
}

interface StarLayer {
  count: number;
  size: number;
  opacity: number;
}

function createStarLayer(
  layer: StarLayer,
  sprite: THREE.Texture,
  random: () => number,
): THREE.Points {
  const positions = new Float32Array(layer.count * 3);
  const colors = new Float32Array(layer.count * 3);
  const tint = new THREE.Color();

  for (let i = 0; i < layer.count; i++) {
    // Uniform distribution over the sphere shell.
    const u = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const radius = STAR_SHELL_RADIUS * (0.86 + random() * 0.14);
    positions[i * 3] = Math.cos(theta) * r * radius;
    positions[i * 3 + 1] = u * radius;
    positions[i * 3 + 2] = Math.sin(theta) * r * radius;

    // Mostly cool white, occasionally warm — reads as varied star temperature.
    const warm = random();
    tint.setHSL(warm < 0.78 ? 0.6 : 0.09, 0.35, 0.72 + random() * 0.28);
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    map: sprite,
    size: layer.size,
    sizeAttenuation: false, // constant pixel size keeps stars crisp at any zoom
    vertexColors: true,
    transparent: true,
    opacity: layer.opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  const points = new THREE.Points(geometry, material);
  points.renderOrder = -1;
  points.frustumCulled = false;
  return points;
}

/** Resolves to the background texture, or null if the file is absent or unreadable. */
async function loadOptionalBackground(): Promise<THREE.Texture | null> {
  const url = 'assets/starfield.jpg';
  if (!(await imageExists(url))) return null;
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(
      url,
      resolve,
      undefined,
      () => resolve(null),
    );
  });
}

export function createSky(quality: QualitySettings): Sky {
  const group = new THREE.Group();
  const random = makeRandom(0x5eed);
  const sprite = makeStarSpriteTexture(64);

  const shell = createGradientShell();
  group.add(shell);

  // Three layers instead of per-star sizing: same visual variety, three draw calls.
  const layers: StarLayer[] = [
    { count: Math.round(quality.starCount * 0.66), size: 2, opacity: 0.7 },
    { count: Math.round(quality.starCount * 0.28), size: 3.5, opacity: 0.85 },
    { count: Math.round(quality.starCount * 0.06), size: 6, opacity: 1 },
  ];
  const points = layers.map((layer) => createStarLayer(layer, sprite, random));
  points.forEach((p) => group.add(p));

  let backgroundTexture: THREE.Texture | null = null;

  return {
    group,

    async applyBackgroundTo(scene: THREE.Scene) {
      // The fallback is the gradient shell already in the group, so on any failure we
      // simply leave it alone rather than generating a substitute.
      const texture = await loadOptionalBackground();
      if (!texture) {
        console.info('[assets] starfield.jpg: placeholder (generated points + gradient)');
        return;
      }
      console.info('[assets] starfield.jpg: file');
      backgroundTexture = texture;
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      scene.background = texture;
      shell.visible = false;
    },

    update(dt: number) {
      // Barely-there drift; enough to make the sky feel alive without anyone noticing why.
      group.rotation.y += dt * 0.0035;
    },

    dispose() {
      shell.geometry.dispose();
      (shell.material as THREE.ShaderMaterial).dispose();
      for (const p of points) {
        p.geometry.dispose();
        (p.material as THREE.PointsMaterial).dispose();
      }
      sprite.dispose();
      backgroundTexture?.dispose();
    },
  };
}
