/**
 * Texture sourcing.
 *
 * Every map is requested by name. If a matching file exists in `public/assets/` it is
 * used; otherwise we synthesise a placeholder on a 2D canvas. That keeps the project
 * playable with zero downloaded art, and upgrading is literally "drop a jpg in the
 * folder and reload" — no code change. See public/assets/README.txt.
 */

import * as THREE from 'three';

const ASSET_BASE = 'assets/';

/**
 * HEAD-probe first so a missing (expected) file does not spam the console with 404s.
 * The content-type check matters: dev servers answer unknown paths with the SPA
 * index.html at status 200, which would otherwise look like a hit.
 */
const probes = new Map<string, Promise<boolean>>();

export function imageExists(url: string): Promise<boolean> {
  let probe = probes.get(url);
  if (!probe) {
    probe = fetch(url, { method: 'HEAD' })
      .then((res) => res.ok && (res.headers.get('content-type') ?? '').startsWith('image/'))
      .catch(() => false);
    probes.set(url, probe);
  }
  return probe;
}

function loadImage(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, () =>
      reject(new Error('Failed to decode ' + url)),
    );
  });
}

export interface TextureRequest {
  /** File name inside public/assets/, e.g. "earth.jpg". */
  file: string;
  /** Produces the placeholder when the file is absent. */
  fallback: () => THREE.Texture;
  /** Colour maps are sRGB; roughness/bump maps are raw data. */
  colorSpace?: THREE.ColorSpace;
  anisotropy?: number;
}

/**
 * Resolves to the real texture when present, the placeholder otherwise.
 * Never rejects — a broken image file degrades to the placeholder.
 */
export async function resolveTexture(req: TextureRequest): Promise<THREE.Texture> {
  const url = ASSET_BASE + req.file;
  let texture: THREE.Texture;
  let source: string;

  if (await imageExists(url)) {
    try {
      texture = await loadImage(url);
      source = 'file';
    } catch {
      texture = req.fallback();
      source = 'placeholder (file could not be decoded)';
    }
  } else {
    texture = req.fallback();
    source = 'placeholder';
  }

  texture.colorSpace = req.colorSpace ?? THREE.SRGBColorSpace;
  texture.anisotropy = req.anisotropy ?? 4;
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  console.info('[assets] ' + req.file + ': ' + source);
  return texture;
}

/* -------------------------------------------------------------------------- */
/* Procedural noise                                                            */
/* -------------------------------------------------------------------------- */

function hash(ix: number, iy: number, iz: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 1274126177);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Trilinear value noise. Sampled on the unit sphere, so it wraps seamlessly. */
function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const fz = smooth(z - iz);

  const c000 = hash(ix, iy, iz);
  const c100 = hash(ix + 1, iy, iz);
  const c010 = hash(ix, iy + 1, iz);
  const c110 = hash(ix + 1, iy + 1, iz);
  const c001 = hash(ix, iy, iz + 1);
  const c101 = hash(ix + 1, iy, iz + 1);
  const c011 = hash(ix, iy + 1, iz + 1);
  const c111 = hash(ix + 1, iy + 1, iz + 1);

  const x00 = c000 + (c100 - c000) * fx;
  const x10 = c010 + (c110 - c010) * fx;
  const x01 = c001 + (c101 - c001) * fx;
  const x11 = c011 + (c111 - c011) * fx;
  const y0 = x00 + (x10 - x00) * fy;
  const y1 = x01 + (x11 - x01) * fy;
  return y0 + (y1 - y0) * fz;
}

function fbm(x: number, y: number, z: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += noise3(x * f, y * f, z * f) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.07; // non-integer so octaves do not align into a visible grid
  }
  return sum / norm;
}

