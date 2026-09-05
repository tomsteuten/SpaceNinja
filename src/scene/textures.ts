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

/**
 * Hard ceiling on a supplied image before it ever reaches the GPU.
 *
 * The NASA Blue Marble originals are 21600x10800 — a 933MB RGBA upload that kills a
 * tablet outright, and the kind of thing that is very easy to drop in by accident. This
 * turns "dead tab" into "slightly soft texture, and a console line telling you to resize
 * the file", which is the right failure for a folder anyone is invited to throw art into.
 */
const MAX_TEXTURE_WIDTH = 2048;

function shrinkToFit(texture: THREE.Texture, file: string): THREE.Texture {
  const image = texture.image as { width?: number; height?: number } | undefined;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  if (!width || !height || width <= MAX_TEXTURE_WIDTH) return texture;

  const scaledHeight = Math.max(1, Math.round((height * MAX_TEXTURE_WIDTH) / width));
  const [el, ctx] = canvas2d(MAX_TEXTURE_WIDTH, scaledHeight);
  ctx.drawImage(texture.image as CanvasImageSource, 0, 0, MAX_TEXTURE_WIDTH, scaledHeight);
  texture.dispose();
  console.warn(
    `[assets] ${file} is ${width}x${height}; rescaled to ${MAX_TEXTURE_WIDTH}x${scaledHeight} ` +
      'before upload. Resize the file itself to save the download.',
  );
  return new THREE.CanvasTexture(el);
}

export interface TextureRequest {
  /** File name inside public/assets/, e.g. "earth.jpg". */
  file: string;
  /** Produces the placeholder when the file is absent. */
  fallback: () => THREE.Texture;
  /**
   * What to call the fallback in the console. Defaults to "placeholder", which is a lie
   * when the fallback is something better — the roughness map derived from a supplied
   * earth.jpg, say — and these log lines are what the assets README tells people to read.
   */
  fallbackLabel?: string;
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

  const label = req.fallbackLabel ?? 'placeholder';

  if (await imageExists(url)) {
    try {
      texture = shrinkToFit(await loadImage(url), req.file);
      source = 'file';
    } catch {
      texture = req.fallback();
      source = label + ' (file could not be decoded)';
    }
  } else {
    texture = req.fallback();
    source = label;
  }

  texture.colorSpace = req.colorSpace ?? THREE.SRGBColorSpace;
  texture.anisotropy = req.anisotropy ?? 4;
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  console.info('[assets] ' + req.file + ': ' + source);
  return texture;
}

/**
 * For maps that have no placeholder: supplied or absent, never generated.
 *
 * Returns null when the file is not there, so the caller can leave the whole feature
 * switched off rather than wiring up a map that renders nothing. Never rejects — a file
 * that is present but broken is treated as absent, because a decode failure should cost
 * the feature, not the scene.
 */
export async function resolveOptionalTexture(
  req: Omit<TextureRequest, 'fallback' | 'fallbackLabel'>,
): Promise<THREE.Texture | null> {
  const url = ASSET_BASE + req.file;

  if (!(await imageExists(url))) {
    console.info('[assets] ' + req.file + ': absent (optional)');
    return null;
  }

  let texture: THREE.Texture;
  try {
    texture = shrinkToFit(await loadImage(url), req.file);
  } catch {
    console.warn('[assets] ' + req.file + ': present but could not be decoded - skipped');
    return null;
  }

  texture.colorSpace = req.colorSpace ?? THREE.SRGBColorSpace;
  texture.anisotropy = req.anisotropy ?? 4;
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  console.info('[assets] ' + req.file + ': file');
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
  color: THREE.Texture;
  roughness: THREE.Texture;
}

/**
 * How glossy the sea is. Raised from 0.42, which put a blown-out white glint the size of
 * the north Atlantic on the ocean — tolerable against the stylised generated map, and
 * badly overcooked against a photographic one, whose darker water throws the highlight
 * into much higher contrast.
 */
const SEA_ROUGHNESS = 0.55;
/** Land, ice and cloud: matte, so nothing off the water takes a specular highlight. */
const SHORE_ROUGHNESS = 0.9;

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
        rough = SEA_ROUGHNESS;
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
        rough = SHORE_ROUGHNESS;
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

