/**
 * The interface's own icons.
 *
 * These replace emoji. Emoji were doing a real job — they are instantly readable to a
 * child who cannot read words — but they are drawn by the operating system, so 🚀 is a
 * different object on an iPad, a Pixel and a Windows laptop, and none of those objects
 * belong to this game. They also cannot take a colour, which is why every button looked
 * like a label with something pasted onto it.
 *
 * All one family: no fills, 2px round-capped strokes on a 24-unit grid, drawn in
 * currentColor so an icon is simply the colour of the text next to it.
 */

const ICONS = {
  rocket:
    '<path d="M12 2.6c2.7 2.4 4.1 5.5 4.1 8.9v3.2l1.8 1.9v3.2l-2.9-1.3-3 1.3-3-1.3-2.9 1.3v-3.2l1.8-1.9v-3.2c0-3.4 1.4-6.5 4.1-8.9Z"/>' +
    '<circle cx="12" cy="10" r="1.7"/>',
  rock: '<path d="M3.6 13.2 7.9 6.1l6.2-2.1 6.3 4.7-1.6 7.3-7.8 2.6Z"/><path d="m7.9 6.1 4.5 5.6 7.9-2.9"/>',
  speaker:
    '<path d="M4 9.4h3.4L11.9 5v14L7.4 14.6H4Z"/>' +
    '<path d="M15.7 9.3a4 4 0 0 1 0 5.4"/><path d="M18.3 6.8a7.6 7.6 0 0 1 0 10.4"/>',
  journal:
    '<path d="M6.6 2.8H18v18.4H6.6A2.6 2.6 0 0 1 4 18.6V5.4a2.6 2.6 0 0 1 2.6-2.6Z"/>' +
    '<path d="M4 18.6A2.6 2.6 0 0 1 6.6 16H18"/>',
  /** The empty mission slot: something is meant to go here. */
  dot: '<circle cx="12" cy="12" r="2.4"/>',
  /** On the photo thumbnail: this opens bigger. Four arrows pushing out from the middle. */
  expand:
    '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/>' +
    '<path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
  /** Turning a world through a day. A sun, because what moves is the light on the ground. */
  sun:
    '<circle cx="12" cy="12" r="4.2"/>' +
    '<path d="M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1"/>' +
    '<path d="m5.4 5.4 1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5"/>',
} as const;

export type IconName = keyof typeof ICONS;

/**
 * The markup for one icon. Static strings from the table above — nothing here is ever
 * built from anything a user typed, so assigning it as innerHTML is safe.
 */
export function iconMarkup(name: IconName): string {
  return (
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" ' +
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
