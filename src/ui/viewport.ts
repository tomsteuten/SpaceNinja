/**
 * The visit screen's clear playfield: the part of the screen the world may use, clear of the
 * toy shelf and the top buttons (owner's pick B, `design/visit-screen/visit-B.png`).
 *
 * The numbers mirror `src/ui/visit.css`; change them together. Portrait keeps the Space map
 * button, the Listen/Journal column and the found counter out of the band the world sits in,
 * and the shelf along the bottom. Landscape has the shelf down the right side; the corner
 * buttons on the left sit outside the world's round silhouette, so only a little is kept at
 * the top for the name chip.
 */
export interface Playfield {
  /** The clear rectangle, in CSS pixels. */
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** True when the visit screen lays out for landscape (shelf down the right side). */
export function isLandscape(width: number, height: number): boolean {
  return width > height;
}

/** Card height and width the shelf holds, in CSS pixels (visit.css `--card-h`, `--card-w`). */
export function shelfCard(width: number, height: number): { width: number; height: number } {
  if (isLandscape(width, height)) {
    const large = width >= 900 && height >= 600;
    return large ? { width: 210, height: 190 } : { width: 176, height: 162 };
  }
  const large = width >= 600 && height >= 900;
  return large ? { width: 210, height: 180 } : { width: 168, height: 150 };
}

/** Space the shelf takes from the edge of the screen (visit.css `.toy-shelf`). */
export function shelfDepth(width: number, height: number): number {
  const card = shelfCard(width, height);
  return isLandscape(width, height) ? card.width + 40 : card.height + 34;
}

/** Portrait: the top buttons' band (Space map 76 px, Listen and Journal 50 px each, gaps). */
const PORTRAIT_TOP = 128;
/** Portrait: the found counter sits this far above the shelf, and is this tall. */
const PORTRAIT_COUNTER = 42;
/** Landscape: a little kept clear at the top for the name chip. */
const LANDSCAPE_TOP = 16;

export function visitPlayfield(width: number, height: number): Playfield {
  const shelf = shelfDepth(width, height);
  if (isLandscape(width, height)) {
    return { left: 0, top: LANDSCAPE_TOP, right: Math.max(1, width - shelf), bottom: height };
  }
  return { left: 0, top: PORTRAIT_TOP, right: width, bottom: Math.max(PORTRAIT_TOP + 1, height - shelf - PORTRAIT_COUNTER) };
}

/**
 * How the camera puts the world in the playfield: the projection is shifted (in CSS pixels,
 * for `camera.setViewOffset`) so the optical centre is the playfield's centre, and the framing
 * fits the subject into the playfield's share of the frame (`width`/`height`, 0..1).
 */
export interface PlayfieldView {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export const FULL_VIEW: PlayfieldView = { offsetX: 0, offsetY: 0, width: 1, height: 1 };

export function playfieldView(width: number, height: number): PlayfieldView {
  const field = visitPlayfield(width, height);
  return {
    offsetX: width / 2 - (field.left + field.right) / 2,
    offsetY: height / 2 - (field.top + field.bottom) / 2,
    width: (field.right - field.left) / width,
    height: (field.bottom - field.top) / height,
  };
}