/**
 * A roughness map read back out of a colour map: water is blue-dominant and not very
 * bright, so it gets the sheen and everything else stays matte.
 *
 * This exists because the generated colour and roughness maps are cut from the *same*
 * noise field, and are only correct as a pair. Drop a real Earth photo in on its own and
 * the generated roughness is suddenly describing continents that are not there — matte
 * oceans, and a specular highlight sliding across the Sahara. Deriving from whatever
 * colour map actually won means the pair always agree.
 *
 * Returns null if the pixels cannot be read, in which case the caller keeps its own
 * fallback rather than getting something wrong.
 */
export function deriveRoughness(source: THREE.Texture): THREE.CanvasTexture | null {
  const image = source.image as ({ width?: number; height?: number } & CanvasImageSource) | undefined;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  if (!image || !width || !height) return null;

  try {
    const [el, ctx] = canvas2d(width, height);
    ctx.drawImage(image, 0, 0);
    const map = ctx.getImageData(0, 0, width, height);
    const p = map.data;

    for (let i = 0; i < p.length; i += 4) {
      const r = p[i] ?? 0;
      const g = p[i + 1] ?? 0;
      const b = p[i + 2] ?? 0;
      // How far blue leads the other channels, damped where the pixel is bright enough to
      // be ice or cloud rather than water. Continuous rather than a threshold, so
      // coastlines come out soft instead of stair-stepped.
      const lead = THREE.MathUtils.clamp((b - Math.max(r, g)) / 40, 0, 1);
      const bright = THREE.MathUtils.clamp((Math.max(r, g, b) - 150) / 80, 0, 1);
      // The same two values makeEarthMaps writes, so a supplied map and a generated one
      // catch the light identically.
      const v = Math.round(mix(SHORE_ROUGHNESS * 255, SEA_ROUGHNESS * 255, lead * (1 - bright)));
      p[i] = v;
      p[i + 1] = v;
      p[i + 2] = v;
      p[i + 3] = 255;
    }

    ctx.putImageData(map, 0, 0);
    return new THREE.CanvasTexture(el);
  } catch {
    // getImageData throws on a tainted canvas. Assets are same-origin so this should not
    // happen, but a wrong guess here would be baked into every frame.
    return null;
  }
}

/**
 * Earth's two maps together, because they are only ever correct as a pair.
 *
 *  - both files supplied: use both, the author knows what they want.
 *  - earth.jpg alone (the common case — Blue Marble ships no roughness map): derive the
 *    roughness from it.
 *  - neither: the generated pair, which already agree with each other.
 */
