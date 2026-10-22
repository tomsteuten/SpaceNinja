/**
 * The interface's own icons.
 *
 * These replace emoji. Emoji were doing a real job — they are instantly readable to a
 * child who cannot read words — but they are drawn by the operating system, so 🚀 is a
 * different object on an iPad, a Pixel and a Windows laptop, and none of those objects
 * belong to this game. They also cannot take a colour, which is why every button looked
 * like a label with something pasted onto it.
 *
 * Controls use the approved soft blue/cream filled illustrations. Utility icons
 * remain round-capped strokes in currentColor. Both are authored SVG, not OS glyphs.
 */

const ICONS = {
  construction: '<path d="M4 9h16v7H4zM7 9l5 7m2-7 5 7M7 16v5m10-5v5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  turnArrow: '<path d="M3 9c4 7 15 7 19 0m-6-1 7 0-1 6"/>',
  back: '<path d="m12 7-8 11 8 10M5 18h20c7 0 10 4 10 10"/>',
  spaceMap: '<path d="m9 6-6 6 6 6M4 12h12" stroke="#e2f2f6" stroke-width="3"/><circle cx="23" cy="24" r="10" fill="#69b7d5" stroke="#d0eef1"/><path d="m21 15-5 7 7 2 1 8 6-7-2-7Z" fill="#b8d8a5" stroke="none"/><circle cx="35" cy="9" r="5" fill="#d8d9dd" stroke="#eff1ef"/><circle cx="36" cy="8" r="1.5" fill="#a2aabb" stroke="none"/>',
  dragHand: '<path d="M4 9H1m0 0 3-3M1 9l3 3M20 9h3m0 0-3-3m3 3-3 3" stroke="#fff0c4"/><path d="M9 20V8a2 2 0 0 1 4 0v6l2-1 4 2v4l-3 4h-5l-5-6a2 2 0 0 1 3-2" fill="#fff0c4" stroke="#263b55"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/>',
  rocket:
    '<path d="M12 2.6c2.7 2.4 4.1 5.5 4.1 8.9v3.2l1.8 1.9v3.2l-2.9-1.3-3 1.3-3-1.3-2.9 1.3v-3.2l1.8-1.9v-3.2c0-3.4 1.4-6.5 4.1-8.9Z"/>' +
    '<circle cx="12" cy="10" r="1.7"/>',
  rock: '<path d="M3.6 13.2 7.9 6.1l6.2-2.1 6.3 4.7-1.6 7.3-7.8 2.6Z"/><path d="m7.9 6.1 4.5 5.6 7.9-2.9"/>',
  speaker: '<path d="M6 14h7l9-7v23l-9-7H6Z" fill="#a8dce5" stroke="#a8dce5"/><path d="M28 12a10 10 0 0 1 0 13M33 8a16 16 0 0 1 0 21" stroke="#a8dce5"/>',
  journal: '<path d="M8 4h24v28H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" fill="#a9ced0" stroke="#d5eeed"/><path d="M11 4v24M4 28h28" stroke="#325165"/><circle cx="23" cy="16" r="5" fill="#354d6a" stroke="none"/><path d="m17 19 12-6" stroke="#eddfaf"/>',
  /** The empty mission slot: something is meant to go here. */
  dot: '<circle cx="12" cy="12" r="2.4"/>',
  /**
   * The gold target to go and find. A double ring around a centre dot, so the empty slot in
   * the counter is a small picture of the very thing on the planet the child is hunting for
   * — the counter and the markers then read as the same object, which is what a pre-reader
   * has instead of the sentence above them.
   */
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.4"/>',
  /** On the photo thumbnail: this opens bigger. Four arrows pushing out from the middle. */
  expand:
    '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/>' +
    '<path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
  /**
   * The way back to the solar-system map: a little sun with a planet on its orbit. It stands
   * for the whole home view a child returns to, which "home" (they are standing on a world
   * that is also called home) and a rocket (which means go, not come back) both failed to say.
   */
  orbit:
    '<circle cx="12" cy="12" r="2.3"/>' +
    '<g transform="rotate(-20 12 12)"><ellipse cx="12" cy="12" rx="9" ry="4.2"/><circle cx="21" cy="12" r="1.5"/></g>',
  /** Turning a world through a day. A sun, because what moves is the light on the ground. */
  /** Moon jump: a child in mid-air, arms up, above the ground line. */
  jump:
    '<circle cx="12" cy="4.5" r="2.3"/><path d="M12 7.5v6M12 9.5 8 6.5M12 9.5l4-3M12 13.5l-3 3.5M12 13.5l3 3.5"/>' +
    '<path d="M5 22h14" stroke-dasharray="2 3"/>',
  /** Saturn's bath: a tub on little feet, a tap, and a bubble. */
  bath:
    '<path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z"/><path d="M7 19l-1 2.5M17 19l1 2.5"/>' +
    '<path d="M6 12V6a2 2 0 0 1 4 0"/><circle cx="15" cy="7" r="1.6"/><circle cx="18.5" cy="4" r="1"/>',
  /** Mars rover: Perseverance from the side, six wheels and its camera mast. */
  rover:
    '<path d="M4 12.5h13v3.5H4z"/><path d="M15 12.5V7.5M12.5 5h5.5v2.5h-5.5z"/><path d="M7 12.5 6 10h4"/>' +
    '<circle cx="5.5" cy="19" r="2"/><circle cx="10.5" cy="19" r="2"/><circle cx="15.5" cy="19" r="2"/>',
  /** Done: a crayon tick, for a world the child has already been to. */
  tick: '<path d="m5 12.5 4.5 4.5L19 6.5"/>',
  /** The map's "go here next": a fat arrow pointing down at the card. */
  pointer: '<path d="M8.5 2.5h7v8.5H20L12 21 4 11h4.5Z"/>',
  /** The rover's drill: a bit going down into a rock. */
  drill:
    '<path d="M8.5 2.5h7v5h-7z"/><path d="M12 7.5v2M9.5 9.5h5L12 18z"/><path d="M10.4 12.2l3.2 1M11 15l2 .7"/>' +
    '<path d="M4 21.5c2-2 5-2.5 8-2.5s6 .5 8 2.5"/>',
} as const;

export type IconName = keyof typeof ICONS;

/**
 * The markup for one icon. Static strings from the table above — nothing here is ever
 * built from anything a user typed, so assigning it as innerHTML is safe.
 */
export function iconMarkup(name: IconName): string {
  return (
    `<svg class="icon" viewBox="${['spaceMap', 'speaker', 'journal', 'back'].includes(name) ? '0 0 40 36' : '0 0 24 24'}" aria-hidden="true" focusable="false" ` +
    'fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    ICONS[name] +
    '</svg>'
  );
}

export function createIcon(name: IconName): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'icon-slot';
  span.innerHTML = iconMarkup(name);
  return span;
}
