/**
 * The visit screen's pictures (owner's pick B, `design/visit-screen/visit-B.png`).
 *
 * The control pictures are Fluent Emoji flat (Microsoft, MIT; `src/pictures/`), kept byte for
 * byte as published. The toy cards compose those with a few flat shapes and the worlds' own
 * textures, the way the mock's cards were drawn, so a child who cannot read can tell the cards
 * apart from the picture alone. Each card picture is a 120 x 84 night-sky scene.
 */
import planetUrl from '../pictures/planet.svg?url';
import speakerUrl from '../pictures/speaker.svg?url';
import cameraUrl from '../pictures/camera.svg?url';
import astronautUrl from '../pictures/astronaut.svg?url';
import sunUrl from '../pictures/sun.svg?url';
import houseUrl from '../pictures/house.svg?url';
import rocketUrl from '../pictures/rocket.svg?url';
import glowstarUrl from '../pictures/glowstar.svg?url';
import { DESTINATIONS } from '../config';

export type PictureName = 'planet' | 'speaker' | 'camera' | 'astronaut';
const PICTURES: Record<PictureName, string> = {
  planet: planetUrl, speaker: speakerUrl, camera: cameraUrl, astronaut: astronautUrl,
};

/** One of the control pictures, decorative: the control carries its own accessible name. */
export function picture(name: PictureName, className = 'picture'): HTMLImageElement {
  const image = document.createElement('img');
  image.className = className;
  image.src = PICTURES[name];
  image.alt = '';
  image.draggable = false;
  image.setAttribute('aria-hidden', 'true');
  return image;
}

export type CardPicture = 'jump' | 'moonlight' | 'turn-earth' | 'day-night' | 'rover' | 'bath' | 'far-away' | 'places';

const INK = '#2b2118';
const SKY = '<rect width="120" height="84" fill="#0a0b22"/>';
const stars = (points: [number, number, number][]) =>
  `<g fill="#fff">${points.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
/** A world drawn from its own map, as the game's world chips are. */
const world = (id: string, cx: number, cy: number, r: number, clip: string) =>
  `<clipPath id="${clip}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>` +
  `<image href="./assets/${id}.jpg" x="${cx - r * 2}" y="${cy - r}" width="${r * 4}" height="${r * 2}" preserveAspectRatio="none" clip-path="url(#${clip})"/>`;
/** The night half of a world lit from the left, and its outline. */
const night = (cx: number, cy: number, r: number) =>
  `<path d="M${cx} ${cy - r} a${r} ${r} 0 0 1 0 ${r * 2} z" fill="#070a1c" opacity=".62"/>` +
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-width="2.5"/>`;
const sunlight = (x0: number, x1: number, y: number) =>
  `<g stroke="#ffd564" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="1 7">` +
  `<path d="M${x0} ${y - 10} L${x1} ${y - 6}"/><path d="M${x0 + 2} ${y} L${x1} ${y}"/><path d="M${x0} ${y + 10} L${x1} ${y + 6}"/></g>`;
/** The near half of a ring, drawn over its world (the far half goes behind it). */
const ringFront = (cx: number, cy: number, rx: number, ry: number, tilt: number) =>
  `<path d="M${cx - rx} ${cy} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}" fill="none" stroke="#d7c693" stroke-width="4" transform="rotate(${tilt} ${cx} ${cy})"/>`;
/** A little snapshot of one of the world's places, tilted, as the Places mock drew them. */
const snapshot = (id: string | undefined, x: number, tilt: number) => id
  ? `<g transform="rotate(${tilt} ${x + 22} 32)"><rect x="${x}" y="7" width="44" height="50" rx="3" fill="#fffdf6" stroke="${INK}" stroke-width="2.5"/>` +
    `<image href="./assets/discoveries/thumbs/${id}.jpg" x="${x + 4}" y="11" width="36" height="36" preserveAspectRatio="xMidYMid slice"/></g>`
  : '';
/** A curved arrow under a world: it turns. */
const turnArrow = (cx: number, y: number, half: number) =>
  `<g fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M${cx - half} ${y} q${half} ${half * 0.55} ${half * 2} 0"/>` +
  `<path d="M${cx + half - 9} ${y - 1} L${cx + half} ${y} L${cx + half + 1} ${y - 9}"/></g>`;