function canvas2d(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const el = document.createElement('canvas');
  el.width = width;
  el.height = height;
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable - cannot build placeholder textures.');
  return [el, ctx];
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/* -------------------------------------------------------------------------- */
/* Placeholder generators                                                      */
/* -------------------------------------------------------------------------- */

export interface EarthMaps {
  color: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
}

/**
 * Blue/green world with continents, polar ice and a matching roughness map so the
 * oceans catch a specular highlight and the land does not.
 */
export function makeEarthMaps(width: number): EarthMaps {
  const height = width / 2;
  const [colorEl, colorCtx] = canvas2d(width, height);
  const [roughEl, roughCtx] = canvas2d(width, height);
  const colorData = colorCtx.createImageData(width, height);
  const roughData = roughCtx.createImageData(width, height);
  const cp = colorData.data;
  const rp = roughData.data;

  const FREQ = 2.4;
  const SEA = 0.545;

  for (let j = 0; j < height; j++) {
    const lat = (0.5 - (j + 0.5) / height) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);

    for (let i = 0; i < width; i++) {
      const lon = ((i + 0.5) / width) * Math.PI * 2;
      const px = cosLat * Math.cos(lon);
      const py = sinLat;
      const pz = cosLat * Math.sin(lon);

      // Domain-warp the continent field so coastlines wander instead of blobbing.
      const warp = fbm(px * 4.3 + 11, py * 4.3 + 7, pz * 4.3 + 3, 2) - 0.5;
      const e =
        fbm(px * FREQ + warp * 0.9, py * FREQ + warp * 0.9, pz * FREQ + warp * 0.9, 4) * 0.8 +
        fbm(px * 7.1, py * 7.1, pz * 7.1, 2) * 0.2;

      let r: number;
      let g: number;
      let b: number;
      let rough: number;

      if (e < SEA) {
        const depth = Math.min(1, (SEA - e) / 0.22);
        r = mix(48, 12, depth);
        g = mix(122, 38, depth);
        b = mix(186, 96, depth);
        rough = 0.42;
      } else {
        const h = Math.min(1, (e - SEA) / 0.3);
        if (h < 0.08) {
          const t = h / 0.08; // narrow sandy shoreline
          r = mix(196, 96, t);
          g = mix(178, 138, t);
          b = mix(126, 78, t);
        } else if (h < 0.62) {
          const t = (h - 0.08) / 0.54;
          r = mix(96, 58, t);
          g = mix(138, 104, t);
          b = mix(78, 60, t);
        } else {
          const t = (h - 0.62) / 0.38;
          r = mix(58, 148, t);
          g = mix(104, 146, t);
          b = mix(60, 142, t);
        }
        rough = 0.9;
      }

      // Polar caps, edge broken up by noise so they do not read as a drawn band.
      const capNoise = fbm(px * 5 + 31, py * 5 + 17, pz * 5 + 23, 2) * 0.16;
      const cap = (Math.abs(lat) - (1.15 - capNoise)) / 0.3;
      if (cap > 0) {
        const t = Math.min(1, cap);
        r = mix(r, 246, t);
        g = mix(g, 250, t);
        b = mix(b, 255, t);
        rough = mix(rough, 0.7, t);
      }

      const o = (j * width + i) * 4;
      cp[o] = r;
      cp[o + 1] = g;
      cp[o + 2] = b;
      cp[o + 3] = 255;

      const rv = Math.round(rough * 255);
      rp[o] = rv;
      rp[o + 1] = rv;
      rp[o + 2] = rv;
      rp[o + 3] = 255;
    }
  }

  colorCtx.putImageData(colorData, 0, 0);
  roughCtx.putImageData(roughData, 0, 0);

  return {
    color: new THREE.CanvasTexture(colorEl),
    roughness: new THREE.CanvasTexture(roughEl),
  };
}

