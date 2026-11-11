/**
 * The visit screen's clear playfield: the part of the screen the world may use, clear of the
 * toy shelf and the top buttons (owner's pick B, `design/visit-screen/visit-B.png`).
 *
 * The numbers mirror `src/ui/visit.css`; change them together. Portrait keeps the Space map
 * button and Listen out of the band the world sits in, and the shelf along the bottom. Landscape has the shelf down the right side; the corner
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

/** Portrait: the top buttons' band (Space map 78 px at 12 px from the top, and a gap). */
const PORTRAIT_TOP = 100;
/** Landscape: a little kept clear at the top for the name chip. */
const LANDSCAPE_TOP = 16;
/** Gap kept between the place photo and the world. */
const PHOTO_GAP = 12;

/**
 * Where the place photo sits (owner's pick B, design/places/places-B.png): across the top of
 * the play area under the Space map in portrait, beside the world left of the shelf in
 * landscape. The photo itself (`image`) is the panel less its paper border and name strip.
 * ui.ts places the panel from this, so the camera and the photo cannot disagree.
 */
export function placePhotoRect(width: number, height: number): Playfield & { image: number } {
  /** Paper padding and border round the photo, and the name strip under it. */
  const frame = 64;
  if (isLandscape(width, height)) {
    const shelf = shelfDepth(width, height);
    const panel = Math.round(Math.min(360, Math.max(220, width * 0.34)));
    const image = Math.max(80, Math.min(panel - 16, height - 32 - frame));
    const right = width - shelf - 14;
    const top = Math.round((height - image - frame) / 2);
    return { left: right - panel, right, top, bottom: top + image + frame, image };
  }
  const image = Math.round(Math.min(300, Math.max(140, height * 0.3)));
  const top = 104;
  return { left: 14, right: width - 14, top, bottom: top + image + frame, image };
}

export function visitPlayfield(width: number, height: number, photo = false): Playfield {
  const shelf = shelfDepth(width, height);
  if (isLandscape(width, height)) {
    const right = photo ? placePhotoRect(width, height).left - PHOTO_GAP : width - shelf;
    return { left: 0, top: LANDSCAPE_TOP, right: Math.max(1, right), bottom: height };
  }
  const top = photo ? placePhotoRect(width, height).bottom + PHOTO_GAP : PORTRAIT_TOP;
  return { left: 0, top, right: width, bottom: Math.max(top + 1, height - shelf - 12) };
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

export function playfieldView(width: number, height: number, photo = false): PlayfieldView {
  const field = visitPlayfield(width, height, photo);
  return {
    offsetX: width / 2 - (field.left + field.right) / 2,
    offsetY: height / 2 - (field.top + field.bottom) / 2,
    width: (field.right - field.left) / width,
    height: (field.bottom - field.top) / height,
  };
}