const PICTURE_MARKUP: Record<CardPicture, (worldId: string) => string> = {
  // As mocked: the astronaut hopping above the Moon's ground.
  jump: () => SKY +
    stars([[14, 12, 1.2], [98, 9, 1.4], [106, 38, 1], [24, 40, 1], [84, 24, 1]]) +
    `<ellipse cx="60" cy="100" rx="95" ry="34" fill="#aeb4bf" stroke="${INK}" stroke-width="2.5"/>` +
    '<ellipse cx="28" cy="76" rx="9" ry="3" fill="#8c929e"/><ellipse cx="96" cy="74" rx="7" ry="2.5" fill="#8c929e"/>' +
    '<ellipse cx="60" cy="73" rx="13" ry="3.5" fill="#6d727d"/>' +
    '<path d="M44 62 q16 9 32 0" fill="none" stroke="#f2b632" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M48 54 q12 7 24 0" fill="none" stroke="#f2b632" stroke-width="3" stroke-linecap="round" opacity=".7"/>' +
    `<image href="${astronautUrl}" x="38" y="3" width="44" height="44"/>`,
  // As mocked: the Sun beaming its light at a half-lit Moon.
  moonlight: () => SKY +
    stars([[60, 10, 1.2], [108, 12, 1.2], [52, 74, 1], [10, 72, 1]]) +
    sunlight(46, 70, 44) +
    `<image href="${sunUrl}" x="4" y="22" width="42" height="42"/>` +
    `<circle cx="92" cy="44" r="21" fill="#3a3d49" stroke="${INK}" stroke-width="2.5"/>` +
    `<path d="M92 23 a21 21 0 0 0 0 42 z" fill="#f1f1ea" stroke="${INK}" stroke-width="2.5"/>` +
    '<circle cx="82" cy="38" r="3.5" fill="#cfd0c8"/><circle cx="86" cy="52" r="2.5" fill="#cfd0c8"/>',
  // Earth's bedtime spin: the Sun, Earth half in night, the house riding on top, and a turn.
  'turn-earth': () => SKY +
    stars([[58, 8, 1.2], [112, 10, 1.2], [8, 76, 1], [112, 70, 1]]) +
    sunlight(42, 58, 46) +
    `<image href="${sunUrl}" x="2" y="26" width="40" height="40"/>` +
    world('earth', 85, 47, 24, 'pic-clip-earth') + night(85, 47, 24) +
    `<image href="${houseUrl}" x="72" y="0" width="26" height="26"/>` +
    turnArrow(85, 76, 20),
  // Mars and Saturn's timed day: the same Sun and turn, on this world.
  'day-night': (worldId) => SKY +
    stars([[58, 8, 1.2], [112, 10, 1.2], [8, 76, 1], [112, 70, 1]]) +
    sunlight(44, 62, 42) +
    `<image href="${sunUrl}" x="3" y="22" width="40" height="40"/>` +
    (worldId === 'saturn'
      ? `<ellipse cx="86" cy="42" rx="31" ry="8" fill="none" stroke="#d7c693" stroke-width="4" transform="rotate(-14 86 42)"/>`
      : '') +
    world(worldId, 86, 42, 19, 'pic-clip-day') + night(86, 42, 19) +
    (worldId === 'saturn'
      ? ringFront(86, 42, 31, 8, -14)
      : '') +
    turnArrow(86, 70, 18),
  // Mars's rover: Earth sends a slow signal; the rover rolls to a glowing rock.
  rover: () => '<rect width="120" height="84" fill="#1a0f1e"/>' +
    stars([[44, 8, 1.1], [104, 10, 1.2], [70, 20, 1]]) +
    world('earth', 13, 13, 8, 'pic-clip-signal') +
    `<circle cx="13" cy="13" r="8" fill="none" stroke="${INK}" stroke-width="1.5"/>` +
    '<path d="M24 18 L52 30" stroke="#b9dc4f" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 6"/>' +
    `<ellipse cx="60" cy="104" rx="98" ry="40" fill="#c8643a" stroke="${INK}" stroke-width="2.5"/>` +
    '<ellipse cx="20" cy="74" rx="8" ry="2.5" fill="#a24d2a"/><ellipse cx="104" cy="78" rx="7" ry="2.2" fill="#a24d2a"/>' +
    `<g stroke="${INK}" stroke-width="2.2" stroke-linejoin="round">` +
    '<path d="M58 30 V42" fill="none"/><rect x="52" y="24" width="14" height="8" rx="2" fill="#f1f1ea"/>' +
    '<rect x="30" y="42" width="40" height="13" rx="3" fill="#f1f1ea"/>' +
    '<rect x="26" y="38" width="22" height="5" rx="1.5" fill="#7f8ae6"/>' +
    '<circle cx="36" cy="60" r="6" fill="#3a3d49"/><circle cx="50" cy="60" r="6" fill="#3a3d49"/><circle cx="64" cy="60" r="6" fill="#3a3d49"/>' +
    '<path d="M84 64 L90 50 L102 48 L108 60 L100 66 Z" fill="#8b5a3c"/></g>' +
    '<circle cx="96" cy="57" r="16" fill="none" stroke="#f2b632" stroke-width="3" opacity=".9"/>',
  // Saturn's bath: Saturn floating in a bath of water.
  bath: () => SKY +
    stars([[14, 10, 1.2], [102, 8, 1.4], [62, 6, 1]]) +
    '<g fill="#fff" stroke="#9fd8f5" stroke-width="1.2"><circle cx="22" cy="36" r="3.5"/><circle cx="30" cy="27" r="2.2"/><circle cx="98" cy="30" r="3"/></g>' +
    `<path d="M10 50 H110 V58 a16 16 0 0 1 -16 16 H26 a16 16 0 0 1 -16 -16 Z" fill="#f8f0dd" stroke="${INK}" stroke-width="2.5"/>` +
    `<path d="M24 74 l-4 7 M96 74 l4 7" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
    `<ellipse cx="60" cy="40" rx="30" ry="7" fill="none" stroke="#d7c693" stroke-width="4" transform="rotate(-12 60 40)"/>` +
    world('saturn', 60, 40, 14, 'pic-clip-bath') +
    `<circle cx="60" cy="40" r="14" fill="none" stroke="${INK}" stroke-width="2"/>` +
    ringFront(60, 40, 30, 7, -12) +
    `<path d="M8 50 H112 V56 H8 Z" fill="#7cc8f0" stroke="${INK}" stroke-width="2.5"/>`,
  // The Sun's Far away: a rocket flies off from the big Sun towards a little star.
  'far-away': () => SKY +
    stars([[64, 10, 1.2], [110, 70, 1.2], [56, 76, 1], [90, 14, 1]]) +
    `<image href="${sunUrl}" x="-10" y="16" width="54" height="54"/>` +
    '<path d="M46 50 Q64 44 76 40" fill="none" stroke="#c9cff5" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7"/>' +
    `<image href="${rocketUrl}" x="70" y="24" width="28" height="28" transform="rotate(45 84 38)"/>` +
    `<image href="${glowstarUrl}" x="100" y="26" width="16" height="16"/>`,
  // Places (owner's pick B, design/places/places-B.png): two of this world's real photos with
  // a camera in front.
  places: (worldId) => {
    const places = DESTINATIONS[worldId]?.places ?? [];
    return SKY + stars([[10, 10, 1.2], [112, 70, 1.2], [8, 64, 1]]) +
      snapshot(places[1]?.id, 14, -9) + snapshot(places[0]?.id, 58, 8) +
      `<image href="${cameraUrl}" x="35" y="34" width="50" height="50"/>`;
  },
};

/** The markup for one card's picture, as an inline SVG (static strings only). */
export function cardPictureMarkup(kind: CardPicture, worldId: string): string {
  return `<svg viewBox="0 0 120 84" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${PICTURE_MARKUP[kind](worldId)}</svg>`;
}