/** Grey, cratered, gently mottled. Doubles as its own bump map. */
export function makeMoonTexture(width: number): THREE.CanvasTexture {
  const height = width / 2;
  const [el, ctx] = canvas2d(width, height);
  const image = ctx.createImageData(width, height);
  const data = image.data;

  for (let j = 0; j < height; j++) {
    const lat = (0.5 - (j + 0.5) / height) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    for (let i = 0; i < width; i++) {
      const lon = ((i + 0.5) / width) * Math.PI * 2;
      const px = cosLat * Math.cos(lon);
      const pz = cosLat * Math.sin(lon);

      // Broad dark maria under fine regolith speckle.
      const maria = fbm(px * 1.7 + 5, sinLat * 1.7 + 5, pz * 1.7 + 5, 3);
      const grain = fbm(px * 9, sinLat * 9, pz * 9, 3);
      let v = 150 + (maria - 0.5) * 96 + (grain - 0.5) * 34;
      v = Math.max(40, Math.min(226, v));

      const o = (j * width + i) * 4;
      data[o] = v;
      data[o + 1] = v * 0.985;
      data[o + 2] = v * 0.95;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  // Craters last, in 2D. Drawn three times horizontally so the seam wraps cleanly.
  const craters = Math.round(width / 7);
  for (let c = 0; c < craters; c++) {
    const cx = hash(c, 1, 9) * width;
    const cy = height * 0.25 + (0.5 + (hash(c, 2, 9) - 0.5) * 1.7) * height * 0.5;
    const radius = (0.4 + Math.pow(hash(c, 3, 9), 3) * 6) * (width / 190);

    for (const offset of [-width, 0, width]) {
      const grad = ctx.createRadialGradient(cx + offset, cy, radius * 0.1, cx + offset, cy, radius);
      grad.addColorStop(0, 'rgba(58,56,52,0.55)');
      grad.addColorStop(0.62, 'rgba(120,118,112,0.28)');
      grad.addColorStop(0.86, 'rgba(232,230,222,0.34)');
      grad.addColorStop(1, 'rgba(200,198,190,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx + offset, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return new THREE.CanvasTexture(el);
}

/**
 * Rusty deserts, darker volcanic plains and two bright polar caps.
 *
 * The same shape as makeMoonTexture: broad low-frequency regions for the big features,
 * fine noise for grain, then a 2D pass on top for anything that wants a soft gradient.
 */
export function makeMarsTexture(width: number): THREE.CanvasTexture {
  const height = width / 2;
  const [el, ctx] = canvas2d(width, height);
  const image = ctx.createImageData(width, height);
  const data = image.data;

  for (let j = 0; j < height; j++) {
    const lat = (0.5 - (j + 0.5) / height) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    for (let i = 0; i < width; i++) {
      const lon = ((i + 0.5) / width) * Math.PI * 2;
      const px = cosLat * Math.cos(lon);
      const pz = cosLat * Math.sin(lon);

      const region = fbm(px * 1.5 + 17, sinLat * 1.5 + 17, pz * 1.5 + 17, 3);
      const grain = fbm(px * 11, sinLat * 11, pz * 11, 3);
      // Dark basalt plains where the low-frequency field dips, bright dust where it rises.
      const shade = (region - 0.5) * 1.5 + (grain - 0.5) * 0.42;

      let r = mix(126, 214, THREE.MathUtils.clamp(0.5 + shade, 0, 1));
      let g = r * mix(0.46, 0.6, THREE.MathUtils.clamp(0.5 + shade * 0.6, 0, 1));
      let b = r * 0.36;

      // Polar caps, with a soft ragged edge rather than a drawn-on circle.
      const polar = Math.abs(sinLat);
      const capEdge = 0.88 + (grain - 0.5) * 0.16;
      if (polar > capEdge) {
        const t = THREE.MathUtils.clamp((polar - capEdge) / (1 - capEdge), 0, 1);
        r = mix(r, 244, t);
        g = mix(g, 240, t);
        b = mix(b, 232, t);
      }

      const o = (j * width + i) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  // A handful of craters, fewer and softer than the Moon's - Mars has weather, and a
  // heavily cratered Mars reads as "another moon" at a glance.
  const craters = Math.round(width / 22);
  for (let c = 0; c < craters; c++) {
    const cx = hash(c, 4, 21) * width;
    const cy = height * 0.3 + (0.5 + (hash(c, 5, 21) - 0.5) * 1.4) * height * 0.4;
    const radius = (0.6 + Math.pow(hash(c, 6, 21), 3) * 5) * (width / 190);

    // Drawn three times horizontally so the seam wraps cleanly.
    for (const offset of [-width, 0, width]) {
      const grad = ctx.createRadialGradient(cx + offset, cy, radius * 0.1, cx + offset, cy, radius);
      grad.addColorStop(0, 'rgba(84,42,26,0.42)');
      grad.addColorStop(0.68, 'rgba(148,84,52,0.2)');
      grad.addColorStop(0.88, 'rgba(226,158,110,0.24)');
      grad.addColorStop(1, 'rgba(210,140,96,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx + offset, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return new THREE.CanvasTexture(el);
}

/** Warm granulated plasma. The Sun is unlit and bloomed, so this is mostly surface interest. */
export function makeSunTexture(width: number): THREE.CanvasTexture {
  const height = width / 2;
  const [el, ctx] = canvas2d(width, height);
  const image = ctx.createImageData(width, height);
  const data = image.data;

  for (let j = 0; j < height; j++) {
    const lat = (0.5 - (j + 0.5) / height) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    for (let i = 0; i < width; i++) {
      const lon = ((i + 0.5) / width) * Math.PI * 2;
      const n = fbm(cosLat * Math.cos(lon) * 6, sinLat * 6, cosLat * Math.sin(lon) * 6, 3);
      const o = (j * width + i) * 4;
      data[o] = 255;
      data[o + 1] = 190 + (n - 0.5) * 90;
      data[o + 2] = 92 + (n - 0.5) * 120;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return new THREE.CanvasTexture(el);
}

/** Soft radial falloff, used for the corona sprite and the engine flame. */
export function makeGlowTexture(size = 256): THREE.CanvasTexture {
  const [el, ctx] = canvas2d(size, size);
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.16, 'rgba(255,236,190,0.86)');
  grad.addColorStop(0.42, 'rgba(255,176,96,0.32)');
  grad.addColorStop(0.72, 'rgba(255,140,70,0.08)');
  grad.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(el);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Soft glowing annulus, drawn as a billboard to mark the selected body. */
export function makeRingTexture(size = 256): THREE.CanvasTexture {
  const [el, ctx] = canvas2d(size, size);
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255,214,150,0)');
  grad.addColorStop(0.74, 'rgba(255,214,150,0)');
  grad.addColorStop(0.83, 'rgba(255,226,176,0.95)');
  grad.addColorStop(0.9, 'rgba(255,206,140,0.5)');
  grad.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(el);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Round, soft-edged dot for the starfield points. */
export function makeStarSpriteTexture(size = 64): THREE.CanvasTexture {
  const [el, ctx] = canvas2d(size, size);
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(el);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