export async function resolveEarthMaps(size: number): Promise<EarthMaps> {
  const placeholders = makeEarthMaps(size);

  const color = await resolveTexture({
    file: 'earth.jpg',
    fallback: () => placeholders.color,
    anisotropy: 8,
  });

  // Identity, not a second HEAD probe: whatever resolveTexture handed back is the truth
  // about which one won, including when a supplied file failed to decode.
  const usingRealColor = color !== placeholders.color;
  const derived = usingRealColor ? deriveRoughness(color) : null;

  const roughness = await resolveTexture({
    file: 'earth-roughness.jpg',
    fallback: () => derived ?? placeholders.roughness,
    fallbackLabel: derived
      ? 'derived from earth.jpg'
      : usingRealColor
        ? 'placeholder (could not derive from earth.jpg)'
        : 'placeholder',
    colorSpace: THREE.NoColorSpace,
  });

  // Release whichever candidates lost.
  if (color !== placeholders.color) placeholders.color.dispose();
  if (roughness !== placeholders.roughness) placeholders.roughness.dispose();
  if (derived && roughness !== derived) derived.dispose();

  return { color, roughness };
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

/**
 * A banded gas giant: pale gold latitude stripes, no craters, no continents.
 *
 * The same equirectangular shape as the other bodies, but the structure is horizontal
 * bands rather than a noise field, because that is what reads as "the stripy planet" at a
 * glance. Fine noise breaks the bands up so they do not look like drawn lines; there is no
 * polar cap, and no hard feature, because a real Saturn has none a child would recognise —
 * the recognisable thing is the rings, which are a separate texture and a separate mesh.
 */
export function makeSaturnTexture(width: number): THREE.CanvasTexture {
  const height = width / 2;
  const [el, ctx] = canvas2d(width, height);
  const image = ctx.createImageData(width, height);
  const data = image.data;

  for (let j = 0; j < height; j++) {
    const lat = (0.5 - (j + 0.5) / height) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    // Several soft bands between pole and pole, their edges wobbled by low-frequency noise
    // so they wander like real cloud belts instead of sitting as ruled stripes.
    const bandNoise = fbm(cosLat * 2 + 5, sinLat * 6 + 9, 3, 2) - 0.5;
    const band = Math.sin(sinLat * 9 + bandNoise * 1.6) * 0.5 + 0.5;

    for (let i = 0; i < width; i++) {
      const lon = ((i + 0.5) / width) * Math.PI * 2;
      const px = cosLat * Math.cos(lon);
      const pz = cosLat * Math.sin(lon);
      const grain = fbm(px * 8 + 2, sinLat * 3, pz * 8 + 2, 3) - 0.5;

      // Two golds, lerped by the band value, with a little grain on top. Warmer and paler
      // than Mars so the two rusty-vs-buttery planets never read as the same colour.
      const t = THREE.MathUtils.clamp(band + grain * 0.22, 0, 1);
      const r = mix(196, 232, t);
      const g = mix(168, 210, t);
      const b = mix(116, 158, t);

      const o = (j * width + i) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return new THREE.CanvasTexture(el);
}

/**
 * The rings, as a strip that runs inner edge to outer edge along its width.
 *
 * Deliberately 1-D: the caller rewrites the RingGeometry's UVs so `u` runs across the
 * radius (which THREE does *not* do by default — the classic Saturn gotcha), so all the
 * structure lives along x here and a single row would do. A few rows of gentle noise only
 * stop it looking laser-cut. Alpha is part of the map: the Cassini Division and the inner
 * edge are gaps you can see stars through, which is what a flat opaque disc never gets right.
 */
export function makeSaturnRingTexture(width = 1024): THREE.CanvasTexture {
  const height = 16;
  const [el, ctx] = canvas2d(width, height);
  const image = ctx.createImageData(width, height);
  const data = image.data;

  // Ring structure across the radius, as [start, end, brightness, alpha] in 0..1 of the
  // strip. Real proportions: a faint inner C ring, the bright B ring, the dark Cassini
  // Division, then the A ring, fading out at the edge.
  const bands: Array<[number, number, number, number]> = [
    [0.0, 0.16, 0.5, 0.25], // C ring: thin and see-through
    [0.16, 0.58, 1.0, 0.95], // B ring: the bright, dense one
    [0.58, 0.66, 0.3, 0.12], // Cassini Division: a near-gap
    [0.66, 0.97, 0.78, 0.72], // A ring
    [0.97, 1.0, 0.4, 0.0], // outer edge fades to nothing
  ];

  function sample(u: number): { level: number; alpha: number } {
    for (const [start, end, level, alpha] of bands) {
      if (u >= start && u < end) {
        // Fade the very first and last sliver of each band so edges are soft, not stepped.
        const edge = Math.min(1, Math.min(u - start, end - u) / 0.015);
        return { level, alpha: alpha * edge };
      }
    }
    return { level: 0, alpha: 0 };
  }

  for (let i = 0; i < width; i++) {
    const u = (i + 0.5) / width;
    const { level, alpha } = sample(u);
    for (let j = 0; j < height; j++) {
      // A whisper of noise along the radius so the bands have grain rather than flat fill.
      const grain = (fbm(u * 90, j * 0.5, 3, 2) - 0.5) * 0.16;
      const l = THREE.MathUtils.clamp(level + grain, 0, 1);
      const o = (j * width + i) * 4;
      data[o] = mix(120, 226, l);
      data[o + 1] = mix(104, 206, l);
      data[o + 2] = mix(78, 168, l);
      data[o + 3] = Math.round(THREE.MathUtils.clamp(alpha + grain * 0.3, 0, 1) * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(el);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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

/**
 * One emoji on a transparent square, for the badge left behind on a place once it has
 * been found.
 *
 * Emoji rather than authored art, and not only because it ships no bytes: the journal
 * already labels every discovery with exactly these characters, so the badge on the planet
 * and the entry in the book are the same picture. A sprite sheet would be a second visual
 * language to keep in step with the first.
 *
 * The dark rim underneath is doing real work. These sit on a bright desert, a green
 * rainforest, grey regolith and red dust, and a flat emoji dropped on any of them can lose
 * its edge entirely; a shadow behind it separates it from all four.
 */
export function makeEmojiTexture(emoji: string, size = 128): THREE.CanvasTexture {
  const [el, ctx] = canvas2d(size, size);
  const half = size / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // A named emoji stack first: a bare sans-serif can fall through to a monochrome glyph on
  // platforms that carry both, and the colour is most of what makes these legible.
  ctx.font = `${Math.round(size * 0.68)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = size * 0.09;
  ctx.fillText(emoji, half, half + size * 0.02);

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
