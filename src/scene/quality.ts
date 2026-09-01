/**
 * Device quality tiering.
 *
 * The target device is an older Android tablet, so we start conservative and only
 * spend on effects when the hardware hints look healthy. `Stage` additionally
 * measures real frame times after startup and can demote the tier once — hints
 * lie, frame times do not.
 */

export type Tier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  tier: Tier;
  /** Upper bound on renderer pixel ratio. The single biggest mobile fill-rate lever. */
  maxPixelRatio: number;
  antialias: boolean;
  bloom: boolean;
  /** Bloom is rendered at this fraction of the drawing buffer. */
  bloomScale: number;
  /** [widthSegments, heightSegments] for a full-detail body such as Earth. */
  sphereSegments: [number, number];
  /** Equirectangular width for generated placeholder textures. Height is half. */
  textureSize: number;
  starCount: number;
}

const PRESETS: Record<Tier, QualitySettings> = {
  low: {
    tier: 'low',
    maxPixelRatio: 1,
    antialias: false,
    bloom: false,
    bloomScale: 0.5,
    sphereSegments: [32, 16],
    textureSize: 512,
    starCount: 1400,
  },
  medium: {
    tier: 'medium',
    maxPixelRatio: 1.5,
    antialias: false,
    bloom: true,
    bloomScale: 0.5,
    sphereSegments: [48, 24],
    textureSize: 512,
    starCount: 2200,
  },
  high: {
    tier: 'high',
    maxPixelRatio: 2,
    antialias: true,
    bloom: true,
    bloomScale: 0.6,
    sphereSegments: [64, 32],
    textureSize: 1024,
    starCount: 3200,
  },
};

interface NavigatorHints {
  deviceMemory?: number;
}

export function detectQuality(): QualitySettings {
  const nav = navigator as Navigator & NavigatorHints;
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  if (cores <= 4 || memory <= 2) return PRESETS.low;
  if (coarse || cores <= 6 || memory <= 4) return PRESETS.medium;
  return PRESETS.high;
}

/** One step down the ladder. Returns null at the bottom. */
export function demote(current: QualitySettings): QualitySettings | null {
  if (current.tier === 'high') return PRESETS.medium;
  if (current.tier === 'medium') return PRESETS.low;
  return null;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
