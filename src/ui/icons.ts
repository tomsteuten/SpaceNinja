/**
 * The interface's own icons.
 *
 * These replace emoji. Emoji were doing a real job — they are instantly readable to a
 * child who cannot read words — but they are drawn by the operating system, so 🚀 is a
 * different object on an iPad, a Pixel and a Windows laptop, and none of those objects
 * belong to this game. They also cannot take a colour, which is why every button looked
 * like a label with something pasted onto it.
 *
 * The child-facing controls (Space map, Listen, Journal and the toy cards) are pictures now,
 * Fluent Emoji flat (src/ui/visitPictures.ts): the owner found these line glyphs amateurish
 * on a phone (11 Nov 2026). What is left here are utility glyphs (close, back, expand) and a
 * few small marks inside panels and toys: round-capped strokes in currentColor.
 */

const ICONS = {
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  back: '<path d="m12 7-8 11 8 10M5 18h20c7 0 10 4 10 10"/>',
  rocket:
    '<path d="M12 2.6c2.7 2.4 4.1 5.5 4.1 8.9v3.2l1.8 1.9v3.2l-2.9-1.3-3 1.3-3-1.3-2.9 1.3v-3.2l1.8-1.9v-3.2c0-3.4 1.4-6.5 4.1-8.9Z"/>' +
    '<circle cx="12" cy="10" r="1.7"/>',
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
  /** Saturn's bath: a tub on little feet, a tap, and a bubble. */
  bath:
    '<path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z"/><path d="M7 19l-1 2.5M17 19l1 2.5"/>' +
    '<path d="M6 12V6a2 2 0 0 1 4 0"/><circle cx="15" cy="7" r="1.6"/><circle cx="18.5" cy="4" r="1"/>',
  /** A looking eye, for the "from Earth" window. */
  eye:
    '<path d="M2.5 12c2.6-4.6 6-6.8 9.5-6.8s6.9 2.2 9.5 6.8c-2.6 4.6-6 6.8-9.5 6.8S5.1 16.6 2.5 12Z"/>' +
    '<circle cx="12" cy="12" r="3"/>',
  /** A little house, for the "from the house" window. */
  house:
    '<path d="M4 11.5 12 4.5l8 7M6 10v9.5h12V10"/><path d="M10 19.5v-5h4v5"/>',
  /** Done: a crayon tick, for a world the child has already been to. */
  tick: '<path d="m5 12.5 4.5 4.5L19 6.5"/>',
  /** The map's "go here next": a fat arrow pointing down at the card. */
  pointer: '<path d="M8.5 2.5h7v8.5H20L12 21 4 11h4.5Z"/>',
} as const;

export type IconName = keyof typeof ICONS;

/**
 * The markup for one icon. Static strings from the table above — nothing here is ever
 * built from anything a user typed, so assigning it as innerHTML is safe.
 */
export function iconMarkup(name: IconName): string {
  return (
    `<svg class="icon" viewBox="${name === 'back' ? '0 0 40 36' : '0 0 24 24'}" aria-hidden="true" focusable="false" ` +
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
