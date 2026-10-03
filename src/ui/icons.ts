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
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  turnArrow: '<path d="M3 9c4 7 15 7 19 0m-6-1 7 0-1 6"/>',
  back: '<path d="m12 7-8 11 8 10M5 18h20c7 0 10 4 10 10"/>',
  spaceMap: '<path d="m9 8-5 5 5 5M5 13h11" stroke="#e2f2f6"/><circle cx="25" cy="20" r="9" fill="#77b9cf" stroke="#c4e6ec"/><path d="m24 12-4 6 6 2-1 8 6-5-1-6Z" fill="#b4cc9d" stroke="none"/><circle cx="34" cy="6" r="4" fill="#f2ce79" stroke="none"/>',
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
